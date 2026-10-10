'use client'

import { useState } from 'react'
import { getMockShifts, getMockAttendance, CURRENT_STAFF_ID } from '@/lib/mock-data'
import type { Attendance } from '@/lib/types'

export default function CheckInCard() {
  const shift = getMockShifts().find((s) => s.staffId === CURRENT_STAFF_ID) ?? null
  const initialAttendance = shift
    ? (getMockAttendance().find((a) => a.shiftId === shift.id) ?? null)
    : null
  const [attendance, setAttendance] = useState<Attendance | null>(initialAttendance)
  const [error, setError] = useState<string | null>(null)

  function handleCheckIn() {
    if (!shift) return
    setError(null)
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setAttendance({
          id: attendance?.id ?? `a-${shift.id}`,
          staffId: CURRENT_STAFF_ID,
          shiftId: shift.id,
          hotspotId: shift.hotspotId,
          date: shift.date,
          status: 'present',
          checkInAt: new Date().toISOString(),
          checkOutAt: null,
          isFalseNegative: false,
        })
      },
      () =>
        setError(
          'Location is required to check in. Please allow location access and try again.'
        )
    )
  }

  function handleCheckOut() {
    if (!attendance) return
    setError(null)
    navigator.geolocation.getCurrentPosition(
      () => {
        setAttendance({ ...attendance, checkOutAt: new Date().toISOString() })
      },
      () =>
        setError(
          'Location is required to check out. Please allow location access and try again.'
        )
    )
  }

  if (!shift) {
    return (
      <div className="bg-white rounded-3xl shadow-lg p-6">
        <p className="text-gray-600">No shift assigned for today.</p>
      </div>
    )
  }

  return (
    <div className="bg-brand text-white rounded-3xl shadow-lg p-6 space-y-3">
      <p className="text-sm opacity-80">Today&apos;s shift</p>
      <p className="text-lg font-bold">
        {shift.startTime} – {shift.endTime}
      </p>
      {error && <p className="text-sm bg-danger/80 rounded-xl p-2">{error}</p>}
      {!attendance?.checkInAt && (
        <button
          onClick={handleCheckIn}
          className="w-full bg-white text-brand rounded-xl py-2 font-semibold"
        >
          Check In
        </button>
      )}
      {attendance?.checkInAt && !attendance?.checkOutAt && (
        <button
          onClick={handleCheckOut}
          className="w-full bg-white text-brand rounded-xl py-2 font-semibold"
        >
          Check Out
        </button>
      )}
      {attendance?.checkOutAt && <p className="font-semibold">Shift complete ✓</p>}
    </div>
  )
}
