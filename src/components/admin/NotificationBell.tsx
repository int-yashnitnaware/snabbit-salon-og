import Link from 'next/link'
import type { AppNotification } from '@/lib/types'

export default function NotificationBell({
  notifications,
}: {
  notifications: AppNotification[]
}) {
  const unreadCount = notifications.filter((n) => !n.readAt).length
  return (
    <Link href="/admin/notifications" className="relative">
      <span className="text-xl">🔔</span>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-brand text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
          {unreadCount}
        </span>
      )}
    </Link>
  )
}
