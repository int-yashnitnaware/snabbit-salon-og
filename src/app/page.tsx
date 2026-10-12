'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminSession } from '@/lib/useAdminSession'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()
  const session = useAdminSession()

  useEffect(() => {
    if (session.status === 'signed_out') {
      router.replace('/login')
    } else if (session.status === 'admin' && session.admin.role) {
      router.replace(session.admin.role === 'hub_manager' ? '/hub-manager' : '/clm')
    }
  }, [session, router])

  if (session.status === 'loading' || session.status === 'signed_out') {
    return <main className="min-h-screen bg-cream flex items-center justify-center">Loading…</main>
  }

  if (session.status === 'not_admin') {
    return (
      <main className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 gap-4 text-center">
        <h1 className="text-xl font-bold text-brand">Not authorized yet</h1>
        <p className="text-gray-600 max-w-sm">
          Signed in as <strong>{session.email}</strong>, but this email isn&apos;t in{' '}
          <code className="bg-white px-1 rounded">app_admins</code> yet. Ask whoever manages that
          table to run:
        </p>
        <pre className="bg-white rounded-xl p-4 text-xs text-left max-w-sm overflow-x-auto">
          {`insert into public.app_admins (email, name, role)\nvalues ('${session.email}', 'Your Name', 'hub_manager');\n-- role: 'hub_manager' or 'clm'`}
        </pre>
        <button
          onClick={() => supabase.auth.signOut().then(() => router.replace('/login'))}
          className="text-sm text-danger font-semibold"
        >
          Sign out
        </button>
      </main>
    )
  }

  // session.status === 'admin' with no role set — let them pick.
  return (
    <main className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 gap-4">
      <h1 className="text-xl font-bold text-brand">Salon OG</h1>
      <p className="text-gray-600 text-sm text-center">
        No role set for this account — pick which screens to view.
      </p>
      <div className="w-full max-w-xs space-y-3">
        <Link
          href="/hub-manager"
          className="block text-center bg-brand text-white rounded-xl py-3 font-semibold"
        >
          Hub Manager
        </Link>
        <Link
          href="/clm"
          className="block text-center bg-white text-brand border-2 border-brand rounded-xl py-3 font-semibold"
        >
          CLM
        </Link>
      </div>
    </main>
  )
}
