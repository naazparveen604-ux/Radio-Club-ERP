import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Calendar as CalendarIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import { Dialog, DialogContent } from '@radix-ui/react-dialog'
import { TaskForm } from '../components/tasks/TaskForm'
import { TaskDetails } from '../components/tasks/TaskDetails'
import { format, isPast, isToday } from 'date-fns'

export function Tasks() {
  const { role } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const canManage = role === 'super_admin' || role === 'club_manager'

  const { data: activeYear } = useQuery({
    queryKey: ['activeYear'],
    queryFn: async () => {
      const { data, error } = await supabase.from('academic_years').select('id, label').eq('is_active', true).single()
      if (error && error.code !== 'PGRST116') throw error
      return data
    }
  })

  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ['tasks', activeYear?.id, role],
    enabled: !!activeYear,
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          team:team_id(name),
          event:event_id(name),
          creator:created_by(full_name),
          task_assignees(member_id, individual_progress, safe_profiles(full_name))
        `)
        .eq('academic_year_id', activeYear!.id)
        .order('due_date', { ascending: true })
      
      const { data, error } = await query
      if (error) throw error
      return data || []
    }
  })

  const filteredTasks = tasks?.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })

  const handleEdit = (id: string) => {
    setSelectedTaskId(id)
    setIsTaskFormOpen(true)
  }

  const handleCreate = () => {
    setSelectedTaskId(null)
    setIsTaskFormOpen(true)
  }

  const handleView = (id: string) => {
    setSelectedTaskId(id)
    setIsTaskDetailsOpen(true)
  }

  const handleSuccess = () => {
    setIsTaskFormOpen(false)
    refetch()
  }
  
  const handleDetailsSuccess = () => {
    refetch()
  }

  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'urgent': return 'bg-error text-error-foreground border-error'
      case 'high': return 'bg-warning text-warning-foreground border-warning'
      case 'medium': return 'bg-info text-info-foreground border-info'
      case 'low': return 'bg-success text-success-foreground border-success'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusColor = (s: string) => {
    switch(s) {
      case 'completed': return 'bg-success hover:bg-success/90'
      case 'in_progress': return 'bg-info text-info-foreground hover:bg-info/90'
      case 'review': return 'bg-warning text-warning-foreground hover:bg-warning/90'
      case 'submitted': return 'bg-purple-500 text-white hover:bg-purple-600'
      default: return 'bg-secondary hover:bg-secondary/90'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
          <p className="text-muted-foreground">Manage club work, assignments, and due dates.</p>
        </div>
        
        {canManage && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row flex-wrap justify-between gap-4">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search tasks..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="submitted">Submitted</option>
                <option value="review">Review</option>
                <option value="completed">Completed</option>
              </select>
              
              <select 
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Assignees</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      Loading tasks...
                    </TableCell>
                  </TableRow>
                ) : !filteredTasks || filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      No tasks found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => {
                    const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== 'completed'
                    
                    return (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleView(task.id)}>
                        <TableCell>
                          <div className="font-medium text-primary hover:underline">{task.title}</div>
                          {task.event && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              Event: {task.event.name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getPriorityColor(task.priority)}>
                            {task.priority.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {task.due_date ? (
                            <div className={`flex items-center gap-1 text-sm ${isOverdue ? 'text-error font-medium' : 'text-muted-foreground'}`}>
                              <CalendarIcon className="h-3 w-3" />
                              {format(new Date(task.due_date), 'MMM d, yyyy')}
                              {isOverdue && <span className="ml-1 text-xs">(Overdue)</span>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex -space-x-2">
                            {task.task_assignees?.slice(0, 3).map((a: any) => (
                              <div key={a.member_id} className="h-8 w-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-medium" title={a.safe_profiles?.full_name}>
                                {a.safe_profiles?.full_name?.charAt(0)}
                              </div>
                            ))}
                            {task.task_assignees && task.task_assignees.length > 3 && (
                              <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                                +{task.task_assignees.length - 3}
                              </div>
                            )}
                            {(!task.task_assignees || task.task_assignees.length === 0) && (
                              <span className="text-sm text-muted-foreground ml-2">Unassigned</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(task.status)}>
                            {task.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {isTaskFormOpen && activeYear && (
        <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
          <DialogContent className="sm:max-w-[700px] bg-surface p-6 rounded-lg shadow-lg border border-border fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-h-[90vh] overflow-y-auto z-50">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                {selectedTaskId ? 'Edit Task' : 'Create New Task'}
              </h2>
            </div>
            <TaskForm 
              taskId={selectedTaskId}
              activeYearId={activeYear.id}
              onSuccess={handleSuccess} 
              onCancel={() => setIsTaskFormOpen(false)} 
            />
          </DialogContent>
        </Dialog>
      )}

      {isTaskDetailsOpen && selectedTaskId && (
        <Dialog open={isTaskDetailsOpen} onOpenChange={setIsTaskDetailsOpen}>
          <DialogContent className="sm:max-w-[900px] bg-surface p-0 rounded-lg shadow-lg border border-border fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-h-[95vh] overflow-hidden z-50 flex flex-col">
            <TaskDetails 
              taskId={selectedTaskId}
              onClose={() => setIsTaskDetailsOpen(false)}
              onUpdated={handleDetailsSuccess}
              onEdit={() => {
                setIsTaskDetailsOpen(false)
                handleEdit(selectedTaskId)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
