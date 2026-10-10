'use client'

import { useState } from 'react'
import { getMockLeaveRequests, getMockProfiles } from '@/lib/mock-data'
import type { LeaveRequest } from '@/lib/types'

export default function AdminLeavePage() {
  const profiles = getMockProfiles()
  const [requests, setRequests] = useState<LeaveRequest[]>(
    getMockLeaveRequests().filter((r) => r.status === 'pending')
  )

  function nameFor(staffId: string) {
    return profiles.find((p) => p.id === staffId)?.fullName ?? staffId
  }

  function handleReview(id: string) {
    setRequests(requests.filter((r) => r.id !== id))
  }

  if (requests.length === 0) {
    return <p className="text-gray-500">No pending leave requests.</p>
  }

  return (
    <div className="max-w-md mx-auto">
      <ul className="space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="bg-white rounded-2xl shadow p-4 space-y-2">
            <p className="font-semibold">{nameFor(r.staffId)}</p>
            <p className="text-sm text-gray-500">
              {r.startDate} → {r.endDate}
            </p>
            <p className="text-sm">{r.reason}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleReview(r.id)}
                className="flex-1 bg-success text-white rounded-xl py-1 text-sm font-semibold"
              >
                Approve
              </button>
              <button
                onClick={() => handleReview(r.id)}
                className="flex-1 bg-danger text-white rounded-xl py-1 text-sm font-semibold"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
