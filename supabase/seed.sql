-- Seed file for local development

-- 1. Roles
INSERT INTO public.roles (id, name, description) VALUES
(1, 'super_admin', 'Full system access'),
(2, 'faculty_coordinator', 'Read-only oversight'),
(3, 'club_manager', 'Operational management'),
(4, 'club_member', 'Standard member access')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 2. Departments
INSERT INTO public.academic_departments (name, code) VALUES
('Computer Science', 'CS'),
('Electrical Engineering', 'EE'),
('Mechanical Engineering', 'ME'),
('Media Studies', 'MS')
ON CONFLICT (name) DO NOTHING;

-- 3. Academic Year
INSERT INTO public.academic_years (label, start_date, end_date, is_active) VALUES
('AY 2026-27', '2026-08-01', '2027-05-31', true),
('AY 2025-26', '2025-08-01', '2026-05-31', false)
ON CONFLICT (label) DO NOTHING;

-- 4. Program Categories
INSERT INTO public.program_categories (name, description) VALUES
('Morning Show', 'Daily morning broadcast'),
('Interviews', 'Guest interviews'),
('Music', 'Music showcase')
ON CONFLICT (name) DO NOTHING;

-- 5. Teams
INSERT INTO public.teams (name, description) VALUES
('Content Team', 'Responsible for scripting and shows'),
('Technical Team', 'Audio and equipment management'),
('Marketing Team', 'Social media and promotion')
ON CONFLICT (name) DO NOTHING;

