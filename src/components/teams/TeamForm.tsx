import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'

const teamSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  manager_id: z.string().optional().or(z.literal('')),
  is_active: z.boolean().default(true)
})

type TeamFormData = z.infer<typeof teamSchema>

interface TeamFormProps {
  teamId: string | null
  activeYearId: string
  onSuccess: () => void
  onCancel: () => void
}

export function TeamForm({ teamId, activeYearId, onSuccess, onCancel }: TeamFormProps) {
  const { role } = useAuth()
  const isSuperAdmin = role === 'super_admin'
  
  const [managers, setManagers] = useState<any[]>([])
  const [availableMembers, setAvailableMembers] = useState<any[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      is_active: true
    }
  })

  useEffect(() => {
    // Fetch potential managers (role = 3 for Club Manager, 1 for Super Admin)
    const fetchManagers = async () => {
      const { data } = await supabase.from('safe_profiles').select('id, full_name').in('role_id', [1, 3])
      if (data) setManagers(data)
    }
    
    // Fetch active members to assign
    const fetchMembers = async () => {
      const { data } = await supabase.from('safe_profiles').select('id, full_name').eq('status', 'active')
      if (data) setAvailableMembers(data)
    }

    fetchManagers()
    fetchMembers()

    if (teamId) {
      const fetchTeam = async () => {
        setIsLoading(true)
        // Fetch team details
        const { data, error } = await supabase.from('teams').select('*').eq('id', teamId).single()
        if (error) console.error("Fetch error:", error)
        
        // Fetch current team members
        const { data: tmData } = await supabase
          .from('team_members')
          .select('member_id')
          .eq('team_id', teamId)
          .eq('academic_year_id', activeYearId)

        if (data) {
          reset({
            name: data.name,
            description: data.description || '',
            manager_id: data.manager_id || '',
            is_active: data.is_active
          })
        }
        
        if (tmData) {
          setSelectedMembers(tmData.map(tm => tm.member_id))
        }
        setIsLoading(false)
      }
      fetchTeam()
    }
  }, [teamId, reset, activeYearId])

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId) 
        : [...prev, memberId]
    )
  }

  const onSubmit = async (data: TeamFormData) => {
    setIsLoading(true)
    setError(null)
    try {
      const payload: any = {
        name: data.name,
        description: data.description || null,
        is_active: data.is_active
      }

      // Only super admin can change the manager
      if (isSuperAdmin && data.manager_id) {
        payload.manager_id = data.manager_id
      }

      let currentTeamId = teamId

      if (currentTeamId) {
        const { error: updateError } = await supabase.from('teams').update(payload).eq('id', currentTeamId)
        if (updateError) throw updateError
      } else {
        const { data: newTeam, error: insertError } = await supabase.from('teams').insert(payload).select().single()
        if (insertError) throw insertError
        currentTeamId = newTeam.id
      }

      // Handle team_members syncing for the active year
      if (currentTeamId) {
        // Delete removed members
        const { error: delError } = await supabase
          .from('team_members')
          .delete()
          .eq('team_id', currentTeamId)
          .eq('academic_year_id', activeYearId)
          .not('member_id', 'in', `(${selectedMembers.length ? selectedMembers.join(',') : '00000000-0000-0000-0000-000000000000'})`)
        
        if (delError) throw delError

        // Upsert selected members
        const tmPayload = selectedMembers.map(id => ({
          team_id: currentTeamId,
          member_id: id,
          academic_year_id: activeYearId
        }))
        
        if (tmPayload.length > 0) {
          const { error: upsertError } = await supabase
            .from('team_members')
            .upsert(tmPayload, { onConflict: 'team_id, member_id, academic_year_id' })
          
          if (upsertError) throw upsertError
        }
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && <div className="p-3 bg-error/10 text-error rounded text-sm">{error}</div>}
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Team Name *</Label>
          <Input id="name" {...register('name')} disabled={isLoading} />
          {errors.name && <span className="text-xs text-error">{errors.name.message}</span>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea 
            id="description" 
            {...register('description')}
            rows={3} 
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
          />
        </div>

        {isSuperAdmin && (
          <div className="space-y-2">
            <Label htmlFor="manager_id">Team Manager</Label>
            <select 
              id="manager_id" 
              {...register('manager_id')} 
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
            >
              <option value="">Select Manager...</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2 flex items-center gap-2">
          <input type="checkbox" id="is_active" {...register('is_active')} disabled={isLoading} className="h-4 w-4" />
          <Label htmlFor="is_active" className="mb-0">Team is Active</Label>
        </div>

        <div className="space-y-2 border-t border-border pt-4 mt-2">
          <Label>Assign Members</Label>
          <div className="border border-input rounded-md max-h-48 overflow-y-auto p-2 bg-background/50">
            {availableMembers.map(member => (
              <div key={member.id} className="flex items-center gap-2 py-1 px-1 hover:bg-secondary rounded">
                <input 
                  type="checkbox" 
                  id={`member-${member.id}`}
                  checked={selectedMembers.includes(member.id)}
                  onChange={() => toggleMember(member.id)}
                  disabled={isLoading}
                  className="h-4 w-4"
                />
                <label htmlFor={`member-${member.id}`} className="text-sm cursor-pointer flex-1">
                  {member.full_name}
                </label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{selectedMembers.length} members selected</p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : (teamId ? 'Update Team' : 'Create Team')}
        </Button>
      </div>
    </form>
  )
}
