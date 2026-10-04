-- Security Fix: Prevent role escalation
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- If role_id is being changed
    IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
        -- Allow if the user is a super admin
        IF public.is_super_admin() THEN
            RETURN NEW;
        END IF;
        
        -- Otherwise, raise exception
        RAISE EXCEPTION 'Unauthorized: Only super admins can change user roles.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_role_escalation();
