-- Week-off was showing 0 instead of 10 because attendance_state's
-- week_off_absent/week_off_present values are frequently never written at
-- all for a partner's scheduled day off — no partner_attendance row gets
-- created, so the partner just looked "not marked". Confirmed: all 10 of
-- today's scheduled-off partners (partners.weekly_off matching today's
-- day-of-week) have null manual_status AND null attendance_state.
--
-- Adds scheduled_week_off — partners.weekly_off = extract(dow from
-- current_date)::text — as the authoritative "is this their day off"
-- signal. Frontend priority (see isWeekOff() in src/app/clm/page.tsx):
-- explicit manual_status wins first (e.g. off_present = worked despite
-- being off), then attendance_state's week_off_* values, then this
-- scheduled_week_off fallback.
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
  'One row per (active partner, qualifying booking today) pair. '
  'scheduled_week_off = partners.weekly_off matches today''s day-of-week '
  '(0=Sun..6=Sat) — the authoritative source for whether a partner is '
  'scheduled off today. attendance_state''s week_off_absent/'
  'week_off_present values are frequently never written for a scheduled '
  'off day (no attendance row gets created at all), so scheduled_week_off '
  'is what callers should check first, falling back to manual_status for '
  'an explicit override (e.g. off_present = worked despite being '
  'scheduled off). today_society_name is addresses.street (precise '
  'society/apartment name). hotspot_id/name is the broader zone bucket. '
  'shift_hrs/shift_start_time are from partners. Partners with no '
  'qualifying booking today get one row with null booking/hotspot/'
  'society fields. Qualifying = effective_date today, order_status '
  'confirmed/rescheduled, effective_booking_type on-demand/scheduled. '
  'today_order_started = booking.started_at is not null.';

grant select on public.salon_partner_board to authenticated;
