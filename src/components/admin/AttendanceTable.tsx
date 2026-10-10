import type { Attendance, Profile } from '@/lib/types'

export default function AttendanceTable({
  rows,
  profiles,
}: {
  rows: Attendance[]
  profiles: Profile[]
}) {
  function nameFor(staffId: string) {
    return profiles.find((p) => p.id === staffId)?.fullName ?? staffId
  }

  if (rows.length === 0) {
    return <p className="text-gray-500">No attendance records for this date.</p>
  }

  return (
    <table className="w-full bg-white rounded-2xl shadow overflow-hidden text-sm">
      <thead className="bg-gray-100">
        <tr>
          <th className="text-left p-2">Name</th>
          <th className="text-left p-2">Status</th>
          <th className="text-left p-2">Check-in</th>
          <th className="text-left p-2">Check-out</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t">
            <td className="p-2">{nameFor(r.staffId)}</td>
            <td className="p-2">{r.status}</td>
            <td className="p-2">
              {r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : '—'}
            </td>
            <td className="p-2">
              {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
