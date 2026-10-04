-- Auth Trigger for creating profile on sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, joining_date, status, role_id)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unknown User'), 
    NEW.email, 
    CURRENT_DATE, 
    'active', 
    4
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Do not block auth signups if profile creation fails, log it instead.
  RAISE WARNING 'Profile creation failed for user %', NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC for Atomic Leave Approval
CREATE OR REPLACE FUNCTION public.approve_leave_request(p_leave_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_leave_record public.leave_requests%ROWTYPE;
    v_current_date DATE;
    v_actor_id UUID := auth.uid();
BEGIN
    -- 1. Locking: Row lock on leave_requests to prevent double-approvals
    SELECT * INTO v_leave_record 
    FROM public.leave_requests 
    WHERE id = p_leave_request_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Leave request not found';
    END IF;

    -- 2. Authorization Validation (Must be Super Admin, FC, or Manager of the team)
    IF NOT (public.is_super_admin() OR public.is_manager_of_member(v_leave_record.member_id)) THEN
        RAISE EXCEPTION 'Unauthorized to approve this leave request';
    END IF;

    IF v_leave_record.status != 'pending' THEN
        RAISE EXCEPTION 'Leave request is not in pending state';
    END IF;

    -- 3. Update Leave
    UPDATE public.leave_requests 
    SET status = 'approved',
        reviewed_by = v_actor_id,
        updated_at = now()
    WHERE id = p_leave_request_id;

    -- 4. Upsert Attendance
    v_current_date := v_leave_record.start_date;
    WHILE v_current_date <= v_leave_record.end_date LOOP
        INSERT INTO public.attendance (member_id, academic_year_id, date, status, marked_by)
        VALUES (v_leave_record.member_id, v_leave_record.academic_year_id, v_current_date, 'leave', v_actor_id)
        ON CONFLICT (member_id, date) 
        DO UPDATE SET status = 'leave', marked_by = v_actor_id, updated_at = now();
        
        v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;

    -- 5. Audit Log
    INSERT INTO public.audit_logs (actor_id, action, module, entity_id, old_value, new_value)
    VALUES (
        v_actor_id, 
        'approve_leave', 
        'leave_requests', 
        p_leave_request_id, 
        jsonb_build_object('status', 'pending'), 
        jsonb_build_object('status', 'approved')
    );

    RETURN TRUE;
END;
$$;
