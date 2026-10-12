'use client'

import { useEffect, useState, useCallback } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { supabase } from '@/lib/supabase'
import { MANUAL_STATUS_LABELS, SERVICE_STAGE_LABELS, type Hotspot, type SalonPartnerBoardRow } from '@/lib/types'

export default function ClmPage() {
  const [rows, setRows] = useState<SalonPartnerBoardRow[]>([])
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [selectedHotspotId, setSelectedHotspotId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const filtered = selectedHotspotId
    ? rows.filter((r) => r.hotspot_id === selectedHotspotId)
    : rows

  const presentCount = filtered.filter((r) => r.manual_status === 'present').length
  const onJobCount = filtered.filter(
    (r) => r.today_service_stage && r.today_service_stage !== 'service_ended'
  ).length

  return (
    <AdminGuard title="CLM">
      {() => (
        <div className="p-4 space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedHotspotId('')}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                selectedHotspotId === '' ? 'bg-brand text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              All
            </button>
            {hotspots.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedHotspotId(h.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                  selectedHotspotId === h.id ? 'bg-brand text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {h.name}
              </button>
            ))}
          </div>

          <div className="bg-brand text-white rounded-3xl shadow-lg p-6 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Partners</h3>
              <span className="text-3xl font-bold">{filtered.length}</span>
            </div>
            <p>Present today: {presentCount}</p>
            <p>Currently on a job: {onJobCount}</p>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {loading && <p className="text-gray-600">Loading…</p>}

          <div className="space-y-3">
            {!loading && filtered.length === 0 && (
              <p className="text-gray-600">No partners in this hotspot.</p>
            )}
            {filtered.map((row) => (
              <div key={row.partner_id} className="bg-white rounded-3xl shadow-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">{row.partner_name}</p>
                    <p className="text-xs text-gray-500">{row.hotspot_name ?? 'Unassigned'}</p>
                  </div>
                  <span
                    className={`text-xs rounded-full px-3 py-1 font-semibold ${
                      row.manual_status === 'present'
                        ? 'bg-success/20 text-success'
                        : row.manual_status
                          ? 'bg-danger/20 text-danger'
                          : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {row.manual_status ? MANUAL_STATUS_LABELS[row.manual_status] : 'Not marked'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {row.today_service_stage
                    ? `Live: ${SERVICE_STAGE_LABELS[row.today_service_stage]}${
                        row.today_scheduled_time ? ` at ${row.today_scheduled_time.slice(0, 5)}` : ''
                      }`
                    : 'No job today'}
                </p>
                {row.mobile && (
                  <a href={`tel:${row.mobile}`} className="text-sm text-brand font-semibold">
                    📞 Call {row.mobile}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminGuard>
  )
}
