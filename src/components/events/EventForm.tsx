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

const eventSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  time: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['planned', 'upcoming', 'ongoing', 'completed', 'cancelled']),
  organizer_id: z.string().uuid().optional().or(z.literal('')),
})

export function EventForm({ 
  eventId, 
  activeYearId,
  onSuccess, 
  onCancel 
}: { 
  eventId: string | null
  activeYearId: string
  onSuccess: () => void
  onCancel: () => void 
}) {
  const { user, role } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [members, setMembers] = useState<any[]>([])
  const [participants, setParticipants] = useState<string[]>([])

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      status: 'planned',
      date: new Date().toISOString().split('T')[0],
      time: '12:00',
    }
  })

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      
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

      // Fetch event details if editing
      if (eventId) {
        const { data: eData } = await supabase.from('events').select('*').eq('id', eventId).single()
        if (eData) {
          reset({
            name: eData.name,
            description: eData.description || '',
            date: eData.date,
            time: eData.time ? eData.time.substring(0, 5) : '',
            location: eData.location || '',
            status: eData.status,
            organizer_id: eData.organizer_id || ''
          })
        }
        
        // Fetch participants
        const { data: partData } = await supabase.from('event_participants').select('member_id').eq('event_id', eventId)
        if (partData) {
          setParticipants(partData.map(p => p.member_id))
        }
      }
      setIsLoading(false)
    }
    fetchData()
  }, [eventId, activeYearId, reset, role, user])

  const toggleParticipant = (memberId: string) => {
    setParticipants(prev => 
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    )
  }

  const onSubmit = async (data: any) => {
    if (!user) return
    setIsLoading(true)
    setError(null)

    try {
      // 1. Upsert Event
      const payload = {
        name: data.name,
        description: data.description || null,
        date: data.date,
        time: data.time || null,
        location: data.location || null,
        status: data.status,
        organizer_id: data.organizer_id || null,
        academic_year_id: activeYearId,
      }

      let savedEventId = eventId

      if (eventId) {
        const { error: eError } = await supabase.from('events').update(payload).eq('id', eventId)
        if (eError) throw eError
      } else {
        const { data: eData, error: eError } = await supabase.from('events').insert([{ ...payload, manager_id: user.id }]).select().single()
        if (eError) throw eError
        savedEventId = eData.id
      }

      // 2. Sync Participants
      if (savedEventId) {
        // Clear existing for this event
        await supabase.from('event_participants').delete().eq('event_id', savedEventId)
        
        // Insert new
        if (participants.length > 0) {
          const assigns = participants.map(mId => ({
            event_id: savedEventId,
            member_id: mId
          }))
          const { error: pError } = await supabase.from('event_participants').insert(assigns)
          if (pError) throw pError
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
          <Label>Event Name *</Label>
          <Input {...register('name')} />
          {errors.name && <p className="text-xs text-error">{errors.name.message as string}</p>}
        </div>
        
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label>Status</Label>
          <select 
            {...register('status')} 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="planned">Planned</option>
            <option value="upcoming">Upcoming</option>
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
          <Label>Time</Label>
          <Input type="time" {...register('time')} />
        </div>

        <div className="space-y-2 col-span-1">
          <Label>Location</Label>
          <Input {...register('location')} />
        </div>

        <div className="space-y-2 col-span-2">
          <Label>Organizer</Label>
          <select 
            {...register('organizer_id')} 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select Organizer (Optional)</option>
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
        
        {/* Participants */}
        <div className="space-y-2 col-span-2 border-t border-border pt-4 mt-2">
          <Label>Participants</Label>
          <div className="flex flex-wrap gap-2 mb-3">
            {participants.map(mId => {
              const mem = members.find(m => m.id === mId)
              return mem ? (
                <Badge key={mId} variant="secondary" className="gap-1 pr-1">
                  {mem.full_name}
                  <button type="button" onClick={() => toggleParticipant(mId)} className="hover:bg-muted rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null
            })}
            {participants.length === 0 && <span className="text-sm text-muted-foreground">No participants selected</span>}
          </div>
          
          <select 
            onChange={(e) => {
              if (e.target.value) toggleParticipant(e.target.value)
              e.target.value = ""
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">+ Add Participant</option>
            {members.filter(m => !participants.includes(m.id)).map(m => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Event'}</Button>
      </div>
    </form>
  )
}
