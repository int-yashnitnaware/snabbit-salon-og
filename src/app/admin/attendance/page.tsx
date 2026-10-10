'use client'

import { useState } from 'react'
import { getMockHotspots, getMockAttendance, getMockProfiles } from '@/lib/mock-data'
import HotspotSwitcher from '@/components/admin/HotspotSwitcher'
import AttendanceTable from '@/components/admin/AttendanceTable'

export default function AttendanceReportPage() {
  const hotspots = getMockHotspots()
  const profiles = getMockProfiles()
  const [selectedId, setSelectedId] = useState(hotspots[0].id)
  const rows = getMockAttendance().filter((a) => a.hotspotId === selectedId)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <HotspotSwitcher
        hotspots={hotspots}
        selectedId={selectedId}
        onChange={setSelectedId}
      />
      <AttendanceTable rows={rows} profiles={profiles} />
    </div>
  )
}
