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

const programSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  category_id: z.string().uuid().optional().or(z.literal('')),
  date: z.string().min(1, "Date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  location: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'ongoing', 'completed', 'cancelled']),
  host_id: z.string().uuid().optional().or(z.literal('')),
})

export function ProgramForm({ 
  programId, 
  activeYearId,
  onSuccess, 
  onCancel 
}: { 
  programId: string | null
  activeYearId: string
  onSuccess: () => void
  onCancel: () => void 
}) {
  const { user, role } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [categories, setCategories] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [assignedMembers, setAssignedMembers] = useState<string[]>([])

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(programSchema),
    defaultValues: {
      status: 'scheduled',
      date: new Date().toISOString().split('T')[0],
      start_time: '18:00',
      end_time: '19:00'
    }
  })

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      
      // Fetch categories
      const { data: catData } = await supabase.from('program_categories').select('*').eq('is_active', true)
      if (catData) setCategories(catData)

      // Fetch possible members
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

      // Fetch program details if editing
      if (programId) {
        const { data: pData } = await supabase.from('programs').select('*').eq('id', programId).single()
        if (pData) {
          reset({
            name: pData.name,
            description: pData.description || '',
            category_id: pData.category_id || '',
            date: pData.date,
            start_time: pData.start_time.substring(0, 5),
            end_time: pData.end_time.substring(0, 5),
            location: pData.location || '',
            status: pData.status,
            host_id: pData.host_id || ''
          })
        }
        
        // Fetch assignments
        const { data: assignData } = await supabase.from('program_assignments').select('member_id').eq('program_id', programId)
        if (assignData) {
          setAssignedMembers(assignData.map(a => a.member_id))
        }
      }
      setIsLoading(false)
    }
    fetchData()
  }, [programId, activeYearId, reset, role, user])

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
      // 1. Upsert Program
      const payload = {
        name: data.name,
        description: data.description || null,
        category_id: data.category_id || null,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        location: data.location || null,
        status: data.status,
        host_id: data.host_id || null,
        academic_year_id: activeYearId,
      }

      let savedProgramId = programId

      if (programId) {
        const { error: pError } = await supabase.from('programs').update(payload).eq('id', programId)
        if (pError) throw pError
      } else {
        const { data: pData, error: pError } = await supabase.from('programs').insert([{ ...payload, manager_id: user.id }]).select().single()
        if (pError) throw pError
        savedProgramId = pData.id
      }

      // 2. Sync Assignments
      if (savedProgramId) {
        // Clear existing for this year
        await supabase.from('program_assignments').delete().eq('program_id', savedProgramId)
        
        // Insert new
        if (assignedMembers.length > 0) {
          const assigns = assignedMembers.map(mId => ({
            program_id: savedProgramId,
            member_id: mId
          }))
          const { error: aError } = await supabase.from('program_assignments').insert(assigns)
          if (aError) throw aError
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
          <Label>Program Name *</Label>
          <Input {...register('name')} />
          {errors.name && <p className="text-xs text-error">{errors.name.message as string}</p>}
        </div>
        
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label>Category</Label>
          <select 
            {...register('category_id')} 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Uncategorized</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label>Status</Label>
          <select 
            {...register('status')} 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label>Date *</Label>
          <Input type="date" {...register('date')} />
        </div>

        <div className="space-y-2 col-span-1">
          <Label>Start Time *</Label>
          <Input type="time" {...register('start_time')} />
        </div>

        <div className="space-y-2 col-span-1">
          <Label>End Time *</Label>
          <Input type="time" {...register('end_time')} />
        </div>

        <div className="space-y-2 col-span-2">
          <Label>Location</Label>
          <Input {...register('location')} placeholder="Studio A, Link..." />
        </div>

        <div className="space-y-2 col-span-2">
          <Label>Host / Presenter</Label>
          <select 
            {...register('host_id')} 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select Host (Optional)</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </div>

        <div className="space-y-2 col-span-2">
          <Label>Description</Label>
          <textarea 
            {...register('description')} 
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        
        {/* Assignments */}
        <div className="space-y-2 col-span-2 border-t border-border pt-4 mt-2">
          <Label>Assigned Members</Label>
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
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">+ Add Member to Program</option>
            {members.filter(m => !assignedMembers.includes(m.id)).map(m => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Program'}</Button>
      </div>
    </form>
  )
}
