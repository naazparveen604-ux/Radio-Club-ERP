-- Fix SEC-01: Protect phone and student_id exposure
-- Create a secure view that redacts private information for unauthorized users
CREATE OR REPLACE VIEW public.safe_profiles AS
SELECT 
    id,
    role_id,
    department_id,
    full_name,
    email,
    course,
    year_of_study,
    section,
    joining_date,
    status,
    avatar_url,
    created_at,
    updated_at,
    CASE 
        WHEN auth.uid() = id OR public.is_super_admin() THEN phone 
        ELSE NULL 
    END as phone,
    CASE 
        WHEN auth.uid() = id OR public.is_super_admin() THEN student_id 
        ELSE NULL 
    END as student_id
FROM public.profiles;

-- Grant permissions to authenticated users to select from the view
GRANT SELECT ON public.safe_profiles TO authenticated;

-- Note: The original public.profiles table remains accessible to allow relational queries
-- (e.g., getting a member's name attached to a task). However, for member directories,
-- the frontend should query `safe_profiles`.
