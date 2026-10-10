import type { Attendance } from './types'

export interface AttendanceSummary {
  totalExpected: number
  present: number
  absent: number
  falseNegative: number
  breakdown: {
    marked_absent: number
    no_show: number
    not_marked: number
    false_attendance: number
    on_leave: number
  }
}

export function computeAttendanceSummary(
  attendance: Attendance[],
  hotspotId: string
): AttendanceSummary {
  const rows = attendance.filter((a) => a.hotspotId === hotspotId)
  const breakdown = {
    marked_absent: 0,
    no_show: 0,
    not_marked: 0,
    false_attendance: 0,
    on_leave: 0,
  }
  let present = 0
  let falseNegative = 0

  for (const row of rows) {
    if (row.status === 'present') {
      present += 1
    } else {
      breakdown[row.status as keyof typeof breakdown] += 1
    }
    if (row.isFalseNegative) falseNegative += 1
  }

  return {
    totalExpected: rows.length,
    present,
    absent: rows.length - present,
    falseNegative,
    breakdown,
  }
}
