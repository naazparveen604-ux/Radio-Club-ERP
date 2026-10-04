import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

export function CategoryForm({ onSuccess }: { onSuccess: () => void }) {
  const [categories, setCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setIsLoading(true)
    const { data } = await supabase.from('program_categories').select('*').order('name')
    if (data) setCategories(data)
    setIsLoading(false)
  }

  const handleAdd = async () => {
    if (!newCategory.trim()) return
    setIsLoading(true)
    setError(null)
    
    try {
      const { error: err } = await supabase.from('program_categories').insert([{ name: newCategory.trim(), is_active: true }])
      if (err) throw err
      setNewCategory('')
      fetchCategories()
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }

  const handleToggle = async (id: string, current: boolean) => {
    setIsLoading(true)
    await supabase.from('program_categories').update({ is_active: !current }).eq('id', id)
    fetchCategories()
  }

  return (
    <div className="space-y-4">
      {error && <div className="p-3 text-sm bg-error/10 text-error rounded">{error}</div>}
      
      <div className="flex gap-2">
        <Input 
          placeholder="New Category Name" 
          value={newCategory} 
          onChange={(e) => setNewCategory(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button onClick={handleAdd} disabled={isLoading || !newCategory.trim()}>Add</Button>
      </div>

      <div className="border border-border rounded-md max-h-60 overflow-y-auto">
        {categories.map(c => (
          <div key={c.id} className="flex items-center justify-between p-3 border-b border-border last:border-0">
            <span className={c.is_active ? '' : 'text-muted-foreground line-through'}>{c.name}</span>
            <Button 
              variant={c.is_active ? 'outline' : 'secondary'} 
              size="sm" 
              onClick={() => handleToggle(c.id, c.is_active)}
              disabled={isLoading}
            >
              {c.is_active ? 'Disable' : 'Enable'}
            </Button>
          </div>
        ))}
        {categories.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">No categories defined</div>}
      </div>
      
      <div className="flex justify-end pt-4">
        <Button type="button" onClick={onSuccess}>Done</Button>
      </div>
    </div>
  )
}
