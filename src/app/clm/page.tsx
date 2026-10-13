'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { supabase } from '@/lib/supabase'
import { usePolling } from '@/lib/usePolling'
import { formatTimeIST, formatShiftRange, formatPlainTime } from '@/lib/formatTime'
import {
  MANUAL_STATUS_LABELS,
  type AttendanceState,
  type Hotspot,
  type ManualStatus,
  type SalonPartnerBoardRow,
  type ServiceStage,
} from '@/lib/types'

// Week-off priority: an explicit manual_status always wins (e.g. off_present
// means "worked despite being scheduled off" — not week off). Otherwise fall
// back to attendance_state's week_off_* values, and finally to
// scheduled_week_off (partners.weekly_off matching today) — the attendance
// table frequently has no row at all for a partner's scheduled day off, so
// without this fallback those partners wrongly show as "not marked".
function isWeekOff(p: {
  manualStatus: ManualStatus | null
  attendanceState: AttendanceState | null
  scheduledWeekOff: boolean
}): boolean {
  if (p.manualStatus) return p.manualStatus === 'week_off'
  if (p.attendanceState === 'week_off_absent' || p.attendanceState === 'week_off_present') return true
  return p.scheduledWeekOff
}

// Progressive location disclosure by lifecycle stage:
// - order_accepted: Current Hotspot shows the broad zone (partner just
//   accepted, exact destination not yet relevant).
// - ready_to_go: Current Hotspot shows the precise society name (partner's
//   about to leave — CLM needs the exact destination now).
// - started (reached/service_ended): Original Hotspot shows the society
//   name, as confirmation of where they actually ended up.

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

interface PartnerOrder {
  bookingId: string
  hotspotId: string | null
  hotspotName: string | null
  societyName: string | null
  started: boolean
  orderStatus: string | null
  serviceStage: ServiceStage | null
  effectiveTime: string | null
}

interface GroupedPartner {
  partnerId: string
  partnerName: string
  partnerCode: string | null
  mobile: string | null
  manualStatus: ManualStatus | null
  attendanceState: AttendanceState | null
  scheduledWeekOff: boolean
  hubCheckIn: string | null
  hubCheckOut: string | null
  shiftHrs: number | null
  shiftStartTime: string | null
  orders: PartnerOrder[]
}

function groupByPartner(rows: SalonPartnerBoardRow[]): GroupedPartner[] {
  const byId = new Map<string, GroupedPartner>()
  for (const row of rows) {
    let partner = byId.get(row.partner_id)
    if (!partner) {
      partner = {
        partnerId: row.partner_id,
        partnerName: row.partner_name,
        partnerCode: row.partner_code,
        mobile: row.mobile,
        manualStatus: row.manual_status,
        attendanceState: row.attendance_state,
        scheduledWeekOff: row.scheduled_week_off,
        hubCheckIn: row.hub_check_in,
        hubCheckOut: row.hub_check_out,
        shiftHrs: row.shift_hrs,
        shiftStartTime: row.shift_start_time,
        orders: [],
      }
      byId.set(row.partner_id, partner)
    }
    if (row.today_booking_id) {
      partner.orders.push({
        bookingId: row.today_booking_id,
        hotspotId: row.hotspot_id,
        hotspotName: row.hotspot_name,
        societyName: row.today_society_name,
        started: row.today_order_started,
        orderStatus: row.today_order_status,
        serviceStage: row.today_service_stage,
        effectiveTime: row.today_effective_time,
      })
    }
  }
  for (const partner of byId.values()) {
    partner.orders.sort((a, b) => (a.effectiveTime ?? '').localeCompare(b.effectiveTime ?? ''))
  }
  return Array.from(byId.values())
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
  // without having to manually refresh.
  usePolling(() => load(true), LIVE_REFRESH_MS)

  const partners = useMemo(() => groupByPartner(rows), [rows])

  const inHotspot = selectedHotspotId
    ? partners.filter((p) => p.orders.some((o) => o.hotspotId === selectedHotspotId))
    : partners
  const filtered = inHotspot.filter((p) =>
    p.partnerName.toLowerCase().includes(search.toLowerCase())
  )

  // See isWeekOff() for the week-off precedence rules.
  const weekOffCount = inHotspot.filter((p) => isWeekOff(p)).length
  const presentCount = inHotspot.filter(
    (p) =>
      !isWeekOff(p) &&
      (p.manualStatus === 'present' ||
        p.manualStatus === 'off_present' ||
        p.manualStatus === 'half_day')
  ).length
  const absentCount = inHotspot.filter((p) => !isWeekOff(p) && p.manualStatus === 'absent').length
  const notMarkedCount = inHotspot.length - presentCount - absentCount - weekOffCount

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
                Present: {presentCount} &nbsp;·&nbsp; Absent: {absentCount}
              </p>
              <p className="text-sm opacity-90">
                Week off: {weekOffCount} &nbsp;·&nbsp; Not marked: {notMarkedCount}
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
              {filtered.map((partner) => (
                <PartnerCard key={partner.partnerId} partner={partner} />
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminGuard>
  )
}

function PartnerCard({ partner }: { partner: GroupedPartner }) {
  // CLM cares about what's happening now/next, not finished jobs — hide
  // completed (service_ended) orders from the card entirely.
  const pendingOrders = partner.orders.filter((o) => o.serviceStage !== 'service_ended')
  const weekOff = isWeekOff(partner)
  const statusClass = weekOff
    ? 'bg-gray-200 text-gray-700'
    : partner.manualStatus
      ? (STATUS_PILL_CLASSES[partner.manualStatus] ?? 'bg-gray-200 text-gray-700')
      : 'bg-gray-200 text-gray-700'
  const statusLabel = weekOff
    ? 'Week Off'
    : partner.manualStatus
      ? MANUAL_STATUS_LABELS[partner.manualStatus]
      : 'Not marked'

  return (
    <div className="bg-white rounded-3xl shadow-lg p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-cream flex items-center justify-center font-bold text-brand shrink-0">
          {initials(partner.partnerName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{partner.partnerName}</p>
          <p className="text-xs text-gray-500">ID: {partner.partnerCode ?? '—'}</p>
        </div>
        <span className={`text-xs rounded-full px-3 py-1 font-semibold shrink-0 ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      <div className="text-sm text-gray-600">
        Shift: {formatShiftRange(partner.shiftStartTime, partner.shiftHrs)}
      </div>

      <div className="text-sm text-gray-600">
        Login: {formatTimeIST(partner.hubCheckIn)} · Logout: {formatTimeIST(partner.hubCheckOut)}
      </div>

      <div className="space-y-2 border-t border-gray-100 pt-2">
        {pendingOrders.length === 0 ? (
          <span className="text-xs rounded-full px-3 py-1 font-semibold bg-gray-200 text-gray-600">
            {partner.orders.length > 0 ? 'No pending order' : 'No order today'}
          </span>
        ) : (
          pendingOrders.map((order, index) => {
            const stage = order.serviceStage
            return (
              <div key={order.bookingId} className="space-y-1">
                {pendingOrders.length > 1 && (
                  <p className="text-xs font-semibold text-gray-400">
                    Order {index + 1} · {formatPlainTime(order.effectiveTime)}
                  </p>
                )}
                {stage === 'order_accepted' && (
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="min-w-0">
                      📍 Current Hotspot:{' '}
                      <span className="text-gray-400">{order.hotspotName ?? 'Unresolved zone'}</span>
                    </span>
                    <span className="text-xs rounded-full px-3 py-1 font-semibold shrink-0 bg-orange-100 text-orange-700">
                      ✓ Accepted
                    </span>
                  </div>
                )}
                {stage === 'ready_to_go' && (
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="min-w-0">
                      📍 Current Hotspot:{' '}
                      <span className="text-gray-400">{order.societyName ?? 'Society unknown'}</span>
                    </span>
                    <span className="text-xs rounded-full px-3 py-1 font-semibold shrink-0 bg-orange-100 text-orange-700">
                      🚗 Ready to go
                    </span>
                  </div>
                )}
                {order.started && (
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="min-w-0">
                      📍 Original Hotspot: {order.societyName ?? 'Society unknown'}
                      <span className="text-gray-400"> · {order.hotspotName ?? 'Unresolved zone'}</span>
                    </span>
                    <span className="text-xs rounded-full px-3 py-1 font-semibold shrink-0 bg-success/15 text-success">
                      ● Started
                    </span>
                  </div>
                )}
                {stage === 'assigned' && (
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="min-w-0 text-gray-500">
                      📍 {order.hotspotName ?? 'Unresolved zone'}
                    </span>
                    <span className="text-xs rounded-full px-3 py-1 font-semibold shrink-0 bg-gray-200 text-gray-600">
                      Awaiting acceptance
                    </span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {partner.mobile && (
        <div className="flex justify-end pt-1">
          <a href={`tel:${partner.mobile}`} className="text-brand text-lg" aria-label="Call partner">
            📞
          </a>
        </div>
      )}
    </div>
  )
}
