import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, FileText, Download, Trash2, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import { Dialog, DialogContent } from '@radix-ui/react-dialog'
import { format } from 'date-fns'
import { DocumentForm } from '../components/documents/DocumentForm'

export function Documents() {
  const { user, role } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const canManage = role === 'super_admin' || role === 'club_manager' || role === 'faculty_coordinator'

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['documents', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          uploader:uploaded_by(full_name),
          target_team:access_team_id(name)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    }
  })

  const filteredDocs = documents?.filter(d => 
    d.file_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDownload = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(doc.storage_path)
      if (error) throw error
      
      // Create object url and trigger download
      const url = window.URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file_name
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`Download failed: ${err.message}`)
    }
  }

  const handleDelete = async (doc: any) => {
    if (!confirm(`Are you sure you want to delete ${doc.file_name}?`)) return
    
    setDeletingId(doc.id)
    try {
      // Delete from storage first
      const { error: storageError } = await supabase.storage.from('documents').remove([doc.storage_path])
      if (storageError) throw storageError
      
      // Delete from db
      const { error: dbError } = await supabase.from('documents').delete().eq('id', doc.id)
      if (dbError) throw dbError
      
      refetch()
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleSuccess = () => {
    setIsFormOpen(false)
    refetch()
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Documents</h2>
          <p className="text-muted-foreground">Secure club files and resources.</p>
        </div>
        
        {canManage && (
          <Button onClick={() => setIsFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Upload Document
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search documents..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      Loading documents...
                    </TableCell>
                  </TableRow>
                ) : !filteredDocs || filteredDocs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      No documents found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocs.map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          <FileText className="h-4 w-4 text-primary" />
                          {doc.file_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{doc.category}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatSize(doc.file_size)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          {doc.access_level === 'everyone' ? (
                            <span className="text-success">Everyone</span>
                          ) : (
                            <span className="text-warning flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" />
                              {doc.access_level.replace('_', ' ')}
                              {doc.target_team && ` (${doc.target_team.name})`}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(doc.created_at), 'MMM d, yyyy')}
                        <div className="text-xs">by {doc.uploader?.full_name || 'Admin'}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)} title="Download">
                            <Download className="h-4 w-4" />
                          </Button>
                          {canManage && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-error hover:text-error/80" 
                              onClick={() => handleDelete(doc)} 
                              disabled={deletingId === doc.id}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {isFormOpen && (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-[600px] bg-surface p-6 rounded-lg shadow-lg border border-border fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] z-50">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Upload Document</h2>
            </div>
            <DocumentForm 
              onSuccess={handleSuccess} 
              onCancel={() => setIsFormOpen(false)} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
