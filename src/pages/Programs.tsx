import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Radio, Calendar, Clock, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import { Dialog, DialogContent } from '@radix-ui/react-dialog'
import { ProgramForm } from '../components/programs/ProgramForm'
import { CategoryForm } from '../components/programs/CategoryForm'

export function Programs() {
  const { role } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [isProgramFormOpen, setIsProgramFormOpen] = useState(false)
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)

  const canManage = role === 'super_admin' || role === 'club_manager'
  const isSuperAdmin = role === 'super_admin'

  const { data: activeYear } = useQuery({
    queryKey: ['activeYear'],
    queryFn: async () => {
      const { data, error } = await supabase.from('academic_years').select('id, label').eq('is_active', true).single()
      if (error && error.code !== 'PGRST116') throw error
      return data
    }
  })

  const { data: programs, isLoading, refetch } = useQuery({
    queryKey: ['programs', activeYear?.id],
    enabled: !!activeYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select(`
          *,
          program_categories(name),
          manager:manager_id(full_name),
          host:host_id(full_name),
          team:team_id(name)
        `)
        .eq('academic_year_id', activeYear!.id)
        .order('date', { ascending: false })
      
      if (error) throw error
      return data || []
    }
  })

  const filteredPrograms = programs?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.program_categories?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleEdit = (id: string) => {
    setSelectedProgramId(id)
    setIsProgramFormOpen(true)
  }

  const handleCreate = () => {
    setSelectedProgramId(null)
    setIsProgramFormOpen(true)
  }

  const handleSuccess = () => {
    setIsProgramFormOpen(false)
    setIsCategoryFormOpen(false)
    refetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Radio Programs</h2>
          <p className="text-muted-foreground">Manage broadcasting schedules and formats.</p>
        </div>
        
        <div className="flex gap-2">
          {isSuperAdmin && (
            <Button variant="outline" onClick={() => setIsCategoryFormOpen(true)}>
              Manage Categories
            </Button>
          )}
          {canManage && (
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              New Program
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative max-w-sm w-full">
              <Radio className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search programs..."
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
                  <TableHead>Program</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 5 : 4} className="text-center h-24 text-muted-foreground">
                      Loading programs...
                    </TableCell>
                  </TableRow>
                ) : !filteredPrograms || filteredPrograms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 5 : 4} className="text-center h-24 text-muted-foreground">
                      No programs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPrograms.map((program) => (
                    <TableRow key={program.id}>
                      <TableCell>
                        <div className="font-medium">{program.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 max-w-[250px]">
                          {program.description || 'No description'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {program.program_categories?.name || 'Uncategorized'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(program.date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {program.start_time.substring(0, 5)} - {program.end_time.substring(0, 5)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          program.status === 'completed' ? 'default' :
                          program.status === 'cancelled' ? 'destructive' :
                          program.status === 'ongoing' ? 'secondary' : 'outline'
                        } className={program.status === 'completed' ? 'bg-success hover:bg-success' : program.status === 'ongoing' ? 'bg-info hover:bg-info text-info-foreground' : ''}>
                          {program.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(program.id)}>
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

      {isProgramFormOpen && activeYear && (
        <Dialog open={isProgramFormOpen} onOpenChange={setIsProgramFormOpen}>
          <DialogContent className="sm:max-w-[600px] bg-surface p-6 rounded-lg shadow-lg border border-border fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-h-[90vh] overflow-y-auto z-50">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                {selectedProgramId ? 'Edit Program' : 'Create New Program'}
              </h2>
            </div>
            <ProgramForm 
              programId={selectedProgramId}
              activeYearId={activeYear.id}
              onSuccess={handleSuccess} 
              onCancel={() => setIsProgramFormOpen(false)} 
            />
          </DialogContent>
        </Dialog>
      )}

      {isCategoryFormOpen && (
        <Dialog open={isCategoryFormOpen} onOpenChange={setIsCategoryFormOpen}>
          <DialogContent className="sm:max-w-[500px] bg-surface p-6 rounded-lg shadow-lg border border-border fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-h-[90vh] overflow-y-auto z-50">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Manage Categories</h2>
            </div>
            <CategoryForm 
              onSuccess={handleSuccess} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
