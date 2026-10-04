import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, CheckCircle2, XCircle, Clock, Plane, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'

export function Attendance() {
  const { user, role } = useAuth()
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)

  // Roles map
  const canManage = role === 'super_admin' || role === 'club_manager'

  // Fetch active academic year
  const { data: activeYear } = useQuery({
    queryKey: ['activeYear'],
    queryFn: async () => {
      const { data, error } = await supabase.from('academic_years').select('id, label').eq('is_active', true).single()
      if (error && error.code !== 'PGRST116') throw error
      return data
    }
  })

  // Fetch members to display (managers see team members, admins/FC see all, members see themselves)
  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ['attendance_members', activeYear?.id, role, user?.id],
    enabled: !!activeYear,
    queryFn: async () => {
      if (role === 'super_admin' || role === 'faculty_coordinator') {
        const { data } = await supabase.from('safe_profiles').select('id, full_name, student_id, academic_departments(name)').eq('status', 'active').order('full_name')
        return data || []
      } else if (role === 'club_manager') {
        // Find team manager manages
        const { data: teamData } = await supabase.from('teams').select('id').eq('manager_id', user!.id).single()
        if (!teamData) return []
        
        // Find team members
        const { data } = await supabase.from('team_members')
          .select('member_id, safe_profiles(id, full_name, student_id, academic_departments(name))')
          .eq('team_id', teamData.id)
          .eq('academic_year_id', activeYear!.id)
        
        return data?.map(d => d.safe_profiles) || []
      } else {
        // Club member
        const { data } = await supabase.from('safe_profiles').select('id, full_name, student_id, academic_departments(name)').eq('id', user!.id)
        return data || []
      }
    }
  })

  // Fetch attendance records for the selected date
  const { data: attendanceRecords, isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance', selectedDate, activeYear?.id],
    enabled: !!activeYear && !!selectedDate,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', selectedDate)
        .eq('academic_year_id', activeYear!.id)
      
      if (error) throw error
      
      // Convert to map for easy lookup
      const recordMap: Record<string, any> = {}
      data?.forEach(record => {
        recordMap[record.member_id] = record
      })
      return recordMap
    }
  })

  // Local state for edits before saving
  const [localAttendance, setLocalAttendance] = useState<Record<string, string>>({})

  // Update local state when records change
  // Effect to sync local state is tricky, better to just merge at render and allow local overrides
  const getStatus = (memberId: string) => {
    return localAttendance[memberId] || attendanceRecords?.[memberId]?.status || null
  }

  const handleStatusChange = (memberId: string, status: string) => {
    if (!canManage) return
    setLocalAttendance(prev => ({ ...prev, [memberId]: status }))
    setMessage(null)
  }

  const handleSave = async () => {
    if (!activeYear || !user) return
    
    setIsSaving(true)
    setMessage(null)
    
    try {
      const upsertPayload = Object.entries(localAttendance).map(([memberId, status]) => {
        const existingRecord = attendanceRecords?.[memberId]
        return {
          id: existingRecord?.id, // include ID if updating
          member_id: memberId,
          academic_year_id: activeYear.id,
          date: selectedDate,
          status,
          marked_by: user.id
        }
      })
      
      if (upsertPayload.length === 0) {
        setIsSaving(false)
        return
      }

      // Upsert records. Supabase will match on (member_id, date) if we specified the UNIQUE constraint in the DB,
      // but to be safe, providing the 'id' for existing records ensures update.
      // Wait, upsert on conflict: member_id, date doesn't work out of the box if we pass id unless id is the conflict target.
      // Since member_id and date have a UNIQUE constraint, we can specify onConflict.
      const { error } = await supabase
        .from('attendance')
        .upsert(upsertPayload, { onConflict: 'member_id, date' })
      
      if (error) throw error

      setMessage({ type: 'success', text: 'Attendance saved successfully.' })
      setLocalAttendance({}) // Clear local changes
      queryClient.invalidateQueries({ queryKey: ['attendance', selectedDate] })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save attendance.' })
    } finally {
      setIsSaving(false)
    }
  }

  const isLoading = loadingMembers || loadingAttendance

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Attendance Management</h2>
        <p className="text-muted-foreground">Record and view daily attendance for {activeYear?.label || 'the current year'}.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              <Input 
                type="date" 
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value)
                  setLocalAttendance({})
                  setMessage(null)
                }}
                className="w-40"
              />
            </div>
            {isLoading && <span className="text-sm text-muted-foreground animate-pulse">Loading...</span>}
          </div>
          
          {canManage && Object.keys(localAttendance).length > 0 && (
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-6">
          {message && (
            <div className={`p-3 mb-4 text-sm rounded ${message.type === 'success' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
              {message.text}
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Member</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Current Status</TableHead>
                  {canManage && <TableHead className="text-right">Mark Attendance</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!members || members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 4 : 3} className="text-center h-24 text-muted-foreground">
                      No members found for this view.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member: any) => {
                    const status = getStatus(member.id)
                    const isLeave = status === 'leave'
                    const hasLocalChange = !!localAttendance[member.id]
                    
                    return (
                      <TableRow key={member.id} className={hasLocalChange ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{member.full_name}</span>
                            <span className="text-xs text-muted-foreground">{member.student_id || 'No ID'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {member.academic_departments?.name || '—'}
                        </TableCell>
                        <TableCell>
                          {!status ? (
                            <Badge variant="outline" className="text-muted-foreground">Not Marked</Badge>
                          ) : status === 'present' ? (
                            <Badge variant="default" className="bg-success text-success-foreground hover:bg-success/90">Present</Badge>
                          ) : status === 'absent' ? (
                            <Badge variant="destructive">Absent</Badge>
                          ) : status === 'late' ? (
                            <Badge variant="secondary" className="bg-warning text-warning-foreground hover:bg-warning/90">Late</Badge>
                          ) : (
                            <Badge variant="outline" className="border-info text-info">Leave (Approved)</Badge>
                          )}
                        </TableCell>
                        
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                variant={status === 'present' ? 'default' : 'outline'} 
                                size="sm"
                                className={`px-2 ${status === 'present' && !hasLocalChange ? 'bg-success hover:bg-success/90' : ''}`}
                                onClick={() => handleStatusChange(member.id, 'present')}
                                title="Mark Present"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant={status === 'absent' ? 'default' : 'outline'} 
                                size="sm"
                                className={`px-2 ${status === 'absent' && !hasLocalChange ? 'bg-destructive hover:bg-destructive/90' : ''}`}
                                onClick={() => handleStatusChange(member.id, 'absent')}
                                title="Mark Absent"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant={status === 'late' ? 'default' : 'outline'} 
                                size="sm"
                                className={`px-2 ${status === 'late' && !hasLocalChange ? 'bg-warning text-warning-foreground hover:bg-warning/90' : ''}`}
                                onClick={() => handleStatusChange(member.id, 'late')}
                                title="Mark Late"
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                              
                              {/* If leave is approved, they shouldn't just toggle it normally here, but we'll show it if it is leave. We disable marking leave directly since that's handled via Leave Requests module according to requirements. */}
                              {isLeave && (
                                <Button variant="outline" size="sm" className="px-2 border-info text-info cursor-not-allowed" disabled title="On Approved Leave">
                                  <Plane className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
