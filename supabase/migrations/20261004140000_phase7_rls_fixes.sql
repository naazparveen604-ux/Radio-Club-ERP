-- Add missing RLS policies for program_categories, program_assignments, event_participants

-- Program Categories
CREATE POLICY "Program categories viewable by everyone" ON program_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage program categories" ON program_categories FOR ALL USING (is_super_admin());

-- Program Assignments
CREATE POLICY "Program assignments viewable by everyone" ON program_assignments FOR SELECT USING (true);
CREATE POLICY "Admins can manage program assignments" ON program_assignments FOR ALL USING (is_super_admin());
CREATE POLICY "Managers can manage program assignments" ON program_assignments FOR ALL USING (
    EXISTS (SELECT 1 FROM programs WHERE id = program_id AND (manager_id = auth.uid() OR is_manager_of_team(team_id)))
);

-- Event Participants
CREATE POLICY "Event participants viewable by everyone" ON event_participants FOR SELECT USING (true);
CREATE POLICY "Admins can manage event participants" ON event_participants FOR ALL USING (is_super_admin());
CREATE POLICY "Managers can manage event participants" ON event_participants FOR ALL USING (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND (manager_id = auth.uid() OR is_manager_of_team(team_id)))
);
