export type AdminRole = 'hub_manager' | 'clm' | null

export interface AppAdmin {
  email: string
  name: string | null
  is_super: boolean
  role: AdminRole
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
  mobile: string | null
  partner_status: string | null
  hotspot_id: string | null
  hotspot_name: string | null
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
