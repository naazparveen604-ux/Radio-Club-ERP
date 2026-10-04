-- Add missing RLS policies for Phase 9 features (Announcements & Documents)
-- Based on the Phase 1/Phase 2 matrix, Club Managers and FCs should be able to create announcements and documents.
-- Members remain strictly read-only.

DROP POLICY IF EXISTS "Admins can manage announcements" ON announcements;
CREATE POLICY "Admins, FC and Managers can manage announcements" ON announcements FOR ALL USING (is_super_admin() OR is_faculty_coordinator() OR is_club_manager());

-- announcement_targets has no manage policy in init_rls_policies.sql except falling back to none? 
-- Let's check if it exists: 
-- Wait, I'll just CREATE OR REPLACE the policy. Wait, Postgres doesn't have CREATE OR REPLACE POLICY.
-- So I will DROP IF EXISTS and then CREATE.

DROP POLICY IF EXISTS "Admins can manage announcement targets" ON announcement_targets;
CREATE POLICY "Admins, FC and Managers can manage announcement targets" ON announcement_targets FOR ALL USING (is_super_admin() OR is_faculty_coordinator() OR is_club_manager());

DROP POLICY IF EXISTS "Admins can manage docs" ON documents;
CREATE POLICY "Admins, FC and Managers can manage docs" ON documents FOR ALL USING (is_super_admin() OR is_faculty_coordinator() OR is_club_manager());
