import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, Check, Trash2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { formatDistanceToNow } from 'date-fns'

export function Notifications() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) throw error
      return data || []
    }
  })
  
  // Realtime subscription setup
  useEffect(() => {
    if (!user) return
    
    const channel = supabase.channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          refetch()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refetch])

  const filtered = notifications?.filter(n => filter === 'all' || !n.is_read)

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    refetch()
  }

  const markAllAsRead = async () => {
    if (!notifications?.length) return
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
    if (!unreadIds.length) return
    
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
    refetch()
  }

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id)
    refetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
          <p className="text-muted-foreground">In-app alerts and updates.</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Mark all as read
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border flex flex-row items-center gap-4">
          <button 
            className={`text-sm font-medium pb-2 border-b-2 ${filter === 'all' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
            onClick={() => setFilter('all')}
          >
            All Notifications
          </button>
          <button 
            className={`text-sm font-medium pb-2 border-b-2 ${filter === 'unread' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
            onClick={() => setFilter('unread')}
          >
            Unread
          </button>
        </CardHeader>
        <CardContent className="pt-0 p-0">
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : !filtered || filtered.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-muted-foreground text-sm">
                <Bell className="h-8 w-8 mb-3 opacity-20" />
                You're all caught up.
              </div>
            ) : (
              filtered.map((n) => (
                <div key={n.id} className={`p-4 flex gap-4 items-start hover:bg-muted/30 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}>
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!n.is_read ? 'bg-primary' : 'bg-transparent'}`} />
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {n.title}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    {n.link && (
                      <a href={n.link} className="text-xs font-medium text-primary hover:underline inline-block mt-1">
                        View details
                      </a>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {!n.is_read && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markAsRead(n.id)} title="Mark as read">
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-error" onClick={() => deleteNotification(n.id)} title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
