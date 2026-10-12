'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    // If the recovery link already established a session before this
    // listener attached, a session is enough to allow setting a new password.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setInfo('Password updated. Redirecting to sign in…')
    setTimeout(() => router.push('/login'), 1500)
  }

  if (!ready) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center p-6 text-center">
        <p className="text-gray-600">
          Open this page from the password reset link in your email — it needs that link&apos;s
          token to work.
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 bg-white rounded-3xl shadow-lg p-6"
      >
        <h1 className="text-xl font-bold text-brand">Set a new password</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="w-full rounded-xl border border-gray-300 p-3"
          required
          minLength={6}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        {info && <p className="text-sm text-success">{info}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand text-white rounded-xl py-3 font-semibold disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </main>
  )
}
