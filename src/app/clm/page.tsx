'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AdminGuard from '@/components/AdminGuard'
import BottomSheet from '@/components/BottomSheet'
import CheckboxRow from '@/components/CheckboxRow'
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

type StatusKey = 'present' | 'absent' | 'week_off' | 'not_marked'

const STATUS_OPTIONS: { key: StatusKey; label: string }[] = [
  { key: 'present', label: 'Present' },
  { key: 'absent', label: 'Absent' },
  { key: 'week_off', label: 'Week Off' },
  { key: 'not_marked', label: 'Not Marked' },
]

function statusKey(p: {
  manualStatus: ManualStatus | null
  attendanceState: AttendanceState | null
  scheduledWeekOff: boolean
}): StatusKey {
  if (isWeekOff(p)) return 'week_off'
  if (p.manualStatus === 'present' || p.manualStatus === 'off_present' || p.manualStatus === 'half_day')
    return 'present'
  if (p.manualStatus === 'absent') return 'absent'
  return 'not_marked'
}

// Progressive location disclosure by lifecycle stage:
// - order_accepted: Current Hotspot shows the broad zone (partner just
//   accepted, exact destination not yet relevant).
// - ready_to_go: Current Hotspot shows the precise society name (partner's
//   about to leave — CLM needs the exact destination now).
// - started (reached/service_ended): Original Hotspot shows the society
//   name, as confirmation of where they actually ended up.

const LIVE_REFRESH_MS = 15000

const STATUS_PILL_CLASSES: Record<StatusKey, string> = {
  present: 'bg-success/15 text-success',
  absent: 'bg-danger/15 text-danger',
  week_off: 'bg-gray-200 text-gray-700',
  not_marked: 'bg-gray-200 text-gray-600',
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
  const router = useRouter()
  const [rows, setRows] = useState<SalonPartnerBoardRow[]>([])
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [selectedHotspotIds, setSelectedHotspotIds] = useState<Set<string>>(new Set())
  const [selectedStatuses, setSelectedStatuses] = useState<Set<StatusKey>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showStatusFilter, setShowStatusFilter] = useState(false)

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

  const inHotspot =
    selectedHotspotIds.size === 0
      ? partners
      : partners.filter((p) => p.orders.some((o) => o.hotspotId && selectedHotspotIds.has(o.hotspotId)))

  const inStatus =
    selectedStatuses.size === 0 ? inHotspot : inHotspot.filter((p) => selectedStatuses.has(statusKey(p)))

  const filtered = inStatus.filter((p) => p.partnerName.toLowerCase().includes(search.toLowerCase()))

  // See isWeekOff() for the week-off precedence rules.
  const weekOffCount = inHotspot.filter((p) => isWeekOff(p)).length
  const presentCount = inHotspot.filter((p) => statusKey(p) === 'present').length
  const absentCount = inHotspot.filter((p) => statusKey(p) === 'absent').length
  const notMarkedCount = inHotspot.length - presentCount - absentCount - weekOffCount
  const total = inHotspot.length
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100))

  function toggleHotspot(id: string, checked: boolean) {
    setSelectedHotspotIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleStatus(key: StatusKey, checked: boolean) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  return (
    <AdminGuard>
      {() => (
        <div>
          {/* Top bar: hotspot filter trigger + status filter + menu */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-2 min-w-0"
            >
              <span className="text-brand text-xl shrink-0">📍</span>
              <span className="font-bold text-gray-900 truncate">
                {selectedHotspotIds.size === 0
                  ? 'All hotspots'
                  : `${selectedHotspotIds.size} hotspot${selectedHotspotIds.size > 1 ? 's' : ''}`}
              </span>
              <span className="text-gray-400 shrink-0">▾</span>
            </button>
            <div className="flex items-center gap-4 shrink-0">
              <button
                onClick={() => setShowStatusFilter(true)}
                aria-label="Filter by status"
                className="relative text-gray-500 text-xl"
              >
                ⚙️
                {selectedStatuses.size > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-brand" />
                )}
              </button>
              <button
                onClick={() => router.push('/clm/profile')}
                aria-label="Menu"
                className="text-gray-700 text-2xl leading-none"
              >
                ☰
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Overview</h2>

            {/* Attendance summary card */}
            <div className="bg-brand text-white rounded-3xl shadow-lg p-6 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Attendance</h3>
                <span className="text-3xl font-bold">{total}</span>
              </div>
              <p className="text-sm font-semibold opacity-95">
                Present: {presentCount} ({pct(presentCount)}%)
              </p>
              <p className="text-sm font-semibold opacity-95">
                Absent: {absentCount} ({pct(absentCount)}%)
              </p>
              <p className="text-sm opacity-80">
                Week off: {weekOffCount} &nbsp;·&nbsp; Not marked: {notMarkedCount}
              </p>
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name"
              className="w-full rounded-xl border border-gray-300 p-3 bg-white"
            />

            {error && <p className="text-sm text-danger">{error}</p>}
            {loading && <p className="text-gray-600">Loading…</p>}

            <div className="space-y-3">
              {!loading && filtered.length === 0 && (
                <p className="text-gray-600">No partners match the current filters.</p>
              )}
              {filtered.map((partner) => (
                <PartnerCard key={partner.partnerId} partner={partner} />
              ))}
            </div>
          </div>

          {showFilters && (
            <BottomSheet
              title="Filters"
              onClose={() => setShowFilters(false)}
              footer={
                <>
                  <button
                    onClick={() => setSelectedHotspotIds(new Set())}
                    className="flex-1 rounded-xl py-3 font-semibold bg-gray-100 text-gray-700"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="flex-1 rounded-xl py-3 font-semibold bg-brand text-white"
                  >
                    Apply
                  </button>
                </>
              }
            >
              {hotspots.length === 0 && <p className="text-gray-500 px-1 py-2">No hotspots yet.</p>}
              {hotspots.map((h) => (
                <CheckboxRow
                  key={h.id}
                  label={h.name}
                  checked={selectedHotspotIds.has(h.id)}
                  onChange={(checked) => toggleHotspot(h.id, checked)}
                />
              ))}
            </BottomSheet>
          )}

          {showStatusFilter && (
            <BottomSheet
              title="Status"
              onClose={() => setShowStatusFilter(false)}
              footer={
                <>
                  <button
                    onClick={() => setSelectedStatuses(new Set())}
                    className="flex-1 rounded-xl py-3 font-semibold bg-gray-100 text-gray-700"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowStatusFilter(false)}
                    className="flex-1 rounded-xl py-3 font-semibold bg-brand text-white"
                  >
                    Apply
                  </button>
                </>
              }
            >
              {STATUS_OPTIONS.map((opt) => (
                <CheckboxRow
                  key={opt.key}
                  label={opt.label}
                  checked={selectedStatuses.has(opt.key)}
                  onChange={(checked) => toggleStatus(opt.key, checked)}
                />
              ))}
            </BottomSheet>
          )}
        </div>
      )}
    </AdminGuard>
  )
}

function PartnerCard({ partner }: { partner: GroupedPartner }) {
  const [expanded, setExpanded] = useState(false)
  // CLM cares about what's happening now/next, not finished jobs — hide
  // completed (service_ended) orders from the card entirely.
  const pendingOrders = partner.orders.filter((o) => o.serviceStage !== 'service_ended')
  const status = statusKey(partner)
  const statusClass = STATUS_PILL_CLASSES[status]
  const statusLabel =
    status === 'week_off'
      ? 'Week Off'
      : status === 'not_marked'
        ? 'Not Marked'
        : partner.manualStatus
          ? MANUAL_STATUS_LABELS[partner.manualStatus]
          : 'Not Marked'

  return (
    <div className="bg-white rounded-3xl shadow-lg p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-cream flex items-center justify-center font-bold text-brand shrink-0 ring-2 ring-brand/30">
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

      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center justify-between w-full text-sm font-semibold text-brand pt-1"
      >
        View Details
        <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {expanded && (
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
                      <span className="text-xs rounded-full px-3 py-1 font-semibold shrink-0 bg-warning/15 text-warning">
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
                      <span className="text-xs rounded-full px-3 py-1 font-semibold shrink-0 bg-warning/15 text-warning">
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
                        📍 {order.societyName ?? 'Society unknown'}
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

          {partner.mobile && (
            <div className="flex justify-end pt-1">
              <a href={`tel:${partner.mobile}`} className="text-brand text-lg" aria-label="Call partner">
                📞
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
