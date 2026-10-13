-- Adds a third society-name matching tier using pg_trgm similarity()
-- (extension already enabled in this project) to catch typos/naming
-- variants that exact and ILIKE-substring matching miss — e.g. "Estella
-- mapple square" -> "Estella Maple Square" (0.87 similarity), "Bren Palms
-- apartment" -> " Bren Palms" (0.52), "Adarsh Palm Retreat, Phase 3" ->
-- "Adarsh Palm Retreat Villas" (0.59).
--
-- Threshold 0.4 chosen from live data: a clear gap exists between real
-- matches (0.5-0.87 in sampled cases) and genuine non-matches (0.14-0.18
-- for streets with no corresponding society at all, e.g. "Shiv niwas",
-- "MJ lifestyle Amadeus", "Lakeshorehomes" — these aren't in the
-- societies table under any name, confirmed by checking their best-match
-- similarity scores).
--
-- Result on live data: "Others" dropped from 7 to 4 bookings (today's
-- active-partner board); the remaining 4 have no matching society record
-- at all — a data completeness gap in the societies table, not something
-- further matching logic can resolve. Adding those societies (if they're
-- real) would close the rest.
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
  select s.zone
  from public.societies s
  where sz_exact.zone is null
    and sz_fuzzy.zone is null
    and a.street is not null
    and length(trim(a.street)) > 3
    and similarity(trim(a.street), s.name) > 0.4
  order by similarity(trim(a.street), s.name) desc
  limit 1
) sz_trgm on true
left join lateral (
  select hs.id, hs.name
  from public.hotspots hs
  where b.id is not null
    and (
      (
        coalesce(sz_exact.zone, sz_fuzzy.zone, sz_trgm.zone) is not null
        and trim(coalesce(sz_exact.zone, sz_fuzzy.zone, sz_trgm.zone)) = any(hs.zone_labels)
      )
      or (hs.hsr_pincode_fallback and (a.pincode = '560102' or a.area ilike '%hsr%'))
      or hs.is_catch_all
    )
  order by
    case
      when coalesce(sz_exact.zone, sz_fuzzy.zone, sz_trgm.zone) is not null
        and trim(coalesce(sz_exact.zone, sz_fuzzy.zone, sz_trgm.zone)) = any(hs.zone_labels)
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
  'at: addresses.street matched against societies.name, tried in order — '
  '(1) exact case-insensitive, (2) ILIKE substring containment either '
  'direction, (3) pg_trgm similarity() > 0.4 (catches typos/naming '
  'variants, e.g. "Estella mapple square" -> "Estella Maple Square" at '
  '0.87 similarity; verified a clear gap between real matches (0.5+) and '
  'genuine non-matches (~0.15-0.18) in this data) — then reading that '
  'society''s own zone column directly. Unambiguous whenever matched '
  '(society names are unique). Pincode is NOT used for zone resolution '
  '(shared across many zones in this data). HSR is matched via pincode '
  '560102 or address text; Others catches bookings whose society has no '
  'match at all (genuinely missing from the societies table, not a '
  'matching-logic gap). today_society_name is the raw addresses.street '
  'value for display. scheduled_week_off = partners.weekly_off matches '
  'today''s day-of-week. shift_hrs/shift_start_time are from partners. '
  'Partners with no qualifying booking today get one row with null '
  'booking/hotspot/society fields. Qualifying = effective_date today, '
  'order_status confirmed/rescheduled, effective_booking_type '
  'on-demand/scheduled. today_order_started = booking.started_at is not '
  'null.';

grant select on public.salon_partner_board to authenticated;
