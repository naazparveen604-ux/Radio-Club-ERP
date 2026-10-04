import { useState } from 'react'
import { FileText, FileSpreadsheet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import { Label } from '../components/ui/Label'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

type ReportType = 'members' | 'attendance' | 'tasks' | 'leave' | 'programs' | 'events'

export function Reports() {
  const { user, role } = useAuth()
  const [reportType, setReportType] = useState<ReportType>('members')
  const [isGenerating, setIsGenerating] = useState(false)

  // We could add more filters (team, date ranges, etc.) but for V1, we'll keep it simple
  // and export the current data the user has access to. RLS ensures they only get authorized data.

  const canManage = role === 'super_admin' || role === 'club_manager' || role === 'faculty_coordinator'

  const generateReport = async (formatType: 'csv' | 'pdf') => {
    if (!user) return
    setIsGenerating(true)
    try {
      let data: any[] = []
      let headers: string[] = []
      let filename = `Report_${reportType}_${format(new Date(), 'yyyy-MM-dd')}`

      if (reportType === 'members') {
        const { data: members, error } = await supabase
          .from('safe_profiles')
          .select('full_name, email, role:roles(name), department:academic_departments(name), status, joining_date')
        
        if (error) throw error
        headers = ['Name', 'Email', 'Role', 'Department', 'Status', 'Joined']
        data = (members || []).map((m: any) => [
          m.full_name, 
          m.email, 
          m.role?.name?.replace('_', ' '), 
          m.department?.name || 'N/A', 
          m.status, 
          m.joining_date
        ])
      } 
      else if (reportType === 'attendance') {
        const { data: att, error } = await supabase
          .from('attendance')
          .select('date, status, member:profiles(full_name)')
          .order('date', { ascending: false })
          .limit(1000)
        
        if (error) throw error
        headers = ['Date', 'Member', 'Status']
        data = (att || []).map((a: any) => [a.date, a.member?.full_name, a.status])
      }
      else if (reportType === 'tasks') {
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('title, status, priority, due_date, team:teams(name)')
          .order('due_date', { ascending: true })
        
        if (error) throw error
        headers = ['Task Title', 'Status', 'Priority', 'Due Date', 'Team']
        data = (tasks || []).map((t: any) => [
          t.title, 
          t.status?.replace('_', ' '), 
          t.priority, 
          t.due_date || 'None', 
          t.team?.name || 'Unassigned'
        ])
      }
      else if (reportType === 'leave') {
        const { data: leaves, error } = await supabase
          .from('leave_requests')
          .select('start_date, end_date, status, reason, member:profiles(full_name)')
          .order('start_date', { ascending: false })
        
        if (error) throw error
        headers = ['Member', 'Start Date', 'End Date', 'Status', 'Reason']
        data = (leaves || []).map((l: any) => [
          l.member?.full_name,
          l.start_date,
          l.end_date,
          l.status,
          l.reason
        ])
      }
      else if (reportType === 'programs') {
        const { data: progs, error } = await supabase
          .from('programs')
          .select('name, date, status, location, category:program_categories(name)')
          .order('date', { ascending: false })
        
        if (error) throw error
        headers = ['Program Name', 'Category', 'Date', 'Location', 'Status']
        data = (progs || []).map((p: any) => [
          p.name,
          p.category?.name || 'N/A',
          p.date,
          p.location || 'N/A',
          p.status
        ])
      }
      else if (reportType === 'events') {
        const { data: evts, error } = await supabase
          .from('events')
          .select('name, date, status, location')
          .order('date', { ascending: false })
        
        if (error) throw error
        headers = ['Event Name', 'Date', 'Location', 'Status']
        data = (evts || []).map((e: any) => [
          e.name,
          e.date,
          e.location || 'N/A',
          e.status
        ])
      }

      if (data.length === 0) {
        alert("No data available to export for this report based on your permissions.")
        setIsGenerating(false)
        return
      }

      if (formatType === 'pdf') {
        exportPDF(headers, data, filename)
      } else {
        exportCSV(headers, data, filename)
      }
    } catch (err: any) {
      alert(`Report generation failed: ${err.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const exportPDF = (headers: string[], data: any[][], filename: string) => {
    const doc = new jsPDF()
    const title = `Radio Club ERP - ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`
    
    doc.setFontSize(16)
    doc.text(title, 14, 15)
    
    doc.setFontSize(10)
    doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 22)
    doc.text(`Generated by: ${user?.email}`, 14, 27)

    autoTable(doc, {
      head: [headers],
      body: data,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] }
    })
    
    doc.save(`${filename}.pdf`)
  }

  const exportCSV = (headers: string[], data: any[][], filename: string) => {
    // Properly escape fields that contain commas or quotes
    const escapeCSV = (field: any) => {
      if (field === null || field === undefined) return ''
      const str = String(field)
      if (str.includes(',') || str.includes('"') || str.includes('\\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...data.map(row => row.map(escapeCSV).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${filename}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
        <p className="text-muted-foreground">Export operational data securely. RLS strictly enforces data visibility.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Generate Report
            </CardTitle>
            <CardDescription>Select the data entity you wish to export.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <select 
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="members">Members & Profiles</option>
                {canManage && <option value="attendance">Attendance Records</option>}
                <option value="tasks">Tasks & Assignments</option>
                <option value="leave">Leave Requests</option>
                <option value="programs">Programs</option>
                <option value="events">Events</option>
              </select>
            </div>
            
            <div className="pt-4 border-t border-border flex flex-col sm:flex-row gap-3">
              <Button onClick={() => generateReport('pdf')} disabled={isGenerating} className="flex-1 gap-2">
                <FileText className="h-4 w-4" />
                {isGenerating ? 'Generating...' : 'Export as PDF'}
              </Button>
              <Button onClick={() => generateReport('csv')} disabled={isGenerating} variant="outline" className="flex-1 gap-2 border-primary text-primary hover:bg-primary/5">
                <FileSpreadsheet className="h-4 w-4" />
                {isGenerating ? 'Generating...' : 'Export as CSV'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
