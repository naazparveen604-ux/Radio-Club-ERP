import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { useAuth } from '../../contexts/AuthContext'
import { Badge } from '../ui/Badge'
import { X } from 'lucide-react'
import { format } from 'date-fns'

const schema = z.object({
  title: z.string().min(2, "Title is required"),
  body: z.string().min(10, "Content must be at least 10 characters"),
  target_audience: z.enum(['everyone', 'managers_only', 'specific_team', 'specific_members']),
  target_team_id: z.string().uuid().optional().or(z.literal('')),
  publish_date: z.string().min(1, "Publish date is required"),
  expiry_date: z.string().optional().or(z.literal('')),
  is_active: z.boolean()
})

export function AnnouncementForm({ 
  id, 
  onSuccess, 
  onCancel 
}: { 
  id: string | null
  onSuccess: () => void
  onCancel: () => void 
}) {
  const { user, role } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [teams, setTeams] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  
  const canManage = role === 'super_admin' || role === 'club_manager' || role === 'faculty_coordinator'

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      target_audience: 'everyone',
      is_active: true,
      publish_date: format(new Date(), 'yyyy-MM-dd')
    }
  })
  
  const targetAudience = watch('target_audience')

  useEffect(() => {
    if (!canManage) return
    
    const fetchData = async () => {
      setIsLoading(true)
      
      // Fetch teams
      const { data: tData } = await supabase.from('teams').select('id, name').eq('is_active', true)
      if (tData) setTeams(tData)

      // Fetch possible members
      const { data: mData } = await supabase.from('safe_profiles').select('id, full_name').eq('status', 'active')
      if (mData) setMembers(mData)

      // Fetch details if editing
      if (id) {
        const { data: annData } = await supabase.from('announcements').select('*').eq('id', id).single()
        if (annData) {
          reset({
            title: annData.title,
            body: annData.body,
            target_audience: annData.target_audience,
            target_team_id: annData.target_team_id || '',
            publish_date: annData.publish_date,
            expiry_date: annData.expiry_date || '',
            is_active: annData.is_active
          })
          
          if (annData.target_audience === 'specific_members') {
            const { data: targets } = await supabase.from('announcement_targets').select('member_id').eq('announcement_id', id)
            if (targets) setSelectedMembers(targets.map(t => t.member_id))
          }
        }
      }
      setIsLoading(false)
    }
    fetchData()
  }, [id, reset, canManage])

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) ? prev.filter(uid => uid !== memberId) : [...prev, memberId]
    )
  }

  const onSubmit = async (data: any) => {
    if (!user || !canManage) return
    
    if (data.target_audience === 'specific_team' && !data.target_team_id) {
      setError("Please select a target team")
      return
    }
    
    if (data.target_audience === 'specific_members' && selectedMembers.length === 0) {
      setError("Please select at least one target member")
      return
    }
    
    setIsLoading(true)
    setError(null)

    try {
      const payload = {
        title: data.title,
        body: data.body,
        target_audience: data.target_audience,
        target_team_id: data.target_audience === 'specific_team' ? data.target_team_id : null,
        publish_date: data.publish_date,
        expiry_date: data.expiry_date || null,
        is_active: data.is_active,
        created_by: id ? undefined : user.id
      }

      let savedId = id

      if (id) {
        const { error: tError } = await supabase.from('announcements').update(payload).eq('id', id)
        if (tError) throw tError
      } else {
        const { data: tData, error: tError } = await supabase.from('announcements').insert([payload]).select().single()
        if (tError) throw tError
        savedId = tData.id
      }

      // Sync Targets
      if (savedId) {
        if (data.target_audience === 'specific_members') {
          // Get current
          const { data: current } = await supabase.from('announcement_targets').select('member_id').eq('announcement_id', savedId)
          const currentIds = current?.map(a => a.member_id) || []
          
          const toDelete = currentIds.filter(mid => !selectedMembers.includes(mid))
          const toAdd = selectedMembers.filter(mid => !currentIds.includes(mid))
          
          if (toDelete.length > 0) {
            await supabase.from('announcement_targets').delete().eq('announcement_id', savedId).in('member_id', toDelete)
          }
          if (toAdd.length > 0) {
            await supabase.from('announcement_targets').insert(toAdd.map(mid => ({ announcement_id: savedId, member_id: mid })))
          }
        } else {
          // Clear all targets if audience changed away from specific_members
          await supabase.from('announcement_targets').delete().eq('announcement_id', savedId)
        }
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!canManage) return <div className="p-4 text-error">Unauthorized</div>

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && <div className="p-3 text-sm bg-error/10 text-error rounded">{error}</div>}
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label>Title *</Label>
          <Input {...register('title')} />
          {errors.title && <p className="text-xs text-error">{errors.title.message as string}</p>}
        </div>
        
        <div className="space-y-2 col-span-2">
          <Label>Content *</Label>
          <textarea 
            {...register('body')} 
            className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {errors.body && <p className="text-xs text-error">{errors.body.message as string}</p>}
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label>Audience *</Label>
          <select 
            {...register('target_audience')} 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value="everyone">Everyone</option>
            <option value="managers_only">Managers & Admins</option>
            <option value="specific_team">Specific Team</option>
            <option value="specific_members">Specific Members</option>
          </select>
        </div>

        {targetAudience === 'specific_team' && (
          <div className="space-y-2 col-span-2 sm:col-span-1">
            <Label>Target Team *</Label>
            <select 
              {...register('target_team_id')} 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">Select Team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        
        {targetAudience === 'specific_members' && (
          <div className="space-y-2 col-span-2">
            <Label>Target Members *</Label>
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedMembers.map(mid => {
                const mem = members.find(m => m.id === mid)
                return mem ? (
                  <Badge key={mid} variant="secondary" className="gap-1 pr-1">
                    {mem.full_name}
                    <button type="button" onClick={() => toggleMember(mid)} className="hover:bg-muted rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ) : null
              })}
              {selectedMembers.length === 0 && <span className="text-sm text-muted-foreground">No members selected</span>}
            </div>
            
            <select 
              onChange={(e) => {
                if (e.target.value) toggleMember(e.target.value)
                e.target.value = ""
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">+ Add Member</option>
              {members.filter(m => !selectedMembers.includes(m.id)).map(m => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label>Publish Date *</Label>
          <Input type="date" {...register('publish_date')} />
        </div>
        
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label>Expiry Date (Optional)</Label>
          <Input type="date" {...register('expiry_date')} />
        </div>
        
        <div className="space-y-2 col-span-2 flex items-center gap-2 mt-2">
          <input type="checkbox" id="is_active" {...register('is_active')} className="h-4 w-4" />
          <Label htmlFor="is_active" className="cursor-pointer">Active / Published</Label>
        </div>
      </div>
      
      <div className="flex justify-end gap-2 pt-4 border-t border-border mt-6">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : (id ? 'Update Announcement' : 'Publish Announcement')}</Button>
      </div>
    </form>
  )
}
