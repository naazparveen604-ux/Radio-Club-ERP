import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  LayoutDashboard, 
  Users, 
  UsersRound, 
  CalendarCheck, 
  Mic, 
  CheckSquare, 
  TrendingUp, 
  CalendarRange, 
  CalendarOff, 
  Megaphone, 
  FolderOpen, 
  Bell, 
  BarChart3, 
  Settings 
} from 'lucide-react'
import { cn } from '../lib/utils'

interface SidebarProps {
  className?: string
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

const navSections = [
  {
    title: "Main",
    items: [
      { name: "Dashboard", to: "/dashboard", icon: LayoutDashboard } // accessible by all
    ]
  },
  {
    title: "Management",
    items: [
      { name: "Members", to: "/members", icon: Users, roles: ['super_admin', 'faculty_coordinator', 'club_manager'] },
      { name: "Teams", to: "/teams", icon: UsersRound, roles: ['super_admin', 'faculty_coordinator', 'club_manager'] },
      { name: "Attendance", to: "/attendance", icon: CalendarCheck }, // Member views own, Manager views team
      { name: "Radio Programs", to: "/programs", icon: Mic },
      { name: "Tasks", to: "/tasks", icon: CheckSquare },
      { name: "Work Progress", to: "/progress", icon: TrendingUp },
      { name: "Events", to: "/events", icon: CalendarRange },
      { name: "Leave", to: "/leave", icon: CalendarOff },
    ]
  },
  {
    title: "Communication",
    items: [
      { name: "Announcements", to: "/announcements", icon: Megaphone },
      { name: "Documents", to: "/documents", icon: FolderOpen },
      { name: "Notifications", to: "/notifications", icon: Bell },
    ]
  },
  {
    title: "Insights",
    items: [
      { name: "Reports", to: "/reports", icon: BarChart3, roles: ['super_admin', 'faculty_coordinator', 'club_manager'] }
    ]
  },
  {
    title: "Administration",
    items: [
      { name: "Settings", to: "/settings", icon: Settings, roles: ['super_admin'] }
    ]
  }
]

export function Sidebar({ className, isMobileOpen, onMobileClose }: SidebarProps) {
  const { role } = useAuth()
  return (
    <>
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden" 
          onClick={onMobileClose}
        />
      )}
      
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-surface transition-transform duration-200 ease-in-out md:static md:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
        className
      )}>
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px]">
          <span className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
            <Mic className="h-5 w-5" />
            Radio Club ERP
          </span>
        </div>
        
        <div className="flex-1 overflow-auto py-4">
          <nav className="grid gap-1 px-2 text-sm font-medium">
            {navSections.map((section, idx) => {
              const visibleItems = section.items.filter(item => !item.roles || (role && item.roles.includes(role)))
              if (visibleItems.length === 0) return null
              
              return (
                <div key={idx} className="mb-4">
                  <h4 className="mb-1 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.title}
                  </h4>
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-text transition-all hover:bg-secondary hover:text-secondary-foreground",
                        isActive ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary" : ""
                      )}
                      onClick={onMobileClose}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              )
            })}
          </nav>
        </div>
      </aside>
    </>
  )
}
