# Salon OG (On-Ground) Attendance App — Design

Date: 2026-10-10

## Purpose

Snabbit is launching a salon services category. Field ops staff working
this category need an on-ground app to manage attendance (check-in/out),
shift assignment, and leave requests — modeled on Snabbit's existing
Field Ops app, scoped to the salon category launch.

This is a standalone MVP: its own database and auth, not wired into
Snabbit's production systems yet. Integration with real HR/staff systems
is a future step, out of scope here.

## Users / Roles

- **Field staff** — check in/out, see their assigned shift, request leave.
- **Manager/admin** — assign shifts to staff, approve/reject leave
  requests, view attendance records.

## Platform

Mobile-first installable PWA (Next.js + `next-pwa`), usable in a desktop
browser for the manager dashboard too. No native app store distribution
for v1.

## Architecture

Single Next.js (App Router) app with two route groups:

- `/staff` — the field-staff-facing PWA
- `/admin` — the manager/admin dashboard

Supabase provides Postgres (data), Auth (login), and Row Level Security
(role-based data access). One codebase, one deploy target.

## Data model (Supabase / Postgres)

- `profiles` — linked to `auth.users`; `role`: `'staff' | 'manager'`
- `shifts` — `staff_id`, `date`, `start_time`, `end_time`, `assigned_by`
- `attendance` — `staff_id`, `shift_id`, `check_in_at`, `check_in_lat`,
  `check_in_lng`, `check_out_at`, `check_out_lat`, `check_out_lng`
- `leave_requests` — `staff_id`, `start_date`, `end_date`, `reason`,
  `status` (`pending | approved | rejected`), `reviewed_by`

RLS policies: staff can read/write only their own rows in `attendance`
and `leave_requests`, and read their own `shifts`. Managers can
read/write all rows.

## Components

**Staff PWA**
- Login
- Home: today's assigned shift + Check-in / Check-out button
- Leave request form
- Leave history list

**Admin dashboard**
- Login
- Staff list
- Shift assignment (per staff member, per date)
- Leave approval queue (approve/reject)
- Attendance report table

## Data flow

1. Staff logs in → sees today's assigned shift (from `shifts`, filtered
   by `staff_id` + today's date).
2. Staff taps Check-in → browser Geolocation API captures lat/lng → row
   inserted into `attendance` with `check_in_at` + coordinates.
3. Staff taps Check-out → same row updated with `check_out_at` +
   coordinates.
4. Manager logs in → role-gated `/admin` routes → assigns shifts
   (insert into `shifts`) → reviews `leave_requests` queue, updates
   `status` on approve/reject → views attendance report (joined read
   across `attendance` + `profiles` + `shifts`).

## Error handling

- Geolocation permission denied → inline message + retry button;
  check-in is blocked until location is granted.
- Network / Supabase errors → toast notification.
- No shift assigned for today → staff sees a "no shift today" empty
  state instead of a broken check-in control.

## Testing

Manual flow testing for the MVP: login as staff → check-in/out → login
as manager → assign shift → approve leave. No automated test suite for
v1 (YAGNI at demo stage); revisit if/when this moves toward production.

## Out of scope (v1)

- Selfie verification on check-in/out
- Integration with Snabbit's real HR/staff systems
- Native mobile app (React Native/Flutter)
- Automated test suite
