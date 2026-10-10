export type Role = 'staff' | 'team_lead' | 'manager'

export interface Hotspot {
  id: string
  name: string
}

export interface Profile {
  id: string
  fullName: string
  role: Role
  hotspotId: string | null
  isOnDuty: boolean
}

export interface Shift {
  id: string
  staffId: string
  hotspotId: string
  date: string
  startTime: string
  endTime: string
}

export type AttendanceStatus =
  | 'present'
  | 'marked_absent'
  | 'no_show'
  | 'not_marked'
  | 'false_attendance'
  | 'on_leave'

export interface Attendance {
  id: string
  staffId: string
  shiftId: string
  hotspotId: string
  date: string
  status: AttendanceStatus
  checkInAt: string | null
  checkOutAt: string | null
  isFalseNegative: boolean
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveRequest {
  id: string
  staffId: string
  startDate: string
  endDate: string
  reason: string
  status: LeaveStatus
}

export interface AppNotification {
  id: string
  message: string
  hotspotId: string
  readAt: string | null
  createdAt: string
}
