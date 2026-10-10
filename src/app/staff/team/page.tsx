'use client'

import { useState } from 'react'
import { getMockAttendance, getMockProfiles, CURRENT_TEAM_LEAD_ID } from '@/lib/mock-data'
import type { Attendance, AttendanceStatus, Profile } from '@/lib/types'

const MARKABLE_STATUSES: AttendanceStatus[] = [
  'marked_absent',
  'no_show',
  'false_attendance',
]

export default function TeamPage() {
  const me = getMockProfiles().find((p) => p.id === CURRENT_TEAM_LEAD_ID)!
  const profiles = getMockProfiles()
  const [rows, setRows] = useState<Attendance[]>(
    getMockAttendance().filter((a) => a.hotspotId === me.hotspotId)
  )

  function profileFor(staffId: string): Profile {
    return profiles.find((p) => p.id === staffId)!
  }

  function handleMark(id: string, status: AttendanceStatus) {
    setRows(rows.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  function handleFalseNegativeToggle(id: string) {
    setRows(
      rows.map((r) =>
        r.id === id ? { ...r, isFalseNegative: !r.isFalseNegative } : r
      )
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">
        Today&apos;s hotspot attendance
      </h1>
      {rows.length === 0 ? (
        <p className="text-gray-500">No staff shifts at your hotspot today.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="bg-white rounded-2xl shadow p-4 flex justify-between items-center gap-3"
            >
              <div>
                <p className="font-semibold">{profileFor(row.staffId).fullName}</p>
                <p className="text-sm text-gray-500">{row.status}</p>
              </div>
              <div className="flex items-center gap-2">
                {row.status === 'not_marked' && (
                  <select
                    className="border rounded-xl px-2 py-1 text-sm"
                    defaultValue=""
                    onChange={(e) =>
                      handleMark(row.id, e.target.value as AttendanceStatus)
                    }
                  >
                    <option value="" disabled>
                      Mark as…
                    </option>
                    {MARKABLE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => handleFalseNegativeToggle(row.id)}
                  className={`text-xs px-2 py-1 rounded-full font-semibold ${
                    row.isFalseNegative
                      ? 'bg-success text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  False Negative
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
