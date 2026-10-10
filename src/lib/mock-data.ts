import type {
  Hotspot,
  Profile,
  Shift,
  Attendance,
  LeaveRequest,
  AppNotification,
} from './types'

const HOTSPOTS: Hotspot[] = [
  { id: 'h1', name: 'Raheja' },
  { id: 'h2', name: 'Andheri West' },
]

const PROFILES: Profile[] = [
  { id: 'u1', fullName: 'Priya Sharma', role: 'staff', hotspotId: 'h1', isOnDuty: false },
  { id: 'u2', fullName: 'Ravi Kumar', role: 'team_lead', hotspotId: 'h1', isOnDuty: true },
  { id: 'u3', fullName: 'Anjali Mehta', role: 'manager', hotspotId: null, isOnDuty: true },
  { id: 'u4', fullName: 'Suresh Patil', role: 'staff', hotspotId: 'h1', isOnDuty: false },
  { id: 'u5', fullName: 'Neha Joshi', role: 'staff', hotspotId: 'h1', isOnDuty: false },
]

const TODAY = new Date().toISOString().slice(0, 10)

const SHIFTS: Shift[] = [
  { id: 's1', staffId: 'u1', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
  { id: 's2', staffId: 'u2', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
  { id: 's3', staffId: 'u4', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
  { id: 's4', staffId: 'u5', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
]

const ATTENDANCE: Attendance[] = [
  { id: 'a1', staffId: 'u1', shiftId: 's1', hotspotId: 'h1', date: TODAY, status: 'present', checkInAt: `${TODAY}T09:05:00`, checkOutAt: null, isFalseNegative: false },
  { id: 'a2', staffId: 'u2', shiftId: 's2', hotspotId: 'h1', date: TODAY, status: 'present', checkInAt: `${TODAY}T08:55:00`, checkOutAt: null, isFalseNegative: false },
  { id: 'a3', staffId: 'u4', shiftId: 's3', hotspotId: 'h1', date: TODAY, status: 'no_show', checkInAt: null, checkOutAt: null, isFalseNegative: false },
  { id: 'a4', staffId: 'u5', shiftId: 's4', hotspotId: 'h1', date: TODAY, status: 'not_marked', checkInAt: null, checkOutAt: null, isFalseNegative: false },
]

const LEAVE_REQUESTS: LeaveRequest[] = [
  { id: 'l1', staffId: 'u1', startDate: TODAY, endDate: TODAY, reason: 'Family function', status: 'pending' },
]

const NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', message: 'TL Ravi Kumar has reached the hotspot', hotspotId: 'h1', readAt: null, createdAt: new Date().toISOString() },
  { id: 'n2', message: 'TL Ravi Kumar has reached the hotspot', hotspotId: 'h1', readAt: null, createdAt: new Date(Date.now() - 30 * 60000).toISOString() },
]

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export function getMockHotspots(): Hotspot[] {
  return clone(HOTSPOTS)
}
export function getMockProfiles(): Profile[] {
  return clone(PROFILES)
}
export function getMockShifts(): Shift[] {
  return clone(SHIFTS)
}
export function getMockAttendance(): Attendance[] {
  return clone(ATTENDANCE)
}
export function getMockLeaveRequests(): LeaveRequest[] {
  return clone(LEAVE_REQUESTS)
}
export function getMockNotifications(): AppNotification[] {
  return clone(NOTIFICATIONS)
}

export const CURRENT_STAFF_ID = 'u1'
export const CURRENT_TEAM_LEAD_ID = 'u2'
export const CURRENT_MANAGER_ID = 'u3'
