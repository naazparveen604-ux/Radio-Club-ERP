# Phase 9 — Communication, Documents & Notifications

## Features Implemented
1. **Announcements Module** (`src/pages/Announcements.tsx`, `AnnouncementForm.tsx`, `AnnouncementDetails.tsx`)
   - Four distinct targeting audiences correctly implemented as per Phase 1 spec: `everyone`, `managers_only`, `specific_team`, `specific_members`.
   - Real mappings to the existing `announcements` and `announcement_targets` tables.
   - Status visually inferred from dates and active flags (Scheduled, Published, Expired, Archived).
   - Only authorized roles (`super_admin`, `club_manager`, `faculty_coordinator`) can manage them. Club Members have read-only access.
   
2. **Documents Module** (`src/pages/Documents.tsx`, `DocumentForm.tsx`)
   - Secure private document viewing and uploading.
   - Access control settings tied directly to `access_level` (everyone, managers_plus, admin_only, specific_team).
   - Connected natively to Supabase storage bucket `documents`.

3. **Notifications Module** (`src/pages/Notifications.tsx`)
   - In-app notification center tracking read/unread state per user.
   - Realtime integration enabling Websocket streaming of notification inserts without polling.

4. **Header Integration** (`src/layouts/Header.tsx`)
   - Supabase Realtime channel setup directly inside the Header.
   - Unread badge counter instantly maps database triggers (simulated or real) to the top navigation bell.

## Database Migrations Added
- `20261004140001_phase9_rls_fixes.sql`
  - Purpose: The existing Phase 4 `init_rls_policies.sql` aggressively restricted insertion/modification on `announcements`, `announcement_targets`, and `documents` to *only* `is_super_admin()`. 
  - Fix: Updated RLS on these three tables to permit management by `is_super_admin() OR is_faculty_coordinator() OR is_club_manager()`, adhering exactly to the Phase 1 Permission Matrix allowing Managers and FCs to publish content.

## RLS Security Verification
- **Scenario A (Members Publishing)**: Club members attempting to create announcements are strictly blocked. The UI prevents form access, and the modified RLS `INSERT` policy evaluates their role token and rejects.
- **Scenario B (Audience Targeting)**: Supabase RLS enforces read logic on `announcements` and `announcement_targets`. A member not in a targeted team cannot query the announcement row.
- **Scenario C (Realtime Isolation)**: Header realtime subscription explicitly filters via `user_id=eq.${user.id}`. The underlying connection adheres to Postgres RLS policies—Supabase Realtime drops updates for rows the user's JWT isn't authorized to read.

## Known Limitations
- V1 does not hook into email or external push notification providers, strictly fulfilling the "in-app only" requirement.
- Uploads to the `documents` storage bucket use mock-progress hooks since the raw Supabase JS client doesn't natively expose XHR upload progress events perfectly without chunking overhead.
- Notifications are only manually triggered during Announcement Creation in the UI for demonstration. In a production state, they would be triggered securely and robustly by Postgres Database Triggers or Edge Functions.
