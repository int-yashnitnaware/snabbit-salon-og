# Salon OG v2 (CLM / Partner Rebuild) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing staff/team-lead/manager attendance app with a CLM + Partner field-tracking app (two separate mini-apps, `/clm` and `/partner`, in one Next.js codebase), running entirely on generated random mock data persisted in `localStorage` — no backend calls.

**Architecture:** Two independent, session-guarded route trees (`src/app/clm/**`, `src/app/partner/**`) share a client-only data layer (`src/lib/store.ts`, backed by `localStorage`) seeded once with random Bangalore hotspots, CLMs, Partners, and today's attendance records. Phone+OTP auth is mocked (fixed code, no SMS); selfie capture stores a local data URL. Partner check-in/out captures one-shot GPS and matches it to the nearest hotspot via a haversine distance helper, which is how the CLM dashboard's Original-vs-Current-Hotspot comparison gets its data.

**Tech Stack:** Next.js (App Router) + React + TypeScript + Tailwind CSS, `next-pwa` — all already in the project. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-12-salon-og-clm-partner-design.md`

## Global Constraints

- Two apps, one codebase: `/clm` (Cluster Manager) and `/partner` (Partner/Expert). No shared session between them. TLs have zero data footprint anywhere in the app (per spec — out of scope for v1).
- Mock/random data only, persisted in `localStorage` under fixed keys. No Supabase or network calls in this phase — `@supabase/supabase-js` stays an unused dependency.
- OTP is mocked: fixed code `1234`, shown on screen, no real SMS is ever sent.
- GPS is captured once at check-in and once at check-out only — no continuous/background tracking (per spec).
- Use the existing Tailwind tokens from `tailwind.config.js` — `brand` (`#4C5FEA`), `cream` (`#FBF2DD`), `success` (`#3F9065`), `danger` (`#D97462`), and the `3xl` border radius. Don't introduce new colors.
- Use a fixed literal date constant for "today" (`TODAY` in `src/lib/seed-data.ts`) instead of `new Date()` wherever "today" is needed in rendered output — avoids SSR/client hydration mismatches. This is the same pattern the prior app used in `src/lib/mock-data.ts`.
- `src/lib/store.ts` and `src/lib/session.ts` use the bare global `localStorage` API (not `window.localStorage`) and are marked `'use client'`. Every component that calls into them must also be a Client Component (`'use client'`) and must read data inside `useEffect`/event handlers, never synchronously in the render body during the component's first (pre-mount) render — this keeps server-rendered and first-client-render HTML identical and avoids hydration errors.
- **No automated test suite** (per spec, matching the prior app's explicit YAGNI call). Verification per task is either (a) a throwaway Node script for pure/data-layer logic — Node 26 runs `.ts` files directly via built-in type-stripping, and `node --localstorage-file=<path> <file>.ts` makes the `localStorage` global available for store/session verification — deleted after confirming output, never committed; or (b) `npm run dev` + manual browser steps for anything involving React rendering or browser-only APIs (geolocation, camera). This was confirmed working in this environment before writing this plan.
- Follow the existing code style: `'use client'` at the top of any file touching browser APIs or React state, function components, Tailwind utility classes inline (no CSS modules), `@/` path alias for imports from `src/`.

---

### Task 1: Remove the legacy app and add the new landing page

**Files:**
- Delete: `src/app/admin/` (entire directory)
- Delete: `src/app/staff/` (entire directory)
- Delete: `src/components/admin/` (entire directory)
- Delete: `src/components/staff/` (entire directory)
- Delete: `src/lib/attendance-summary.ts`
- Delete: `src/lib/labels.ts`
- Delete: `src/lib/mock-data.ts`
- Delete: `src/lib/types.ts`
- Modify: `src/app/page.tsx` (replace entirely)

**Interfaces:**
- Consumes: nothing
- Produces: a working root `/` route with links to `/clm` and `/partner` (those routes don't exist yet — that's fine, they're built in later tasks; this task just removes dead code and gets the app to a clean, buildable baseline)

- [ ] **Step 1: Delete the legacy routes, components, and lib files**

```bash
cd ~/myapp
git rm -r src/app/admin src/app/staff src/components/admin src/components/staff
git rm src/lib/attendance-summary.ts src/lib/labels.ts src/lib/mock-data.ts src/lib/types.ts
```

- [ ] **Step 2: Replace the root landing page**

Write `src/app/page.tsx`:

```tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-cream flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold text-brand">Snabbit Salon OG</h1>
      <div className="w-full max-w-xs space-y-4">
        <Link
          href="/clm"
          className="block text-center bg-brand text-white rounded-xl py-4 font-semibold"
        >
          CLM App
        </Link>
        <Link
          href="/partner"
          className="block text-center bg-white text-brand border-2 border-brand rounded-xl py-4 font-semibold"
        >
          Partner App
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Verify the app still builds and the root page renders**

Run: `npm run dev` (in `~/myapp`), then open `http://localhost:3000/` in a browser.
Expected: page loads with the "Snabbit Salon OG" heading and two buttons. Clicking either button navigates to a 404 for now (expected — those routes come later). Stop the dev server (Ctrl+C) when confirmed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Remove legacy staff/admin app, add new landing page"
```

---

### Task 2: Core types and the nearest-hotspot geo utility

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/geo.ts`

**Interfaces:**
- Consumes: nothing
- Produces (used by every later task):
  - Types: `PartnerCategory`, `PARTNER_CATEGORIES: { value: PartnerCategory; label: string }[]`, `Hotspot`, `Clm`, `Partner`, `AttendanceStatus`, `AttendanceRecord`
  - `distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number`
  - `findNearestHotspot(lat: number, lng: number, hotspots: Hotspot[]): Hotspot | null`

- [ ] **Step 1: Write the types**

Write `src/lib/types.ts`:

```ts
export type PartnerCategory =
  | 'hair_stylist'
  | 'makeup_artist'
  | 'mehendi_artist'
  | 'spa_therapist'
  | 'nail_artist'

export const PARTNER_CATEGORIES: { value: PartnerCategory; label: string }[] = [
  { value: 'hair_stylist', label: 'Hair Stylist' },
  { value: 'makeup_artist', label: 'Makeup Artist' },
  { value: 'mehendi_artist', label: 'Mehendi Artist' },
  { value: 'spa_therapist', label: 'Spa Therapist' },
  { value: 'nail_artist', label: 'Nail Artist' },
]

export interface Hotspot {
  id: string
  name: string
  area: string
  lat: number
  lng: number
}

export interface Clm {
  id: string
  name: string
  phone: string
  selfieUrl: string | null
  isOnDuty: boolean
}

export interface Partner {
  id: string
  name: string
  phone: string
  selfieUrl: string | null
  category: PartnerCategory
  originalHotspotId: string
  shiftStart: string
  shiftEnd: string
}

export type AttendanceStatus =
  | 'not_marked'
  | 'present'
  | 'logged_out'
  | 'logged_out_early'
  | 'absent'
  | 'marked_absent'

export interface AttendanceRecord {
  id: string
  partnerId: string
  date: string
  status: AttendanceStatus
  checkInAt: string | null
  checkInLat: number | null
  checkInLng: number | null
  currentHotspotId: string | null
  checkOutAt: string | null
  checkOutLat: number | null
  checkOutLng: number | null
}
```

- [ ] **Step 2: Write the geo utility**

Write `src/lib/geo.ts`:

```ts
import type { Hotspot } from './types'

const EARTH_RADIUS_KM = 6371

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

export function findNearestHotspot(
  lat: number,
  lng: number,
  hotspots: Hotspot[]
): Hotspot | null {
  if (hotspots.length === 0) return null
  let nearest = hotspots[0]
  let nearestDist = distanceKm(lat, lng, nearest.lat, nearest.lng)
  for (const hotspot of hotspots.slice(1)) {
    const dist = distanceKm(lat, lng, hotspot.lat, hotspot.lng)
    if (dist < nearestDist) {
      nearest = hotspot
      nearestDist = dist
    }
  }
  return nearest
}
```

- [ ] **Step 3: Verify with a throwaway script**

Write a temporary file `src/lib/__verify-geo.ts`:

```ts
import { findNearestHotspot, distanceKm } from './geo'
import type { Hotspot } from './types'

const hotspots: Hotspot[] = [
  { id: 'hs-1', name: 'HSR Hotspot', area: 'HSR', lat: 12.9121, lng: 77.6446 },
  { id: 'hs-2', name: 'Whitefield Hotspot', area: 'Whitefield', lat: 12.9698, lng: 77.75 },
]

const near = findNearestHotspot(12.913, 77.645, hotspots)
console.log('nearest to HSR point:', near?.id, '(expect hs-1)')

const far = findNearestHotspot(12.97, 77.751, hotspots)
console.log('nearest to Whitefield point:', far?.id, '(expect hs-2)')

console.log('empty list:', findNearestHotspot(0, 0, []), '(expect null)')
console.log('distance HSR-Whitefield km:', distanceKm(12.9121, 77.6446, 12.9698, 77.75).toFixed(1))
```

Run: `node src/lib/__verify-geo.ts`
Expected output:
```
nearest to HSR point: hs-1 (expect hs-1)
nearest to Whitefield point: hs-2 (expect hs-2)
empty list: null (expect null)
distance HSR-Whitefield km: <some positive number>
```

Delete the throwaway script once confirmed: `rm src/lib/__verify-geo.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/geo.ts
git commit -m "Add CLM/Partner types and nearest-hotspot geo utility"
```

---

### Task 3: Random seed data generator

**Files:**
- Create: `src/lib/seed-data.ts`

**Interfaces:**
- Consumes: `Hotspot`, `Clm`, `Partner`, `AttendanceRecord`, `AttendanceStatus`, `PartnerCategory`, `PARTNER_CATEGORIES` from `./types` (Task 2)
- Produces (used by Task 4 and all CLM/Partner pages):
  - `TODAY: string` — fixed literal date constant, e.g. `'2026-10-12'`
  - `seedHotspots(): Hotspot[]`
  - `seedClms(): Clm[]`
  - `seedPartners(hotspots: Hotspot[], count?: number): Partner[]`
  - `seedAttendanceRecords(partners: Partner[], hotspots: Hotspot[]): AttendanceRecord[]`

- [ ] **Step 1: Write the seed data generator**

Write `src/lib/seed-data.ts`:

```ts
import type { Hotspot, Clm, Partner, AttendanceRecord, AttendanceStatus, PartnerCategory } from './types'
import { PARTNER_CATEGORIES } from './types'

// Fixed literal date (not computed at request time) so the mock dataset and
// any "today" comparisons stay stable across server render and client
// hydration, and across reloads. Matches the pattern used by the prior app.
export const TODAY = '2026-10-12'

// Deterministic PRNG so the same seed always produces the same mock dataset
// within a session (re-seeding only happens once, on first localStorage read).
function mulberry32(seed: number) {
  return function random() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(42)

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

function jitter(value: number, maxDelta: number): number {
  return value + (rand() * 2 - 1) * maxDelta
}

const BANGALORE_AREAS: { area: string; name: string; lat: number; lng: number }[] = [
  { area: 'Bellandur', name: 'Bellandur Hotspot', lat: 12.9257, lng: 77.6649 },
  { area: 'BTM Layout', name: 'BTM Layout Hotspot', lat: 12.9166, lng: 77.6101 },
  { area: 'HSR', name: 'HSR Hotspot', lat: 12.9121, lng: 77.6446 },
  { area: 'Jayanagar', name: 'Jayanagar Hotspot', lat: 12.9308, lng: 77.5838 },
  { area: 'Indiranagar', name: 'Indiranagar Hotspot', lat: 12.9719, lng: 77.6412 },
  { area: 'Koramangala', name: 'Koramangala Hotspot', lat: 12.9352, lng: 77.6245 },
  { area: 'Whitefield', name: 'Whitefield Hotspot', lat: 12.9698, lng: 77.75 },
]

const FIRST_NAMES = [
  'Rohini', 'Jyotsna', 'Priya', 'Suresh', 'Neha', 'Deepak', 'Kavita',
  'Meena', 'Zoya', 'Arjun', 'Pooja', 'Vikram', 'Sunita', 'Rahul',
]
const LAST_NAMES = [
  'Kumal', 'Barman', 'Sharma', 'Patil', 'Joshi', 'Rao', 'Iyer',
  'Kulkarni', 'Khan', 'Verma', 'Nair',
]

function randomName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
}

function randomPhone(): string {
  let digits = '9'
  for (let i = 0; i < 9; i++) digits += Math.floor(rand() * 10)
  return digits
}

export function seedHotspots(): Hotspot[] {
  return BANGALORE_AREAS.map((a, i) => ({
    id: `hs-${i + 1}`,
    name: a.name,
    area: a.area,
    lat: a.lat,
    lng: a.lng,
  }))
}

export function seedClms(): Clm[] {
  return [
    { id: 'clm-1', name: 'Aman Singh', phone: '9876500001', selfieUrl: null, isOnDuty: true },
    { id: 'clm-2', name: 'Pooja Nair', phone: '9876500002', selfieUrl: null, isOnDuty: false },
  ]
}

const SHIFT_SLOTS: [string, string][] = [
  ['08:00', '17:00'],
  ['09:00', '18:00'],
  ['10:00', '19:00'],
]

export function seedPartners(hotspots: Hotspot[], count = 24): Partner[] {
  const categories = PARTNER_CATEGORIES.map((c) => c.value)
  return Array.from({ length: count }, (_, i) => {
    const hotspot = pick(hotspots)
    const [shiftStart, shiftEnd] = pick(SHIFT_SLOTS)
    return {
      id: `partner-${i + 1}`,
      name: randomName(),
      phone: randomPhone(),
      selfieUrl: null,
      category: pick(categories) as PartnerCategory,
      originalHotspotId: hotspot.id,
      shiftStart,
      shiftEnd,
    }
  })
}

const STATUS_POOL: AttendanceStatus[] = [
  'present', 'present', 'present',
  'logged_out', 'logged_out_early',
  'not_marked', 'absent', 'marked_absent',
]

export function seedAttendanceRecords(partners: Partner[], hotspots: Hotspot[]): AttendanceRecord[] {
  return partners.map((partner, i) => {
    const status = pick(STATUS_POOL)
    const home = hotspots.find((h) => h.id === partner.originalHotspotId)!
    const checkedIn = status === 'present' || status === 'logged_out' || status === 'logged_out_early'
    const checkInLat = checkedIn ? jitter(home.lat, 0.01) : null
    const checkInLng = checkedIn ? jitter(home.lng, 0.01) : null
    const loggedOut = status === 'logged_out' || status === 'logged_out_early'
    return {
      id: `att-${i + 1}`,
      partnerId: partner.id,
      date: TODAY,
      status,
      checkInAt: checkedIn ? `${TODAY}T${partner.shiftStart}:00` : null,
      checkInLat,
      checkInLng,
      currentHotspotId: checkedIn ? partner.originalHotspotId : null,
      checkOutAt: loggedOut ? `${TODAY}T${partner.shiftEnd}:00` : null,
      checkOutLat: loggedOut ? checkInLat : null,
      checkOutLng: loggedOut ? checkInLng : null,
    }
  })
}
```

- [ ] **Step 2: Verify with a throwaway script**

Write a temporary file `src/lib/__verify-seed.ts`:

```ts
import { seedHotspots, seedClms, seedPartners, seedAttendanceRecords, TODAY } from './seed-data'

const hotspots = seedHotspots()
console.log('hotspot count:', hotspots.length, '(expect 7)')

const clms = seedClms()
console.log('clm count:', clms.length, '(expect 2)')

const partners = seedPartners(hotspots, 24)
console.log('partner count:', partners.length, '(expect 24)')
console.log('all partners have a valid originalHotspotId:',
  partners.every((p) => hotspots.some((h) => h.id === p.originalHotspotId)))

const records = seedAttendanceRecords(partners, hotspots)
console.log('record count matches partner count:', records.length === partners.length)
console.log('all records dated TODAY:', records.every((r) => r.date === TODAY))
console.log('sample record:', JSON.stringify(records[0]))
```

Run: `node src/lib/__verify-seed.ts`
Expected: all boolean checks print `true`, counts match the "(expect N)" comments, and the sample record is a well-formed JSON object.

Delete the throwaway script once confirmed: `rm src/lib/__verify-seed.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/seed-data.ts
git commit -m "Add random mock data generator for hotspots, CLMs, partners, attendance"
```

---

### Task 4: LocalStorage-backed data store and session

**Files:**
- Create: `src/lib/store.ts`
- Create: `src/lib/session.ts`

**Interfaces:**
- Consumes: `Hotspot`, `Clm`, `Partner`, `AttendanceRecord` from `./types`; `seedHotspots`, `seedClms`, `seedPartners`, `seedAttendanceRecords` from `./seed-data` (Task 3)
- Produces (used by every page from Task 6 onward):
  - `getHotspots(): Hotspot[]`
  - `getClms(): Clm[]`
  - `getPartners(): Partner[]`
  - `getAttendanceRecords(): AttendanceRecord[]`
  - `findClmByPhone(phone: string): Clm | null`
  - `findPartnerByPhone(phone: string): Partner | null`
  - `addClm(clm: Clm): void`
  - `addPartner(partner: Partner, initialRecord: AttendanceRecord): void`
  - `updateClmDutyStatus(clmId: string, isOnDuty: boolean): void`
  - `getAttendanceRecordForPartnerToday(partnerId: string, date: string): AttendanceRecord | null`
  - `upsertAttendanceRecord(record: AttendanceRecord): void`
  - `markPartnerAbsent(attendanceId: string): void`
  - `type SessionRole = 'clm' | 'partner'`
  - `interface Session { role: SessionRole; userId: string }`
  - `getSession(): Session | null`
  - `setSession(session: Session): void`
  - `clearSession(): void`

- [ ] **Step 1: Write the store**

Write `src/lib/store.ts`:

```ts
'use client'

import type { Hotspot, Clm, Partner, AttendanceRecord } from './types'
import { seedHotspots, seedClms, seedPartners, seedAttendanceRecords } from './seed-data'

const STORAGE_KEY = 'salon-og-store-v1'

interface StoreData {
  hotspots: Hotspot[]
  clms: Clm[]
  partners: Partner[]
  attendanceRecords: AttendanceRecord[]
}

function buildInitialStore(): StoreData {
  const hotspots = seedHotspots()
  const clms = seedClms()
  const partners = seedPartners(hotspots)
  const attendanceRecords = seedAttendanceRecords(partners, hotspots)
  return { hotspots, clms, partners, attendanceRecords }
}

function readStore(): StoreData {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const initial = buildInitialStore()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
    return initial
  }
  return JSON.parse(raw) as StoreData
}

function writeStore(data: StoreData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getHotspots(): Hotspot[] {
  return readStore().hotspots
}

export function getClms(): Clm[] {
  return readStore().clms
}

export function getPartners(): Partner[] {
  return readStore().partners
}

export function getAttendanceRecords(): AttendanceRecord[] {
  return readStore().attendanceRecords
}

export function findClmByPhone(phone: string): Clm | null {
  return readStore().clms.find((c) => c.phone === phone) ?? null
}

export function findPartnerByPhone(phone: string): Partner | null {
  return readStore().partners.find((p) => p.phone === phone) ?? null
}

export function addClm(clm: Clm): void {
  const store = readStore()
  store.clms.push(clm)
  writeStore(store)
}

export function addPartner(partner: Partner, initialRecord: AttendanceRecord): void {
  const store = readStore()
  store.partners.push(partner)
  store.attendanceRecords.push(initialRecord)
  writeStore(store)
}

export function updateClmDutyStatus(clmId: string, isOnDuty: boolean): void {
  const store = readStore()
  const clm = store.clms.find((c) => c.id === clmId)
  if (clm) clm.isOnDuty = isOnDuty
  writeStore(store)
}

export function getAttendanceRecordForPartnerToday(partnerId: string, date: string): AttendanceRecord | null {
  return readStore().attendanceRecords.find((a) => a.partnerId === partnerId && a.date === date) ?? null
}

export function upsertAttendanceRecord(record: AttendanceRecord): void {
  const store = readStore()
  const idx = store.attendanceRecords.findIndex((a) => a.id === record.id)
  if (idx >= 0) store.attendanceRecords[idx] = record
  else store.attendanceRecords.push(record)
  writeStore(store)
}

export function markPartnerAbsent(attendanceId: string): void {
  const store = readStore()
  const record = store.attendanceRecords.find((a) => a.id === attendanceId)
  if (record) record.status = 'marked_absent'
  writeStore(store)
}
```

- [ ] **Step 2: Write the session helper**

Write `src/lib/session.ts`:

```ts
'use client'

const SESSION_KEY = 'salon-og-session-v1'

export type SessionRole = 'clm' | 'partner'

export interface Session {
  role: SessionRole
  userId: string
}

export function getSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY)
  return raw ? (JSON.parse(raw) as Session) : null
}

export function setSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
```

- [ ] **Step 3: Verify with a throwaway script**

Write a temporary file `src/lib/__verify-store.ts`:

```ts
import { getHotspots, getPartners, addClm, findClmByPhone, upsertAttendanceRecord, getAttendanceRecordForPartnerToday, markPartnerAbsent } from './store'
import { setSession, getSession, clearSession } from './session'
import { TODAY } from './seed-data'

console.log('seeded hotspots:', getHotspots().length, '(expect 7)')
console.log('seeded partners:', getPartners().length, '(expect 24)')

addClm({ id: 'clm-test', name: 'Test CLM', phone: '9999999999', selfieUrl: null, isOnDuty: false })
console.log('found added CLM:', findClmByPhone('9999999999')?.name, '(expect Test CLM)')

const partner = getPartners()[0]
upsertAttendanceRecord({
  id: 'att-verify',
  partnerId: partner.id,
  date: TODAY,
  status: 'present',
  checkInAt: `${TODAY}T09:00:00`,
  checkInLat: 12.9,
  checkInLng: 77.6,
  currentHotspotId: 'hs-1',
  checkOutAt: null,
  checkOutLat: null,
  checkOutLng: null,
})
console.log('upserted record status:', getAttendanceRecordForPartnerToday(partner.id, TODAY)?.status, '(expect present, if partner had no other record for TODAY already)')

markPartnerAbsent('att-verify')
console.log('after markPartnerAbsent:', getAttendanceRecordForPartnerToday(partner.id, TODAY)?.status, '(expect marked_absent if att-verify was the record returned above)')

setSession({ role: 'clm', userId: 'clm-test' })
console.log('session role:', getSession()?.role, '(expect clm)')
clearSession()
console.log('session after clear:', getSession(), '(expect null)')
```

Run: `node --localstorage-file=/tmp/verify-store.db src/lib/__verify-store.ts`
Expected: all printed values match their "(expect ...)" comments. (Note: since every partner starts with a seeded record for `TODAY`, `getAttendanceRecordForPartnerToday` after the upsert will return whichever record matches `partnerId`+`date` first — if the seeded record and `att-verify` differ, re-run is fine, the important checks are the hotspot/partner counts, the added-CLM lookup, and the session round-trip.)

Delete the throwaway script and its scratch db once confirmed: `rm src/lib/__verify-store.ts /tmp/verify-store.db`

- [ ] **Step 4: Commit**

```bash
git add src/lib/store.ts src/lib/session.ts
git commit -m "Add localStorage-backed data store and session helpers"
```

---

### Task 5: Attendance status derivation and display labels

**Files:**
- Create: `src/lib/attendance.ts`

**Interfaces:**
- Consumes: `AttendanceRecord`, `AttendanceStatus` from `./types`
- Produces (used by CLM home/partners pages, Task 8–9):
  - `STATUS_LABELS: Record<AttendanceStatus, string>`
  - `STATUS_COLORS: Record<AttendanceStatus, string>`
  - `displayStatus(record: AttendanceRecord, shiftEnd: string, now: Date): AttendanceStatus`

- [ ] **Step 1: Write the module**

Write `src/lib/attendance.ts`:

```ts
import type { AttendanceRecord, AttendanceStatus } from './types'

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  not_marked: 'Not Marked',
  present: 'Present',
  logged_out: 'Logged Out',
  logged_out_early: 'Logged Out Early',
  absent: 'Absent',
  marked_absent: 'Marked Absent',
}

export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  not_marked: 'bg-gray-200 text-gray-700',
  present: 'bg-success/20 text-success',
  logged_out: 'bg-gray-200 text-gray-700',
  logged_out_early: 'bg-orange-100 text-orange-700',
  absent: 'bg-danger/20 text-danger',
  marked_absent: 'bg-danger/20 text-danger',
}

// A shift that ended with no check-in displays as Absent even though the
// stored status is still `not_marked` (see design spec, status transition
// step 4). This is a read-time projection only — it never mutates the
// record. CLM-initiated `marked_absent` stays as-is; it is a judgment call
// and should never be overwritten back to a derived status.
export function displayStatus(record: AttendanceRecord, shiftEnd: string, now: Date): AttendanceStatus {
  if (record.status !== 'not_marked') return record.status
  const [hours, minutes] = shiftEnd.split(':').map(Number)
  const shiftEndTime = new Date(`${record.date}T00:00:00`)
  shiftEndTime.setHours(hours, minutes, 0, 0)
  return now > shiftEndTime ? 'absent' : 'not_marked'
}
```

- [ ] **Step 2: Verify with a throwaway script**

Write a temporary file `src/lib/__verify-attendance.ts`:

```ts
import { displayStatus } from './attendance'
import type { AttendanceRecord } from './types'

const base: AttendanceRecord = {
  id: 'a1',
  partnerId: 'p1',
  date: '2026-10-12',
  status: 'not_marked',
  checkInAt: null,
  checkInLat: null,
  checkInLng: null,
  currentHotspotId: null,
  checkOutAt: null,
  checkOutLat: null,
  checkOutLng: null,
}

console.log(
  'before shift end:',
  displayStatus(base, '18:00', new Date('2026-10-12T15:00:00')),
  '(expect not_marked)'
)
console.log(
  'after shift end, not_marked:',
  displayStatus(base, '18:00', new Date('2026-10-12T19:00:00')),
  '(expect absent)'
)
console.log(
  'already present, after shift end:',
  displayStatus({ ...base, status: 'present' }, '18:00', new Date('2026-10-12T19:00:00')),
  '(expect present — real statuses pass through unchanged)'
)
console.log(
  'already marked_absent:',
  displayStatus({ ...base, status: 'marked_absent' }, '18:00', new Date('2026-10-12T10:00:00')),
  '(expect marked_absent)'
)
```

Run: `node src/lib/__verify-attendance.ts`
Expected: all four lines match their "(expect ...)" comments.

Delete the throwaway script once confirmed: `rm src/lib/__verify-attendance.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/attendance.ts
git commit -m "Add attendance status labels, colors, and derived-absent logic"
```

---

### Task 6: Shared UI primitives — phone/OTP form, selfie capture, status badge

**Files:**
- Create: `src/components/shared/PhoneOtpForm.tsx`
- Create: `src/components/shared/SelfieCapture.tsx`
- Create: `src/components/shared/StatusBadge.tsx`
- Create: `src/app/clm/register/page.tsx` (temporary smoke-test consumer — kept permanently, see Task 7 note)

**Interfaces:**
- Consumes: `AttendanceStatus` from `@/lib/types`; `STATUS_LABELS`, `STATUS_COLORS` from `@/lib/attendance` (Task 5)
- Produces (used by Tasks 7, 9, 12):
  - `<PhoneOtpForm onVerified={(phone: string) => void} submitLabel?: string />`
  - `<SelfieCapture onCapture={(dataUrl: string) => void} />`
  - `<StatusBadge status={AttendanceStatus} />`

This task builds the three shared components and uses a minimal placeholder CLM register page purely to exercise them in the browser — Task 7 then replaces that placeholder page with the full register flow wired to the store. Building it here first keeps this task's verification self-contained (you can see the components actually work) without duplicating page-building work.

- [ ] **Step 1: Write PhoneOtpForm**

Write `src/components/shared/PhoneOtpForm.tsx`:

```tsx
'use client'

import { useState } from 'react'

interface PhoneOtpFormProps {
  onVerified: (phone: string) => void
  submitLabel?: string
}

const MOCK_OTP = '1234'

export default function PhoneOtpForm({ onVerified, submitLabel = 'Continue' }: PhoneOtpFormProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSendOtp() {
    setError(null)
    if (!/^\d{10}$/.test(phone)) {
      setError('Enter a valid 10-digit phone number.')
      return
    }
    setStep('otp')
  }

  function handleVerify() {
    setError(null)
    if (otp !== MOCK_OTP) {
      setError(`Enter the OTP ${MOCK_OTP} (mocked — no real SMS is sent in this build).`)
      return
    }
    onVerified(phone)
  }

  if (step === 'phone') {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Phone number</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="9876543210"
          className="w-full rounded-xl border border-gray-300 p-3"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button onClick={handleSendOtp} className="w-full bg-brand text-white rounded-xl py-3 font-semibold">
          Send OTP
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        OTP sent to {phone}. (Mocked for this build — use {MOCK_OTP}.)
      </p>
      <input
        type="text"
        inputMode="numeric"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        placeholder="1234"
        className="w-full rounded-xl border border-gray-300 p-3"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button onClick={handleVerify} className="w-full bg-brand text-white rounded-xl py-3 font-semibold">
        {submitLabel}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Write SelfieCapture**

Write `src/components/shared/SelfieCapture.tsx`:

```tsx
'use client'

import { useState } from 'react'

interface SelfieCaptureProps {
  onCapture: (dataUrl: string) => void
}

export default function SelfieCapture({ onCapture }: SelfieCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setPreview(dataUrl)
      onCapture(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Selfie</label>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Selfie preview" className="w-24 h-24 rounded-full object-cover" />
      ) : (
        <div className="w-24 h-24 rounded-full bg-gray-200" />
      )}
      <input type="file" accept="image/*" capture="user" onChange={handleChange} className="block w-full text-sm" />
    </div>
  )
}
```

- [ ] **Step 3: Write StatusBadge**

Write `src/components/shared/StatusBadge.tsx`:

```tsx
import type { AttendanceStatus } from '@/lib/types'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/attendance'

export default function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
```

- [ ] **Step 4: Write a minimal placeholder CLM register page to exercise all three**

Write `src/app/clm/register/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import PhoneOtpForm from '@/components/shared/PhoneOtpForm'
import SelfieCapture from '@/components/shared/SelfieCapture'
import StatusBadge from '@/components/shared/StatusBadge'

export default function ClmRegisterPage() {
  const [phone, setPhone] = useState<string | null>(null)
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)

  return (
    <main className="min-h-screen bg-cream p-6 space-y-6">
      <h1 className="text-2xl font-bold text-brand">CLM Registration</h1>
      {!phone && <PhoneOtpForm onVerified={setPhone} submitLabel="Verify" />}
      {phone && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Verified: {phone}</p>
          <SelfieCapture onCapture={setSelfieUrl} />
          <p className="text-sm text-gray-600">Selfie captured: {selfieUrl ? 'yes' : 'no'}</p>
          <StatusBadge status="present" />
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`, open `http://localhost:3000/clm/register`.
Expected: phone field accepts a 10-digit number → "Send OTP" moves to the OTP step → entering `1234` shows "Verified: <phone>" → the selfie file input, when given any image file, shows a round preview thumbnail and "Selfie captured: yes" → a green "Present" badge renders below. Stop the dev server when confirmed.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared src/app/clm/register
git commit -m "Add shared PhoneOtpForm, SelfieCapture, StatusBadge components"
```

---

### Task 7: CLM register and login pages wired to the store

**Files:**
- Modify: `src/app/clm/register/page.tsx` (replace the Task 6 placeholder with the full flow)
- Create: `src/app/clm/login/page.tsx`
- Create: `src/app/clm/page.tsx`

**Interfaces:**
- Consumes: `PhoneOtpForm`, `SelfieCapture` (Task 6); `addClm`, `findClmByPhone` from `@/lib/store`; `setSession`, `getSession` from `@/lib/session`; `Clm` from `@/lib/types` (all Tasks 2–6)
- Produces: a working CLM register/login flow that ends with a `Session` in `localStorage` and a redirect to `/clm/home` (built in Task 8)

- [ ] **Step 1: Replace the CLM register page with the full flow**

Write `src/app/clm/register/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PhoneOtpForm from '@/components/shared/PhoneOtpForm'
import SelfieCapture from '@/components/shared/SelfieCapture'
import { addClm, findClmByPhone } from '@/lib/store'
import { setSession } from '@/lib/session'
import type { Clm } from '@/lib/types'

export default function ClmRegisterPage() {
  const router = useRouter()
  const [phone, setPhone] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleVerified(verifiedPhone: string) {
    if (findClmByPhone(verifiedPhone)) {
      setError('A CLM is already registered with this number. Please login instead.')
      return
    }
    setError(null)
    setPhone(verifiedPhone)
  }

  function handleCreateProfile() {
    if (!phone || !name.trim()) return
    const clm: Clm = {
      id: `clm-${Date.now()}`,
      name: name.trim(),
      phone,
      selfieUrl,
      isOnDuty: false,
    }
    addClm(clm)
    setSession({ role: 'clm', userId: clm.id })
    router.push('/clm/home')
  }

  return (
    <main className="min-h-screen bg-cream p-6 space-y-6">
      <h1 className="text-2xl font-bold text-brand">CLM Registration</h1>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!phone && <PhoneOtpForm onVerified={handleVerified} submitLabel="Verify" />}
      {phone && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-3"
            />
          </div>
          <SelfieCapture onCapture={setSelfieUrl} />
          <button
            onClick={handleCreateProfile}
            disabled={!name.trim()}
            className="w-full bg-brand text-white rounded-xl py-3 font-semibold disabled:opacity-50"
          >
            Create profile
          </button>
        </div>
      )}
      <p className="text-sm text-center text-gray-600">
        Already registered?{' '}
        <a href="/clm/login" className="text-brand font-semibold">
          Login
        </a>
      </p>
    </main>
  )
}
```

- [ ] **Step 2: Write the CLM login page**

Write `src/app/clm/login/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PhoneOtpForm from '@/components/shared/PhoneOtpForm'
import { findClmByPhone } from '@/lib/store'
import { setSession } from '@/lib/session'

export default function ClmLoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  function handleVerified(phone: string) {
    const clm = findClmByPhone(phone)
    if (!clm) {
      setError('No CLM registered with this number. Please register first.')
      return
    }
    setSession({ role: 'clm', userId: clm.id })
    router.push('/clm/home')
  }

  return (
    <main className="min-h-screen bg-cream p-6 space-y-6">
      <h1 className="text-2xl font-bold text-brand">CLM Login</h1>
      {error && <p className="text-sm text-danger">{error}</p>}
      <PhoneOtpForm onVerified={handleVerified} submitLabel="Login" />
      <p className="text-sm text-center text-gray-600">
        New CLM?{' '}
        <a href="/clm/register" className="text-brand font-semibold">
          Register
        </a>
      </p>
    </main>
  )
}
```

- [ ] **Step 3: Write the `/clm` index redirect**

Write `src/app/clm/page.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'

export default function ClmIndexPage() {
  const router = useRouter()

  useEffect(() => {
    const session = getSession()
    router.replace(session?.role === 'clm' ? '/clm/home' : '/clm/login')
  }, [router])

  return null
}
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`.
1. Open `http://localhost:3000/clm` → redirects to `/clm/login` (no session yet).
2. On `/clm/login`, enter an unregistered 10-digit number, OTP `1234` → should show "No CLM registered with this number..." error.
3. Go to `/clm/register`, verify the same number, enter a name, pick any selfie image, "Create profile" → should redirect toward `/clm/home` (expect a 404 there for now — that route is built in Task 8, this just confirms the redirect fires).
4. Open DevTools → Application → Local Storage → confirm `salon-og-session-v1` holds `{"role":"clm","userId":"clm-..."}` and `salon-og-store-v1` now includes your new CLM in its `clms` array.
5. Open `http://localhost:3000/clm` again in a fresh tab → should redirect straight to `/clm/home` (404 expected, same reason) since a session now exists.
Stop the dev server when confirmed.

- [ ] **Step 5: Commit**

```bash
git add src/app/clm/register/page.tsx src/app/clm/login/page.tsx src/app/clm/page.tsx
git commit -m "Wire CLM register/login pages to the store and session"
```

---

### Task 8: CLM dashboard shell — session guard, filters context, header, hotspot filter

**Files:**
- Create: `src/components/clm/ClmFiltersContext.tsx`
- Create: `src/components/clm/HotspotFilterModal.tsx`
- Create: `src/components/clm/ClmHeader.tsx`
- Create: `src/app/clm/(dashboard)/layout.tsx`
- Create: `src/app/clm/(dashboard)/home/page.tsx` (minimal placeholder — full dashboard built in Task 9)

**Interfaces:**
- Consumes: `getSession` from `@/lib/session` (Task 4); `getClms`, `getHotspots`, `updateClmDutyStatus` from `@/lib/store` (Task 4); `Hotspot`, `PartnerCategory` from `@/lib/types` (Task 2)
- Produces (used by Tasks 9–10):
  - `useClmFilters(): { hotspotIds: string[]; setHotspotIds: (ids: string[]) => void; categories: PartnerCategory[]; setCategories: (c: PartnerCategory[]) => void; dayView: 'today' | 'tomorrow'; setDayView: (v: 'today' | 'tomorrow') => void }`
  - `<ClmFiltersProvider>` — must wrap any tree that calls `useClmFilters`
  - The `(dashboard)` route group guards `/clm/home`, `/clm/partners`, `/clm/profile` — any unauthenticated visit redirects to `/clm/login`

- [ ] **Step 1: Write the filters context**

Write `src/components/clm/ClmFiltersContext.tsx`:

```tsx
'use client'

import { createContext, useContext, useState } from 'react'
import type { PartnerCategory } from '@/lib/types'

interface ClmFiltersValue {
  hotspotIds: string[]
  setHotspotIds: (ids: string[]) => void
  categories: PartnerCategory[]
  setCategories: (categories: PartnerCategory[]) => void
  dayView: 'today' | 'tomorrow'
  setDayView: (view: 'today' | 'tomorrow') => void
}

const ClmFiltersContext = createContext<ClmFiltersValue | null>(null)

export function ClmFiltersProvider({ children }: { children: React.ReactNode }) {
  const [hotspotIds, setHotspotIds] = useState<string[]>([])
  const [categories, setCategories] = useState<PartnerCategory[]>([])
  const [dayView, setDayView] = useState<'today' | 'tomorrow'>('today')

  return (
    <ClmFiltersContext.Provider
      value={{ hotspotIds, setHotspotIds, categories, setCategories, dayView, setDayView }}
    >
      {children}
    </ClmFiltersContext.Provider>
  )
}

export function useClmFilters(): ClmFiltersValue {
  const ctx = useContext(ClmFiltersContext)
  if (!ctx) throw new Error('useClmFilters must be used within ClmFiltersProvider')
  return ctx
}
```

- [ ] **Step 2: Write the hotspot filter modal**

Write `src/components/clm/HotspotFilterModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useClmFilters } from './ClmFiltersContext'
import { getHotspots } from '@/lib/store'

export default function HotspotFilterModal({ onClose }: { onClose: () => void }) {
  const { hotspotIds, setHotspotIds } = useClmFilters()
  const hotspots = getHotspots()
  const [selected, setSelected] = useState<string[]>(hotspotIds)

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const allSelected = selected.length === hotspots.length

  function toggleAll() {
    setSelected(allSelected ? [] : hotspots.map((h) => h.id))
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full p-6 space-y-4 max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Filters</h2>
          <button onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          Bangalore
        </label>
        <div className="pl-6 space-y-2">
          {hotspots.map((h) => (
            <label key={h.id} className="flex items-center gap-2">
              <input type="checkbox" checked={selected.includes(h.id)} onChange={() => toggle(h.id)} />
              {h.area}
            </label>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={() => setSelected([])} className="flex-1 bg-gray-100 rounded-xl py-3 font-semibold">
            Clear All
          </button>
          <button
            onClick={() => {
              setHotspotIds(selected)
              onClose()
            }}
            className="flex-1 bg-brand text-white rounded-xl py-3 font-semibold"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write the CLM header**

Write `src/components/clm/ClmHeader.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useClmFilters } from './ClmFiltersContext'
import HotspotFilterModal from './HotspotFilterModal'
import { getClms, getHotspots, updateClmDutyStatus } from '@/lib/store'

export default function ClmHeader({ clmId }: { clmId: string }) {
  const { hotspotIds } = useClmFilters()
  const [showHotspotModal, setShowHotspotModal] = useState(false)
  const hotspots = getHotspots()
  const clm = getClms().find((c) => c.id === clmId)
  const [isOnDuty, setIsOnDuty] = useState(clm?.isOnDuty ?? false)

  const label =
    hotspotIds.length === 0
      ? 'All'
      : hotspotIds.length === 1
        ? (hotspots.find((h) => h.id === hotspotIds[0])?.area ?? 'All')
        : `${hotspotIds.length} areas`

  function toggleDuty() {
    const next = !isOnDuty
    setIsOnDuty(next)
    updateClmDutyStatus(clmId, next)
  }

  return (
    <header className="flex items-center justify-between p-4 bg-white shadow-sm">
      <button onClick={() => setShowHotspotModal(true)} className="flex items-center gap-1 text-brand font-semibold">
        📍 {label}
      </button>
      <div className="flex items-center gap-3">
        <span className="text-sm">{isOnDuty ? 'Online' : 'Offline'}</span>
        <button
          onClick={toggleDuty}
          className={`w-12 h-6 rounded-full transition-colors ${isOnDuty ? 'bg-success' : 'bg-gray-300'}`}
          aria-label="Toggle duty status"
        >
          <span
            className={`block w-5 h-5 bg-white rounded-full shadow transform transition-transform ${isOnDuty ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>
        <Link href="/clm/profile" className="text-xl" aria-label="Profile menu">
          ☰
        </Link>
      </div>
      {showHotspotModal && <HotspotFilterModal onClose={() => setShowHotspotModal(false)} />}
    </header>
  )
}
```

- [ ] **Step 4: Write the guarded dashboard layout**

Write `src/app/clm/(dashboard)/layout.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, type Session } from '@/lib/session'
import { ClmFiltersProvider } from '@/components/clm/ClmFiltersContext'
import ClmHeader from '@/components/clm/ClmHeader'

export default function ClmDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [session, setSessionState] = useState<Session | null | 'loading'>('loading')

  useEffect(() => {
    const s = getSession()
    if (!s || s.role !== 'clm') {
      router.replace('/clm/login')
      return
    }
    setSessionState(s)
  }, [router])

  if (session === 'loading') {
    return <main className="min-h-screen bg-cream flex items-center justify-center">Loading…</main>
  }
  if (!session) return null

  return (
    <div className="min-h-screen bg-cream pb-6">
      <ClmFiltersProvider>
        <ClmHeader clmId={session.userId} />
        {children}
      </ClmFiltersProvider>
    </div>
  )
}
```

- [ ] **Step 5: Write a minimal placeholder home page**

Write `src/app/clm/(dashboard)/home/page.tsx`:

```tsx
export default function ClmHomePage() {
  return <div className="p-4">CLM home — built out in the next task.</div>
}
```

- [ ] **Step 6: Verify in the browser**

Run: `npm run dev`.
1. Clear `localStorage` for `localhost:3000` in DevTools, then visit `http://localhost:3000/clm/home` directly → should redirect to `/clm/login` (no session).
2. Register or login as a CLM (phone + OTP `1234`) → lands on `/clm/home`, header shows "📍 All", "Offline", and a ☰ link.
3. Tap the Online/Offline toggle → label flips to "Online" and the pill turns green; check DevTools → `salon-og-store-v1` → the CLM's `isOnDuty` is now `true`.
4. Tap "📍 All" → the hotspot filter sheet opens from the bottom listing "Bangalore" plus the 7 area names with checkboxes. Check a couple, tap Apply → header label updates (one area's name, or "N areas"). Re-open and tap "Clear All" then Apply → label returns to "All".
5. Tap ☰ → navigates to `/clm/profile` (expect a 404 for now — built in Task 10).
Stop the dev server when confirmed.

- [ ] **Step 7: Commit**

```bash
git add src/components/clm src/app/clm/\(dashboard\)
git commit -m "Add CLM dashboard shell: session guard, filters context, header, hotspot filter"
```

---

### Task 9: CLM home dashboard — category filter, Today/Tomorrow, attendance summary

**Files:**
- Create: `src/components/clm/CategoryFilterModal.tsx`
- Create: `src/components/clm/AttendanceSummaryCard.tsx`
- Modify: `src/app/clm/(dashboard)/home/page.tsx` (replace the Task 8 placeholder)

**Interfaces:**
- Consumes: `useClmFilters` (Task 8); `getPartners`, `getAttendanceRecords` from `@/lib/store` (Task 4); `displayStatus` from `@/lib/attendance` (Task 5); `TODAY` from `@/lib/seed-data` (Task 3); `PARTNER_CATEGORIES` from `@/lib/types` (Task 2)
- Produces (used by Task 10): the home page links its summary card to `/clm/partners`

- [ ] **Step 1: Write the category filter modal**

Write `src/components/clm/CategoryFilterModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useClmFilters } from './ClmFiltersContext'
import { PARTNER_CATEGORIES, type PartnerCategory } from '@/lib/types'

export default function CategoryFilterModal({ onClose }: { onClose: () => void }) {
  const { categories, setCategories } = useClmFilters()
  const [selected, setSelected] = useState<PartnerCategory[]>(categories)

  function toggle(value: PartnerCategory) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]))
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Select Category</h2>
          <button onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {PARTNER_CATEGORIES.map((c) => (
          <label key={c.value} className="flex items-center justify-between py-2">
            {c.label}
            <input type="checkbox" checked={selected.includes(c.value)} onChange={() => toggle(c.value)} />
          </label>
        ))}
        <button
          onClick={() => {
            setCategories(selected)
            onClose()
          }}
          className="w-full bg-brand text-white rounded-xl py-3 font-semibold"
        >
          Apply
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the attendance summary card**

Write `src/components/clm/AttendanceSummaryCard.tsx`:

```tsx
import Link from 'next/link'

interface AttendanceSummaryCardProps {
  total: number
  presentCount: number
  absentCount: number
}

export default function AttendanceSummaryCard({ total, presentCount, absentCount }: AttendanceSummaryCardProps) {
  const presentPct = total === 0 ? 0 : Math.round((presentCount / total) * 100)
  const absentPct = total === 0 ? 0 : Math.round((absentCount / total) * 100)

  return (
    <Link href="/clm/partners" className="block bg-brand text-white rounded-3xl shadow-lg p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Attendance</h3>
        <span className="text-3xl font-bold">{total}</span>
      </div>
      <p>
        Present: {presentCount} ({presentPct}%)
      </p>
      <p>
        Absent: {absentCount} ({absentPct}%)
      </p>
    </Link>
  )
}
```

- [ ] **Step 3: Replace the home page placeholder**

Write `src/app/clm/(dashboard)/home/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useClmFilters } from '@/components/clm/ClmFiltersContext'
import CategoryFilterModal from '@/components/clm/CategoryFilterModal'
import AttendanceSummaryCard from '@/components/clm/AttendanceSummaryCard'
import { getPartners, getAttendanceRecords } from '@/lib/store'
import { displayStatus } from '@/lib/attendance'
import { TODAY } from '@/lib/seed-data'
import type { Partner, AttendanceRecord } from '@/lib/types'

export default function ClmHomePage() {
  const { hotspotIds, categories, dayView, setDayView } = useClmFilters()
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [partners, setPartners] = useState<Partner[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])

  useEffect(() => {
    setPartners(getPartners())
    setRecords(getAttendanceRecords())
  }, [])

  const filteredPartners = partners
    .filter((p) => hotspotIds.length === 0 || hotspotIds.includes(p.originalHotspotId))
    .filter((p) => categories.length === 0 || categories.includes(p.category))

  const now = new Date()
  const statuses = filteredPartners.map((p) => {
    const record = records.find((r) => r.partnerId === p.id && r.date === TODAY)
    return record ? displayStatus(record, p.shiftEnd, now) : 'not_marked'
  })

  const presentCount = statuses.filter((s) => s === 'present' || s === 'logged_out' || s === 'logged_out_early').length
  const absentCount = statuses.filter((s) => s === 'absent' || s === 'marked_absent').length

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setDayView('today')}
          className={`flex-1 rounded-full py-2 font-semibold ${dayView === 'today' ? 'bg-white text-brand shadow' : 'bg-gray-200 text-gray-600'}`}
        >
          Today
        </button>
        <button
          onClick={() => setDayView('tomorrow')}
          className={`flex-1 rounded-full py-2 font-semibold ${dayView === 'tomorrow' ? 'bg-white text-brand shadow' : 'bg-gray-200 text-gray-600'}`}
        >
          Tomorrow
        </button>
      </div>
      <button
        onClick={() => setShowCategoryModal(true)}
        className="w-full bg-white rounded-xl p-3 text-left text-gray-600 shadow-sm"
      >
        Select Category {categories.length > 0 ? `(${categories.length})` : ''}
      </button>
      {dayView === 'tomorrow' ? (
        <div className="bg-white rounded-3xl shadow-lg p-6 text-gray-600">No shifts scheduled for tomorrow yet.</div>
      ) : (
        <AttendanceSummaryCard total={filteredPartners.length} presentCount={presentCount} absentCount={absentCount} />
      )}
      {showCategoryModal && <CategoryFilterModal onClose={() => setShowCategoryModal(false)} />}
    </div>
  )
}
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, log in as a CLM, land on `/clm/home`.
1. The Attendance card shows a total close to 24 (minus any excluded by filters) with Present/Absent counts and percentages that sum sensibly against the total.
2. Tap "Select Category", check "Hair Stylist" only, Apply → the total on the card drops to roughly a fifth of 24 and counts update accordingly.
3. Tap "Tomorrow" → card is replaced with "No shifts scheduled for tomorrow yet."; tap "Today" → card reappears with the same numbers as before.
4. Open the hotspot filter (📍 All in the header), pick one area, Apply → the card's total drops further to just that area's partners (intersected with the category filter still applied).
5. Tap the Attendance card → navigates toward `/clm/partners` (expect 404 for now — built next).
Stop the dev server when confirmed.

- [ ] **Step 5: Commit**

```bash
git add src/components/clm/CategoryFilterModal.tsx src/components/clm/AttendanceSummaryCard.tsx "src/app/clm/(dashboard)/home/page.tsx"
git commit -m "Build out CLM home dashboard: category filter, Today/Tomorrow, attendance summary"
```

---

### Task 10: CLM partner list — search, status filters, partner cards

**Files:**
- Create: `src/components/clm/PartnerCard.tsx`
- Create: `src/app/clm/(dashboard)/partners/page.tsx`

**Interfaces:**
- Consumes: `useClmFilters` (Task 8); `getPartners`, `getAttendanceRecords`, `getHotspots`, `markPartnerAbsent` from `@/lib/store` (Task 4); `displayStatus` from `@/lib/attendance` (Task 5); `StatusBadge` from `@/components/shared/StatusBadge` (Task 6); `TODAY` from `@/lib/seed-data` (Task 3)
- Produces: nothing consumed by later tasks (this is the leaf screen for the CLM attendance flow)

- [ ] **Step 1: Write the partner card**

Write `src/components/clm/PartnerCard.tsx`:

```tsx
import StatusBadge from '@/components/shared/StatusBadge'
import { markPartnerAbsent } from '@/lib/store'
import type { Partner, AttendanceRecord, Hotspot, AttendanceStatus } from '@/lib/types'

interface PartnerCardProps {
  partner: Partner
  record: AttendanceRecord | null
  status: AttendanceStatus
  hotspots: Hotspot[]
  onMarkedAbsent: () => void
}

export default function PartnerCard({ partner, record, status, hotspots, onMarkedAbsent }: PartnerCardProps) {
  const originalHotspot = hotspots.find((h) => h.id === partner.originalHotspotId)
  const currentHotspot = record?.currentHotspotId ? hotspots.find((h) => h.id === record.currentHotspotId) : null
  const isLocationKnown = status === 'present' || status === 'logged_out' || status === 'logged_out_early'

  function handleMarkAbsent() {
    if (!record) return
    markPartnerAbsent(record.id)
    onMarkedAbsent()
  }

  return (
    <div className="bg-white rounded-3xl shadow-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold">{partner.name}</p>
          <p className="text-xs text-gray-500">ID: {partner.id}</p>
        </div>
        <span className="text-xs bg-cream rounded-full px-3 py-1 font-semibold capitalize">
          {partner.category.replace('_', ' ')}
        </span>
      </div>
      <p className="text-sm text-gray-600">
        Shift: {partner.shiftStart} – {partner.shiftEnd}
      </p>
      <p className="text-sm text-gray-600">
        Login: {record?.checkInAt ? record.checkInAt.slice(11, 16) : '—'} · Logout:{' '}
        {record?.checkOutAt ? record.checkOutAt.slice(11, 16) : '—'}
      </p>
      <div className="text-sm space-y-1">
        <p>📍 Original Hotspot: {originalHotspot?.area ?? 'Unknown'}</p>
        <p>📍 Current Hotspot: {currentHotspot?.area ?? (isLocationKnown ? 'Location not matched' : '—')}</p>
      </div>
      <div className="flex items-center justify-between pt-2">
        <StatusBadge status={status} />
        <div className="flex gap-3 items-center">
          <a href={`tel:${partner.phone}`} aria-label="Call partner" className="text-brand">
            📞
          </a>
          {record?.checkInLat != null && record?.checkInLng != null && (
            <a
              href={`https://maps.google.com/?q=${record.checkInLat},${record.checkInLng}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Navigate to partner"
              className="text-brand"
            >
              🧭
            </a>
          )}
          {record?.status === 'not_marked' && (
            <button onClick={handleMarkAbsent} className="text-xs text-danger font-semibold">
              Mark Absent
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the partners list page**

Write `src/app/clm/(dashboard)/partners/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useClmFilters } from '@/components/clm/ClmFiltersContext'
import PartnerCard from '@/components/clm/PartnerCard'
import { getPartners, getAttendanceRecords, getHotspots } from '@/lib/store'
import { displayStatus } from '@/lib/attendance'
import { TODAY } from '@/lib/seed-data'
import type { Partner, AttendanceRecord, Hotspot, AttendanceStatus } from '@/lib/types'

const STATUS_FILTERS: { value: AttendanceStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'logged_out', label: 'Logged Out' },
  { value: 'logged_out_early', label: 'Logged Out Early' },
  { value: 'not_marked', label: 'Not Marked' },
  { value: 'marked_absent', label: 'Marked Absent' },
]

export default function ClmPartnersPage() {
  const { hotspotIds, categories } = useClmFilters()
  const [partners, setPartners] = useState<Partner[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'all'>('all')

  function reload() {
    setPartners(getPartners())
    setRecords(getAttendanceRecords())
    setHotspots(getHotspots())
  }

  useEffect(() => {
    reload()
  }, [])

  const now = new Date()

  const rows = partners
    .filter((p) => hotspotIds.length === 0 || hotspotIds.includes(p.originalHotspotId))
    .filter((p) => categories.length === 0 || categories.includes(p.category))
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .map((p) => {
      const record = records.find((r) => r.partnerId === p.id && r.date === TODAY) ?? null
      const status = record ? displayStatus(record, p.shiftEnd, now) : 'not_marked'
      return { partner: p, record, status }
    })
    .filter((row) => statusFilter === 'all' || row.status === statusFilter)

  return (
    <div className="p-4 space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name"
        className="w-full rounded-xl border border-gray-300 p-3"
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${statusFilter === f.value ? 'bg-brand text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-gray-600">No partners match these filters.</p>}
        {rows.map(({ partner, record, status }) => (
          <PartnerCard
            key={partner.id}
            partner={partner}
            record={record}
            status={status}
            hotspots={hotspots}
            onMarkedAbsent={reload}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, log in as a CLM, tap the Attendance card to land on `/clm/partners`.
1. ~24 partner cards render (fewer if hotspot/category filters are still set from Task 9 — clear them via the header/Select Category if needed), each showing name, ID, category, shift, login/logout times, Original and Current Hotspot, and a status badge in the correct color (green Present, red Absent/Marked Absent, gray Not Marked/Logged Out, orange Logged Out Early).
2. Type part of a partner's name in the search box → list narrows to matches.
3. Tap the "Present" filter pill → only present partners remain; tap "All" → full list returns.
4. On a card whose badge is "Not Marked", tap "Mark Absent" → badge immediately changes to "Marked Absent" and the card stays visible (or disappears if the "Not Marked" filter pill was active).
5. Tap the 📞 icon on any card → browser attempts a `tel:` call (fine if it just shows "no app configured" in a desktop browser). Tap the 🧭 icon on a card that has one → opens Google Maps in a new tab centered on that lat/lng.
Stop the dev server when confirmed.

- [ ] **Step 4: Commit**

```bash
git add src/components/clm/PartnerCard.tsx "src/app/clm/(dashboard)/partners"
git commit -m "Add CLM partner list: search, status filters, partner cards"
```

---

### Task 11: CLM profile page

**Files:**
- Create: `src/app/clm/(dashboard)/profile/page.tsx`

**Interfaces:**
- Consumes: `getSession`, `clearSession` from `@/lib/session` (Task 4); `getClms` from `@/lib/store` (Task 4)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Write the profile page**

Write `src/app/clm/(dashboard)/profile/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, clearSession } from '@/lib/session'
import { getClms } from '@/lib/store'
import type { Clm } from '@/lib/types'

export default function ClmProfilePage() {
  const router = useRouter()
  const [clm, setClm] = useState<Clm | null>(null)

  useEffect(() => {
    const session = getSession()
    if (!session) return
    setClm(getClms().find((c) => c.id === session.userId) ?? null)
  }, [])

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-3xl shadow-lg p-6">
        <p className="font-bold text-lg">{clm?.name ?? 'Loading…'}</p>
        <p className="text-gray-600 text-sm">Cluster Manager</p>
        <p className="text-gray-600 text-sm">ID: {clm?.id}</p>
      </div>
      <button
        onClick={() => {
          clearSession()
          router.replace('/clm/login')
        }}
        className="w-full bg-danger text-white rounded-xl py-3 font-semibold"
      >
        Logout
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify in the browser**

Run: `npm run dev`, log in as a CLM, tap ☰ in the header to reach `/clm/profile`.
Expected: card shows the logged-in CLM's name, "Cluster Manager", and their ID. Tap "Logout" → redirects to `/clm/login`; visiting `/clm/home` again now redirects back to `/clm/login` (session cleared).
Stop the dev server when confirmed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/clm/(dashboard)/profile"
git commit -m "Add CLM profile page with logout"
```

---

### Task 12: Partner register and login pages

**Files:**
- Create: `src/app/partner/register/page.tsx`
- Create: `src/app/partner/login/page.tsx`
- Create: `src/app/partner/page.tsx`

**Interfaces:**
- Consumes: `PhoneOtpForm`, `SelfieCapture` (Task 6); `addPartner`, `findPartnerByPhone`, `getHotspots` from `@/lib/store` (Task 4); `setSession`, `getSession` from `@/lib/session` (Task 4); `TODAY` from `@/lib/seed-data` (Task 3); `PARTNER_CATEGORIES`, `Partner`, `PartnerCategory`, `AttendanceRecord` from `@/lib/types` (Task 2)
- Produces: a working Partner register/login flow ending with a `Session` in `localStorage` and a redirect to `/partner/home` (built in Task 14)

- [ ] **Step 1: Write the partner register page**

Write `src/app/partner/register/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PhoneOtpForm from '@/components/shared/PhoneOtpForm'
import SelfieCapture from '@/components/shared/SelfieCapture'
import { addPartner, findPartnerByPhone, getHotspots } from '@/lib/store'
import { setSession } from '@/lib/session'
import { TODAY } from '@/lib/seed-data'
import { PARTNER_CATEGORIES, type Partner, type PartnerCategory, type AttendanceRecord } from '@/lib/types'

export default function PartnerRegisterPage() {
  const router = useRouter()
  const [phone, setPhone] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)
  const [category, setCategory] = useState<PartnerCategory>('hair_stylist')
  const [hotspotId, setHotspotId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const hotspots = getHotspots()

  function handleVerified(verifiedPhone: string) {
    if (findPartnerByPhone(verifiedPhone)) {
      setError('A Partner is already registered with this number. Please login instead.')
      return
    }
    setError(null)
    setPhone(verifiedPhone)
    setHotspotId(hotspots[0]?.id ?? '')
  }

  function handleCreateProfile() {
    if (!phone || !name.trim() || !hotspotId) return
    const partner: Partner = {
      id: `partner-${Date.now()}`,
      name: name.trim(),
      phone,
      selfieUrl,
      category,
      originalHotspotId: hotspotId,
      shiftStart: '09:00',
      shiftEnd: '18:00',
    }
    const record: AttendanceRecord = {
      id: `att-${partner.id}`,
      partnerId: partner.id,
      date: TODAY,
      status: 'not_marked',
      checkInAt: null,
      checkInLat: null,
      checkInLng: null,
      currentHotspotId: null,
      checkOutAt: null,
      checkOutLat: null,
      checkOutLng: null,
    }
    addPartner(partner, record)
    setSession({ role: 'partner', userId: partner.id })
    router.push('/partner/home')
  }

  return (
    <main className="min-h-screen bg-cream p-6 space-y-6">
      <h1 className="text-2xl font-bold text-brand">Partner Registration</h1>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!phone && <PhoneOtpForm onVerified={handleVerified} submitLabel="Verify" />}
      {phone && (
        <div className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-700">Service category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PartnerCategory)}
              className="w-full rounded-xl border border-gray-300 p-3"
            >
              {PARTNER_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Assigned hotspot</label>
            <select
              value={hotspotId}
              onChange={(e) => setHotspotId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-3"
            >
              {hotspots.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.area}
                </option>
              ))}
            </select>
          </div>
          <SelfieCapture onCapture={setSelfieUrl} />
          <button
            onClick={handleCreateProfile}
            disabled={!name.trim()}
            className="w-full bg-brand text-white rounded-xl py-3 font-semibold disabled:opacity-50"
          >
            Create profile
          </button>
        </div>
      )}
      <p className="text-sm text-center text-gray-600">
        Already registered?{' '}
        <a href="/partner/login" className="text-brand font-semibold">
          Login
        </a>
      </p>
    </main>
  )
}
```

- [ ] **Step 2: Write the partner login page**

Write `src/app/partner/login/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PhoneOtpForm from '@/components/shared/PhoneOtpForm'
import { findPartnerByPhone } from '@/lib/store'
import { setSession } from '@/lib/session'

export default function PartnerLoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  function handleVerified(phone: string) {
    const partner = findPartnerByPhone(phone)
    if (!partner) {
      setError('No Partner registered with this number. Please register first.')
      return
    }
    setSession({ role: 'partner', userId: partner.id })
    router.push('/partner/home')
  }

  return (
    <main className="min-h-screen bg-cream p-6 space-y-6">
      <h1 className="text-2xl font-bold text-brand">Partner Login</h1>
      {error && <p className="text-sm text-danger">{error}</p>}
      <PhoneOtpForm onVerified={handleVerified} submitLabel="Login" />
      <p className="text-sm text-center text-gray-600">
        New Partner?{' '}
        <a href="/partner/register" className="text-brand font-semibold">
          Register
        </a>
      </p>
    </main>
  )
}
```

- [ ] **Step 3: Write the `/partner` index redirect**

Write `src/app/partner/page.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'

export default function PartnerIndexPage() {
  const router = useRouter()

  useEffect(() => {
    const session = getSession()
    router.replace(session?.role === 'partner' ? '/partner/home' : '/partner/login')
  }, [router])

  return null
}
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`.
1. Visit `http://localhost:3000/partner` → redirects to `/partner/login` (no session).
2. On `/partner/login`, try an unregistered number + OTP `1234` → "No Partner registered..." error.
3. Go to `/partner/register`, verify a fresh 10-digit number, fill name, pick a category and hotspot from the dropdowns, add a selfie, "Create profile" → redirects toward `/partner/home` (expect 404 for now — built in Task 14).
4. DevTools → Local Storage → confirm the new partner appears in `salon-og-store-v1.partners` with the chosen `category`/`originalHotspotId`, and a matching `not_marked` record was added to `attendanceRecords`.
5. Visit `/partner` again → redirects straight to `/partner/home` (still 404, confirms the session-based redirect).
Stop the dev server when confirmed.

- [ ] **Step 5: Commit**

```bash
git add src/app/partner/register/page.tsx src/app/partner/login/page.tsx src/app/partner/page.tsx
git commit -m "Wire Partner register/login pages to the store and session"
```

---

### Task 13: Partner dashboard session guard

**Files:**
- Create: `src/app/partner/(dashboard)/layout.tsx`
- Create: `src/app/partner/(dashboard)/home/page.tsx` (minimal placeholder — full page built in Task 14)

**Interfaces:**
- Consumes: `getSession`, `clearSession` from `@/lib/session` (Task 4)
- Produces: the `(dashboard)` route group guards `/partner/home` — any unauthenticated visit redirects to `/partner/login`

- [ ] **Step 1: Write the guarded layout**

Write `src/app/partner/(dashboard)/layout.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, clearSession, type Session } from '@/lib/session'

export default function PartnerDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [session, setSessionState] = useState<Session | null | 'loading'>('loading')

  useEffect(() => {
    const s = getSession()
    if (!s || s.role !== 'partner') {
      router.replace('/partner/login')
      return
    }
    setSessionState(s)
  }, [router])

  if (session === 'loading') {
    return <main className="min-h-screen bg-cream flex items-center justify-center">Loading…</main>
  }
  if (!session) return null

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-end p-4">
        <button
          onClick={() => {
            clearSession()
            router.replace('/partner/login')
          }}
          className="text-sm text-danger font-semibold"
        >
          Logout
        </button>
      </header>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Write a minimal placeholder home page**

Write `src/app/partner/(dashboard)/home/page.tsx`:

```tsx
export default function PartnerHomePage() {
  return <div className="p-4">Partner home — built out in the next task.</div>
}
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`.
1. Clear `localStorage`, visit `http://localhost:3000/partner/home` directly → redirects to `/partner/login`.
2. Register or login as a Partner → lands on `/partner/home`, shows the placeholder text and a "Logout" link top-right.
3. Tap "Logout" → redirects to `/partner/login`; visiting `/partner/home` again redirects back to `/partner/login`.
Stop the dev server when confirmed.

- [ ] **Step 4: Commit**

```bash
git add "src/app/partner/(dashboard)"
git commit -m "Add Partner dashboard session guard"
```

---

### Task 14: Partner home — shift info and check-in/out with geolocation

**Files:**
- Create: `src/components/partner/CheckInOutButton.tsx`
- Modify: `src/app/partner/(dashboard)/home/page.tsx` (replace the Task 13 placeholder)

**Interfaces:**
- Consumes: `getSession` from `@/lib/session` (Task 4); `getPartners`, `getAttendanceRecordForPartnerToday`, `getHotspots`, `upsertAttendanceRecord` from `@/lib/store` (Task 4); `findNearestHotspot` from `@/lib/geo` (Task 2); `TODAY` from `@/lib/seed-data` (Task 3); `Partner`, `AttendanceRecord` from `@/lib/types` (Task 2)
- Produces: nothing consumed by later tasks — this is the last screen in the Partner app, and the write path the CLM's partner list (Task 10) reads from

- [ ] **Step 1: Write the check-in/out button**

Write `src/components/partner/CheckInOutButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { getHotspots, upsertAttendanceRecord } from '@/lib/store'
import { findNearestHotspot } from '@/lib/geo'
import { TODAY } from '@/lib/seed-data'
import type { Partner, AttendanceRecord } from '@/lib/types'

interface CheckInOutButtonProps {
  partner: Partner
  record: AttendanceRecord | null
  onUpdate: () => void
}

export default function CheckInOutButton({ partner, record, onUpdate }: CheckInOutButtonProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function withLocation(callback: (lat: number, lng: number) => void) {
    setError(null)
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser.')
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLoading(false)
        callback(position.coords.latitude, position.coords.longitude)
      },
      () => {
        setLoading(false)
        setError('Location is required. Please allow location access and try again.')
      }
    )
  }

  function handleCheckIn() {
    withLocation((lat, lng) => {
      const hotspots = getHotspots()
      const nearest = findNearestHotspot(lat, lng, hotspots)
      const updated: AttendanceRecord = {
        id: record?.id ?? `att-${partner.id}`,
        partnerId: partner.id,
        date: TODAY,
        status: 'present',
        checkInAt: new Date().toISOString(),
        checkInLat: lat,
        checkInLng: lng,
        currentHotspotId: nearest?.id ?? null,
        checkOutAt: null,
        checkOutLat: null,
        checkOutLng: null,
      }
      upsertAttendanceRecord(updated)
      onUpdate()
    })
  }

  function handleCheckOut() {
    if (!record) return
    withLocation((lat, lng) => {
      const [hours, minutes] = partner.shiftEnd.split(':').map(Number)
      const shiftEndTime = new Date(`${record.date}T00:00:00`)
      shiftEndTime.setHours(hours, minutes, 0, 0)
      const now = new Date()
      const updated: AttendanceRecord = {
        ...record,
        status: now < shiftEndTime ? 'logged_out_early' : 'logged_out',
        checkOutAt: now.toISOString(),
        checkOutLat: lat,
        checkOutLng: lng,
      }
      upsertAttendanceRecord(updated)
      onUpdate()
    })
  }

  return (
    <div className="bg-brand text-white rounded-3xl shadow-lg p-6 space-y-3">
      <p className="text-sm opacity-80">Today&apos;s shift</p>
      <p className="text-lg font-bold">
        {partner.shiftStart} – {partner.shiftEnd}
      </p>
      {error && <p className="text-sm bg-danger/80 rounded-xl p-2">{error}</p>}
      {!record?.checkInAt && (
        <button
          onClick={handleCheckIn}
          disabled={loading}
          className="w-full bg-white text-brand rounded-xl py-3 font-semibold disabled:opacity-50"
        >
          {loading ? 'Getting location…' : 'Check In'}
        </button>
      )}
      {record?.checkInAt && !record?.checkOutAt && (
        <button
          onClick={handleCheckOut}
          disabled={loading}
          className="w-full bg-white text-brand rounded-xl py-3 font-semibold disabled:opacity-50"
        >
          {loading ? 'Getting location…' : 'Check Out'}
        </button>
      )}
      {record?.checkOutAt && <p className="font-semibold">Shift complete ✓</p>}
    </div>
  )
}
```

- [ ] **Step 2: Replace the partner home page placeholder**

Write `src/app/partner/(dashboard)/home/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { getSession } from '@/lib/session'
import { getPartners, getAttendanceRecordForPartnerToday } from '@/lib/store'
import { TODAY } from '@/lib/seed-data'
import CheckInOutButton from '@/components/partner/CheckInOutButton'
import type { Partner, AttendanceRecord } from '@/lib/types'

export default function PartnerHomePage() {
  const [partner, setPartner] = useState<Partner | null>(null)
  const [record, setRecord] = useState<AttendanceRecord | null>(null)

  function reload() {
    const session = getSession()
    if (!session) return
    const p = getPartners().find((x) => x.id === session.userId) ?? null
    setPartner(p)
    if (p) setRecord(getAttendanceRecordForPartnerToday(p.id, TODAY))
  }

  useEffect(() => {
    reload()
  }, [])

  if (!partner) {
    return <div className="p-4">Loading…</div>
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-3xl shadow-lg p-6">
        <p className="text-sm text-gray-500">Welcome</p>
        <p className="text-xl font-bold">{partner.name}</p>
      </div>
      <CheckInOutButton partner={partner} record={record} onUpdate={reload} />
    </div>
  )
}
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, register or login as a Partner, land on `/partner/home`.
1. Card shows "Welcome" + the partner's name, and a blue shift card with "Check In".
2. Tap "Check In" → browser prompts for location permission (allow it); button becomes "Getting location…" then the card updates to show "Check Out" (check-in succeeded).
3. DevTools → Local Storage → `salon-og-store-v1.attendanceRecords` → the record for this partner's `id` now has `status: "present"`, a `checkInAt` timestamp, `checkInLat`/`checkInLng`, and a non-null `currentHotspotId`.
4. Tap "Check Out" → allow location again → card shows "Shift complete ✓".
5. Reload the page → state persists (still shows "Shift complete ✓", not reset to "Check In") — confirms `getAttendanceRecordForPartnerToday` is reading the persisted record correctly.
6. In a browser that lets you deny location permission, test denial on a *different* partner (register a second test partner) → confirm the inline error message appears and the button stays on "Check In" (no state change).
Stop the dev server when confirmed.

- [ ] **Step 4: Commit**

```bash
git add src/components/partner "src/app/partner/(dashboard)/home"
git commit -m "Add Partner check-in/out with geolocation and nearest-hotspot matching"
```

---

### Task 15: End-to-end verification and production build check

**Files:** none (verification only)

**Interfaces:**
- Consumes: the entire app built in Tasks 1–14
- Produces: confidence that the full spec's manual test flow (see spec's "Testing" section) works end-to-end and that the app builds cleanly for production

- [ ] **Step 1: Run the full manual flow from the spec**

Run: `npm run dev`. With a clean `localStorage` (clear it in DevTools first):

1. Register a new Partner (unique phone, pick a hotspot, e.g. HSR) → lands on `/partner/home`.
2. Check in → allow location → status becomes "present", a Current Hotspot gets set.
3. Open a second browser tab/profile (or clear the Partner session via DevTools and set a CLM session), register/login as a CLM → lands on `/clm/home`.
4. On `/clm/home`, with no filters applied, confirm the total count includes the new partner (25 if you started from the default 24 seeded partners).
5. Filter by hotspot = HSR → confirm the new partner appears in that filtered total.
6. Tap the Attendance card → on `/clm/partners`, search for the new partner's name → their card shows "Present", the Original Hotspot you picked at registration, a Current Hotspot (ideally the same, since the mock GPS in a desktop browser is usually a fixed location — if it differs that's expected and fine, it's demonstrating the location-mismatch signal), and working 📞/🧭 icons.
7. Back in the Partner tab, Check Out → confirm the CLM's partner list updates to "Logged Out" or "Logged Out Early" after a reload of `/clm/partners`.
8. On a "Not Marked" partner elsewhere in the CLM list, tap "Mark Absent" → badge updates to "Marked Absent" immediately.

Expected: every step behaves as described above with no console errors (check DevTools console). Stop the dev server when confirmed.

- [ ] **Step 2: Run a production build**

Run: `npm run build`
Expected: build completes with no TypeScript or ESLint errors. (If `next-pwa` prints warnings about service worker generation in a dev environment, that's expected and not a failure.)

- [ ] **Step 3: Final commit**

If Step 1 or Step 2 surfaced any fixes, stage and commit them:

```bash
git add -A
git commit -m "Fix issues found during end-to-end verification"
```

If nothing needed fixing, there is nothing to commit for this task — the plan is complete.
