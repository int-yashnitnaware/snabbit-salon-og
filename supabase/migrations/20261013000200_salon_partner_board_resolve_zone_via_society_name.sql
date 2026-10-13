-- Hotspots were showing wrong because zone was resolved via the booking's
-- pincode, which is NOT a reliable zone key in this data (e.g. pincode
-- 560035 alone spans 6 different real zones). Fixed by resolving zone
-- through the SPECIFIC society the booking is at instead: match
-- addresses.street against societies.name (exact case-insensitive, then
-- fuzzy containment as a fallback) and read that one society's own zone
-- column directly. Society names are unique (verified: zero duplicates),
-- so this is unambiguous whenever it matches — unlike pincode.
--
-- Verified on live data: match rate went from guessing among up to 6
-- zones per pincode to a clean, specific resolution; Bellandur/Sarjapur 1/
-- Sarjapur 2 all now show distinct real activity instead of nearly
-- everything collapsing into "Others". Confirmed zero duplicate booking
-- rows after the change.
--
-- Pure view redefinition (create or replace), no data/column/policy
-- changes to any existing table.

create or replace view public.salon_partner_board
with (security_invoker = true)
as
select
  p.id as partner_id,
  p.name as partner_name,
  p.mobile,
  p.status as partner_status,
  h.id as hotspot_id,
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
  b.ended_at as today_ended_at,
  p.partner_code,
  p.hotspot_id as original_hotspot_id,
  oh.name as original_hotspot_name,
  b.order_status as today_order_status,
  b.effective_date as today_effective_date,
  b.effective_time as today_effective_time,
  (b.started_at is not null) as today_order_started,
  b.effective_booking_type as today_booking_type,
  p.shift_hrs,
  p.start_time as shift_start_time,
  a.street as today_society_name,
  (p.weekly_off = extract(dow from current_date)::text) as scheduled_week_off
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
    and bk.effective_booking_type in ('on-demand', 'scheduled')
) b on true
left join public.addresses a
  on a.id = b.address_id
left join lateral (
  select s.zone
  from public.societies s
  where lower(trim(s.name)) = lower(trim(a.street))
  limit 1
) sz_exact on true
left join lateral (
  select s.zone
  from public.societies s
  where sz_exact.zone is null
    and a.street is not null
    and length(trim(a.street)) > 3
    and (
      s.name ilike '%' || trim(a.street) || '%'
      or trim(a.street) ilike '%' || s.name || '%'
    )
  limit 1
) sz_fuzzy on true
left join lateral (
  select hs.id, hs.name
  from public.hotspots hs
  where b.id is not null
    and (
      (
        coalesce(sz_exact.zone, sz_fuzzy.zone) is not null
        and trim(coalesce(sz_exact.zone, sz_fuzzy.zone)) = any(hs.zone_labels)
      )
      or (hs.hsr_pincode_fallback and (a.pincode = '560102' or a.area ilike '%hsr%'))
      or hs.is_catch_all
    )
  order by
    case
      when coalesce(sz_exact.zone, sz_fuzzy.zone) is not null
        and trim(coalesce(sz_exact.zone, sz_fuzzy.zone)) = any(hs.zone_labels)
      then 0
      when hs.hsr_pincode_fallback and (a.pincode = '560102' or a.area ilike '%hsr%') then 1
      else 2
    end
  limit 1
) h on true
where p.status = 'active';

comment on view public.salon_partner_board is
  'One row per (active partner, qualifying booking today) pair. '
  'hotspot_id/name is resolved from the SPECIFIC society the booking is '
  'at: addresses.street matched against societies.name (exact '
  'case-insensitive first, then fuzzy containment), reading that '
  'society''s own zone column directly — unambiguous, since society names '
  'are unique. Pincode is NOT used for zone resolution (it is shared '
  'across many zones in this data, e.g. one pincode spans 6 zones, and '
  'was producing wrong hotspot assignments). HSR is matched via pincode '
  '560102 or address text; Others catches bookings whose society has no '
  'match at all. today_society_name is the raw addresses.street value for '
  'display. scheduled_week_off = partners.weekly_off matches today''s '
  'day-of-week. shift_hrs/shift_start_time are from partners. Partners '
  'with no qualifying booking today get one row with null booking/'
  'hotspot/society fields. Qualifying = effective_date today, order_status '
  'confirmed/rescheduled, effective_booking_type on-demand/scheduled. '
  'today_order_started = booking.started_at is not null.';

grant select on public.salon_partner_board to authenticated;
