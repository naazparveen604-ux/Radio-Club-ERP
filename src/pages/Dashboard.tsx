import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Users, UsersRound, CalendarCheck, Radio, Calendar, CheckSquare } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd')
      const [{ count: membersCount }, { count: teamsCount }, { data: attendanceData }, { count: programsCount }, { count: eventsCount }, { count: tasksCount }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('teams').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('attendance').select('status').eq('date', today),
        supabase.from('programs').select('*', { count: 'exact', head: true }).in('status', ['scheduled', 'ongoing']),
        supabase.from('events').select('*', { count: 'exact', head: true }).in('status', ['upcoming', 'ongoing']),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'completed')
      ])
      
      const presentCount = attendanceData?.filter(a => a.status === 'present').length || 0
      const leaveCount = attendanceData?.filter(a => a.status === 'leave').length || 0
      
      return { 
        membersCount: membersCount || 0, 
        teamsCount: teamsCount || 0,
        presentCount,
        leaveCount,
        programsCount: programsCount || 0,
        eventsCount: eventsCount || 0,
        tasksCount: tasksCount || 0
      }
    }
  })
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of club operations and activities.</p>
      </div>
      
      {/* KPI Cards Foundation */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.membersCount || 0}</div>
            <p className="text-xs text-muted-foreground">Active profiles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Teams</CardTitle>
            <UsersRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.teamsCount || 0}</div>
            <p className="text-xs text-muted-foreground">Operational teams</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Today</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.presentCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.leaveCount || 0} on approved leave
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Programs</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.programsCount || 0}</div>
            <p className="text-xs text-muted-foreground">Scheduled or ongoing</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.eventsCount || 0}</div>
            <p className="text-xs text-muted-foreground">Planned club activities</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area Grid Foundation */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border-2 border-dashed rounded-md">
              Activity feed will be implemented here.
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Task Summary</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex flex-col items-center justify-center py-6 text-center">
               <div className="bg-primary/10 p-4 rounded-full mb-4">
                 <CheckSquare className="h-8 w-8 text-primary" />
               </div>
               <div className="text-3xl font-bold mb-1">{stats?.tasksCount || 0}</div>
               <p className="text-sm text-muted-foreground mb-4">Pending club tasks</p>
               <a href="/tasks" className="text-sm text-primary hover:underline font-medium">View all tasks →</a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
