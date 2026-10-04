import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Megaphone, Calendar as CalendarIcon, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Dialog, DialogContent } from '@radix-ui/react-dialog'
import { format, isPast, isFuture } from 'date-fns'
import { AnnouncementForm } from '../components/announcements/AnnouncementForm'
import { AnnouncementDetails } from '../components/announcements/AnnouncementDetails'

export function Announcements() {
  const { user, role } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [audienceFilter, setAudienceFilter] = useState('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const canManage = role === 'super_admin' || role === 'club_manager' || role === 'faculty_coordinator'

  const { data: activeYear } = useQuery({
    queryKey: ['activeYear'],
    queryFn: async () => {
      const { data, error } = await supabase.from('academic_years').select('id, label').eq('is_active', true).single()
      if (error && error.code !== 'PGRST116') throw error
      return data
    }
  })

  const { data: announcements, isLoading, refetch } = useQuery({
    queryKey: ['announcements', user?.id],
    queryFn: async () => {
      // The backend RLS will automatically restrict what the user can see.
      // We just fetch all available to the user and sort.
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          creator:created_by(full_name),
          target_team:target_team_id(name)
        `)
        .order('publish_date', { ascending: false })
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    }
  })

  const filteredAnnouncements = announcements?.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          a.body.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesAudience = audienceFilter === 'all' || a.target_audience === audienceFilter
    return matchesSearch && matchesAudience
  })

  const handleEdit = (id: string) => {
    setSelectedId(id)
    setIsFormOpen(true)
  }

  const handleCreate = () => {
    setSelectedId(null)
    setIsFormOpen(true)
  }

  const handleView = (id: string) => {
    setSelectedId(id)
    setIsDetailsOpen(true)
  }

  const handleSuccess = () => {
    setIsFormOpen(false)
    refetch()
  }

  const getStatus = (a: any) => {
    if (!a.is_active) return { label: 'Archived', color: 'bg-secondary text-secondary-foreground' }
    if (isFuture(new Date(a.publish_date))) return { label: 'Draft / Scheduled', color: 'bg-warning text-warning-foreground' }
    if (a.expiry_date && isPast(new Date(a.expiry_date))) return { label: 'Expired', color: 'bg-secondary text-secondary-foreground' }
    return { label: 'Published', color: 'bg-success text-success-foreground' }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Announcements</h2>
          <p className="text-muted-foreground">Broadcast messages to members and teams.</p>
        </div>
        
        {canManage && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New Announcement
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
                placeholder="Search announcements..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <select 
                value={audienceFilter}
                onChange={(e) => setAudienceFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="all">All Audiences</option>
                <option value="everyone">Everyone</option>
                <option value="managers_only">Managers Only</option>
                <option value="specific_team">Specific Team</option>
                <option value="specific_members">Specific Members</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4">
            {isLoading ? (
              <div className="text-center p-8 text-muted-foreground">Loading announcements...</div>
            ) : !filteredAnnouncements || filteredAnnouncements.length === 0 ? (
              <div className="text-center p-8 border-2 border-dashed rounded-md text-muted-foreground">
                <Megaphone className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                No announcements found.
              </div>
            ) : (
              filteredAnnouncements.map((ann) => {
                const status = getStatus(ann)
                return (
                  <Card key={ann.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => handleView(ann.id)}>
                    <div className="p-5 flex flex-col sm:flex-row gap-4">
                      <div className="hidden sm:flex h-12 w-12 rounded-full bg-primary/10 items-center justify-center shrink-0">
                        <Megaphone className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-lg leading-none">{ann.title}</h3>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {format(new Date(ann.publish_date), 'MMM d, yyyy')}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {ann.target_audience.replace('_', ' ').toUpperCase()}
                                {ann.target_audience === 'specific_team' && ann.target_team && ` - ${ann.target_team.name}`}
                              </span>
                              <span>By {ann.creator?.full_name || 'Admin'}</span>
                            </div>
                          </div>
                          <Badge className={status.color}>{status.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                          {ann.body}
                        </p>
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      {isFormOpen && activeYear && (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-[700px] bg-surface p-6 rounded-lg shadow-lg border border-border fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-h-[90vh] overflow-y-auto z-50">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                {selectedId ? 'Edit Announcement' : 'Create Announcement'}
              </h2>
            </div>
            <AnnouncementForm 
              id={selectedId}
              onSuccess={handleSuccess} 
              onCancel={() => setIsFormOpen(false)} 
            />
          </DialogContent>
        </Dialog>
      )}

      {isDetailsOpen && selectedId && (
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-[800px] bg-surface p-0 rounded-lg shadow-lg border border-border fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-h-[95vh] overflow-hidden z-50 flex flex-col">
            <AnnouncementDetails 
              id={selectedId}
              onClose={() => setIsDetailsOpen(false)}
              onEdit={() => {
                setIsDetailsOpen(false)
                handleEdit(selectedId)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
