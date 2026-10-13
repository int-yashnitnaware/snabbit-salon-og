export interface AppAdmin {
  email: string
  name: string | null
  is_super: boolean
}

export interface Hotspot {
  id: string
  name: string
}

export type ManualStatus = 'present' | 'absent' | 'off_present' | 'week_off' | 'half_day'
export type AttendanceState = 'present' | 'leave' | 'week_off_absent' | 'week_off_present'
export type PunctualityStatus = 'early' | 'on_time' | 'late'
export type ServiceStage =
  | 'unassigned'
  | 'assigned'
  | 'order_accepted'
  | 'ready_to_go'
  | 'reached'
  | 'service_ended'

export interface SalonPartnerBoardRow {
  partner_id: string
  partner_name: string
  partner_code: string | null
  mobile: string | null
  partner_status: string | null
  /** Current hotspot — derived from the partner's booking today. */
  hotspot_id: string | null
  hotspot_name: string | null
  /** Original hotspot — static partners.hotspot_id, set by Hub Manager at onboarding. */
  original_hotspot_id: string | null
  original_hotspot_name: string | null
  manual_status: ManualStatus | null
  attendance_state: AttendanceState | null
  punctuality_status: PunctualityStatus | null
  hub_check_in: string | null
  hub_check_out: string | null
  attendance_edited_by: string | null
  attendance_edited_at: string | null
  today_booking_id: string | null
  today_service_stage: ServiceStage | null
  today_scheduled_time: string | null
  today_started_at: string | null
  today_reached_at: string | null
  today_ended_at: string | null
  today_order_status: string | null
  today_effective_date: string | null
  today_effective_time: string | null
  today_order_started: boolean
  today_booking_type: 'on-demand' | 'scheduled' | null
  shift_hrs: number | null
  shift_start_time: string | null
  /** The society/apartment name for today's order (addresses.street) — precise, unlike hotspot_name which is a broad zone bucket. */
  today_society_name: string | null
}

export const MANUAL_STATUS_LABELS: Record<ManualStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  off_present: 'Off (Present)',
  week_off: 'Week Off',
  half_day: 'Half Day',
}

export const SERVICE_STAGE_LABELS: Record<ServiceStage, string> = {
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  order_accepted: 'Accepted',
  ready_to_go: 'Ready to go',
  reached: 'Reached customer',
  service_ended: 'Service ended',
}
