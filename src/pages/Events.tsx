import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Calendar, Clock, Edit2, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import { Dialog, DialogContent } from '@radix-ui/react-dialog'
import { EventForm } from '../components/events/EventForm'

export function Events() {
  const { role } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [isEventFormOpen, setIsEventFormOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const canManage = role === 'super_admin' || role === 'club_manager'

  const { data: activeYear } = useQuery({
    queryKey: ['activeYear'],
    queryFn: async () => {
      const { data, error } = await supabase.from('academic_years').select('id, label').eq('is_active', true).single()
      if (error && error.code !== 'PGRST116') throw error
      return data
    }
  })

  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['events', activeYear?.id],
    enabled: !!activeYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          organizer:organizer_id(full_name),
          team:team_id(name)
        `)
        .eq('academic_year_id', activeYear!.id)
        .order('date', { ascending: true })
      
      if (error) throw error
      return data || []
    }
  })

  const filteredEvents = events?.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.location?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleEdit = (id: string) => {
    setSelectedEventId(id)
    setIsEventFormOpen(true)
  }

  const handleCreate = () => {
    setSelectedEventId(null)
    setIsEventFormOpen(true)
  }

  const handleSuccess = () => {
    setIsEventFormOpen(false)
    refetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Events</h2>
          <p className="text-muted-foreground">Manage club activities and technical events.</p>
        </div>
        
        {canManage && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New Event
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative max-w-sm w-full">
              <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search events..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {activeYear && (
              <Badge variant="outline" className="self-start sm:self-center">
                {activeYear.label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 5 : 4} className="text-center h-24 text-muted-foreground">
                      Loading events...
                    </TableCell>
                  </TableRow>
                ) : !filteredEvents || filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 5 : 4} className="text-center h-24 text-muted-foreground">
                      No events found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="font-medium">{event.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Org: {event.organizer?.full_name || 'Unassigned'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(event.date).toLocaleDateString()}
                          </div>
                          {event.time && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {event.time.substring(0, 5)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {event.location ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          event.status === 'completed' ? 'default' :
                          event.status === 'cancelled' ? 'destructive' :
                          event.status === 'ongoing' ? 'secondary' : 'outline'
                        } className={event.status === 'completed' ? 'bg-success hover:bg-success' : event.status === 'ongoing' ? 'bg-info hover:bg-info text-info-foreground' : ''}>
                          {event.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(event.id)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {isEventFormOpen && activeYear && (
        <Dialog open={isEventFormOpen} onOpenChange={setIsEventFormOpen}>
          <DialogContent className="sm:max-w-[600px] bg-surface p-6 rounded-lg shadow-lg border border-border fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-h-[90vh] overflow-y-auto z-50">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                {selectedEventId ? 'Edit Event' : 'Create New Event'}
              </h2>
            </div>
            <EventForm 
              eventId={selectedEventId}
              activeYearId={activeYear.id}
              onSuccess={handleSuccess} 
              onCancel={() => setIsEventFormOpen(false)} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
