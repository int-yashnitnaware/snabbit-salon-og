import Link from 'next/link'
import { getMockProfiles, getMockNotifications, CURRENT_MANAGER_ID } from '@/lib/mock-data'
import NotificationBell from '@/components/admin/NotificationBell'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const me = getMockProfiles().find((p) => p.id === CURRENT_MANAGER_ID)!
  const notifications = getMockNotifications()

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white px-4 py-3 shadow-sm flex gap-4 items-center flex-wrap">
        <span className="font-bold text-gray-900">{me.fullName}</span>
        <NotificationBell notifications={notifications} />
        <nav className="flex gap-3 text-sm">
          <Link href="/admin" className="text-brand">
            Dashboard
          </Link>
          <Link href="/admin/staff" className="text-brand">
            Staff
          </Link>
          <Link href="/admin/shifts" className="text-brand">
            Shifts
          </Link>
          <Link href="/admin/leave" className="text-brand">
            Leave
          </Link>
          <Link href="/admin/attendance" className="text-brand">
            Report
          </Link>
          <Link href="/admin/notifications" className="text-brand">
            Notifications
          </Link>
        </nav>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
