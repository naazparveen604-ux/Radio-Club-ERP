import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Calendar as CalendarIcon, Edit2, Paperclip, CheckCircle2, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { format, isPast, isToday } from 'date-fns'

export function TaskDetails({ 
  taskId, 
  onClose,
  onUpdated,
  onEdit
}: { 
  taskId: string
  onClose: () => void
  onUpdated: () => void
  onEdit: () => void
}) {
  const { user, role } = useAuth()
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [updatingProgress, setUpdatingProgress] = useState<string | null>(null)
  
  const canManage = role === 'super_admin' || role === 'club_manager'

  const { data: task, isLoading, refetch } = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          team:team_id(name),
          event:event_id(name),
          creator:created_by(full_name),
          task_assignees(id, member_id, individual_progress, safe_profiles(full_name))
        `)
        .eq('id', taskId)
        .single()
      
      if (error) throw error
      return data
    }
  })

  // Quick action for overall status
  const updateOverallStatus = async (newStatus: string) => {
    if (!canManage) return
    setUpdatingStatus(true)
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    setUpdatingStatus(false)
    refetch()
    onUpdated()
  }

  // Member updates their own progress
  const updateIndividualProgress = async (assigneeId: string, progress: number) => {
    setUpdatingProgress(assigneeId)
    await supabase.from('task_assignees').update({ individual_progress: progress }).eq('id', assigneeId)
    setUpdatingProgress(null)
    refetch()
    onUpdated()
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading task details...</div>
  if (!task) return <div className="p-8 text-center text-error">Task not found</div>

  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== 'completed'
  const isAssigned = task.task_assignees?.some((a: any) => a.member_id === user?.id)
  const myAssignment = task.task_assignees?.find((a: any) => a.member_id === user?.id)

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={
              task.priority === 'urgent' ? 'border-error text-error' :
              task.priority === 'high' ? 'border-warning text-warning' :
              task.priority === 'medium' ? 'border-info text-info' : 'border-success text-success'
            }>
              {task.priority.toUpperCase()}
            </Badge>
            <Badge className={
              task.status === 'completed' ? 'bg-success hover:bg-success' :
              task.status === 'in_progress' ? 'bg-info hover:bg-info text-info-foreground' :
              task.status === 'review' ? 'bg-warning hover:bg-warning text-warning-foreground' : ''
            }>
              {task.status.replace('_', ' ').toUpperCase()}
            </Badge>
            {isOverdue && <Badge variant="destructive">OVERDUE</Badge>}
          </div>
          <h2 className="text-2xl font-bold">{task.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button variant="outline" size="sm" onClick={onEdit} className="gap-1">
              <Edit2 className="h-4 w-4" /> Edit
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Description</h3>
              <div className="text-sm whitespace-pre-wrap bg-muted/30 p-4 rounded-md border border-border">
                {task.description || 'No description provided.'}
              </div>
            </div>

            {/* Individual Progress Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assignee Progress</h3>
              <div className="space-y-3">
                {task.task_assignees?.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No members assigned to this task.</p>
                )}
                {task.task_assignees?.map((assignee: any) => {
                  const isMe = assignee.member_id === user?.id
                  const canEditProgress = isMe || canManage
                  return (
                    <div key={assignee.id} className="bg-surface border border-border p-3 rounded-md flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {assignee.safe_profiles?.full_name} {isMe && '(You)'}
                          </span>
                        </div>
                        <span className="text-sm font-bold">{assignee.individual_progress}%</span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${assignee.individual_progress === 100 ? 'bg-success' : 'bg-primary'}`} 
                          style={{ width: `${assignee.individual_progress}%` }} 
                        />
                      </div>
                      
                      {/* Edit Progress Control */}
                      {canEditProgress && (
                        <div className="flex items-center gap-2 pt-2 mt-2 border-t border-border/50">
                          <span className="text-xs text-muted-foreground">Update Progress:</span>
                          <input 
                            type="range" 
                            min="0" max="100" step="5"
                            value={assignee.individual_progress}
                            disabled={updatingProgress === assignee.id}
                            onChange={(e) => updateIndividualProgress(assignee.id, parseInt(e.target.value))}
                            className="flex-1 h-1.5"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* Attachments Section Placeholder for Future Implementation */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Attachments
              </h3>
              <div className="bg-muted/30 border border-dashed border-border rounded-md p-6 text-center text-sm text-muted-foreground">
                Attachment handling will securely connect to the task-attachments bucket.
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-muted/20 border border-border p-4 rounded-md space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Details</h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-1">Due Date</span>
                  <div className="flex items-center gap-1 font-medium">
                    <CalendarIcon className="h-4 w-4" />
                    {task.due_date ? format(new Date(task.due_date), 'MMMM d, yyyy') : 'No due date'}
                  </div>
                </div>
                
                {task.event && (
                  <div>
                    <span className="text-muted-foreground block mb-1">Event</span>
                    <span className="font-medium">{task.event.name}</span>
                  </div>
                )}
                
                <div>
                  <span className="text-muted-foreground block mb-1">Created By</span>
                  <span className="font-medium">{task.creator?.full_name || 'Unknown'}</span>
                </div>
              </div>
            </div>
            
            {/* Overall Status Control (Managers Only) */}
            {canManage && (
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-md space-y-3">
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Overall Status Control</h3>
                <p className="text-xs text-muted-foreground">As a manager, you have authoritative control over the final task status, independent of member progress.</p>
                <select 
                  className="w-full h-9 text-sm rounded-md border border-input bg-background px-3"
                  value={task.status}
                  onChange={(e) => updateOverallStatus(e.target.value)}
                  disabled={updatingStatus}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="submitted">Submitted</option>
                  <option value="review">Under Review</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            )}
            
            {/* Quick Actions for Assignees */}
            {isAssigned && task.status !== 'completed' && !canManage && (
              <div className="bg-success/10 border border-success/20 p-4 rounded-md space-y-3">
                <h3 className="text-sm font-semibold text-success uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> My Actions
                </h3>
                {myAssignment?.individual_progress === 100 ? (
                  <p className="text-xs text-muted-foreground">You have marked your portion as 100%. The manager will update the overall task status.</p>
                ) : (
                  <Button 
                    className="w-full" 
                    variant="default"
                    onClick={() => updateIndividualProgress(myAssignment.id, 100)}
                  >
                    Mark My Part 100%
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
