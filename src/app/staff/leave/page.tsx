'use client'

import { useState } from 'react'
import { getMockLeaveRequests, CURRENT_STAFF_ID } from '@/lib/mock-data'
import type { LeaveRequest } from '@/lib/types'

const STATUS_COLOR: Record<LeaveRequest['status'], string> = {
  pending: 'bg-gray-200 text-gray-800',
  approved: 'bg-success/20 text-success',
  rejected: 'bg-danger/20 text-danger',
}

export default function StaffLeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>(
    getMockLeaveRequests().filter((r) => r.staffId === CURRENT_STAFF_ID)
  )
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setRequests([
      {
        id: `l-${Date.now()}`,
        staffId: CURRENT_STAFF_ID,
        startDate,
        endDate,
        reason,
        status: 'pending',
      },
      ...requests,
    ])
    setStartDate('')
    setEndDate('')
    setReason('')
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-lg p-6 space-y-3"
      >
        <h2 className="font-bold text-gray-900">Request leave</h2>
        <div className="flex gap-2">
          <input
            type="date"
            className="flex-1 border rounded-xl px-3 py-2"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <input
            type="date"
            className="flex-1 border rounded-xl px-3 py-2"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
        <textarea
          className="w-full border rounded-xl px-3 py-2"
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full bg-brand text-white rounded-xl py-2 font-semibold hover:bg-brand-dark"
        >
          Submit
        </button>
      </form>
      {requests.length === 0 ? (
        <p className="text-gray-500">No leave requests yet.</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li
              key={r.id}
              className="bg-white rounded-2xl shadow p-4 flex justify-between items-center"
            >
              <div>
                <p className="font-semibold">
                  {r.startDate} → {r.endDate}
                </p>
                <p className="text-sm text-gray-500">{r.reason}</p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_COLOR[r.status]}`}
              >
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
