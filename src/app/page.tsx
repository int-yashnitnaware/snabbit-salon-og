'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminSession } from '@/lib/useAdminSession'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()
  const session = useAdminSession()

  useEffect(() => {
    if (session.status === 'signed_out') {
      router.replace('/login')
    } else if (session.status === 'admin') {
      router.replace('/clm')
    }
  }, [session, router])

  if (session.status !== 'not_admin') {
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
          {`insert into public.app_admins (email, name)\nvalues ('${session.email}', 'Your Name');`}
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

  return null
}
