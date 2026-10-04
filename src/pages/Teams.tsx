import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, UsersRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Dialog, DialogContent } from '@radix-ui/react-dialog'
import { TeamForm } from '../components/teams/TeamForm'

export function Teams() {
  const { role, user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  const canManageTeams = role === 'super_admin' || role === 'club_manager' // FC is read-only usually, but let's stick to Super Admin and Club Manager

  const { data: activeYear } = useQuery({
    queryKey: ['activeYear'],
    queryFn: async () => {
      const { data, error } = await supabase.from('academic_years').select('id, label').eq('is_active', true).single()
      if (error && error.code !== 'PGRST116') throw error
      return data
    }
  })

  const { data: teams, isLoading, error, refetch } = useQuery({
    queryKey: ['teams', activeYear?.id],
    enabled: !!activeYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          description,
          is_active,
          manager_id,
          profiles!manager_id(full_name),
          team_members(id, member_id, safe_profiles(full_name, avatar_url))
        `)
        .eq('team_members.academic_year_id', activeYear!.id)
        .order('name')
      
      if (error) throw error
      return data
    }
  })

  const filteredTeams = teams?.filter(team => 
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleEdit = (id: string, managerId: string | null) => {
    // Only Admin can edit any team. Manager can only edit their own team.
    if (role === 'super_admin' || (role === 'club_manager' && user?.id === managerId)) {
      setSelectedTeamId(id)
      setIsFormOpen(true)
    }
  }

  const handleCreate = () => {
    setSelectedTeamId(null)
    setIsFormOpen(true)
  }

  const handleSuccess = () => {
    setIsFormOpen(false)
    refetch()
  }

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading teams...</div>
  if (error) return <div className="p-8 text-center text-error">Failed to load teams: {(error as Error).message}</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Teams</h2>
          <p className="text-muted-foreground">Manage club teams and assignments for {activeYear?.label || 'Current Year'}.</p>
        </div>
        {canManageTeams && (
          <Button onClick={handleCreate} className="w-full sm:w-auto gap-2">
            <Plus className="h-4 w-4" />
            Create Team
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search teams..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredTeams?.length === 0 ? (
          <div className="col-span-full p-8 text-center text-muted-foreground bg-surface rounded-lg border border-border border-dashed">
            No teams found.
          </div>
        ) : (
          filteredTeams?.map((team) => {
            const canEdit = role === 'super_admin' || (role === 'club_manager' && user?.id === team.manager_id)
            
            return (
              <Card 
                key={team.id} 
                className={`flex flex-col transition-shadow ${canEdit ? 'hover:shadow-md cursor-pointer border-primary/20 hover:border-primary/50' : ''}`}
                onClick={() => canEdit && handleEdit(team.id, team.manager_id)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 text-primary rounded-md">
                        <UsersRound className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-xl">{team.name}</CardTitle>
                    </div>
                    {!team.is_active && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <CardDescription className="line-clamp-2 mt-2 min-h-[40px]">
                    {team.description || 'No description provided.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <div className="flex flex-col space-y-4">
                    <div>
                      <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Manager</span>
                      <p className="font-medium text-sm mt-1">
                        {/* @ts-ignore */}
                        {team.profiles?.full_name || 'Unassigned'}
                      </p>
                    </div>
                    
                    <div className="flex justify-between items-center border-t border-border pt-4">
                      <span className="text-sm font-medium">Members</span>
                      <Badge variant="outline">{team.team_members?.length || 0}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {isFormOpen && activeYear && (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-[500px] bg-surface p-6 rounded-lg shadow-lg border border-border fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-h-[90vh] overflow-y-auto z-50">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                {selectedTeamId ? 'Edit Team' : 'Create New Team'}
              </h2>
            </div>
            <TeamForm 
              teamId={selectedTeamId}
              activeYearId={activeYear.id}
              onSuccess={handleSuccess} 
              onCancel={() => setIsFormOpen(false)} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
