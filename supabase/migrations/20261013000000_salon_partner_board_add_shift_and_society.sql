-- Adds partner shift timing (partners.shift_hrs, partners.start_time)
-- and the precise order location (addresses.street — the society/
-- apartment name, e.g. "SJR Palazza City") to salon_partner_board.
--
-- addresses.street is a much more precise and reliable location signal
-- than pincode: no ambiguity, matches real societies.name values exactly
-- in spot checks (e.g. "SJR Palazza City" appears verbatim in both
-- addresses.street and societies.name for pincode 560035). hotspot_id/
-- name stays as the broader zone bucket for filtering/tabs; this adds
-- the precise society name alongside it for display, not as a
-- replacement.
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
  a.street as today_society_name
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
  'today_society_name is addresses.street for that booking — the actual '
  'apartment/society name (e.g. "SJR Palazza City"), not a full address; '
  'this is precise, unlike hotspot_id/name which is the broader zone '
  'bucket (ambiguous for many shared pincodes — see prior migration). '
  'shift_hrs/shift_start_time are from partners, for display only. '
  'Partners with no qualifying booking today get one row with null '
  'booking/hotspot/society fields. Qualifying = effective_date today, '
  'order_status confirmed/rescheduled, effective_booking_type '
  'on-demand/scheduled. today_order_started = booking.started_at is not '
  'null.';

grant select on public.salon_partner_board to authenticated;
