'use client'

import { usePathname } from 'next/navigation'
import {
  getMockProfiles,
  CURRENT_STAFF_ID,
  CURRENT_TEAM_LEAD_ID,
} from '@/lib/mock-data'
import StaffHeader from '@/components/staff/StaffHeader'

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isTeamLeadView = pathname?.startsWith('/staff/team') ?? false
  const currentId = isTeamLeadView ? CURRENT_TEAM_LEAD_ID : CURRENT_STAFF_ID
  const me = getMockProfiles().find((p) => p.id === currentId)!

  return (
    <div className="min-h-screen bg-cream">
      <StaffHeader me={me} />
      <main className="p-4">{children}</main>
    </div>
  )
}
