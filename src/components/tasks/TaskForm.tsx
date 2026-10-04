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

const taskSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  event_id: z.string().uuid().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['pending', 'in_progress', 'submitted', 'review', 'completed']),
  due_date: z.string().optional().or(z.literal('')),
})

export function TaskForm({ 
  taskId, 
  activeYearId,
  onSuccess, 
  onCancel 
}: { 
  taskId: string | null
  activeYearId: string
  onSuccess: () => void
  onCancel: () => void 
}) {
  const { user, role } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [events, setEvents] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [assignedMembers, setAssignedMembers] = useState<string[]>([])
  const [existingProgressMap, setExistingProgressMap] = useState<Record<string, number>>({})

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      priority: 'medium',
      status: 'pending',
    }
  })

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      
      // Fetch events for association
      const { data: eData } = await supabase.from('events').select('id, name').eq('academic_year_id', activeYearId)
      if (eData) setEvents(eData)

      // Fetch possible members (based on manager's scope or super admin)
      if (role === 'super_admin' || role === 'faculty_coordinator') {
        const { data: memData } = await supabase.from('safe_profiles').select('id, full_name').eq('status', 'active')
        if (memData) setMembers(memData)
      } else if (role === 'club_manager') {
        const { data: teamData } = await supabase.from('teams').select('id').eq('manager_id', user!.id).single()
        if (teamData) {
          const { data: memData } = await supabase.from('team_members')
            .select('member_id, safe_profiles(id, full_name)')
            .eq('team_id', teamData.id)
            .eq('academic_year_id', activeYearId)
          if (memData) setMembers(memData.map(m => m.safe_profiles))
        }
      }

      // Fetch task details if editing
      if (taskId) {
        const { data: tData } = await supabase.from('tasks').select('*').eq('id', taskId).single()
        if (tData) {
          reset({
            title: tData.title,
            description: tData.description || '',
            event_id: tData.event_id || '',
            priority: tData.priority,
            status: tData.status,
            due_date: tData.due_date || ''
          })
        }
        
        // Fetch assignments
        const { data: assignData } = await supabase.from('task_assignees').select('member_id, individual_progress').eq('task_id', taskId)
        if (assignData) {
          setAssignedMembers(assignData.map(a => a.member_id))
          const pMap: Record<string, number> = {}
          assignData.forEach(a => pMap[a.member_id] = a.individual_progress)
          setExistingProgressMap(pMap)
        }
      }
      setIsLoading(false)
    }
    fetchData()
  }, [taskId, activeYearId, reset, role, user])

  const toggleMember = (memberId: string) => {
    setAssignedMembers(prev => 
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    )
  }

  const onSubmit = async (data: any) => {
    if (!user) return
    setIsLoading(true)
    setError(null)

    try {
      // 1. Upsert Task
      const payload = {
        title: data.title,
        description: data.description || null,
        event_id: data.event_id || null,
        priority: data.priority,
        status: data.status,
        due_date: data.due_date || null,
        academic_year_id: activeYearId,
      }

      let savedTaskId = taskId

      if (taskId) {
        const { error: tError } = await supabase.from('tasks').update(payload).eq('id', taskId)
        if (tError) throw tError
      } else {
        // Find team_id if manager
        let teamId = null
        if (role === 'club_manager') {
          const { data: teamData } = await supabase.from('teams').select('id').eq('manager_id', user.id).single()
          if (teamData) teamId = teamData.id
        }

        const { data: tData, error: tError } = await supabase.from('tasks').insert([{ 
          ...payload, 
          created_by: user.id,
          team_id: teamId
        }]).select().single()
        if (tError) throw tError
        savedTaskId = tData.id
      }

      // 2. Sync Assignments safely (preserving progress)
      if (savedTaskId) {
        // Fetch current assignments to see what to delete and what to add
        const { data: currentAssigns } = await supabase.from('task_assignees').select('member_id').eq('task_id', savedTaskId)
        const currentMemberIds = currentAssigns?.map(a => a.member_id) || []
        
        const toDelete = currentMemberIds.filter(id => !assignedMembers.includes(id))
        const toAdd = assignedMembers.filter(id => !currentMemberIds.includes(id))
        
        if (toDelete.length > 0) {
          const { error: delError } = await supabase.from('task_assignees').delete().eq('task_id', savedTaskId).in('member_id', toDelete)
          if (delError) throw delError
        }
        
        if (toAdd.length > 0) {
          const newAssigns = toAdd.map(mId => ({
            task_id: savedTaskId,
            member_id: mId,
            individual_progress: existingProgressMap[mId] || 0 // preserve if it was ever set, or default 0
          }))
          const { error: addError } = await supabase.from('task_assignees').insert(newAssigns)
          if (addError) throw addError
        }
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && <div className="p-3 text-sm bg-error/10 text-error rounded">{error}</div>}
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label>Task Title *</Label>
          <Input {...register('title')} />
          {errors.title && <p className="text-xs text-error">{errors.title.message as string}</p>}
        </div>
        
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label>Priority</Label>
          <select 
            {...register('priority')} 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label>Overall Status</Label>
          <select 
            {...register('status')} 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="submitted">Submitted</option>
            <option value="review">Review</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label>Due Date</Label>
          <Input type="date" {...register('due_date')} />
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label>Related Event</Label>
          <select 
            {...register('event_id')} 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value="">None</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        <div className="space-y-2 col-span-2">
          <Label>Description</Label>
          <textarea 
            {...register('description')} 
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        
        {/* Assignees */}
        <div className="space-y-2 col-span-2 border-t border-border pt-4 mt-2">
          <Label>Assign Members</Label>
          <div className="flex flex-wrap gap-2 mb-3">
            {assignedMembers.map(mId => {
              const mem = members.find(m => m.id === mId)
              return mem ? (
                <Badge key={mId} variant="secondary" className="gap-1 pr-1">
                  {mem.full_name}
                  <button type="button" onClick={() => toggleMember(mId)} className="hover:bg-muted rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null
            })}
            {assignedMembers.length === 0 && <span className="text-sm text-muted-foreground">No members assigned</span>}
          </div>
          
          <select 
            onChange={(e) => {
              if (e.target.value) toggleMember(e.target.value)
              e.target.value = ""
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value="">+ Assign Member</option>
            {members.filter(m => !assignedMembers.includes(m.id)).map(m => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Task'}</Button>
      </div>
    </form>
  )
}
