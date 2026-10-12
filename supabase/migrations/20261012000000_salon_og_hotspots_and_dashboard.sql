-- Salon OG: hotspot schema + Hub Manager/CLM role tagging + dashboard view.
--
-- Target project: "Blush Master" (acuwcmnijzltwvhrvjmh), the live Blush
-- salon/beauty booking backend. This migration is purely additive:
--   - new table (hotspots)
--   - new nullable columns (partners.hotspot_id, app_admins.role)
--   - new RLS policies, scoped only to the new table
--   - new view (no table data is altered, no existing RLS policy is
--     changed — partners/partner_attendance already allow is_admin()
--     writes, which is all Hub Manager/CLM need)
--
-- NOT YET APPLIED. Review before running (e.g. `supabase db push`,
-- or paste into the SQL editor) against the Blush Master project.
--
-- See docs/superpowers/specs/2026-10-12-salon-og-real-data-integration-design.md
-- for the design this implements.

-- 1. Hotspots lookup table -----------------------------------------------

create table public.hotspots (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  zone_labels text[] not null default '{}',
  hsr_pincode_fallback boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.hotspots is
  'Salon OG field-ops areas. zone_labels match (trimmed) societies.zone values. '
  'hsr_pincode_fallback = true marks the one hotspot (HSR) with no society/zone '
  'data at all, resolved instead via addresses.pincode = ''560102''.';

alter table public.hotspots enable row level security;

create policy hotspots_select on public.hotspots
  for select
  to authenticated
  using (true);

create policy hotspots_admin_write on public.hotspots
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.hotspots to authenticated;
grant insert, update, delete on public.hotspots to authenticated;

insert into public.hotspots (name, zone_labels, hsr_pincode_fallback) values
  ('Bellandur',  array['Bellandur Zone', 'DK Zone 2'], false),
  ('Sarjapur 1', array['Kasavanahalli Zone', 'Choodasandra Zone', 'Harlur Zone'], false),
  ('Sarjapur 2', array['DK Zone 1'], false),
  ('HSR', array[]::text[], true);

-- 2. Link partners to a hotspot (manually assigned, no existing data) ----

alter table public.partners
  add column hotspot_id uuid references public.hotspots(id);

comment on column public.partners.hotspot_id is
  'Salon OG field-ops area, set manually by Hub Manager/CLM at onboarding. '
  'No existing data links a partner to an area, so this starts null for everyone.';

-- 3. Tag which admins are Hub Manager / CLM -------------------------------
-- Reuses the existing app_admins + is_admin() mechanism (required by the
-- existing partner_attendance/partners RLS policies) rather than a parallel
-- identity table. `role` is advisory only (drives which screens the app
-- shows); it does not change what is_admin() grants.

alter table public.app_admins
  add column role text check (role in ('hub_manager', 'clm'));

comment on column public.app_admins.role is
  'Salon OG screen selector: hub_manager marks attendance, clm tracks field '
  'location/live orders. Null = generic admin, sees both. Not a hard '
  'permission boundary — both roles are is_admin() either way.';

-- 4. Dashboard view: one row per active partner, their hotspot, today's -----
--    attendance, and today's most relevant live booking.
--
-- security_invoker = true is required (Postgres 15+ default is OFF) so this
-- view enforces the querying user's own RLS instead of the view owner's —
-- without it, this would silently bypass partners/partner_attendance RLS.

create or replace view public.salon_partner_board
with (security_invoker = true)
as
select
  p.id as partner_id,
  p.name as partner_name,
  p.mobile,
  p.status as partner_status,
  p.hotspot_id,
  h.name as hotspot_name,
  pa.manual_status,
  pa.attendance_state,
  pa.punctuality_status,
  pa.hub_check_in,
  pa.hub_check_out,
  pa.edited_by as attendance_edited_by,
  pa.edited_at as attendance_edited_at,
  b.id as today_booking_id,
  b.service_stage as today_service_stage,
  b.scheduled_time as today_scheduled_time,
  b.started_at as today_started_at,
  b.reached_at as today_reached_at,
  b.ended_at as today_ended_at
from public.partners p
left join public.hotspots h
  on h.id = p.hotspot_id
left join public.partner_attendance pa
  on pa.partner_id = p.id and pa.date = current_date
left join lateral (
  select bk.*
  from public.bookings bk
  where bk.assigned_partner_id = p.id
    and bk.scheduled_date = current_date
    and bk.service_stage <> 'unassigned'
  order by
    case when bk.service_stage <> 'service_ended' then 0 else 1 end,
    bk.scheduled_time asc nulls last
  limit 1
) b on true
where p.status = 'active';

comment on view public.salon_partner_board is
  'One row per active partner for today: hotspot, Hub Manager-marked '
  'attendance, and the most relevant live booking (an in-progress one if '
  'any exists, else the next/last one today). today_service_stage is null '
  'when the partner has no booking today at all (shown as "No job today" '
  'in the app, not an error).';

grant select on public.salon_partner_board to authenticated;

-- 5. Next partner_code helper ---------------------------------------------
-- Existing codes follow 'BL' + sequential number (e.g. BL112, BL113).
-- Simple max+1 — fine for a low-volume, manually-triggered registration
-- flow; not safe under truly concurrent inserts (two Hub Managers
-- registering a partner in the same instant could collide). Acceptable
-- for v1; revisit with a sequence if registration volume grows.

create or replace function public.next_partner_code()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select 'BL' || (coalesce(max(substring(partner_code from 3)::int), 0) + 1)::text
  from public.partners
  where partner_code ~ '^BL[0-9]+$';
$$;

grant execute on function public.next_partner_code() to authenticated;
