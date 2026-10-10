import Link from 'next/link'
import { getMockProfiles, CURRENT_STAFF_ID } from '@/lib/mock-data'

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const me = getMockProfiles().find((p) => p.id === CURRENT_STAFF_ID)!

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white px-4 py-3 shadow-sm flex gap-4 items-center">
        <span className="font-bold text-gray-900">{me.fullName}</span>
        <nav className="flex gap-3 text-sm">
          <Link href="/staff" className="text-brand">
            Home
          </Link>
          <Link href="/staff/leave" className="text-brand">
            Leave
          </Link>
          <Link href="/staff/team" className="text-brand">
            Team
          </Link>
        </nav>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
