# Salon OG Static UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every screen from the approved design (staff check-in/out, team-lead status marking, manager multi-hotspot dashboard matching the reference screenshots, shift assignment, leave) as a runnable, clickable PWA — with **no backend**. All data is hardcoded mock data; all mutations are local React state that resets on reload. This lets the user see and approve the actual UI/UX before any Supabase work happens.

**Architecture:** Same Next.js app, same route structure (`/staff`, `/admin`) and same Tailwind design tokens as the original plan. The only architectural change: `src/lib/mock-data.ts` replaces Supabase as the data source, `src/lib/types.ts` replaces the Supabase-generated types, and every page/component that previously called a Server Action now manages state with `useState` initialized from the mock data. There is no login — the home page (`/`) is a role switcher with three links straight into `/staff`, `/staff/team`, and `/admin`, each hardcoded to a specific mock persona (Priya Sharma = staff, Ravi Kumar = team lead, Anjali Mehta = manager).

**Tech Stack:** Next.js (App Router, TypeScript), Tailwind CSS, `next-pwa`. No Supabase, no auth, no database.

**Spec:** `docs/superpowers/specs/2026-10-10-salon-og-attendance-design.md` — this plan implements the same screens and data model that spec describes, deliberately deferring the "standalone Supabase backend" requirement. Once this UI is approved, `docs/superpowers/plans/2026-10-10-salon-og-attendance.md` (the original 13-task plan, already written, Task 1 complete) becomes the path to wire in real Supabase — it reuses the same component designs, just swapping the data layer back in.

## Global Constraints

- No backend: no Supabase, no auth, no middleware, no database. Every page reads from `src/lib/mock-data.ts`.
- No login/signup pages in this phase — `/` is a role-switcher with direct links to each persona's view.
- State is local React state (`useState`), seeded from mock data on mount. It resets on page reload — this is expected and fine for a visual prototype.
- No automated test suite — every task is verified by manually exercising the flow in the browser.
- Visual style matches the reference screens and the tokens already established in Task 1 of the original plan: `cream` (#FBF2DD) background, `brand` (#4C5FEA) / `brand-dark` (#3B4ACB) primary, `success` (#3F9065), `danger` (#D97462).
- Reuses the attendance status model from the spec: `present | marked_absent | no_show | not_marked | false_attendance | on_leave`, plus an independent `isFalseNegative` flag.
- This plan builds directly on top of Task 1 of `docs/superpowers/plans/2026-10-10-salon-og-attendance.md` (already complete: Next.js scaffold, Tailwind v3 pinned and working, `--webpack` scripts for `next-pwa`). Do not redo that setup.

---

## Task 1: Shared types, mock data, and home page

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/mock-data.ts`
- Modify: `src/app/page.tsx` (currently the placeholder "Snabbit Salon OG — coming up." from Task 1 of the Supabase plan)

**Interfaces:**
- Produces: types `Role`, `Hotspot`, `Profile`, `Shift`, `AttendanceStatus`, `Attendance`, `LeaveStatus`, `LeaveRequest`, `AppNotification` (from `src/lib/types.ts`); mock accessors `getMockHotspots()`, `getMockProfiles()`, `getMockShifts()`, `getMockAttendance()`, `getMockLeaveRequests()`, `getMockNotifications()` (each returns a fresh deep copy, safe to mutate locally) and constants `CURRENT_STAFF_ID`, `CURRENT_TEAM_LEAD_ID`, `CURRENT_MANAGER_ID` (from `src/lib/mock-data.ts`) — consumed by every subsequent task.

- [ ] **Step 1: Create `src/lib/types.ts`**

```ts
export type Role = 'staff' | 'team_lead' | 'manager'

export interface Hotspot {
  id: string
  name: string
}

export interface Profile {
  id: string
  fullName: string
  role: Role
  hotspotId: string | null
  isOnDuty: boolean
}

export interface Shift {
  id: string
  staffId: string
  hotspotId: string
  date: string
  startTime: string
  endTime: string
}

export type AttendanceStatus =
  | 'present'
  | 'marked_absent'
  | 'no_show'
  | 'not_marked'
  | 'false_attendance'
  | 'on_leave'

export interface Attendance {
  id: string
  staffId: string
  shiftId: string
  hotspotId: string
  date: string
  status: AttendanceStatus
  checkInAt: string | null
  checkOutAt: string | null
  isFalseNegative: boolean
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveRequest {
  id: string
  staffId: string
  startDate: string
  endDate: string
  reason: string
  status: LeaveStatus
}

export interface AppNotification {
  id: string
  message: string
  hotspotId: string
  readAt: string | null
  createdAt: string
}
```

- [ ] **Step 2: Create `src/lib/mock-data.ts`**

```ts
import type {
  Hotspot,
  Profile,
  Shift,
  Attendance,
  LeaveRequest,
  AppNotification,
} from './types'

const HOTSPOTS: Hotspot[] = [
  { id: 'h1', name: 'Raheja' },
  { id: 'h2', name: 'Andheri West' },
]

const PROFILES: Profile[] = [
  { id: 'u1', fullName: 'Priya Sharma', role: 'staff', hotspotId: 'h1', isOnDuty: false },
  { id: 'u2', fullName: 'Ravi Kumar', role: 'team_lead', hotspotId: 'h1', isOnDuty: true },
  { id: 'u3', fullName: 'Anjali Mehta', role: 'manager', hotspotId: null, isOnDuty: true },
  { id: 'u4', fullName: 'Suresh Patil', role: 'staff', hotspotId: 'h1', isOnDuty: false },
  { id: 'u5', fullName: 'Neha Joshi', role: 'staff', hotspotId: 'h1', isOnDuty: false },
]

const TODAY = new Date().toISOString().slice(0, 10)

const SHIFTS: Shift[] = [
  { id: 's1', staffId: 'u1', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
  { id: 's2', staffId: 'u2', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
  { id: 's3', staffId: 'u4', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
  { id: 's4', staffId: 'u5', hotspotId: 'h1', date: TODAY, startTime: '09:00', endTime: '18:00' },
]

const ATTENDANCE: Attendance[] = [
  { id: 'a1', staffId: 'u1', shiftId: 's1', hotspotId: 'h1', date: TODAY, status: 'present', checkInAt: `${TODAY}T09:05:00`, checkOutAt: null, isFalseNegative: false },
  { id: 'a2', staffId: 'u2', shiftId: 's2', hotspotId: 'h1', date: TODAY, status: 'present', checkInAt: `${TODAY}T08:55:00`, checkOutAt: null, isFalseNegative: false },
  { id: 'a3', staffId: 'u4', shiftId: 's3', hotspotId: 'h1', date: TODAY, status: 'no_show', checkInAt: null, checkOutAt: null, isFalseNegative: false },
  { id: 'a4', staffId: 'u5', shiftId: 's4', hotspotId: 'h1', date: TODAY, status: 'not_marked', checkInAt: null, checkOutAt: null, isFalseNegative: false },
]

const LEAVE_REQUESTS: LeaveRequest[] = [
  { id: 'l1', staffId: 'u1', startDate: TODAY, endDate: TODAY, reason: 'Family function', status: 'pending' },
]

const NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', message: 'TL Ravi Kumar has reached the hotspot', hotspotId: 'h1', readAt: null, createdAt: new Date().toISOString() },
  { id: 'n2', message: 'TL Ravi Kumar has reached the hotspot', hotspotId: 'h1', readAt: null, createdAt: new Date(Date.now() - 30 * 60000).toISOString() },
]

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export function getMockHotspots(): Hotspot[] {
  return clone(HOTSPOTS)
}
export function getMockProfiles(): Profile[] {
  return clone(PROFILES)
}
export function getMockShifts(): Shift[] {
  return clone(SHIFTS)
}
export function getMockAttendance(): Attendance[] {
  return clone(ATTENDANCE)
}
export function getMockLeaveRequests(): LeaveRequest[] {
  return clone(LEAVE_REQUESTS)
}
export function getMockNotifications(): AppNotification[] {
  return clone(NOTIFICATIONS)
}

export const CURRENT_STAFF_ID = 'u1'
export const CURRENT_TEAM_LEAD_ID = 'u2'
export const CURRENT_MANAGER_ID = 'u3'
```

- [ ] **Step 3: Replace `src/app/page.tsx`**

```tsx
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Snabbit Salon OG</h1>
        <p className="text-gray-500 text-sm">Pick a view to preview</p>
        <div className="space-y-3">
          <Link
            href="/staff"
            className="block bg-brand text-white rounded-xl py-3 font-semibold hover:bg-brand-dark"
          >
            Staff View
          </Link>
          <Link
            href="/staff/team"
            className="block bg-brand text-white rounded-xl py-3 font-semibold hover:bg-brand-dark"
          >
            Team Lead View
          </Link>
          <Link
            href="/admin"
            className="block bg-brand text-white rounded-xl py-3 font-semibold hover:bg-brand-dark"
          >
            Manager Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Verify**

Run `npm run dev`. Open `http://localhost:3000` — confirm it shows "Snabbit Salon OG" with three buttons. The `/staff`, `/staff/team`, and `/admin` links will 404 until later tasks build those routes — that's expected at this point. Confirm no TypeScript/build errors: run `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/mock-data.ts src/app/page.tsx
git commit -m "feat: add mock data layer and role-switcher home page"
```

---

## Task 2: Staff layout + check-in/out

**Files:**
- Create: `src/app/staff/layout.tsx`
- Create: `src/components/staff/CheckInCard.tsx`
- Create: `src/app/staff/page.tsx`

**Interfaces:**
- Consumes: `getMockProfiles`, `getMockShifts`, `getMockAttendance`, `CURRENT_STAFF_ID` from Task 1; types `Profile`, `Shift`, `Attendance` from Task 1.
- Produces: the `/staff` route tree with a shared header/nav, reused by Tasks 3 and 4.

- [ ] **Step 1: Create `src/app/staff/layout.tsx`**

```tsx
import Link from 'next/link'
import { getMockProfiles, CURRENT_STAFF_ID } from '@/lib/mock-data'

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const me = getMockProfiles().find((p) => p.id === CURRENT_STAFF_ID)!

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white px-4 py-3 shadow-sm flex gap-4 items-center">
        <span className="font-bold text-gray-900">{me.fullName}</span>
        <nav className="flex gap-3 text-sm">
          <Link href="/staff" className="text-brand">
            Home
          </Link>
          <Link href="/staff/leave" className="text-brand">
            Leave
          </Link>
          <Link href="/staff/team" className="text-brand">
            Team
          </Link>
        </nav>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/staff/CheckInCard.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { getMockShifts, getMockAttendance, CURRENT_STAFF_ID } from '@/lib/mock-data'
import type { Attendance } from '@/lib/types'

export default function CheckInCard() {
  const shift = getMockShifts().find((s) => s.staffId === CURRENT_STAFF_ID) ?? null
  const initialAttendance = shift
    ? (getMockAttendance().find((a) => a.shiftId === shift.id) ?? null)
    : null
  const [attendance, setAttendance] = useState<Attendance | null>(initialAttendance)
  const [error, setError] = useState<string | null>(null)

  function handleCheckIn() {
    if (!shift) return
    setError(null)
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setAttendance({
          id: attendance?.id ?? `a-${shift.id}`,
          staffId: CURRENT_STAFF_ID,
          shiftId: shift.id,
          hotspotId: shift.hotspotId,
          date: shift.date,
          status: 'present',
          checkInAt: new Date().toISOString(),
          checkOutAt: null,
          isFalseNegative: false,
        })
      },
      () =>
        setError(
          'Location is required to check in. Please allow location access and try again.'
        )
    )
  }

  function handleCheckOut() {
    if (!attendance) return
    setError(null)
    navigator.geolocation.getCurrentPosition(
      () => {
        setAttendance({ ...attendance, checkOutAt: new Date().toISOString() })
      },
      () =>
        setError(
          'Location is required to check out. Please allow location access and try again.'
        )
    )
  }

  if (!shift) {
    return (
      <div className="bg-white rounded-3xl shadow-lg p-6">
        <p className="text-gray-600">No shift assigned for today.</p>
      </div>
    )
  }

  return (
    <div className="bg-brand text-white rounded-3xl shadow-lg p-6 space-y-3">
      <p className="text-sm opacity-80">Today&apos;s shift</p>
      <p className="text-lg font-bold">
        {shift.startTime} – {shift.endTime}
      </p>
      {error && <p className="text-sm bg-danger/80 rounded-xl p-2">{error}</p>}
      {!attendance?.checkInAt && (
        <button
          onClick={handleCheckIn}
          className="w-full bg-white text-brand rounded-xl py-2 font-semibold"
        >
          Check In
        </button>
      )}
      {attendance?.checkInAt && !attendance?.checkOutAt && (
        <button
          onClick={handleCheckOut}
          className="w-full bg-white text-brand rounded-xl py-2 font-semibold"
        >
          Check Out
        </button>
      )}
      {attendance?.checkOutAt && <p className="font-semibold">Shift complete ✓</p>}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/staff/page.tsx`**

```tsx
import CheckInCard from '@/components/staff/CheckInCard'

export default function StaffHome() {
  return (
    <div className="max-w-md mx-auto">
      <CheckInCard />
    </div>
  )
}
```

- [ ] **Step 4: Verify**

Run `npm run dev`, go to `http://localhost:3000/staff`. Confirm it shows "Priya Sharma" in the header and a blue shift card with "09:00 – 18:00" and a Check In button already in "present" state (since the mock data seeds Priya as already checked in) — confirm it shows a Check Out button, not Check In. Click Check Out, grant location permission when prompted, confirm it changes to "Shift complete ✓". Reload the page — confirm it resets back to showing the Check Out button (expected: no persistence).

- [ ] **Step 5: Commit**

```bash
git add src/app/staff/layout.tsx src/components/staff/CheckInCard.tsx src/app/staff/page.tsx
git commit -m "feat: add staff layout and check-in/out UI"
```

---

## Task 3: Staff leave request + history

**Files:**
- Create: `src/app/staff/leave/page.tsx`

**Interfaces:**
- Consumes: `getMockLeaveRequests`, `CURRENT_STAFF_ID` from Task 1; type `LeaveRequest` from Task 1.

- [ ] **Step 1: Create `src/app/staff/leave/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { getMockLeaveRequests, CURRENT_STAFF_ID } from '@/lib/mock-data'
import type { LeaveRequest } from '@/lib/types'

const STATUS_COLOR: Record<LeaveRequest['status'], string> = {
  pending: 'bg-gray-200 text-gray-800',
  approved: 'bg-success/20 text-success',
  rejected: 'bg-danger/20 text-danger',
}

export default function StaffLeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>(
    getMockLeaveRequests().filter((r) => r.staffId === CURRENT_STAFF_ID)
  )
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setRequests([
      {
        id: `l-${Date.now()}`,
        staffId: CURRENT_STAFF_ID,
        startDate,
        endDate,
        reason,
        status: 'pending',
      },
      ...requests,
    ])
    setStartDate('')
    setEndDate('')
    setReason('')
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-lg p-6 space-y-3"
      >
        <h2 className="font-bold text-gray-900">Request leave</h2>
        <div className="flex gap-2">
          <input
            type="date"
            className="flex-1 border rounded-xl px-3 py-2"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <input
            type="date"
            className="flex-1 border rounded-xl px-3 py-2"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
        <textarea
          className="w-full border rounded-xl px-3 py-2"
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full bg-brand text-white rounded-xl py-2 font-semibold hover:bg-brand-dark"
        >
          Submit
        </button>
      </form>
      {requests.length === 0 ? (
        <p className="text-gray-500">No leave requests yet.</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li
              key={r.id}
              className="bg-white rounded-2xl shadow p-4 flex justify-between items-center"
            >
              <div>
                <p className="font-semibold">
                  {r.startDate} → {r.endDate}
                </p>
                <p className="text-sm text-gray-500">{r.reason}</p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_COLOR[r.status]}`}
              >
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Go to `http://localhost:3000/staff/leave`. Confirm the existing mock leave request ("Family function", pending) shows in the list. Submit a new request — confirm it appears at the top of the list with a "pending" badge.

- [ ] **Step 3: Commit**

```bash
git add src/app/staff/leave
git commit -m "feat: add staff leave request UI"
```

---

## Task 4: Team-lead status marking

**Files:**
- Create: `src/app/staff/team/page.tsx`

**Interfaces:**
- Consumes: `getMockAttendance`, `getMockProfiles`, `CURRENT_TEAM_LEAD_ID` from Task 1; types `Attendance`, `AttendanceStatus`, `Profile` from Task 1.

- [ ] **Step 1: Create `src/app/staff/team/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { getMockAttendance, getMockProfiles, CURRENT_TEAM_LEAD_ID } from '@/lib/mock-data'
import type { Attendance, AttendanceStatus, Profile } from '@/lib/types'

const MARKABLE_STATUSES: AttendanceStatus[] = [
  'marked_absent',
  'no_show',
  'false_attendance',
]

export default function TeamPage() {
  const me = getMockProfiles().find((p) => p.id === CURRENT_TEAM_LEAD_ID)!
  const profiles = getMockProfiles()
  const [rows, setRows] = useState<Attendance[]>(
    getMockAttendance().filter((a) => a.hotspotId === me.hotspotId)
  )

  function profileFor(staffId: string): Profile {
    return profiles.find((p) => p.id === staffId)!
  }

  function handleMark(id: string, status: AttendanceStatus) {
    setRows(rows.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  function handleFalseNegativeToggle(id: string) {
    setRows(
      rows.map((r) =>
        r.id === id ? { ...r, isFalseNegative: !r.isFalseNegative } : r
      )
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">
        Today&apos;s hotspot attendance
      </h1>
      {rows.length === 0 ? (
        <p className="text-gray-500">No staff shifts at your hotspot today.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="bg-white rounded-2xl shadow p-4 flex justify-between items-center gap-3"
            >
              <div>
                <p className="font-semibold">{profileFor(row.staffId).fullName}</p>
                <p className="text-sm text-gray-500">{row.status}</p>
              </div>
              <div className="flex items-center gap-2">
                {row.status === 'not_marked' && (
                  <select
                    className="border rounded-xl px-2 py-1 text-sm"
                    defaultValue=""
                    onChange={(e) =>
                      handleMark(row.id, e.target.value as AttendanceStatus)
                    }
                  >
                    <option value="" disabled>
                      Mark as…
                    </option>
                    {MARKABLE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => handleFalseNegativeToggle(row.id)}
                  className={`text-xs px-2 py-1 rounded-full font-semibold ${
                    row.isFalseNegative
                      ? 'bg-success text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  False Negative
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Go to `http://localhost:3000/staff/team`. Confirm it lists Priya (present), Suresh (no_show), and Neha (not_marked — with a "Mark as…" dropdown). Mark Neha as "marked_absent" — confirm her row updates and the dropdown disappears. Click the "False Negative" button on Suresh's row — confirm it turns green; click again — confirm it toggles off.

- [ ] **Step 3: Commit**

```bash
git add src/app/staff/team
git commit -m "feat: add team-lead attendance status marking UI"
```

---

## Task 5: Admin layout + dashboard home

**Files:**
- Create: `src/lib/attendance-summary.ts`
- Create: `src/components/admin/HotspotSwitcher.tsx`
- Create: `src/components/admin/OnDutyToggle.tsx`
- Create: `src/components/admin/AttendanceSummaryCard.tsx`
- Create: `src/components/admin/FalseNegativeRow.tsx`
- Create: `src/components/admin/AbsentBreakdownCard.tsx`
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `getMockHotspots`, `getMockAttendance`, `getMockProfiles`, `CURRENT_MANAGER_ID` from Task 1; types `Hotspot`, `Attendance` from Task 1.
- Produces: `computeAttendanceSummary(attendance: Attendance[], hotspotId: string): AttendanceSummary` where `AttendanceSummary = { totalExpected: number; present: number; absent: number; falseNegative: number; breakdown: { marked_absent: number; no_show: number; not_marked: number; false_attendance: number; on_leave: number } }`; `<HotspotSwitcher>`, `<OnDutyToggle>` — reused by Task 9 (attendance report).

- [ ] **Step 1: Create `src/lib/attendance-summary.ts`**

```ts
import type { Attendance } from './types'

export interface AttendanceSummary {
  totalExpected: number
  present: number
  absent: number
  falseNegative: number
  breakdown: {
    marked_absent: number
    no_show: number
    not_marked: number
    false_attendance: number
    on_leave: number
  }
}

export function computeAttendanceSummary(
  attendance: Attendance[],
  hotspotId: string
): AttendanceSummary {
  const rows = attendance.filter((a) => a.hotspotId === hotspotId)
  const breakdown = {
    marked_absent: 0,
    no_show: 0,
    not_marked: 0,
    false_attendance: 0,
    on_leave: 0,
  }
  let present = 0
  let falseNegative = 0

  for (const row of rows) {
    if (row.status === 'present') {
      present += 1
    } else {
      breakdown[row.status as keyof typeof breakdown] += 1
    }
    if (row.isFalseNegative) falseNegative += 1
  }

  return {
    totalExpected: rows.length,
    present,
    absent: rows.length - present,
    falseNegative,
    breakdown,
  }
}
```

- [ ] **Step 2: Create `src/components/admin/HotspotSwitcher.tsx`**

```tsx
'use client'

import type { Hotspot } from '@/lib/types'

export default function HotspotSwitcher({
  hotspots,
  selectedId,
  onChange,
}: {
  hotspots: Hotspot[]
  selectedId: string
  onChange: (id: string) => void
}) {
  return (
    <select
      className="bg-white border rounded-full px-3 py-1 font-semibold text-gray-900"
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
    >
      {hotspots.map((h) => (
        <option key={h.id} value={h.id}>
          {h.name}
        </option>
      ))}
    </select>
  )
}
```

- [ ] **Step 3: Create `src/components/admin/OnDutyToggle.tsx`**

```tsx
'use client'

import { useState } from 'react'

export default function OnDutyToggle({
  initialOnDuty,
}: {
  initialOnDuty: boolean
}) {
  const [onDuty, setOnDuty] = useState(initialOnDuty)

  return (
    <button
      onClick={() => setOnDuty(!onDuty)}
      className={`rounded-full px-3 py-1 text-sm font-semibold ${
        onDuty ? 'bg-success text-white' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {onDuty ? 'Online' : 'Offline'}
    </button>
  )
}
```

- [ ] **Step 4: Create `src/components/admin/AttendanceSummaryCard.tsx`**

```tsx
import type { AttendanceSummary } from '@/lib/attendance-summary'

export default function AttendanceSummaryCard({
  summary,
}: {
  summary: AttendanceSummary
}) {
  return (
    <div className="bg-brand text-white rounded-3xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-lg">Attendance</span>
        <span className="font-bold text-2xl">{summary.totalExpected}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>Present:</span>
        <span className="font-semibold">{summary.present}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>Absent:</span>
        <span className="font-semibold">{summary.absent}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `src/components/admin/FalseNegativeRow.tsx`**

```tsx
export default function FalseNegativeRow({ count }: { count: number }) {
  return (
    <div className="bg-success text-white rounded-2xl shadow p-4 flex justify-between items-center">
      <span className="font-semibold">False Negative:</span>
      <span className="font-bold text-xl">{String(count).padStart(2, '0')}</span>
    </div>
  )
}
```

- [ ] **Step 6: Create `src/components/admin/AbsentBreakdownCard.tsx`**

```tsx
import type { AttendanceSummary } from '@/lib/attendance-summary'

const LABELS: Record<keyof AttendanceSummary['breakdown'], string> = {
  marked_absent: 'Marked',
  no_show: 'No Show',
  not_marked: 'Not Marked',
  false_attendance: 'False Attendance',
  on_leave: 'On leave',
}

export default function AbsentBreakdownCard({
  summary,
}: {
  summary: AttendanceSummary
}) {
  return (
    <div className="bg-danger text-white rounded-3xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-lg">Absent</span>
        <span className="font-bold text-2xl">{summary.absent}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {(
          Object.keys(summary.breakdown) as (keyof AttendanceSummary['breakdown'])[]
        ).map((key) => (
          <div key={key} className="flex justify-between">
            <span>{LABELS[key]}:</span>
            <span className="font-semibold">
              {String(summary.breakdown[key]).padStart(2, '0')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create `src/app/admin/layout.tsx`**

```tsx
import Link from 'next/link'
import { getMockProfiles, CURRENT_MANAGER_ID } from '@/lib/mock-data'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const me = getMockProfiles().find((p) => p.id === CURRENT_MANAGER_ID)!

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white px-4 py-3 shadow-sm flex gap-4 items-center flex-wrap">
        <span className="font-bold text-gray-900">{me.fullName}</span>
        <nav className="flex gap-3 text-sm">
          <Link href="/admin" className="text-brand">
            Dashboard
          </Link>
          <Link href="/admin/staff" className="text-brand">
            Staff
          </Link>
          <Link href="/admin/shifts" className="text-brand">
            Shifts
          </Link>
          <Link href="/admin/leave" className="text-brand">
            Leave
          </Link>
          <Link href="/admin/attendance" className="text-brand">
            Report
          </Link>
          <Link href="/admin/notifications" className="text-brand">
            Notifications
          </Link>
        </nav>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
```

- [ ] **Step 8: Create `src/app/admin/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import {
  getMockHotspots,
  getMockAttendance,
  getMockProfiles,
  CURRENT_MANAGER_ID,
} from '@/lib/mock-data'
import { computeAttendanceSummary } from '@/lib/attendance-summary'
import HotspotSwitcher from '@/components/admin/HotspotSwitcher'
import OnDutyToggle from '@/components/admin/OnDutyToggle'
import AttendanceSummaryCard from '@/components/admin/AttendanceSummaryCard'
import FalseNegativeRow from '@/components/admin/FalseNegativeRow'
import AbsentBreakdownCard from '@/components/admin/AbsentBreakdownCard'

export default function AdminHome() {
  const hotspots = getMockHotspots()
  const me = getMockProfiles().find((p) => p.id === CURRENT_MANAGER_ID)!
  const [selectedId, setSelectedId] = useState(hotspots[0].id)
  const attendance = getMockAttendance()
  const summary = computeAttendanceSummary(attendance, selectedId)

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <HotspotSwitcher
          hotspots={hotspots}
          selectedId={selectedId}
          onChange={setSelectedId}
        />
        <OnDutyToggle initialOnDuty={me.isOnDuty} />
      </div>
      <AttendanceSummaryCard summary={summary} />
      <FalseNegativeRow count={summary.falseNegative} />
      <AbsentBreakdownCard summary={summary} />
    </div>
  )
}
```

- [ ] **Step 9: Verify**

Go to `http://localhost:3000/admin`. Confirm it shows "Anjali Mehta" in the header, the hotspot switcher defaulting to "Raheja", an Online toggle (green, since Anjali is seeded on-duty), and three cards: Attendance (4 total, 2 present, 2 absent), False Negative (00), and Absent breakdown (No Show: 01, Not Marked: 01, others 00). Click the Online toggle — confirm it flips to "Offline" (gray). Switch the hotspot to "Andheri West" — confirm all cards update to zero (no shifts there in mock data).

- [ ] **Step 10: Commit**

```bash
git add src/lib/attendance-summary.ts src/components/admin/HotspotSwitcher.tsx src/components/admin/OnDutyToggle.tsx src/components/admin/AttendanceSummaryCard.tsx src/components/admin/FalseNegativeRow.tsx src/components/admin/AbsentBreakdownCard.tsx src/app/admin/layout.tsx src/app/admin/page.tsx
git commit -m "feat: add manager dashboard home matching reference screens"
```

---

## Task 6: Notifications

**Files:**
- Create: `src/components/admin/NotificationBell.tsx`
- Create: `src/app/admin/notifications/page.tsx`
- Modify: `src/app/admin/layout.tsx` (from Task 5)

**Interfaces:**
- Consumes: `getMockNotifications` from Task 1; type `AppNotification` from Task 1.

- [ ] **Step 1: Create `src/components/admin/NotificationBell.tsx`**

```tsx
import Link from 'next/link'
import type { AppNotification } from '@/lib/types'

export default function NotificationBell({
  notifications,
}: {
  notifications: AppNotification[]
}) {
  const unreadCount = notifications.filter((n) => !n.readAt).length
  return (
    <Link href="/admin/notifications" className="relative">
      <span className="text-xl">🔔</span>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-brand text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
          {unreadCount}
        </span>
      )}
    </Link>
  )
}
```

- [ ] **Step 2: Create `src/app/admin/notifications/page.tsx`**

```tsx
import { getMockNotifications } from '@/lib/mock-data'

export default function NotificationsPage() {
  const notifications = getMockNotifications()

  return (
    <div className="max-w-md mx-auto space-y-2">
      <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
      {notifications.length === 0 && (
        <p className="text-gray-500">No notifications yet.</p>
      )}
      <ul className="space-y-2">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`rounded-2xl shadow p-4 ${
              n.readAt ? 'bg-white' : 'bg-brand/10'
            }`}
          >
            <p className="font-medium">{n.message}</p>
            <p className="text-xs text-gray-500">
              {new Date(n.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Modify `src/app/admin/layout.tsx` to add the bell**

Add the import and a call to `getMockNotifications()`, and render `NotificationBell` in the header. Change:

```tsx
import Link from 'next/link'
import { getMockProfiles, CURRENT_MANAGER_ID } from '@/lib/mock-data'
```

to:

```tsx
import Link from 'next/link'
import { getMockProfiles, getMockNotifications, CURRENT_MANAGER_ID } from '@/lib/mock-data'
import NotificationBell from '@/components/admin/NotificationBell'
```

Add before the `return`:

```tsx
  const notifications = getMockNotifications()
```

And change:

```tsx
        <span className="font-bold text-gray-900">{me.fullName}</span>
        <nav className="flex gap-3 text-sm">
```

to:

```tsx
        <span className="font-bold text-gray-900">{me.fullName}</span>
        <NotificationBell notifications={notifications} />
        <nav className="flex gap-3 text-sm">
```

- [ ] **Step 4: Verify**

Go to `http://localhost:3000/admin`. Confirm the bell icon shows a badge with "2" (both mock notifications are unread). Click it — confirm `/admin/notifications` lists both "TL Ravi Kumar has reached the hotspot" entries with timestamps, styled with a highlighted background (unread).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/NotificationBell.tsx src/app/admin/notifications src/app/admin/layout.tsx
git commit -m "feat: add manager notification feed UI"
```

---

## Task 7: Staff list + shift assignment

**Files:**
- Create: `src/components/admin/StaffTable.tsx`
- Create: `src/app/admin/staff/page.tsx`
- Create: `src/app/admin/shifts/page.tsx`

**Interfaces:**
- Consumes: `getMockProfiles`, `getMockHotspots`, `getMockShifts` from Task 1; types `Profile`, `Hotspot`, `Shift` from Task 1.

- [ ] **Step 1: Create `src/components/admin/StaffTable.tsx`**

```tsx
import type { Profile } from '@/lib/types'

export default function StaffTable({ staff }: { staff: Profile[] }) {
  if (staff.length === 0) {
    return <p className="text-gray-500">No staff at your hotspots yet.</p>
  }

  return (
    <ul className="space-y-2">
      {staff.map((s) => (
        <li
          key={s.id}
          className="bg-white rounded-2xl shadow p-4 flex justify-between"
        >
          <span className="font-semibold">{s.fullName}</span>
          <span className="text-sm text-gray-500">{s.role}</span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: Create `src/app/admin/staff/page.tsx`**

```tsx
import { getMockProfiles } from '@/lib/mock-data'
import StaffTable from '@/components/admin/StaffTable'

export default function AdminStaffPage() {
  const staff = getMockProfiles().filter(
    (p) => p.role === 'staff' || p.role === 'team_lead'
  )
  return (
    <div className="max-w-md mx-auto">
      <StaffTable staff={staff} />
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/admin/shifts/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { getMockProfiles, getMockHotspots, getMockShifts } from '@/lib/mock-data'
import type { Shift } from '@/lib/types'

export default function AdminShiftsPage() {
  const staff = getMockProfiles().filter(
    (p) => p.role === 'staff' || p.role === 'team_lead'
  )
  const hotspots = getMockHotspots()
  const [shifts, setShifts] = useState<Shift[]>(getMockShifts())
  const [staffId, setStaffId] = useState('')
  const [hotspotId, setHotspotId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setShifts([
      { id: `sh-${Date.now()}`, staffId, hotspotId, date, startTime, endTime },
      ...shifts.filter((s) => !(s.staffId === staffId && s.date === date)),
    ])
    setStaffId('')
    setHotspotId('')
    setDate('')
  }

  function nameFor(id: string) {
    return staff.find((s) => s.id === id)?.fullName ?? id
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-lg p-6 space-y-3"
      >
        <h2 className="font-bold text-gray-900">Assign shift</h2>
        <select
          className="w-full border rounded-xl px-3 py-2"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          required
        >
          <option value="">Select staff</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </select>
        <select
          className="w-full border rounded-xl px-3 py-2"
          value={hotspotId}
          onChange={(e) => setHotspotId(e.target.value)}
          required
        >
          <option value="">Select hotspot</option>
          {hotspots.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="w-full border rounded-xl px-3 py-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <div className="flex gap-2">
          <input
            type="time"
            className="flex-1 border rounded-xl px-3 py-2"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          <input
            type="time"
            className="flex-1 border rounded-xl px-3 py-2"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-brand text-white rounded-xl py-2 font-semibold hover:bg-brand-dark"
        >
          Assign
        </button>
      </form>
      <ul className="space-y-2">
        {shifts.map((s) => (
          <li
            key={s.id}
            className="bg-white rounded-2xl shadow p-4 flex justify-between"
          >
            <span className="font-semibold">{nameFor(s.staffId)}</span>
            <span className="text-sm text-gray-500">
              {s.date} {s.startTime}-{s.endTime}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

Go to `/admin/staff` — confirm it lists Priya, Ravi, Suresh, Neha with their roles. Go to `/admin/shifts` — confirm the 4 seeded shifts show in the list below the form. Assign a new shift to any staff member for tomorrow — confirm it appears at the top of the list with the right name/date/time.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/StaffTable.tsx src/app/admin/staff src/app/admin/shifts
git commit -m "feat: add manager staff list and shift assignment UI"
```

---

## Task 8: Leave approval queue

**Files:**
- Create: `src/app/admin/leave/page.tsx`

**Interfaces:**
- Consumes: `getMockLeaveRequests`, `getMockProfiles` from Task 1; type `LeaveRequest` from Task 1.

- [ ] **Step 1: Create `src/app/admin/leave/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { getMockLeaveRequests, getMockProfiles } from '@/lib/mock-data'
import type { LeaveRequest } from '@/lib/types'

export default function AdminLeavePage() {
  const profiles = getMockProfiles()
  const [requests, setRequests] = useState<LeaveRequest[]>(
    getMockLeaveRequests().filter((r) => r.status === 'pending')
  )

  function nameFor(staffId: string) {
    return profiles.find((p) => p.id === staffId)?.fullName ?? staffId
  }

  function handleReview(id: string) {
    setRequests(requests.filter((r) => r.id !== id))
  }

  if (requests.length === 0) {
    return <p className="text-gray-500">No pending leave requests.</p>
  }

  return (
    <div className="max-w-md mx-auto">
      <ul className="space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="bg-white rounded-2xl shadow p-4 space-y-2">
            <p className="font-semibold">{nameFor(r.staffId)}</p>
            <p className="text-sm text-gray-500">
              {r.startDate} → {r.endDate}
            </p>
            <p className="text-sm">{r.reason}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleReview(r.id)}
                className="flex-1 bg-success text-white rounded-xl py-1 text-sm font-semibold"
              >
                Approve
              </button>
              <button
                onClick={() => handleReview(r.id)}
                className="flex-1 bg-danger text-white rounded-xl py-1 text-sm font-semibold"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Go to `/admin/leave`. Confirm Priya's "Family function" leave request shows with Approve/Reject buttons. Click Approve — confirm the request disappears from the queue. Reload the page — confirm it reappears (expected: no persistence).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/leave
git commit -m "feat: add manager leave approval queue UI"
```

---

## Task 9: Attendance report + PWA installability

**Files:**
- Create: `src/components/admin/AttendanceTable.tsx`
- Create: `src/app/admin/attendance/page.tsx`
- Create: `public/manifest.json`
- Create: `public/icons/icon.svg`

**Interfaces:**
- Consumes: `getMockHotspots`, `getMockAttendance`, `getMockProfiles` from Task 1; `<HotspotSwitcher>` from Task 5; types `Attendance`, `Profile` from Task 1.

- [ ] **Step 1: Create `src/components/admin/AttendanceTable.tsx`**

```tsx
import type { Attendance, Profile } from '@/lib/types'

export default function AttendanceTable({
  rows,
  profiles,
}: {
  rows: Attendance[]
  profiles: Profile[]
}) {
  function nameFor(staffId: string) {
    return profiles.find((p) => p.id === staffId)?.fullName ?? staffId
  }

  if (rows.length === 0) {
    return <p className="text-gray-500">No attendance records for this date.</p>
  }

  return (
    <table className="w-full bg-white rounded-2xl shadow overflow-hidden text-sm">
      <thead className="bg-gray-100">
        <tr>
          <th className="text-left p-2">Name</th>
          <th className="text-left p-2">Status</th>
          <th className="text-left p-2">Check-in</th>
          <th className="text-left p-2">Check-out</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t">
            <td className="p-2">{nameFor(r.staffId)}</td>
            <td className="p-2">{r.status}</td>
            <td className="p-2">
              {r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : '—'}
            </td>
            <td className="p-2">
              {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 2: Create `src/app/admin/attendance/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { getMockHotspots, getMockAttendance, getMockProfiles } from '@/lib/mock-data'
import HotspotSwitcher from '@/components/admin/HotspotSwitcher'
import AttendanceTable from '@/components/admin/AttendanceTable'

export default function AttendanceReportPage() {
  const hotspots = getMockHotspots()
  const profiles = getMockProfiles()
  const [selectedId, setSelectedId] = useState(hotspots[0].id)
  const rows = getMockAttendance().filter((a) => a.hotspotId === selectedId)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <HotspotSwitcher
        hotspots={hotspots}
        selectedId={selectedId}
        onChange={setSelectedId}
      />
      <AttendanceTable rows={rows} profiles={profiles} />
    </div>
  )
}
```

- [ ] **Step 3: Create `public/icons/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <rect width="192" height="192" rx="32" fill="#4C5FEA"/>
  <text x="96" y="124" font-size="96" fill="#ffffff" text-anchor="middle" font-family="sans-serif" font-weight="bold">S</text>
</svg>
```

- [ ] **Step 4: Create `public/manifest.json`**

```json
{
  "name": "Snabbit Salon OG",
  "short_name": "Salon OG",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FBF2DD",
  "theme_color": "#4C5FEA",
  "icons": [
    { "src": "/icons/icon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

- [ ] **Step 5: Verify**

Run `npm run build && npm run start`. Open `http://localhost:3000` in Chrome. Go to `/admin/attendance`, confirm the table shows the 4 seeded attendance rows with correct names/statuses/times for "Raheja", and updates to empty for "Andheri West". Open DevTools → Application → Manifest and confirm it loads with no errors and shows the "S" icon.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AttendanceTable.tsx src/app/admin/attendance public/manifest.json public/icons
git commit -m "feat: add attendance report table and PWA manifest"
```
