# Salon OG — Real Supabase Integration Design

Date: 2026-10-12

## Purpose

This spec supersedes the data/auth architecture of the earlier mock-data
spec (`2026-10-12-salon-og-clm-partner-design.md`) now that the app is
connecting to Snabbit's real production Supabase project for the salon
business. The mock-data build already done (CLM/Partner apps against
`localStorage`) stays as-is as a throwaway UI prototype; this spec
describes what the real build replaces it with.

**Project:** Supabase project "Blush Master" (`acuwcmnijzltwvhrvjmh`).
This is confirmed to be the live, already-operating salon/beauty booking
platform (`blushnow.in` — waxing, threading, facials, mani-pedi, hair
services, saree draping), not a separate business vertical. `partners`,
`partner_attendance`, `partner_leaves`, `partner_deallocations`,
`bookings`, and `societies` are real, in-production tables with live
data (98 partners, 580+ bookings per partner, thousands of attendance
records). All exploration for this spec was read-only; **no schema
changes or writes have been made to this project.** The exact DDL for
the additive schema changes this spec proposes is listed at the end,
for separate review and approval before anything runs.

## Users / Roles (revised from the mock-data spec)

Three roles. Team Leads remain out of scope (unchanged).

- **Hub Manager** — registers partners and marks their daily attendance
  at a physical hub check-in step. Owns writes to `partner_attendance`
  (present/absent/leave/half-day, `hub_check_in`/`hub_check_out`
  timestamps). This is the ground-truth record of whether a partner
  showed up to work at all.
- **CLM (Cluster Manager)** — tracks partners' field location and live
  service delivery *after* hub check-in. Filters partners by hotspot
  (Bellandur / Sarjapur 1 / Sarjapur 2 / HSR), cross-checks against live
  `bookings` data to see whether a partner is actually on a job right
  now, calls partners/TLs by phone when something looks off (no
  automated fraud detection — a human-in-the-loop check, same
  philosophy as the mock-data spec). CLM does **not** mark attendance.
- **Team Lead (TL)** — no login, no data footprint, pure phone
  coordination (unchanged from the mock-data spec).
- **Partner** — no app, no login. A tracked `partners` row only;
  attendance is marked on their behalf by the Hub Manager.

Both Hub Manager and CLM authenticate the same way (see Auth below) and
are differentiated only by which screens of the app they use, not by a
hard permission split — consistent with keeping this simple. If finer
role separation (e.g., a CLM who can't mark attendance even if they
tried) turns out to matter, that's a small follow-up, not a redesign.

## Data model

### Tables used directly, as-is (no new columns except where noted)

- **`partners`** — `id` (uuid), `partner_code`, `name`, `mobile`,
  `address`, `shift_hrs`, `start_time`, `weekly_off`, `vehicle`,
  `join_date`, `status`, `pin`, `email`, `is_verified_at_hub`. This is
  the real beautician roster (98 rows today). Read for the partner
  list; a new nullable `hotspot_id` column is added here (see "New,
  additive schema" below) since no existing column links a partner to
  an area.
- **`partner_attendance`** — `id`, `partner_id`, `date`,
  `checked_in_at`, `checked_out_at`, `punctuality_status`
  (`early`/`on_time`/`late`), `leave_status`
  (`unplanned_leave`/`planned_leave`/`menstrual_leave`/`mia`),
  `attendance_state`
  (`present`/`leave`/`week_off_absent`/`week_off_present`),
  `leave_classification`, `half_day_flag`, `late_flag`, `ot_hours`,
  `edited_by`, `edited_at`, `leave_note`, `manual_status`
  (`present`/`absent`/`off_present`/`week_off`/`half_day`),
  `hub_check_in`, `hub_check_out`, `aaj_mein_aaungi_at`,
  `lunch_started_at`, `lunch_ended_at`, `refill_done_at`,
  `not_coming_at`. The Hub Manager's "mark attendance" action writes
  `manual_status`, `attendance_state`, `hub_check_in`/`hub_check_out`,
  and `edited_by` here — using these exact existing values, not a new
  vocabulary. Fields irrelevant to a first cut of this feature
  (`aaj_mein_aaungi_at`, `refill_done_at`, lunch fields) are simply left
  null, same as many existing rows already are.
- **`bookings`** — read-only. Joined via `assigned_partner_id = partners.id`.
  Live-order signal comes from `service_stage`
  (`unassigned → assigned → order_accepted → ready_to_go → reached →
  service_ended`), `started_at`, `ended_at`, `reached_at`,
  `scheduled_date`. "Is this partner currently on a job" = a booking
  for that partner where `scheduled_date` is today and `service_stage`
  is past `assigned` but not yet `service_ended`.
- **`societies`** — read-only. `zone` (text), `pincode`, `lat`/`lng`,
  `geofence_radius_m`. Used only for hotspot resolution (below).
- **`addresses`** — read-only, via `bookings.address_id`. `pincode`,
  `area` (free text). Used for the HSR fallback.

### New, additive schema (proposed — not yet applied; see DDL below)

- **`hotspots`** — a small lookup table: `id`, `name` (`Bellandur` /
  `Sarjapur 1` / `Sarjapur 2` / `HSR`), `zone_labels` (text array of the
  matching `societies.zone` values), `hsr_pincode_fallback` (boolean,
  true only for the HSR row, which has no matching `societies.zone`
  data at all).
- **`partners.hotspot_id`** — nullable FK to `hotspots.id`. This is the
  field a Hub Manager/CLM sets when a partner is onboarded/assigned to
  an area. No existing column serves this purpose today.
- **Hub Manager / CLM accounts** — a new table (e.g. `app_admins`
  reused, or a parallel table — exact shape decided at DDL-review time)
  holding `@snabbit.com` email identities for both roles, since neither
  role exists in the current schema.

## Hotspot resolution

Four hotspots, defined by real zone/pincode data already in `societies`:

| Hotspot | Resolution rule |
|---|---|
| Bellandur | `trim(societies.zone)` IN (`Bellandur Zone`, `DK Zone 2`) |
| Sarjapur 1 | `trim(societies.zone)` IN (`Kasavanahalli Zone`, `Choodasandra Zone`, `Harlur Zone`) |
| Sarjapur 2 | `trim(societies.zone)` = `DK Zone 1` |
| HSR | `addresses.pincode = '560102'` (no society/zone record exists for HSR at all — 2,444 real bookings found there despite that) |

For a **booking**, hotspot is resolved live via
`bookings → addresses (by address_id) → societies (by pincode)`, with
the HSR pincode check as a fallback when no society match is found
(verified: this join correctly buckets real booking counts across all
four groups).

For a **partner**, hotspot is not derivable from existing data (no
society/zone link exists for partners) — it's the new
`partners.hotspot_id`, set manually by the Hub Manager/CLM when a
partner is onboarded or reassigned.

Known data quality note: one `societies.zone` value is literally
`"Bellandur Zone \n"` (trailing whitespace/newline) — all zone
comparisons must `trim()` first or this silently creates a 5th,
unintended bucket.

## Auth

Both Hub Manager and CLM authenticate via Supabase Auth using their
`@snabbit.com` email — the same mechanism the existing `is_admin()`
Postgres function already uses in production
(`auth_email() like '%@snabbit.com' and exists (select 1 from
app_admins where lower(email) = auth_email())`). This isn't a stylistic
choice: the existing RLS policy on `partner_attendance`
(`partner_attendance_insert`/`_update`) only allows writes from
`is_admin()` or the partner themself, so a custom phone/PIN-based
session for Hub Manager/CLM would not satisfy that policy without
building a parallel auth path. Reusing `is_admin()` means these roles
get real RLS protection with no new backend auth code.

Partners are **not** authenticated by this app at all (no partner app,
per the revised roles above) — `partners.pin`, which the real field app
appears to use, is irrelevant to this build.

## Error handling

- No `hotspot_id` set on a partner → CLM/Hub Manager screens show
  "Unassigned" instead of a hotspot name, not an error; filterable as
  its own bucket.
- No booking found for a partner today → CLM sees "No job today"
  instead of a broken live-status indicator.
- `societies.zone` null/unmapped values (other than the known HSR gap)
  → partner/booking falls into an "Unknown zone" bucket rather than
  silently being dropped from counts.

## Testing

Manual verification against real (read-only, for now) data: confirm
the hotspot-resolution queries bucket real bookings into the 4 groups
correctly (already verified during this design's research — see chat
history), confirm `partner_attendance` status values written by a Hub
Manager action match the existing vocabulary exactly, confirm the
live-booking join correctly reflects `service_stage` for a few sampled
partners. No automated test suite (same call as the mock-data spec).

## Out of scope (this phase)

- Any actual write to Supabase — schema changes and the first real
  data writes happen only after the DDL below is explicitly approved.
- Partner-facing app/login (removed from scope entirely per the role
  revision above).
- Fine-grained permission split between Hub Manager and CLM beyond
  "both are `@snabbit.com` admins."
- Selfie capture for Hub Manager/CLM (no longer meaningful once auth is
  email-based rather than phone+selfie — can be added back as a
  profile photo if wanted, but it's not an auth mechanism here).
- Automated geofence/GPS fraud detection (unchanged from the mock-data
  spec — CLM cross-checks via live bookings and phone calls, not
  automated flags).

## Proposed DDL (for review only — do not run yet)

```sql
-- New hotspots lookup table
create table public.hotspots (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  zone_labels text[] not null default '{}',
  hsr_pincode_fallback boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.hotspots enable row level security;

insert into public.hotspots (name, zone_labels, hsr_pincode_fallback) values
  ('Bellandur', array['Bellandur Zone', 'DK Zone 2'], false),
  ('Sarjapur 1', array['Kasavanahalli Zone', 'Choodasandra Zone', 'Harlur Zone'], false),
  ('Sarjapur 2', array['DK Zone 1'], false),
  ('HSR', array[]::text[], true);

-- New nullable column linking a partner to a hotspot
alter table public.partners
  add column hotspot_id uuid references public.hotspots(id);
```

RLS policies for `hotspots` and the exact shape of the Hub
Manager/CLM accounts table are intentionally left out of this draft —
they need a short follow-up decision (reuse `app_admins` directly vs. a
parallel table, and what `select`/`insert` policies make sense) before
being finalized, so they aren't presented as a fait accompli.
