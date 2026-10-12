'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!email.toLowerCase().endsWith('@snabbit.com')) {
      setError('Use your @snabbit.com email — only those can be granted access.')
      return
    }
    setLoading(true)
    if (mode === 'sign_in') {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (signInError) {
        setError(signInError.message)
        return
      }
      router.push('/')
    } else {
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      setLoading(false)
      if (signUpError) {
        setError(signUpError.message)
        return
      }
      setInfo(
        'Account created. If this email was already added to app_admins you can sign in now — otherwise ask whoever manages that table to add it first.'
      )
      setMode('sign_in')
    }
  }

  return (
    <main className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-brand text-center">Salon OG</h1>
        <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-3xl shadow-lg p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@snabbit.com"
              className="w-full rounded-xl border border-gray-300 p-3"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-3"
              required
              minLength={6}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          {info && <p className="text-sm text-success">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white rounded-xl py-3 font-semibold disabled:opacity-50"
          >
            {loading ? 'Please wait…' : mode === 'sign_in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button
          onClick={() => {
            setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in')
            setError(null)
            setInfo(null)
          }}
          className="w-full text-sm text-brand font-semibold text-center"
        >
          {mode === 'sign_in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </div>
    </main>
  )
}
