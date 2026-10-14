'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminSession } from '@/lib/useAdminSession'
import type { AppAdmin } from '@/lib/types'

interface AdminGuardProps {
  children: (admin: AppAdmin, email: string) => React.ReactNode
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter()
  const session = useAdminSession()

  useEffect(() => {
    if (session.status === 'signed_out' || session.status === 'not_admin') {
      router.replace('/')
    }
  }, [session, router])

  if (session.status !== 'admin') {
    return <main className="min-h-screen bg-surface flex items-center justify-center">Loading…</main>
  }

  return <div className="min-h-screen bg-surface pb-6">{children(session.admin, session.email)}</div>
}
