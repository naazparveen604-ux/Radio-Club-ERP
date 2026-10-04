import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'

const memberSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  student_id: z.string().optional(),
  department_id: z.string().optional(),
  course: z.string().optional(),
  year_of_study: z.coerce.number().min(1).max(7).optional().or(z.literal('')),
  section: z.string().optional(),
  role_id: z.coerce.number().min(1).max(4).optional(),
  status: z.enum(['active', 'inactive', 'graduated', 'suspended']).default('active'),
  password: z.string().min(6).optional().or(z.literal('')) // Only used for creation
})

type MemberFormData = z.infer<typeof memberSchema>

interface MemberFormProps {
  memberId: string | null
  onSuccess: () => void
  onCancel: () => void
}

export function MemberForm({ memberId, onSuccess, onCancel }: MemberFormProps) {
  const { role } = useAuth()
  const isSuperAdmin = role === 'super_admin'
  
  const [departments, setDepartments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      status: 'active',
      role_id: 4
    }
  })

  useEffect(() => {
    // Fetch departments for the select dropdown
    const fetchDeps = async () => {
      const { data } = await supabase.from('academic_departments').select('id, name').eq('is_active', true)
      if (data) setDepartments(data)
    }
    fetchDeps()

    if (memberId) {
      // Fetch existing member details
      // Note: we fetch from safe_profiles, but for update we target profiles.
      // The RPC doesn't restrict our own select if we are managers, but we'll use safe_profiles to be safe.
      const fetchMember = async () => {
        setIsLoading(true)
        const { data, error } = await supabase.from('safe_profiles').select('*').eq('id', memberId).single()
        if (error) console.error("Fetch error:", error)
        if (data) {
          reset({
            full_name: data.full_name,
            email: data.email,
            phone: data.phone || '',
            student_id: data.student_id || '',
            department_id: data.department_id || '',
            course: data.course || '',
            year_of_study: data.year_of_study || '',
            section: data.section || '',
            role_id: data.role_id,
            status: data.status,
          })
        }
        setIsLoading(false)
      }
      fetchMember()
    }
  }, [memberId, reset])

  const onSubmit = async (data: MemberFormData) => {
    setIsLoading(true)
    setError(null)
    try {
      const payload: any = {
        full_name: data.full_name,
        phone: data.phone || null,
        student_id: data.student_id || null,
        department_id: data.department_id || null,
        course: data.course || null,
        year_of_study: data.year_of_study ? Number(data.year_of_study) : null,
        section: data.section || null,
        status: data.status
      }

      // Only super_admin can change role_id
      if (isSuperAdmin && data.role_id) {
        payload.role_id = data.role_id
      }

      if (memberId) {
        // UPDATE existing member
        // Cannot update email easily without edge function, skip email update for now
        const { error: updateError } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', memberId)
        
        if (updateError) throw updateError
      } else {
        // CREATE new member via Edge Function
        if (!data.password) throw new Error("Password is required for new members")
        
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-create-user', {
          body: {
            email: data.email,
            password: data.password,
            full_name: data.full_name,
            role_id: isSuperAdmin ? data.role_id : 4 // non-admins can only create regular members
          }
        })
        
        if (edgeError) throw edgeError
        if (edgeData.error) throw new Error(edgeData.error)

        // Then update the new profile with the extra fields
        const newUserId = edgeData.user?.id
        if (newUserId) {
          await supabase.from('profiles').update(payload).eq('id', newUserId)
        }
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && <div className="p-3 bg-error/10 text-error rounded text-sm">{error}</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input id="full_name" {...register('full_name')} disabled={isLoading} />
          {errors.full_name && <span className="text-xs text-error">{errors.full_name.message}</span>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" {...register('email')} disabled={isLoading || !!memberId} />
          {errors.email && <span className="text-xs text-error">{errors.email.message}</span>}
        </div>

        {!memberId && (
          <div className="space-y-2">
            <Label htmlFor="password">Temporary Password *</Label>
            <Input id="password" type="password" {...register('password')} disabled={isLoading} />
            {errors.password && <span className="text-xs text-error">{errors.password.message}</span>}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="student_id">Student ID</Label>
          <Input id="student_id" {...register('student_id')} disabled={isLoading} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" {...register('phone')} disabled={isLoading} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="department_id">Department</Label>
          <select 
            id="department_id" 
            {...register('department_id')} 
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
          >
            <option value="">Select Department...</option>
            {departments.map(dep => (
              <option key={dep.id} value={dep.id}>{dep.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="course">Course</Label>
          <Input id="course" {...register('course')} disabled={isLoading} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="year_of_study">Year of Study</Label>
          <Input id="year_of_study" type="number" min="1" max="7" {...register('year_of_study')} disabled={isLoading} />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select 
            id="status" 
            {...register('status')} 
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {isSuperAdmin && (
          <div className="space-y-2">
            <Label htmlFor="role_id">Role</Label>
            <select 
              id="role_id" 
              {...register('role_id')} 
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
            >
              <option value="4">Club Member</option>
              <option value="3">Club Manager</option>
              <option value="2">Faculty Coordinator</option>
              <option value="1">Super Admin</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : (memberId ? 'Update Member' : 'Create Member')}
        </Button>
      </div>
    </form>
  )
}
