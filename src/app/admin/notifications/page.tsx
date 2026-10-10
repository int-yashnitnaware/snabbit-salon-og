import { getMockNotifications } from '@/lib/mock-data'

export default function NotificationsPage() {
  const notifications = getMockNotifications()

  return (
    <div className="max-w-md mx-auto space-y-2">
      <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
      {notifications.length === 0 && (
        <p className="text-gray-500">No notifications yet.</p>
      )}
      <ul className="space-y-2">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`rounded-2xl shadow p-4 ${
              n.readAt ? 'bg-white' : 'bg-brand/10'
            }`}
          >
            <p className="font-medium">{n.message}</p>
            <p className="text-xs text-gray-500">
              {new Date(n.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
