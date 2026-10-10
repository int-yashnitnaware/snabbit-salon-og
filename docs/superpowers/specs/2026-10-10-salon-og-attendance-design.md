# Salon OG (On-Ground) Attendance App — Design

Date: 2026-10-10 (revised same day after reviewing reference screens)

## Purpose

Snabbit is launching a salon services category. Field ops staff working
this category need an on-ground app to manage attendance (check-in/out),
shift assignment, and leave requests — modeled on Snabbit's existing
Field Ops app and reference screens for the salon category launch.

This is a standalone MVP: its own database and auth, not wired into
Snabbit's production systems yet. Integration with real HR/staff systems
is a future step, out of scope here.

## Users / Roles

Three-tier hierarchy:

- **Staff** — field workers. Check in/out, see their assigned shift,
  request leave. Belong to exactly one hotspot.
- **Team lead (TL)** — supervises staff at one hotspot. Checks in/out
  like staff (triggers a notification to the overseeing manager when
  they do). Manually marks daily attendance status for staff at their
  hotspot who haven't checked in. Belongs to exactly one hotspot.
- **Manager** — oversees one or more hotspots (switches between them in
  the UI). Assigns shifts, approves/rejects leave requests, views the
  attendance dashboard and notification feed across their hotspots.
  Not tied to a single hotspot.

Leave approval stays with the manager, not the TL — TLs only handle
day-of attendance status marking.

## Platform

Mobile-first installable PWA (Next.js + `next-pwa`), usable in a desktop
browser for the manager dashboard too. No native app store distribution
for v1.

## Architecture

Single Next.js (App Router) app with two route groups:

- `/staff` — the field-staff and team-lead facing PWA (same check-in/out
  flow for both roles)
- `/admin` — the manager dashboard

Supabase provides Postgres (data), Auth (login), and Row Level Security
(role-based data access). One codebase, one deploy target.

## Data model (Supabase / Postgres)

- `hotspots` — `id`, `name`
- `hotspot_managers` — join table, `hotspot_id` + `manager_id`
  (many-to-many: a manager can oversee multiple hotspots)
- `profiles` — linked to `auth.users`; `full_name`, `role`
  (`'staff' | 'team_lead' | 'manager'`), `hotspot_id` (required for
  staff/team_lead, null for manager), `is_on_duty` (boolean, the
  Online/Offline toggle — self-set by team_lead/manager)
- `shifts` — `staff_id`, `hotspot_id`, `date`, `start_time`, `end_time`,
  `assigned_by`
- `attendance` — `staff_id`, `shift_id`, `hotspot_id`, `date`, `status`
  (`'present' | 'marked_absent' | 'no_show' | 'not_marked' |
  'false_attendance' | 'on_leave'`, default `'not_marked'`),
  `check_in_at`, `check_in_lat`, `check_in_lng`, `check_out_at`,
  `check_out_lat`, `check_out_lng`, `is_false_negative` (boolean,
  default false — a correction flag, independent of `status`),
  `marked_by` (nullable — the TL/manager who set a manual status)
- `leave_requests` — `staff_id`, `start_date`, `end_date`, `reason`,
  `status` (`pending | approved | rejected`), `reviewed_by`
- `notifications` — `manager_id` (recipient), `message`, `hotspot_id`,
  `read_at` (nullable), `created_at`

**Status transitions (`attendance.status`):**
1. A shift exists for a staff/TL on a date → an `attendance` row is
   created (or implied) with `status = 'not_marked'`.
2. Staff/TL checks in → `status` auto-set to `'present'`,
   `check_in_at`/lat/lng recorded. No GPS/geofence validation — this is
   a simple record, not a fraud check.
3. After the shift, a TL can manually change a still-`'not_marked'`
   record for staff at their hotspot to `'marked_absent'`, `'no_show'`,
   or `'false_attendance'` (judgment call, no automated detection).
4. When a leave request is approved and its date range covers a given
   day, that day's `attendance.status` is set to `'on_leave'`
   automatically (set by the leave-approval action, not a manual mark).
5. `is_false_negative` can be flagged true on any row by a TL/manager at
   any time, independent of `status` — signals "this was wrongly marked
   absent, needs correction/payroll review." It's a separate counter in
   the UI, not one of the five Absent sub-categories.

**Notifications:** when a team lead's `check_in_at` is set, a
notification row is inserted for every manager in that hotspot's
`hotspot_managers` (message: `"TL {name} has reached the hotspot"`).

RLS summary:
- Staff: read/write only their own `attendance`, `shifts`, `leave_requests`.
- Team lead: read/write `attendance` (status marking) for staff at their
  own `hotspot_id`; read their own `shifts`/`attendance`/`leave_requests`
  as staff would.
- Manager: read/write all rows scoped to hotspots in their
  `hotspot_managers` rows; read/write `leave_requests` and
  `notifications` addressed to them.

## Components

**Staff / Team Lead PWA**
- Login
- Home: today's assigned shift + Check-in / Check-out button
- Leave request form
- Leave history list

**Admin dashboard**
- Login
- **Home (Attendance Management)**: hotspot switcher, on-duty
  (Online/Offline) toggle, notification bell, Today/Tomorrow view
  toggle, Attendance count card (Present/Absent), False Negative count,
  categorized Absent breakdown (Marked / No Show / Not Marked / False
  Attendance / On Leave)
- Notifications list (full feed, read/unread)
- Staff list
- Shift assignment (per staff member, per date)
- Leave approval queue (approve/reject)
- Attendance report table (detail drill-down from the home dashboard)

## Data flow

1. Staff/TL logs in → sees today's assigned shift (from `shifts`,
   filtered by `staff_id` + today's date).
2. Staff/TL taps Check-in → browser Geolocation API captures lat/lng →
   `attendance.status` set to `'present'`, `check_in_at` + coordinates
   recorded. If the checker-in is a TL, a `notifications` row is
   inserted for each manager overseeing that hotspot.
3. Staff/TL taps Check-out → same row updated with `check_out_at` +
   coordinates.
4. TL reviews their hotspot's staff after shift end → manually sets
   `status` for anyone still `'not_marked'`.
5. Manager logs in → role-gated `/admin` routes → picks a hotspot from
   the switcher → dashboard shows aggregated counts for that hotspot
   and date (computed by grouping `attendance.status`) → assigns shifts
   → reviews `leave_requests` queue (approving sets the covered days'
   `attendance.status` to `'on_leave'`) → views notifications → drills
   into the full attendance report table.

## Error handling

- Geolocation permission denied → inline message + retry button;
  check-in is blocked until location is granted.
- Network / Supabase errors → toast notification.
- No shift assigned for today → staff/TL sees a "no shift today" empty
  state instead of a broken check-in control.
- Manager with no hotspots assigned → dashboard shows an empty state
  instead of an error.

## Testing

Manual flow testing for the MVP: login as staff → check-in/out → login
as TL → check-in triggers a manager notification → mark a staff member's
status → login as manager → assign shift → approve leave (confirm
`on_leave` status synced) → view dashboard counts. No automated test
suite for v1 (YAGNI at demo stage); revisit if/when this moves toward
production.

## Out of scope (v1)

- Selfie verification on check-in/out
- Geofence/location-based fraud validation (false attendance detection
  is manual, not automatic)
- Integration with Snabbit's real HR/staff systems
- Native mobile app (React Native/Flutter)
- Automated test suite
- Team leads approving leave (manager-only for v1)
