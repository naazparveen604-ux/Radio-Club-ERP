import { Menu, Bell, User as UserIcon, LogOut } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useEffect } from 'react'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { profile, role, signOut, user } = useAuth()

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['header_notifications', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_read', false)
      
      if (error) throw error
      return count || 0
    }
  })

  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('header-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { refetch() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, refetch])

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-surface px-4 lg:h-[60px] lg:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle navigation menu</span>
      </Button>
      
      <div className="flex-1">
        <h1 className="text-lg font-semibold md:text-xl hidden md:block">
          Welcome back{profile ? `, ${profile.full_name}` : ''}
        </h1>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Academic Year Selector Placeholder */}
        <select className="hidden sm:flex h-9 w-[140px] rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary">
          <option>AY 2026-27 (Active)</option>
          <option>AY 2025-26</option>
        </select>

        {/* Notifications */}
        <Link to="/notifications" className="relative">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Notifications</span>
          </Button>
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-4 w-4 flex items-center justify-center rounded-full bg-error text-[10px] font-bold text-white shadow-sm ring-2 ring-surface">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {/* User Profile */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="hidden flex-col md:flex">
              <span className="text-sm font-medium leading-none">{profile?.full_name || user?.email}</span>
              <span className="text-xs text-muted-foreground leading-none mt-1 capitalize">{role?.replace('_', ' ')}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sign Out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
