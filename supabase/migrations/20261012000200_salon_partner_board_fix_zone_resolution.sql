-- Two real bugs fixed in salon_partner_board's hotspot resolution, found
-- while investigating why Bellandur/Sarjapur 2 showed empty:
--
-- 1. The booking lateral subquery picked only the partner's EARLIEST
--    booking of the day (order by effective_time limit 1), so a partner
--    with jobs in several zones today only ever showed under their first
--    job's zone — the others were silently dropped. Fixed by removing the
--    limit: the view is now one row per (partner, qualifying booking)
--    pair, so a partner with jobs in 3 zones shows up 3 times, once per
--    zone, each with its own order-started status.
--
-- 2. Hotspot was resolved via `societies WHERE pincode = address.pincode
--    LIMIT 1` with no ORDER BY — but pincode is NOT a reliable zone key
--    in this dataset. Pincode 560035 alone is shared by societies across
--    6 different zones (Bellandur, DK Zone 1, DK Zone 2, Harlur,
--    Kasavanahalli, Choodasandra); 560103 also spans 6. The unordered
--    LIMIT 1 was silently picking an arbitrary one of those zones,
--    non-deterministically. None of today's 59 relevant addresses have
--    lat/lng populated either, so the geofence-based matching the
--    societies table is clearly built for (lat/lng/geofence_radius_m)
--    isn't usable with current data.
--
--    Fixed by only resolving a real zone when the booking's pincode maps
--    UNAMBIGUOUSLY to exactly one of the 4 tracked zones (via array
--    overlap between societies.zone values for that pincode and each
--    hotspot's zone_labels, with a count(*) = 1 check). An ambiguous
--    pincode (matches multiple zones) now correctly falls through to the
--    "Others" catch-all instead of guessing. HSR (pincode 560102 or
--    address text) is still checked ahead of the catch-all.
--
-- Practical result on today's real data: most bookings along the
-- "Sarjapur Road" corridor share ambiguous pincodes across all 3 SE
-- zones and land in Others (49 of 59); only HSR resolves cleanly via its
-- distinct pincode (10). This is now an honest reflection of what the
-- address data can support — getting addresses.lat/lng populated would
-- let a future version resolve Bellandur/Sarjapur 1/Sarjapur 2 precisely
-- via geofence distance to societies.lat/lng, matching how the
-- societies table already looks designed to be used.
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
  b.effective_booking_type as today_booking_type
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
  select array_agg(distinct trim(s.zone)) filter (where s.zone is not null) as zones
  from public.societies s
  where s.pincode = a.pincode
) sz on true
left join lateral (
  select hs.id, hs.name
  from public.hotspots hs
  where b.id is not null
    and (
      (
        hs.zone_labels && coalesce(sz.zones, array[]::text[])
        and (
          select count(*) from public.hotspots hz
          where hz.zone_labels && coalesce(sz.zones, array[]::text[])
        ) = 1
      )
      or (hs.hsr_pincode_fallback and (a.pincode = '560102' or a.area ilike '%hsr%'))
      or hs.is_catch_all
    )
  order by
    case
      when hs.zone_labels && coalesce(sz.zones, array[]::text[])
        and (
          select count(*) from public.hotspots hz
          where hz.zone_labels && coalesce(sz.zones, array[]::text[])
        ) = 1
      then 0
      when hs.hsr_pincode_fallback and (a.pincode = '560102' or a.area ilike '%hsr%') then 1
      else 2
    end
  limit 1
) h on true
where p.status = 'active';

comment on view public.salon_partner_board is
  'One row per (active partner, qualifying booking today) pair. hotspot_id/'
  'name is resolved from the booking''s address pincode -> the set of '
  'societies.zone values sharing that pincode. Many pincodes here are '
  'shared across multiple real zones (e.g. 560035 spans 6 zones) and most '
  'addresses have no lat/lng for precise matching, so a pincode only '
  'resolves to a real zone/hotspot when it maps unambiguously to exactly '
  'one of the 4 tracked zones; otherwise (ambiguous pincode, no society '
  'match, or genuinely no zone data) it falls to HSR (pincode 560102 or '
  'address text) then the "Others" catch-all. Partners with no qualifying '
  'booking today get one row with null booking/hotspot fields. Qualifying '
  '= effective_date today, order_status confirmed/rescheduled, '
  'effective_booking_type on-demand/scheduled. today_order_started = '
  'booking.started_at is not null.';

grant select on public.salon_partner_board to authenticated;
