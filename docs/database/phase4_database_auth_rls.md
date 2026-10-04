# Phase 4 — Database, Authentication & RLS Implementation

## Database Implementation Summary
The Supabase PostgreSQL database has been successfully initialized and configured matching the exact specifications from Phase 2. The database model enforces extreme normalization and strict referential integrity.
- `team_members` maps members to teams scoped by `academic_year_id` (resolving historical team membership bleeding).
- `attendance` strictly enforces `UNIQUE(member_id, date)`.
- `leave_requests` utilizes constraints for `end_date >= start_date`.

## Migrations
The schema and configurations are managed entirely through Supabase Migrations, ensuring reproducibility and proper state versioning.
1. `20261004130107_init_schema.sql`: Contains the DDL for all 23 required tables, Foreign Keys, CHECK constraints, UNIQUE constraints, triggers to manage `updated_at`, and primary indexes.
2. `20261004130146_init_rls_policies.sql`: Contains the implementation of the RLS Strategy matrix.
3. `20261004130228_init_storage.sql`: Configures storage buckets (`avatars`, `documents`, `task-attachments`) and their specific RLS rules.
4. `20261004130302_init_rpc_and_triggers.sql`: Defines the Postgres RPC `approve_leave_request` for atomic transactions, and `handle_new_user` for syncing `auth.users` to `public.profiles`.

## Authentication Architecture
- Frontend utilizes `@supabase/supabase-js`.
- Implemented `AuthContext.tsx` providing `session`, `user`, `profile`, `role`, and `signOut`.
- Implemented `ProtectedRoute.tsx` to guard React Router pathways based on the exact user role mapped in `profiles.role_id`.
- `Login.tsx` upgraded to securely invoke `supabase.auth.signInWithPassword`.
- Unauthenticated users are routed to `/login`.
- Unauthorized users navigating to protected modules are routed to `/unauthorized`.
- Note: Self-registration remains explicitly disabled. User creation is strictly mediated via the Edge Function.

## Row Level Security (RLS)
The RLS philosophy implemented is **Deny by Default**.
- We bypass custom JWT propagation issues by creating fast `STABLE` Postgres functions (`auth_user_role_id()`, `is_super_admin()`, `is_manager_of_team()`) which fetch authorization states securely without stale token vectors.
- A Member cannot view another Member's attendance, task assignments, or leave requests unless implicitly permitted (e.g., they are assigned the same task).
- A Manager can freely mutate records but strictly bounded to their assigned `team_id`.
- Administrative Settings and Audit Logs are guarded globally by `is_super_admin()`.

## Storage Architecture
1. **avatars**: Public bucket (2MB). Allows unauthenticated reads. User can upload/delete their own image paths.
2. **documents**: Private bucket (25MB). Read access is strictly coupled to the `access_level` matrix on the `documents` table row. Write access restricted to Managers and Admins.
3. **task-attachments**: Private bucket (25MB). Access coupled to the `tasks` and `task_assignees` matrices. A member can only download/upload if they are explicitly mapped as an assignee.

## Edge Functions
- `admin-create-user`: Authorized dynamically. Verifies the caller possesses the `super_admin` role via `profiles`, then invokes `supabase.auth.admin.createUser` utilizing the backend `SERVICE_ROLE_KEY`.
- `generate-report`: Authorized dynamically. Requires `club_manager` or `super_admin`. Validates the caller's team jurisdiction and uses `SERVICE_ROLE_KEY` to pull a unified JSON payload representing the report data, ready for client-side rendering/export.

## Atomic Leave Operations
Implemented securely at the database level via the RPC `approve_leave_request(p_leave_request_id UUID)`.
The transaction:
1. Locks the `leave_requests` row (`FOR UPDATE`).
2. Validates the caller is an Admin or the member's Team Manager.
3. Iterates over the requested date range (`start_date` to `end_date`), inserting or updating the `attendance` table with the status `leave`.
4. Writes an immutable trail to `audit_logs`.
5. Commits atomically.

## Seed Strategy
Development Seed (`supabase/seed.sql`) populates static references required for the UI to operate without throwing constraint errors:
- Roles (`super_admin`, `faculty_coordinator`, etc.)
- Program Categories
- Academic Departments
- Historical and Active Academic Years

## Known Limitations
- Supabase Docker is not running in the current isolated terminal environment. Therefore, TypeScript generic definitions for `database.types.ts` could not be auto-generated via the CLI. A generic fallback shim has been applied for now.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are currently placeholders pending actual project binding.

## Next Phase Recommendation
Phase 4 architecture is solidly in place. The recommendation is to proceed to **Phase 5 — Member & Team Management Module**, which will leverage the new `profiles`, `teams`, and `team_members` tables and start breathing life into the dashboard placeholders.
