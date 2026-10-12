'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { AppAdmin } from './types'

export type AdminSessionState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'not_admin'; email: string }
  | { status: 'admin'; email: string; admin: AppAdmin }

export function useAdminSession(): AdminSessionState {
  const [state, setState] = useState<AdminSessionState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function resolve(email: string | undefined) {
      if (!email) {
        if (!cancelled) setState({ status: 'signed_out' })
        return
      }
      const { data, error } = await supabase
        .from('app_admins')
        .select('email, name, is_super, role')
        .eq('email', email.toLowerCase())
        .maybeSingle()

      if (cancelled) return
      if (error || !data) {
        setState({ status: 'not_admin', email })
        return
      }
      setState({ status: 'admin', email, admin: data as AppAdmin })
    }

    supabase.auth.getSession().then(({ data }) => {
      resolve(data.session?.user.email)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      resolve(session?.user.email)
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  return state
}
