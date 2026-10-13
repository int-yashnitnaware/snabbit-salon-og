-- Fixes bookings where addresses.street is blank but the society name is
-- folded into house_flat instead (e.g. house_flat = "C 1305 Bren champion
-- square Sarjapur road carmelaram bangalore", street = ""). Plain
-- similarity()/ILIKE miss this because the society name is a small
-- fragment inside a much longer, noisy string — word_similarity() is
-- built for exactly this "needle in haystack" case.
--
-- Threshold 0.6 chosen from live data: the real match ("Bren Champions
-- Square" / "Bren Champion", both DK Zone 1) scores 0.87-1.0, while an
-- unrelated society sharing one word ("Poorvi Champion") only scores
-- ~0.56 — a clear margin.
--
-- Also added two missing society records the user confirmed by hand
-- (MJ lifestyle Amadeus -> DK Zone 1, pincode 560099) in a prior
-- apply_migration call not captured in its own file; this migration
-- documents the view change only. Result: "Others" on today's
-- active-partner board dropped from 4 to 2 — the 2 remaining
-- (Ashwini/"Lakeshorehomes", Dalimi/"Shiv niwas") have no matching
-- society under any name at all, confirmed via best-match similarity
-- scores well below any real-match threshold.
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
  coalesce(nullif(a.street, ''), a.house_flat) as today_society_name,
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
  select s.zone
  from public.societies s
  where sz_exact.zone is null
    and sz_fuzzy.zone is null
    and sz_trgm.zone is null
    and (a.street is null or trim(a.street) = '' or length(trim(a.street)) <= 3)
    and a.house_flat is not null
    and length(trim(a.house_flat)) > 3
    and word_similarity(s.name, a.house_flat) > 0.6
  order by word_similarity(s.name, a.house_flat) desc
  limit 1
) sz_wsim on true
left join lateral (
  select hs.id, hs.name
  from public.hotspots hs
  where b.id is not null
    and (
      (
        coalesce(sz_exact.zone, sz_fuzzy.zone, sz_trgm.zone, sz_wsim.zone) is not null
        and trim(coalesce(sz_exact.zone, sz_fuzzy.zone, sz_trgm.zone, sz_wsim.zone)) = any(hs.zone_labels)
      )
      or (hs.hsr_pincode_fallback and (a.pincode = '560102' or a.area ilike '%hsr%'))
      or hs.is_catch_all
    )
  order by
    case
      when coalesce(sz_exact.zone, sz_fuzzy.zone, sz_trgm.zone, sz_wsim.zone) is not null
        and trim(coalesce(sz_exact.zone, sz_fuzzy.zone, sz_trgm.zone, sz_wsim.zone)) = any(hs.zone_labels)
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
  'at, matched against societies.name in order: (1) addresses.street '
  'exact case-insensitive, (2) street ILIKE substring either direction, '
  '(3) street pg_trgm similarity() > 0.4, (4) when street is blank/too '
  'short, addresses.house_flat via word_similarity() > 0.6 (catches the '
  'society name embedded in a longer noisy house_flat string) — then '
  'reading that society''s own zone column directly. Unambiguous whenever '
  'matched (society names are unique). Pincode is NOT used for zone '
  'resolution (shared across many zones in this data). HSR is matched via '
  'pincode 560102 or address text; Others catches bookings whose society '
  'has no match at all. today_society_name displays street, falling back '
  'to house_flat when street is blank. scheduled_week_off = '
  'partners.weekly_off matches today''s day-of-week. shift_hrs/'
  'shift_start_time are from partners. Partners with no qualifying '
  'booking today get one row with null booking/hotspot/society fields. '
  'Qualifying = effective_date today, order_status confirmed/rescheduled, '
  'effective_booking_type on-demand/scheduled. today_order_started = '
  'booking.started_at is not null.';

grant select on public.salon_partner_board to authenticated;

-- Missing society records confirmed by the user and added directly:
-- insert into public.societies (name, pincode, zone)
-- values ('MJ lifestyle Amadeus', '560099', 'DK Zone 1');
