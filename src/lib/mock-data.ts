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
  { id: 'u6', fullName: 'Deepak Rao', role: 'staff', hotspotId: 'h1', isOnDuty: false },
  { id: 'u7', fullName: 'Kavita Iyer', role: 'staff', hotspotId: 'h1', isOnDuty: false },
  { id: 'u8', fullName: 'Meena Kulkarni', role: 'staff', hotspotId: 'h1', isOnDuty: false },
  { id: 'u9', fullName: 'Zoya Khan', role: 'staff', hotspotId: 'h2', isOnDuty: false },
]

// Fixed literal date (not computed at request time) so statically prerendered
// pages and the client agree on "today" and never hit a hydration mismatch.
const TODAY = '2026-10-10'

const SHIFTS: Shift[] = [
  { id: 's1', staffId: 'u1', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
  { id: 's2', staffId: 'u2', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
  { id: 's3', staffId: 'u4', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
  { id: 's4', staffId: 'u5', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
  { id: 's5', staffId: 'u6', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
  { id: 's6', staffId: 'u7', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
  { id: 's7', staffId: 'u8', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
  { id: 's8', staffId: 'u9', hotspotId: 'h2', date: TODAY, startTime: '10:00', endTime: '19:00' },
]

const ATTENDANCE: Attendance[] = [
  { id: 'a1', staffId: 'u1', shiftId: 's1', hotspotId: 'h1', date: TODAY, status: 'present', checkInAt: `${TODAY}T09:05:00`, checkOutAt: null, isFalseNegative: false },
  { id: 'a2', staffId: 'u2', shiftId: 's2', hotspotId: 'h1', date: TODAY, status: 'present', checkInAt: `${TODAY}T08:55:00`, checkOutAt: null, isFalseNegative: false },
  { id: 'a3', staffId: 'u4', shiftId: 's3', hotspotId: 'h1', date: TODAY, status: 'no_show', checkInAt: null, checkOutAt: null, isFalseNegative: true },
  { id: 'a4', staffId: 'u5', shiftId: 's4', hotspotId: 'h1', date: TODAY, status: 'not_marked', checkInAt: null, checkOutAt: null, isFalseNegative: false },
  { id: 'a5', staffId: 'u6', shiftId: 's5', hotspotId: 'h1', date: TODAY, status: 'marked_absent', checkInAt: null, checkOutAt: null, isFalseNegative: false },
  { id: 'a6', staffId: 'u7', shiftId: 's6', hotspotId: 'h1', date: TODAY, status: 'false_attendance', checkInAt: `${TODAY}T09:10:00`, checkOutAt: null, isFalseNegative: false },
  { id: 'a7', staffId: 'u8', shiftId: 's7', hotspotId: 'h1', date: TODAY, status: 'on_leave', checkInAt: null, checkOutAt: null, isFalseNegative: false },
  { id: 'a8', staffId: 'u9', shiftId: 's8', hotspotId: 'h2', date: TODAY, status: 'present', checkInAt: `${TODAY}T10:02:00`, checkOutAt: null, isFalseNegative: false },
]

const LEAVE_REQUESTS: LeaveRequest[] = [
  { id: 'l1', staffId: 'u1', startDate: TODAY, endDate: TODAY, reason: 'Family function', status: 'pending' },
  { id: 'l2', staffId: 'u1', startDate: '2026-10-05', endDate: '2026-10-05', reason: 'Medical appointment', status: 'approved' },
  { id: 'l3', staffId: 'u1', startDate: '2026-09-28', endDate: '2026-09-28', reason: 'Personal errand', status: 'rejected' },
  { id: 'l4', staffId: 'u8', startDate: TODAY, endDate: TODAY, reason: 'Sick leave', status: 'approved' },
]

const NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', message: 'TL Ravi Kumar has reached the Raheja hotspot', hotspotId: 'h1', readAt: null, createdAt: new Date().toISOString() },
  { id: 'n2', message: 'Attendance marking window closes in 30 minutes', hotspotId: 'h1', readAt: new Date(Date.now() - 20 * 60000).toISOString(), createdAt: new Date(Date.now() - 30 * 60000).toISOString() },
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
