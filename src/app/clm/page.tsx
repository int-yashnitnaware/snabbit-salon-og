'use client'

import { useEffect, useState, useCallback } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { supabase } from '@/lib/supabase'
import { usePolling } from '@/lib/usePolling'
import { MANUAL_STATUS_LABELS, type Hotspot, type SalonPartnerBoardRow } from '@/lib/types'

const LIVE_REFRESH_MS = 15000

const STATUS_PILL_CLASSES: Record<string, string> = {
  present: 'bg-success/15 text-success',
  absent: 'bg-danger/15 text-danger',
  off_present: 'bg-success/15 text-success',
  week_off: 'bg-gray-200 text-gray-700',
  half_day: 'bg-orange-100 text-orange-700',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export default function ClmPage() {
  const [rows, setRows] = useState<SalonPartnerBoardRow[]>([])
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [selectedHotspotId, setSelectedHotspotId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    const [boardRes, hotspotsRes] = await Promise.all([
      supabase.from('salon_partner_board').select('*').order('partner_name'),
      supabase.from('hotspots').select('id, name').order('name'),
    ])
    if (boardRes.error) setError(boardRes.error.message)
    else setRows(boardRes.data as SalonPartnerBoardRow[])
    if (hotspotsRes.data) setHotspots(hotspotsRes.data as Hotspot[])
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Keeps booking status (order started/not, current hotspot) current
  // without the Hub Manager or CLM having to manually refresh.
  usePolling(() => load(true), LIVE_REFRESH_MS)

  const inHotspot = selectedHotspotId
    ? rows.filter((r) => r.hotspot_id === selectedHotspotId)
    : rows
  const filtered = inHotspot.filter((r) =>
    r.partner_name.toLowerCase().includes(search.toLowerCase())
  )

  const withOrderToday = inHotspot.filter((r) => r.today_booking_id)
  const startedCount = withOrderToday.filter((r) => r.today_order_started).length
  const notStartedCount = withOrderToday.length - startedCount

  return (
    <AdminGuard title="CLM">
      {() => (
        <div className="pb-6">
          {/* Hotspot tabs — above the partner overview, not buried in a modal */}
          <div className="flex gap-2 overflow-x-auto px-4 py-3 bg-white border-b border-gray-100">
            <button
              onClick={() => setSelectedHotspotId('')}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                selectedHotspotId === '' ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              All
            </button>
            {hotspots.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedHotspotId(h.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                  selectedHotspotId === h.id
                    ? 'bg-brand text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                📍 {h.name}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Overview</h2>

            {/* Attendance summary card, blue like the reference */}
            <div className="bg-brand text-white rounded-3xl shadow-lg p-6 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Partners</h3>
                <span className="text-3xl font-bold">{inHotspot.length}</span>
              </div>
              <p className="text-sm opacity-90">
                With an order today: {withOrderToday.length}
              </p>
              <p className="text-sm opacity-90">
                Started: {startedCount} &nbsp;·&nbsp; Not started: {notStartedCount}
              </p>
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name"
              className="w-full rounded-xl border border-gray-300 p-3"
            />

            {error && <p className="text-sm text-danger">{error}</p>}
            {loading && <p className="text-gray-600">Loading…</p>}

            <div className="space-y-3">
              {!loading && filtered.length === 0 && (
                <p className="text-gray-600">No partners in this hotspot.</p>
              )}
              {filtered.map((row) => (
                <PartnerCard key={row.partner_id} row={row} />
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminGuard>
  )
}

function PartnerCard({ row }: { row: SalonPartnerBoardRow }) {
  const statusClass = row.manual_status
    ? (STATUS_PILL_CLASSES[row.manual_status] ?? 'bg-gray-200 text-gray-700')
    : 'bg-gray-200 text-gray-700'

  return (
    <div className="bg-white rounded-3xl shadow-lg p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-cream flex items-center justify-center font-bold text-brand shrink-0">
          {initials(row.partner_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{row.partner_name}</p>
          <p className="text-xs text-gray-500">ID: {row.partner_code ?? '—'}</p>
        </div>
        <span className={`text-xs rounded-full px-3 py-1 font-semibold shrink-0 ${statusClass}`}>
          {row.manual_status ? MANUAL_STATUS_LABELS[row.manual_status] : 'Not marked'}
        </span>
      </div>

      <div className="text-sm text-gray-600">
        Login: {row.hub_check_in ? row.hub_check_in.slice(11, 16) : '—'} · Logout:{' '}
        {row.hub_check_out ? row.hub_check_out.slice(11, 16) : '—'}
      </div>

      <div className="text-sm border-t border-gray-100 pt-2">
        <p>📍 Current Hotspot: {row.hotspot_name ?? 'No job today'}</p>
      </div>

      <div className="flex items-center justify-between pt-1">
        {row.today_booking_id ? (
          <span
            className={`text-xs rounded-full px-3 py-1 font-semibold ${
              row.today_order_started
                ? 'bg-success/15 text-success'
                : 'bg-orange-100 text-orange-700'
            }`}
          >
            {row.today_order_started ? '● Order started' : '○ Not started yet'}
          </span>
        ) : (
          <span className="text-xs rounded-full px-3 py-1 font-semibold bg-gray-200 text-gray-600">
            No order today
          </span>
        )}
        {row.mobile && (
          <a href={`tel:${row.mobile}`} className="text-brand text-lg" aria-label="Call partner">
            📞
          </a>
        )}
      </div>
    </div>
  )
}
