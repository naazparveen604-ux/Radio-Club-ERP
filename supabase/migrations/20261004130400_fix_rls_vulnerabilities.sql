-- Fix RLS vulnerabilities

-- Fix: Allow members to cancel leave, but ONLY cancel (status = 'cancelled')
DROP POLICY IF EXISTS "Members can cancel own pending leave" ON leave_requests;
CREATE POLICY "Members can cancel own pending leave" ON leave_requests 
FOR UPDATE 
USING (auth.uid() = member_id AND status = 'pending')
WITH CHECK (status = 'cancelled');

-- Fix: Prevent managers from modifying leave request status directly to bypass RPC
DROP POLICY IF EXISTS "Managers can approve/reject team leave" ON leave_requests;
CREATE POLICY "Managers can reject team leave" ON leave_requests 
FOR UPDATE 
USING (is_manager_of_member(member_id) AND status = 'pending')
WITH CHECK (status = 'rejected');

-- Fix: Ensure task assignees can only update their own progress
DROP POLICY IF EXISTS "Members can update own progress" ON task_assignees;
CREATE POLICY "Members can update own progress" ON task_assignees 
FOR UPDATE 
USING (auth.uid() = member_id)
WITH CHECK (auth.uid() = member_id AND task_id = task_id); 

-- Security Fix: Prevent role escalation
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
        IF public.is_super_admin() THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Unauthorized: Only super admins can change user roles.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_role_escalation ON public.profiles;
CREATE TRIGGER check_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_role_escalation();

-- Fix: Add missing policies for announcement_targets
CREATE POLICY "Targeted members can view own targets" ON announcement_targets FOR SELECT USING (member_id = auth.uid());
CREATE POLICY "Admins can view all targets" ON announcement_targets FOR SELECT USING (is_super_admin());
CREATE POLICY "Admins can manage targets" ON announcement_targets FOR ALL USING (is_super_admin());

