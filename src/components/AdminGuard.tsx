'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminSession } from '@/lib/useAdminSession'
import { supabase } from '@/lib/supabase'
import type { AppAdmin } from '@/lib/types'

interface AdminGuardProps {
  title: string
  children: (admin: AppAdmin) => React.ReactNode
}

export default function AdminGuard({ title, children }: AdminGuardProps) {
  const router = useRouter()
  const session = useAdminSession()

  useEffect(() => {
    if (session.status === 'signed_out' || session.status === 'not_admin') {
      router.replace('/')
    }
  }, [session, router])

  if (session.status !== 'admin') {
    return <main className="min-h-screen bg-cream flex items-center justify-center">Loading…</main>
  }

  return (
    <div className="min-h-screen bg-cream pb-6">
      <header className="flex items-center justify-between p-4 bg-white shadow-sm">
        <div>
          <p className="font-bold text-brand">{title}</p>
          <p className="text-xs text-gray-500">{session.email}</p>
        </div>
        <button
          onClick={() => supabase.auth.signOut().then(() => router.replace('/login'))}
          className="text-sm text-danger font-semibold"
        >
          Sign out
        </button>
      </header>
      {children(session.admin)}
    </div>
  )
}
