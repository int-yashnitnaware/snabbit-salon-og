import type { Profile } from '@/lib/types'

export default function StaffTable({ staff }: { staff: Profile[] }) {
  if (staff.length === 0) {
    return <p className="text-gray-500">No staff at your hotspots yet.</p>
  }

  return (
    <ul className="space-y-2">
      {staff.map((s) => (
        <li
          key={s.id}
          className="bg-white rounded-2xl shadow p-4 flex justify-between"
        >
          <span className="font-semibold">{s.fullName}</span>
          <span className="text-sm text-gray-500">{s.role}</span>
        </li>
      ))}
    </ul>
  )
}
