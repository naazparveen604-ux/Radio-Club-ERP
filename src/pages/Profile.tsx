import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { User as UserIcon, Camera } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

export function Profile() {
  const { user, role } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    course: '',
    year_of_study: '',
    section: ''
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: profile, refetch } = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, academic_departments(name)')
        .eq('id', user!.id)
        .single()
      
      if (error) throw error
      return data
    }
  })

  // We also want to know their team and academic year.
  const { data: teamData } = useQuery({
    queryKey: ['profile_team', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: activeYear } = await supabase.from('academic_years').select('id, label').eq('is_active', true).single()
      if (!activeYear) return null

      const { data } = await supabase
        .from('team_members')
        .select('teams(name)')
        .eq('member_id', user!.id)
        .eq('academic_year_id', activeYear.id)
      
      return data && data.length > 0 ? (data[0].teams as any)?.name : null
    }
  })

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        course: profile.course || '',
        year_of_study: profile.year_of_study ? String(profile.year_of_study) : '',
        section: profile.section || ''
      })
    }
  }, [profile])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    setIsLoading(true)
    setMessage(null)
    
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: formData.full_name,
        phone: formData.phone || null,
        course: formData.course || null,
        year_of_study: formData.year_of_study ? Number(formData.year_of_study) : null,
        section: formData.section || null
      }).eq('id', user.id)

      if (error) throw error
      
      setMessage({ type: 'success', text: 'Profile updated successfully.' })
      refetch()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user) {
      return
    }

    const file = event.target.files[0]
    const fileExt = file.name.split('.').pop()
    const filePath = `${user.id}/${Math.random()}.${fileExt}`

    setIsUploading(true)
    setMessage(null)

    try {
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setMessage({ type: 'success', text: 'Avatar updated successfully.' })
      refetch()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (!profile) return <div className="p-8 text-center animate-pulse">Loading profile...</div>

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Profile</h2>
        <p className="text-muted-foreground">Manage your personal information and account settings.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Avatar & Basic Info */}
        <Card className="md:col-span-1">
          <CardHeader className="text-center">
            <div className="mx-auto relative group w-32 h-32 rounded-full overflow-hidden border-4 border-surface bg-primary/5">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary/40">
                  <UserIcon className="w-16 h-16" />
                </div>
              )}
              <div 
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-8 h-8 text-white" />
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={isUploading}
            />
            {isUploading && <p className="text-xs text-muted-foreground mt-2">Uploading...</p>}
            
            <CardTitle className="mt-4">{profile.full_name}</CardTitle>
            <CardDescription>{profile.email}</CardDescription>
            
            <div className="mt-4 flex justify-center gap-2 flex-wrap">
              <Badge variant="default" className="capitalize">{role?.replace('_', ' ')}</Badge>
              {teamData && <Badge variant="outline">{teamData}</Badge>}
              <Badge variant={profile.status === 'active' ? 'outline' : 'secondary'} className={profile.status === 'active' ? 'text-success border-success' : ''}>
                {profile.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Student ID:</span>
              <p className="font-medium">{profile.student_id || 'Not provided'}</p>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Department:</span>
              <p className="font-medium">{profile.academic_departments?.name || 'Not provided'}</p>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Joined:</span>
              <p className="font-medium">{new Date(profile.joining_date).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Editable Form */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Edit Information</CardTitle>
            <CardDescription>Update your contact details and academic info.</CardDescription>
          </CardHeader>
          <CardContent>
            {message && (
              <div className={`p-3 mb-6 text-sm rounded ${message.type === 'success' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                {message.text}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input 
                    id="full_name" 
                    name="full_name" 
                    value={formData.full_name} 
                    onChange={handleChange} 
                    required 
                    disabled={isLoading} 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone" 
                    name="phone" 
                    value={formData.phone} 
                    onChange={handleChange} 
                    disabled={isLoading} 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="course">Course</Label>
                  <Input 
                    id="course" 
                    name="course" 
                    value={formData.course} 
                    onChange={handleChange} 
                    disabled={isLoading} 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="year_of_study">Year of Study</Label>
                  <Input 
                    id="year_of_study" 
                    name="year_of_study" 
                    type="number"
                    min="1"
                    max="7"
                    value={formData.year_of_study} 
                    onChange={handleChange} 
                    disabled={isLoading} 
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="section">Section/Batch</Label>
                  <Input 
                    id="section" 
                    name="section" 
                    value={formData.section} 
                    onChange={handleChange} 
                    disabled={isLoading} 
                  />
                </div>
              </div>
              
              <div className="flex justify-end pt-4 border-t border-border mt-6">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
