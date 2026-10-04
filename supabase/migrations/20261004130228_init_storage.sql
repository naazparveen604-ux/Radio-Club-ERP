-- Storage Buckets Configuration

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('documents', 'documents', false, 26214400); -- 25MB
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('task-attachments', 'task-attachments', false, 26214400); -- 25MB

-- Enable RLS for Storage

-- Avatars Policies (Public bucket, anyone can read)
CREATE POLICY "Avatar images are publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Anyone can upload an avatar." ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Anyone can update their own avatar." ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Anyone can delete their own avatar." ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Documents Policies (Private bucket, governed by documents table)
-- Read: Allowed if user has access to the metadata row in public.documents
CREATE POLICY "Users can download permitted documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'documents' AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.storage_path = name AND (
      public.is_super_admin() OR
      (d.access_level = 'everyone') OR
      (d.access_level = 'managers_plus' AND (public.is_faculty_coordinator() OR public.is_club_manager())) OR
      (d.access_level = 'specific_team' AND EXISTS (
        SELECT 1 FROM public.team_members tm WHERE tm.team_id = d.access_team_id AND tm.member_id = auth.uid()
      ))
    )
  )
);
-- Write: Admins and Managers can upload
CREATE POLICY "Admins and Managers can upload documents" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'documents' AND (public.is_super_admin() OR public.is_club_manager())
);
-- Delete: Admins and Managers
CREATE POLICY "Admins and Managers can delete documents" ON storage.objects FOR DELETE USING (
  bucket_id = 'documents' AND (public.is_super_admin() OR public.is_club_manager())
);

-- Task Attachments Policies (Private bucket, governed by task_attachments table)
-- Read: Allowed if user has access to task
CREATE POLICY "Users can download permitted task attachments" ON storage.objects FOR SELECT USING (
  bucket_id = 'task-attachments' AND EXISTS (
    SELECT 1 FROM public.task_attachments ta
    JOIN public.tasks t ON ta.task_id = t.id
    WHERE ta.storage_path = name AND (
      public.is_super_admin() OR
      public.is_faculty_coordinator() OR
      public.is_manager_of_team(t.team_id) OR
      EXISTS (SELECT 1 FROM public.task_assignees assignee WHERE assignee.task_id = t.id AND assignee.member_id = auth.uid())
    )
  )
);
-- Write: Allowed if user can upload to task
CREATE POLICY "Users can upload task attachments" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'task-attachments' AND EXISTS (
    SELECT 1 FROM public.task_attachments ta
    JOIN public.tasks t ON ta.task_id = t.id
    WHERE ta.storage_path = name AND (
      public.is_super_admin() OR
      public.is_manager_of_team(t.team_id) OR
      EXISTS (SELECT 1 FROM public.task_assignees assignee WHERE assignee.task_id = t.id AND assignee.member_id = auth.uid())
    )
  )
);
-- Delete: Admin, Manager of team, or Uploader
CREATE POLICY "Users can delete task attachments" ON storage.objects FOR DELETE USING (
  bucket_id = 'task-attachments' AND EXISTS (
    SELECT 1 FROM public.task_attachments ta
    JOIN public.tasks t ON ta.task_id = t.id
    WHERE ta.storage_path = name AND (
      public.is_super_admin() OR
      public.is_manager_of_team(t.team_id) OR
      ta.uploaded_by = auth.uid()
    )
  )
);
