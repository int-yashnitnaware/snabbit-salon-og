'use client'

import { useRouter } from 'next/navigation'
import AdminGuard from '@/components/AdminGuard'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const router = useRouter()

  return (
    <AdminGuard>
      {(admin, email) => (
        <div className="p-4 space-y-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-gray-700 font-semibold"
          >
            <span className="text-xl">‹</span> Back
          </button>

          <div className="bg-white rounded-3xl shadow-sm p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-surface-alt flex items-center justify-center text-gray-400 text-2xl shrink-0">
              👤
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 truncate">{admin.name ?? email}</p>
              <p className="text-sm text-gray-500 truncate">{email}</p>
              {admin.is_super && (
                <span className="inline-block mt-1 text-xs font-semibold text-brand bg-brand/10 rounded-full px-3 py-1">
                  Super Admin
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide px-1">Actions</h2>
            <button
              onClick={() => supabase.auth.signOut().then(() => router.replace('/login'))}
              className="w-full flex items-center justify-between bg-white rounded-2xl shadow-sm p-4 text-danger font-semibold"
            >
              Logout
              <span className="text-xl">⏻</span>
            </button>
          </div>
        </div>
      )}
    </AdminGuard>
  )
}
