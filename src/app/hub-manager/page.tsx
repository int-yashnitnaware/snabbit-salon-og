'use client'

import { useEffect, useState, useCallback } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { supabase } from '@/lib/supabase'
import { MANUAL_STATUS_LABELS, type Hotspot, type ManualStatus, type SalonPartnerBoardRow } from '@/lib/types'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const QUICK_STATUSES: ManualStatus[] = ['present', 'absent', 'half_day', 'week_off']

export default function HubManagerPage() {
  const [rows, setRows] = useState<SalonPartnerBoardRow[]>([])
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRegister, setShowRegister] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [boardRes, hotspotsRes] = await Promise.all([
      supabase.from('salon_partner_board').select('*').order('partner_name'),
      supabase.from('hotspots').select('id, name').order('name'),
    ])
    if (boardRes.error) setError(boardRes.error.message)
    else setRows(boardRes.data as SalonPartnerBoardRow[])
    if (hotspotsRes.data) setHotspots(hotspotsRes.data as Hotspot[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function markAttendance(partnerId: string, status: ManualStatus) {
    const { error: upsertError } = await supabase.from('partner_attendance').upsert(
      {
        partner_id: partnerId,
        date: todayIso(),
        manual_status: status,
        attendance_state: status === 'present' || status === 'half_day' ? 'present' : status === 'week_off' ? 'week_off_absent' : 'leave',
        hub_check_in: status === 'present' ? new Date().toISOString() : null,
      },
      { onConflict: 'partner_id,date' }
    )
    if (upsertError) {
      setError(upsertError.message)
      return
    }
    load()
  }

  const filtered = rows.filter((r) => r.partner_name.toLowerCase().includes(search.toLowerCase()))

  return (
    <AdminGuard title="Hub Manager">
      {() => (
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search partner name"
              className="flex-1 rounded-xl border border-gray-300 p-3"
            />
            <button
              onClick={() => setShowRegister(true)}
              className="bg-brand text-white rounded-xl px-4 font-semibold"
            >
              + Register
            </button>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          {loading && <p className="text-gray-600">Loading…</p>}
          <div className="space-y-3">
            {!loading && filtered.length === 0 && (
              <p className="text-gray-600">No partners match.</p>
            )}
            {filtered.map((row) => (
              <div key={row.partner_id} className="bg-white rounded-3xl shadow-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">{row.partner_name}</p>
                    <p className="text-xs text-gray-500">
                      ID: {row.partner_code ?? '—'} · {row.mobile ?? 'No number'}
                    </p>
                  </div>
                  <span className="text-xs bg-cream rounded-full px-3 py-1 font-semibold">
                    {row.hotspot_name ?? 'No order today'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Today:{' '}
                  {row.manual_status ? MANUAL_STATUS_LABELS[row.manual_status] : 'Not marked'}
                  {row.hub_check_in && ` · In ${row.hub_check_in.slice(11, 16)}`}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {QUICK_STATUSES.map((status) => (
                    <button
                      key={status}
                      onClick={() => markAttendance(row.partner_id, status)}
                      className={`text-xs rounded-full px-3 py-2 font-semibold ${
                        row.manual_status === status
                          ? 'bg-brand text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {MANUAL_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {showRegister && (
            <RegisterPartnerModal
              hotspots={hotspots}
              onClose={() => setShowRegister(false)}
              onRegistered={() => {
                setShowRegister(false)
                load()
              }}
            />
          )}
        </div>
      )}
    </AdminGuard>
  )
}

function RegisterPartnerModal({
  hotspots,
  onClose,
  onRegistered,
}: {
  hotspots: Hotspot[]
  onClose: () => void
  onRegistered: () => void
}) {
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [hotspotId, setHotspotId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!name.trim() || !mobile.trim()) return
    setSaving(true)
    setError(null)
    const { data: code, error: codeError } = await supabase.rpc('next_partner_code')
    if (codeError || !code) {
      setError(codeError?.message ?? 'Could not generate a partner code.')
      setSaving(false)
      return
    }
    const { error: insertError } = await supabase.from('partners').insert({
      partner_code: code,
      name: name.trim(),
      mobile: mobile.trim(),
      start_time: '09:00:00',
      status: 'active',
      hotspot_id: hotspotId || null,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    onRegistered()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Register Partner</h2>
          <button onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-3"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-3"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Hotspot (optional)</label>
          <select
            value={hotspotId}
            onChange={(e) => setHotspotId(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-3"
          >
            <option value="">Unassigned</option>
            {hotspots.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim() || !mobile.trim()}
          className="w-full bg-brand text-white rounded-xl py-3 font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Register'}
        </button>
      </div>
    </div>
  )
}
