import type { AttendanceStatus, Role, LeaveStatus } from './types'

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  marked_absent: 'Marked',
  no_show: 'No Show',
  not_marked: 'Not Marked',
  false_attendance: 'False Attendance',
  on_leave: 'On leave',
}

export const ROLE_LABELS: Record<Role, string> = {
  staff: 'Staff',
  team_lead: 'Team Lead',
  manager: 'Manager',
}

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}
