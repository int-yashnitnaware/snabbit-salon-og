'use client'

import { useState } from 'react'
import { getMockProfiles, getMockHotspots, getMockShifts } from '@/lib/mock-data'
import type { Shift } from '@/lib/types'

export default function AdminShiftsPage() {
  const staff = getMockProfiles().filter(
    (p) => p.role === 'staff' || p.role === 'team_lead'
  )
  const hotspots = getMockHotspots()
  const [shifts, setShifts] = useState<Shift[]>(getMockShifts())
  const [staffId, setStaffId] = useState('')
  const [hotspotId, setHotspotId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setShifts([
      { id: `sh-${Date.now()}`, staffId, hotspotId, date, startTime, endTime },
      ...shifts.filter((s) => !(s.staffId === staffId && s.date === date)),
    ])
    setStaffId('')
    setHotspotId('')
    setDate('')
  }

  function nameFor(id: string) {
    return staff.find((s) => s.id === id)?.fullName ?? id
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-lg p-6 space-y-3"
      >
        <h2 className="font-bold text-gray-900">Assign shift</h2>
        <select
          className="w-full border rounded-xl px-3 py-2"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          required
        >
          <option value="">Select staff</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </select>
        <select
          className="w-full border rounded-xl px-3 py-2"
          value={hotspotId}
          onChange={(e) => setHotspotId(e.target.value)}
          required
        >
          <option value="">Select hotspot</option>
          {hotspots.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="w-full border rounded-xl px-3 py-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <div className="flex gap-2">
          <input
            type="time"
            className="flex-1 border rounded-xl px-3 py-2"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          <input
            type="time"
            className="flex-1 border rounded-xl px-3 py-2"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-brand text-white rounded-xl py-2 font-semibold hover:bg-brand-dark"
        >
          Assign
        </button>
      </form>
      <ul className="space-y-2">
        {shifts.map((s) => (
          <li
            key={s.id}
            className="bg-white rounded-2xl shadow p-4 flex justify-between"
          >
            <span className="font-semibold">{nameFor(s.staffId)}</span>
            <span className="text-sm text-gray-500">
              {s.date} {s.startTime}-{s.endTime}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
