'use client'

import type { Hotspot } from '@/lib/types'

export default function HotspotSwitcher({
  hotspots,
  selectedId,
  onChange,
}: {
  hotspots: Hotspot[]
  selectedId: string
  onChange: (id: string) => void
}) {
  return (
    <select
      className="bg-white border rounded-full px-3 py-1 font-semibold text-gray-900"
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
    >
      {hotspots.map((h) => (
        <option key={h.id} value={h.id}>
          {h.name}
        </option>
      ))}
    </select>
  )
}
