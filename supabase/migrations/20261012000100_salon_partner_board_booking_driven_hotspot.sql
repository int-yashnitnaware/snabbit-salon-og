-- Fix salon_partner_board: show both Original Hotspot (partners.hotspot_id,
-- set manually by Hub Manager at onboarding) and Current Hotspot (derived
-- from the partner's assigned booking today, via bookings -> addresses ->
-- societies.zone). The board was empty because nothing populates
-- partners.hotspot_id in practice and nothing derived a hotspot from real
-- bookings at all.
--
-- Also switches the booking-date filter from scheduled_date to
-- effective_date, which is bookings' own field for "the date this booking
-- actually falls on today, accounting for reschedules" — scheduled_date
-- stays frozen at the original booking time even after a reschedule, so
-- filtering on it silently misses rescheduled-to-today bookings.
--
-- "Started or not" is now a single boolean (today_order_started).
--
-- Purely a view redefinition (create or replace), no data/column/policy
-- changes. Fully reversible by reapplying the previous version in
-- 20261012000000_salon_og_hotspots_and_dashboard.sql.

create or replace view public.salon_partner_board
with (security_invoker = true)
as
select
  p.id as partner_id,
  p.name as partner_name,
  p.partner_code,
  p.mobile,
  p.status as partner_status,
  p.hotspot_id as original_hotspot_id,
  oh.name as original_hotspot_name,
  h.id as current_hotspot_id,
  h.name as current_hotspot_name,
  pa.manual_status,
  pa.attendance_state,
  pa.punctuality_status,
  pa.hub_check_in,
  pa.hub_check_out,
  pa.edited_by as attendance_edited_by,
  pa.edited_at as attendance_edited_at,
  b.id as today_booking_id,
  b.order_status as today_order_status,
  b.effective_date as today_effective_date,
  b.effective_time as today_effective_time,
  b.started_at as today_started_at,
  (b.started_at is not null) as today_order_started
from public.partners p
left join public.hotspots oh
  on oh.id = p.hotspot_id
left join public.partner_attendance pa
  on pa.partner_id = p.id and pa.date = current_date
left join lateral (
  select bk.*
  from public.bookings bk
  where bk.assigned_partner_id = p.id
    and bk.effective_date = current_date
    and bk.order_status in ('confirmed', 'rescheduled')
  order by bk.effective_time asc nulls last
  limit 1
) b on true
left join public.addresses a
  on a.id = b.address_id
left join lateral (
  select s.zone
  from public.societies s
  where s.pincode = a.pincode
  limit 1
) sz on true
left join public.hotspots h on (
  trim(sz.zone) = any(h.zone_labels)
  or (h.hsr_pincode_fallback and a.pincode = '560102')
)
where p.status = 'active';

comment on view public.salon_partner_board is
  'One row per active partner for today. original_hotspot_* is the static '
  'partners.hotspot_id assignment (set by Hub Manager at onboarding). '
  'current_hotspot_* is derived from the partner''s earliest booking today '
  '(effective_date = today, confirmed or rescheduled), via that booking''s '
  'address -> societies.zone (HSR via pincode 560102 fallback). Both are '
  'null when not applicable — shown as unassigned/no job today, not an '
  'error. today_order_started = booking.started_at is not null.';
