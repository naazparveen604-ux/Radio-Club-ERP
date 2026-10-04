import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, AlertTriangle, Activity } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { isPast, isToday } from 'date-fns'

export function Progress() {
  const { user } = useAuth()
  
  const { data: activeYear } = useQuery({
    queryKey: ['activeYear'],
    queryFn: async () => {
      const { data, error } = await supabase.from('academic_years').select('id').eq('is_active', true).single()
      if (error && error.code !== 'PGRST116') throw error
      return data
    }
  })

  const { data: metrics } = useQuery({
    queryKey: ['work_progress', activeYear?.id, user?.id],
    enabled: !!activeYear && !!user,
    queryFn: async () => {
      // Get all tasks assigned to the user
      const { data: assignments, error } = await supabase
        .from('task_assignees')
        .select(`
          individual_progress,
          task:task_id (status, due_date)
        `)
        .eq('member_id', user!.id)
      
      if (error) throw error
      
      const tasks = assignments || []
      
      const totalAssigned = tasks.length
      const completedMyPart = tasks.filter(a => a.individual_progress === 100).length
      const avgProgress = totalAssigned > 0 
        ? Math.round(tasks.reduce((sum, a) => sum + (a.individual_progress || 0), 0) / totalAssigned) 
        : 0
        
      const overdue = tasks.filter(a => {
        const t = a.task as any
        return t && t.status !== 'completed' && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
      }).length

      return {
        totalAssigned,
        completedMyPart,
        avgProgress,
        overdue
      }
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Work Progress</h2>
        <p className="text-muted-foreground">Overview of your individual task completion and responsibilities.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Average Progress</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.avgProgress || 0}%</div>
            <div className="w-full h-1.5 bg-muted mt-2 rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${metrics?.avgProgress || 0}%` }} />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assigned</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalAssigned || 0}</div>
            <p className="text-xs text-muted-foreground">Tasks in current year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Part Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.completedMyPart || 0}</div>
            <p className="text-xs text-muted-foreground">100% individual progress</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-error">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-error" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-error">{metrics?.overdue || 0}</div>
            <p className="text-xs text-muted-foreground">Past due date</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Additional space for future charts or lists if needed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Assignment Activity</CardTitle>
        </CardHeader>
        <CardContent>
           <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border-2 border-dashed rounded-md">
             To view all tasks and update your progress, visit the Tasks page.
           </div>
        </CardContent>
      </Card>
    </div>
  )
}
