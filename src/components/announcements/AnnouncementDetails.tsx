import { useQuery } from '@tanstack/react-query'
import { X, Calendar as CalendarIcon, Edit2, Users, Megaphone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { format, isPast, isFuture } from 'date-fns'

export function AnnouncementDetails({ 
  id, 
  onClose,
  onEdit
}: { 
  id: string
  onClose: () => void
  onEdit: () => void
}) {
  const { role } = useAuth()
  const canManage = role === 'super_admin' || role === 'club_manager' || role === 'faculty_coordinator'

  const { data: ann, isLoading } = useQuery({
    queryKey: ['announcement', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          creator:created_by(full_name),
          target_team:target_team_id(name)
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      
      let targets: any[] = []
      if (data.target_audience === 'specific_members' && canManage) {
         const { data: tData } = await supabase.from('announcement_targets').select('safe_profiles(full_name)').eq('announcement_id', id)
         if (tData) targets = tData.map(t => t.safe_profiles)
      }
      
      return { ...data, targets }
    }
  })

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading announcement...</div>
  if (!ann) return <div className="p-8 text-center text-error">Announcement not found</div>

  let statusLabel = 'Published'
  let statusColor = 'bg-success'
  if (!ann.is_active) { statusLabel = 'Archived'; statusColor = 'bg-secondary text-secondary-foreground' }
  else if (isFuture(new Date(ann.publish_date))) { statusLabel = 'Scheduled'; statusColor = 'bg-warning text-warning-foreground' }
  else if (ann.expiry_date && isPast(new Date(ann.expiry_date))) { statusLabel = 'Expired'; statusColor = 'bg-secondary text-secondary-foreground' }

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge className={statusColor}>{statusLabel}</Badge>
            <Badge variant="outline" className="border-primary/50 text-primary">
              <Megaphone className="h-3 w-3 mr-1 inline" /> Announcement
            </Badge>
          </div>
          <h2 className="text-2xl font-bold">{ann.title}</h2>
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
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        <div className="bg-surface rounded-lg p-6 text-sm md:text-base leading-relaxed whitespace-pre-wrap font-serif border border-border shadow-sm">
          {ann.body}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-6">
          <div className="space-y-3">
             <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Publish Info</h3>
             <div className="space-y-2 text-sm">
               <div className="flex items-center gap-2">
                 <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                 <span>Published: {format(new Date(ann.publish_date), 'MMMM d, yyyy')}</span>
               </div>
               {ann.expiry_date && (
                 <div className="flex items-center gap-2 text-muted-foreground">
                   <CalendarIcon className="h-4 w-4" />
                   <span>Expires: {format(new Date(ann.expiry_date), 'MMMM d, yyyy')}</span>
                 </div>
               )}
               <div className="text-muted-foreground">
                 By: <span className="font-medium text-foreground">{ann.creator?.full_name || 'Admin'}</span>
               </div>
             </div>
          </div>
          
          <div className="space-y-3">
             <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Audience Targeting</h3>
             <div className="space-y-2 text-sm">
               <div className="flex items-center gap-2">
                 <Users className="h-4 w-4 text-muted-foreground" />
                 <span className="font-medium capitalize">{ann.target_audience.replace('_', ' ')}</span>
               </div>
               
               {ann.target_audience === 'specific_team' && ann.target_team && (
                 <div className="pl-6 text-primary font-medium">{ann.target_team.name}</div>
               )}
               
               {ann.target_audience === 'specific_members' && ann.targets && ann.targets.length > 0 && (
                 <div className="pl-6 flex flex-wrap gap-1">
                   {ann.targets.map((t: any, i: number) => (
                     <Badge key={i} variant="secondary" className="text-xs">{t.full_name}</Badge>
                   ))}
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
