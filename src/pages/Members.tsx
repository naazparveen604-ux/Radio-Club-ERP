import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, User as UserIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { MemberForm } from '../components/members/MemberForm'
import { Dialog, DialogContent } from '@radix-ui/react-dialog'

const ROLE_MAP: Record<number, string> = {
  1: 'Super Admin',
  2: 'Faculty Coordinator',
  3: 'Club Manager',
  4: 'Club Member'
}

export function Members() {
  const { role } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  const canManageMembers = role === 'super_admin' || role === 'faculty_coordinator' || role === 'club_manager'

  const { data: members, isLoading, error, refetch } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      // Use safe_profiles to respect privacy constraints from Phase 4
      const { data, error } = await supabase
        .from('safe_profiles')
        .select(`
          *,
          academic_departments(name)
        `)
        .order('full_name')
      
      if (error) throw error
      return data
    }
  })

  const filteredMembers = members?.filter(member => 
    member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (member.student_id && member.student_id.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleEdit = (id: string) => {
    if (!canManageMembers) return
    setSelectedMemberId(id)
    setIsFormOpen(true)
  }

  const handleCreate = () => {
    setSelectedMemberId(null)
    setIsFormOpen(true)
  }

  const handleSuccess = () => {
    setIsFormOpen(false)
    refetch()
  }

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading members...</div>
  if (error) return <div className="p-8 text-center text-error">Failed to load members: {(error as Error).message}</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Members</h2>
          <p className="text-muted-foreground">Manage club members and their profiles.</p>
        </div>
        {canManageMembers && (
          <Button onClick={handleCreate} className="w-full sm:w-auto gap-2">
            <Plus className="h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search members..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      No members found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers?.map((member) => (
                    <TableRow 
                      key={member.id}
                      className={canManageMembers ? "cursor-pointer hover:bg-secondary/50" : ""}
                      onClick={() => handleEdit(member.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 overflow-hidden">
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt={member.full_name} className="h-full w-full object-cover" />
                            ) : (
                              <UserIcon className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium">{member.full_name}</span>
                            <span className="text-xs text-muted-foreground">{member.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.role_id === 1 ? 'default' : 'secondary'}>
                          {ROLE_MAP[member.role_id as number] || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>{member.academic_departments?.name || '—'}</TableCell>
                      <TableCell>
                        {member.student_id ? (
                          <span className="font-mono text-sm">{member.student_id}</span>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">Private/None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.status === 'active' ? 'default' : 'outline'} className={member.status === 'active' ? 'bg-success/20 text-success hover:bg-success/30' : ''}>
                          {member.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Member Form Modal */}
      {isFormOpen && (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-[500px] bg-surface p-6 rounded-lg shadow-lg border border-border fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-h-[90vh] overflow-y-auto z-50">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                {selectedMemberId ? 'Edit Member' : 'Add New Member'}
              </h2>
            </div>
            <MemberForm 
              memberId={selectedMemberId} 
              onSuccess={handleSuccess} 
              onCancel={() => setIsFormOpen(false)} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
