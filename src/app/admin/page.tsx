'use client'

import { useState } from 'react'
import {
  getMockHotspots,
  getMockAttendance,
  getMockProfiles,
  CURRENT_MANAGER_ID,
} from '@/lib/mock-data'
import { computeAttendanceSummary } from '@/lib/attendance-summary'
import HotspotSwitcher from '@/components/admin/HotspotSwitcher'
import OnDutyToggle from '@/components/admin/OnDutyToggle'
import AttendanceSummaryCard from '@/components/admin/AttendanceSummaryCard'
import FalseNegativeRow from '@/components/admin/FalseNegativeRow'
import AbsentBreakdownCard from '@/components/admin/AbsentBreakdownCard'

export default function AdminHome() {
  const hotspots = getMockHotspots()
  const me = getMockProfiles().find((p) => p.id === CURRENT_MANAGER_ID)!
  const [selectedId, setSelectedId] = useState(hotspots[0].id)
  const attendance = getMockAttendance()
  const summary = computeAttendanceSummary(attendance, selectedId)

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <HotspotSwitcher
          hotspots={hotspots}
          selectedId={selectedId}
          onChange={setSelectedId}
        />
        <OnDutyToggle initialOnDuty={me.isOnDuty} />
      </div>
      <AttendanceSummaryCard summary={summary} />
      <FalseNegativeRow count={summary.falseNegative} />
      <AbsentBreakdownCard summary={summary} />
    </div>
  )
}
