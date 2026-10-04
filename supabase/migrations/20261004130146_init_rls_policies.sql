-- Role verification functions for RLS (Lookup based for maximum security & no staleness)
CREATE OR REPLACE FUNCTION auth_user_role_id()
RETURNS SMALLINT AS $$
  SELECT role_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT auth_user_role_id() = 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_faculty_coordinator()
RETURNS BOOLEAN AS $$
  SELECT auth_user_role_id() = 2;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_club_manager()
RETURNS BOOLEAN AS $$
  SELECT auth_user_role_id() = 3;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_club_member()
RETURNS BOOLEAN AS $$
  SELECT auth_user_role_id() = 4;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_manager_of_team(target_team_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams 
    WHERE id = target_team_id AND manager_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_manager_of_member(target_member_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON tm.team_id = t.id
    WHERE tm.member_id = target_member_id AND t.manager_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 1. Roles (Reference table, read only)
CREATE POLICY "Roles are viewable by everyone" ON roles FOR SELECT USING (true);

-- 2. Academic Years (Viewable by all, managed by Admin)
CREATE POLICY "Academic years viewable by everyone" ON academic_years FOR SELECT USING (true);
CREATE POLICY "Academic years managed by admin" ON academic_years FOR ALL USING (is_super_admin());

-- 3. Academic Departments
CREATE POLICY "Academic departments viewable by everyone" ON academic_departments FOR SELECT USING (true);
CREATE POLICY "Academic departments managed by admin" ON academic_departments FOR ALL USING (is_super_admin());

-- 4. Profiles
CREATE POLICY "Profiles viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own non-role fields" ON profiles FOR UPDATE USING (auth.uid() = id);
-- Admins can update roles (we handle this via Edge function to be safer, but DB allows Admin)
CREATE POLICY "Admins can manage profiles" ON profiles FOR ALL USING (is_super_admin());

-- 5. Teams
CREATE POLICY "Teams viewable by everyone" ON teams FOR SELECT USING (true);
CREATE POLICY "Admins can manage teams" ON teams FOR ALL USING (is_super_admin());
CREATE POLICY "Managers can update their teams" ON teams FOR UPDATE USING (manager_id = auth.uid());

-- 6. Team Members
CREATE POLICY "Team members viewable by everyone" ON team_members FOR SELECT USING (true);
CREATE POLICY "Admins can manage team members" ON team_members FOR ALL USING (is_super_admin());
CREATE POLICY "Managers can manage their team members" ON team_members FOR ALL USING (is_manager_of_team(team_id));

-- 7. Attendance
CREATE POLICY "Admins and FC can view all attendance" ON attendance FOR SELECT USING (is_super_admin() OR is_faculty_coordinator());
CREATE POLICY "Managers can view team attendance" ON attendance FOR SELECT USING (is_manager_of_member(member_id));
CREATE POLICY "Members can view own attendance" ON attendance FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "Admins can manage attendance" ON attendance FOR ALL USING (is_super_admin());
CREATE POLICY "Managers can manage team attendance" ON attendance FOR INSERT WITH CHECK (is_manager_of_member(member_id));
CREATE POLICY "Managers can update team attendance" ON attendance FOR UPDATE USING (is_manager_of_member(member_id));

-- 8. Leave Requests
CREATE POLICY "Admins and FC can view all leave" ON leave_requests FOR SELECT USING (is_super_admin() OR is_faculty_coordinator());
CREATE POLICY "Managers can view team leave" ON leave_requests FOR SELECT USING (is_manager_of_member(member_id));
CREATE POLICY "Members can view own leave" ON leave_requests FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "Admins can manage leave" ON leave_requests FOR ALL USING (is_super_admin());
CREATE POLICY "Members can request leave" ON leave_requests FOR INSERT WITH CHECK (auth.uid() = member_id);
CREATE POLICY "Members can cancel own pending leave" ON leave_requests FOR UPDATE USING (auth.uid() = member_id AND status = 'pending');
CREATE POLICY "Managers can approve/reject team leave" ON leave_requests FOR UPDATE USING (is_manager_of_member(member_id));

-- 9. Tasks
CREATE POLICY "Admins and FC can view all tasks" ON tasks FOR SELECT USING (is_super_admin() OR is_faculty_coordinator());
CREATE POLICY "Managers can view team tasks" ON tasks FOR SELECT USING (is_manager_of_team(team_id));
CREATE POLICY "Members can view assigned tasks" ON tasks FOR SELECT USING (
    EXISTS (SELECT 1 FROM task_assignees WHERE task_id = tasks.id AND member_id = auth.uid())
);
CREATE POLICY "Admins can manage tasks" ON tasks FOR ALL USING (is_super_admin());
CREATE POLICY "Managers can manage team tasks" ON tasks FOR ALL USING (is_manager_of_team(team_id));

-- 10. Task Assignees
CREATE POLICY "Admins and FC can view all task assignees" ON task_assignees FOR SELECT USING (is_super_admin() OR is_faculty_coordinator());
CREATE POLICY "Managers can view team task assignees" ON task_assignees FOR SELECT USING (
    EXISTS (SELECT 1 FROM tasks WHERE id = task_id AND is_manager_of_team(team_id))
);
CREATE POLICY "Members can view own assignments" ON task_assignees FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "Admins can manage task assignees" ON task_assignees FOR ALL USING (is_super_admin());
CREATE POLICY "Managers can manage team task assignees" ON task_assignees FOR ALL USING (
    EXISTS (SELECT 1 FROM tasks WHERE id = task_id AND is_manager_of_team(team_id))
);
CREATE POLICY "Members can update own progress" ON task_assignees FOR UPDATE USING (auth.uid() = member_id);

-- 11. Task Attachments
CREATE POLICY "Admins and FC can view all task attachments" ON task_attachments FOR SELECT USING (is_super_admin() OR is_faculty_coordinator());
CREATE POLICY "Managers can view team task attachments" ON task_attachments FOR SELECT USING (
    EXISTS (SELECT 1 FROM tasks WHERE id = task_id AND is_manager_of_team(team_id))
);
CREATE POLICY "Members can view attachments for assigned tasks" ON task_attachments FOR SELECT USING (
    EXISTS (SELECT 1 FROM task_assignees WHERE task_id = task_attachments.task_id AND member_id = auth.uid())
);
CREATE POLICY "Admins can manage task attachments" ON task_attachments FOR ALL USING (is_super_admin());
CREATE POLICY "Managers can manage team task attachments" ON task_attachments FOR ALL USING (
    EXISTS (SELECT 1 FROM tasks WHERE id = task_id AND is_manager_of_team(team_id))
);
CREATE POLICY "Members can upload to assigned tasks" ON task_attachments FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM task_assignees WHERE task_id = task_attachments.task_id AND member_id = auth.uid())
);
CREATE POLICY "Uploaders can delete own attachments" ON task_attachments FOR DELETE USING (uploaded_by = auth.uid());

-- 12. Events
CREATE POLICY "Events viewable by everyone" ON events FOR SELECT USING (true);
CREATE POLICY "Admins can manage events" ON events FOR ALL USING (is_super_admin());
CREATE POLICY "Managers can manage their events" ON events FOR ALL USING (manager_id = auth.uid() OR is_manager_of_team(team_id));

-- 13. Programs
CREATE POLICY "Programs viewable by everyone" ON programs FOR SELECT USING (true);
CREATE POLICY "Admins can manage programs" ON programs FOR ALL USING (is_super_admin());
CREATE POLICY "Managers can manage their programs" ON programs FOR ALL USING (manager_id = auth.uid() OR is_manager_of_team(team_id));

-- 14. Documents
CREATE POLICY "Admins can view all docs" ON documents FOR SELECT USING (is_super_admin());
CREATE POLICY "FC and Managers can view manager docs" ON documents FOR SELECT USING (
    access_level IN ('everyone', 'managers_plus') AND (is_super_admin() OR is_faculty_coordinator() OR is_club_manager())
);
CREATE POLICY "Everyone can view public docs" ON documents FOR SELECT USING (access_level = 'everyone');
CREATE POLICY "Team members can view team docs" ON documents FOR SELECT USING (
    access_level = 'specific_team' AND EXISTS (
        SELECT 1 FROM team_members WHERE team_id = documents.access_team_id AND member_id = auth.uid()
    )
);
CREATE POLICY "Admins can manage docs" ON documents FOR ALL USING (is_super_admin());

-- 15. Announcements
CREATE POLICY "Admins and FC can view all announcements" ON announcements FOR SELECT USING (is_super_admin() OR is_faculty_coordinator());
CREATE POLICY "Everyone can view public announcements" ON announcements FOR SELECT USING (target_audience = 'everyone');
CREATE POLICY "Managers can view manager announcements" ON announcements FOR SELECT USING (target_audience = 'managers_only' AND is_club_manager());
CREATE POLICY "Team members can view team announcements" ON announcements FOR SELECT USING (
    target_audience = 'specific_team' AND EXISTS (
        SELECT 1 FROM team_members WHERE team_id = announcements.target_team_id AND member_id = auth.uid()
    )
);
CREATE POLICY "Targeted members can view specific announcements" ON announcements FOR SELECT USING (
    target_audience = 'specific_members' AND EXISTS (
        SELECT 1 FROM announcement_targets WHERE announcement_id = announcements.id AND member_id = auth.uid()
    )
);
CREATE POLICY "Admins can manage announcements" ON announcements FOR ALL USING (is_super_admin());

-- 16. Notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);
-- Inserts happen via DB triggers or Edge Functions only (no client-side inserts)

-- 17. Audit Logs
CREATE POLICY "Admins can view audit logs" ON audit_logs FOR SELECT USING (is_super_admin());
-- NO INSERT/UPDATE/DELETE policies (immutable, managed by triggers/functions)

-- 18. Settings
CREATE POLICY "Settings viewable by everyone" ON settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON settings FOR ALL USING (is_super_admin());

