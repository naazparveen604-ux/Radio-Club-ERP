-- Phase 9: Database Triggers for Real Notification Generation
-- Resolves the issue of dummy UI notifications by moving logic securely to the DB

-- 1. Announcements Publication
CREATE OR REPLACE FUNCTION process_announcement_notifications()
RETURNS TRIGGER AS $$
BEGIN
    -- Only fire when transitioning to active/published
    IF NEW.is_active = true AND NEW.publish_date <= CURRENT_DATE AND (TG_OP = 'INSERT' OR OLD.is_active = false OR OLD.publish_date > CURRENT_DATE) THEN
        
        IF NEW.target_audience = 'everyone' THEN
            INSERT INTO notifications (user_id, type, title, message, link)
            SELECT id, 'announcement', 'New Announcement: ' || NEW.title, left(NEW.body, 100), '/announcements'
            FROM profiles WHERE status = 'active';
            
        ELSIF NEW.target_audience = 'managers_only' THEN
            INSERT INTO notifications (user_id, type, title, message, link)
            SELECT id, 'announcement', 'Manager Announcement: ' || NEW.title, left(NEW.body, 100), '/announcements'
            FROM profiles WHERE role_id IN (1, 2, 3) AND status = 'active';
            
        ELSIF NEW.target_audience = 'specific_team' THEN
            INSERT INTO notifications (user_id, type, title, message, link)
            SELECT DISTINCT member_id, 'announcement', 'Team Announcement: ' || NEW.title, left(NEW.body, 100), '/announcements'
            FROM team_members WHERE team_id = NEW.target_team_id;
            
        ELSIF NEW.target_audience = 'specific_members' AND TG_OP = 'UPDATE' THEN
            INSERT INTO notifications (user_id, type, title, message, link)
            SELECT member_id, 'announcement', 'Direct Announcement: ' || NEW.title, left(NEW.body, 100), '/announcements'
            FROM announcement_targets WHERE announcement_id = NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_announcement_published ON announcements;
CREATE TRIGGER on_announcement_published
AFTER INSERT OR UPDATE ON announcements
FOR EACH ROW EXECUTE FUNCTION process_announcement_notifications();


-- 2. Announcement Targets (Specific Members)
CREATE OR REPLACE FUNCTION process_announcement_target_notifications()
RETURNS TRIGGER AS $$
DECLARE
    ann_row announcements%ROWTYPE;
BEGIN
    SELECT * INTO ann_row FROM announcements WHERE id = NEW.announcement_id;
    
    -- If the announcement is already active when the target is added, notify immediately
    IF ann_row.is_active = true AND ann_row.publish_date <= CURRENT_DATE THEN
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (NEW.member_id, 'announcement', 'Direct Announcement: ' || ann_row.title, left(ann_row.body, 100), '/announcements');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_announcement_target_added ON announcement_targets;
CREATE TRIGGER on_announcement_target_added
AFTER INSERT ON announcement_targets
FOR EACH ROW EXECUTE FUNCTION process_announcement_target_notifications();


-- 3. Task Assignment
CREATE OR REPLACE FUNCTION process_task_assignment_notifications()
RETURNS TRIGGER AS $$
DECLARE
    task_row tasks%ROWTYPE;
BEGIN
    SELECT * INTO task_row FROM tasks WHERE id = NEW.task_id;
    
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (NEW.member_id, 'task', 'New Task Assigned: ' || task_row.title, 'You have been assigned a new task.', '/tasks');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_task_assigned ON task_assignees;
CREATE TRIGGER on_task_assigned
AFTER INSERT ON task_assignees
FOR EACH ROW EXECUTE FUNCTION process_task_assignment_notifications();


-- 4. Leave Request Approvals/Rejections
CREATE OR REPLACE FUNCTION process_leave_status_notifications()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (NEW.member_id, 'leave', 'Leave Request ' || initcap(NEW.status), 'Your leave request starting ' || NEW.start_date || ' was ' || NEW.status, '/leave');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_leave_status_changed ON leave_requests;
CREATE TRIGGER on_leave_status_changed
AFTER UPDATE ON leave_requests
FOR EACH ROW EXECUTE FUNCTION process_leave_status_notifications();
