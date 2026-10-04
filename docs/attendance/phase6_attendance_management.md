# Phase 6 — Attendance Management

## Features Implemented
1. **Attendance Page** (`src/pages/Attendance.tsx`)
   - Fully functional ERP attendance interface.
   - Date selection (defaults to today).
   - Dynamically loads members based on role (Managers see their team members; Admins/FC see everyone; Members see themselves).
   - Allows authorized users (Super Admin, Club Manager) to mark attendance statuses (`present`, `absent`, `late`).
   - Leave status is properly reflected and displayed when an approved leave request exists (as populated by the backend RPC). It prevents manual toggling away from leave inside the attendance UI directly.
   - Performs a batch `upsert` utilizing Supabase, strictly adhering to the `UNIQUE(member_id, date)` DB constraint.

2. **Dashboard Integration** (`src/pages/Dashboard.tsx`)
   - Upgraded the "Present Today" widget to accurately count today's "present" and "leave" records from the live `attendance` table.

## Workflows
- **Mark Attendance**: User selects date -> Modifies statuses locally in React state -> Submits. The system performs an `upsert` hitting `member_id, date` uniqueness constraint, updating existing records and inserting missing ones in one efficient network request.
- **Leave Integration (A7)**: The system recognizes `leave` statuses implicitly created by the Phase 4 `approve_leave_request` RPC. The UI locks these rows down from normal attendance toggling, respecting the source of truth.

## Files Created
- `src/pages/Attendance.tsx`
- `docs/attendance/phase6_attendance_management.md`

## Files Modified
- `src/App.tsx` (Replaced placeholder with real route)
- `src/pages/Dashboard.tsx` (Integrated actual metrics query)

## RLS Behavior & Security
- **Scenario A**: Members cannot modify another member's attendance. RLS naturally prevents `UPDATE` unless `is_manager_of_member` or `is_super_admin`.
- **Scenario B**: Faculty Coordinator remains read-only. `is_faculty_coordinator()` is explicitly absent from the `INSERT` and `UPDATE` policies.
- The `UNIQUE(member_id, date)` constraint completely shields the system against duplicate/race-condition records per member/day.

## Performance Considerations
- Attendance upserts are batched entirely client-side before submission.
- Uses `Record<string, any>` mapping to O(1) loop lookups when rendering the table, preventing nested `.find()` bottlenecks.
- `useQuery` efficiently caches the `safe_profiles` results so flipping dates doesn't re-download the user directory.

## Known Limitations
- The isolated environment prevents interactive browser testing. Validation relies on Typescript compilation and strict visual auditing of the UI code against the known schema/RLS rules.
