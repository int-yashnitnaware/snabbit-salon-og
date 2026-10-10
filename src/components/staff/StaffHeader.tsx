import Link from 'next/link'
import type { Profile } from '@/lib/types'

export default function StaffHeader({ me }: { me: Profile }) {
  return (
    <header className="bg-white px-4 py-3 shadow-sm flex gap-4 items-center flex-wrap">
      <Link href="/" className="font-bold text-brand">
        Snabbit Salon OG
      </Link>
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
  )
}
