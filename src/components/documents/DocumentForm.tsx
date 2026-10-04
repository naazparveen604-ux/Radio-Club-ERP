import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { useAuth } from '../../contexts/AuthContext'
import { UploadCloud } from 'lucide-react'

const schema = z.object({
  category: z.string().min(2, "Category is required"),
  access_level: z.enum(['everyone', 'managers_plus', 'admin_only', 'specific_team']),
  access_team_id: z.string().uuid().optional().or(z.literal('')),
})

export function DocumentForm({ 
  onSuccess, 
  onCancel 
}: { 
  onSuccess: () => void
  onCancel: () => void 
}) {
  const { user, role } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)

  const canManage = role === 'super_admin' || role === 'club_manager' || role === 'faculty_coordinator'

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'General',
      access_level: 'everyone',
    }
  })
  
  const accessLevel = watch('access_level')

  useEffect(() => {
    if (!canManage) return
    const fetchTeams = async () => {
      const { data } = await supabase.from('teams').select('id, name').eq('is_active', true)
      if (data) setTeams(data)
    }
    fetchTeams()
  }, [canManage])

  const onSubmit = async (data: any) => {
    if (!user || !canManage) return
    if (!file) {
      setError("Please select a file to upload")
      return
    }
    if (data.access_level === 'specific_team' && !data.access_team_id) {
      setError("Please select a team for team-specific access")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `uploads/${fileName}`

      // Mock progress since standard supabase client doesn't expose progress event natively for small files easily
      setUploadProgress(30)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError
      
      setUploadProgress(70)

      // 2. Insert metadata into DB
      const { error: dbError } = await supabase.from('documents').insert([{
        file_name: file.name,
        storage_path: uploadData.path,
        category: data.category,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        uploaded_by: user.id,
        access_level: data.access_level,
        access_team_id: data.access_level === 'specific_team' ? data.access_team_id : null
      }])

      if (dbError) {
        // Rollback storage if DB fails
        await supabase.storage.from('documents').remove([uploadData.path])
        throw dbError
      }
      
      setUploadProgress(100)
      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
      setUploadProgress(0)
    }
  }

  if (!canManage) return <div className="p-4 text-error">Unauthorized</div>

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && <div className="p-3 text-sm bg-error/10 text-error rounded">{error}</div>}
      
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>Select File *</Label>
          <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center bg-muted/20">
             <input 
               type="file" 
               id="file-upload" 
               className="hidden" 
               onChange={(e) => setFile(e.target.files?.[0] || null)}
             />
             <Label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <UploadCloud className="h-8 w-8 text-primary mb-2" />
                <span className="font-medium text-sm hover:underline">{file ? file.name : "Click to select a file"}</span>
                {file && <span className="text-xs text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</span>}
             </Label>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Category *</Label>
          <Input {...register('category')} placeholder="e.g. Policies, Guides, Financials" />
          {errors.category && <p className="text-xs text-error">{errors.category.message as string}</p>}
        </div>

        <div className="space-y-2">
          <Label>Access Level *</Label>
          <select 
            {...register('access_level')} 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value="everyone">Everyone</option>
            <option value="managers_plus">Managers & Admins Only</option>
            <option value="admin_only">Admins Only</option>
            <option value="specific_team">Specific Team</option>
          </select>
        </div>

        {accessLevel === 'specific_team' && (
          <div className="space-y-2">
            <Label>Target Team *</Label>
            <select 
              {...register('access_team_id')} 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">Select Team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
      </div>
      
      {isLoading && (
        <div className="w-full h-1.5 bg-muted rounded-full mt-4 overflow-hidden">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}
      
      <div className="flex justify-end gap-2 pt-4 border-t border-border mt-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>{isLoading ? 'Uploading...' : 'Upload File'}</Button>
      </div>
    </form>
  )
}
