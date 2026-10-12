# Salon OG App v2 — CLM / Partner Field Tracking — Design

Date: 2026-10-12

## Purpose

Full rebuild of the Salon OG app, replacing the earlier staff/team-lead/
manager attendance-and-leave tool. The new app replicates Snabbit's
existing "Field Ops" OG app (reference: 5 screenshots of the live app,
2026-10-12) for the salon services category.

Core job: **Cluster Managers (CLMs)** track whether **Partners**
(salon service providers — "Experts" in the reference app) are present
and physically where they're supposed to be, across hotspots in
Bangalore. CLMs call Partners to verify when something looks off
(e.g. location mismatch, no check-in).

This is a standalone MVP, built first against generated random/mock
data (no backend calls). Real API/auth integration is a deliberate
follow-up phase, not part of this spec.

## Users / Roles

Two roles, two separate apps in one codebase:

- **CLM (Cluster Manager)** — registers with phone number + selfie,
  logs in, toggles their own on-duty (Online/Offline) status, and uses
  a dashboard to monitor Partner attendance and location across one or
  more Bangalore hotspots/areas. Calls Partners directly (outside the
  app, via the phone icon on a Partner's card) when attendance or
  location looks wrong.
- **Partner** — registers with phone number + selfie, picks their
  service category and assigned hotspot, logs into their own simple
  app, and marks their own attendance (check-in/check-out). This is
  the "Expert app" referenced by the user — Partner-reported
  attendance reflects into the CLM's dashboard.

**Team Leads (TLs) are explicitly out of scope for v1** — real-world
TLs exist and physically check on Partners, but they have no login, no
registration, and no data footprint in this app. Purely a
human-coordination role conducted by phone, outside the system.

## Platform

Mobile-first installable PWA (Next.js + `next-pwa`), same as the
existing app's platform choice. Two route groups:

- `/clm` — Cluster Manager app
- `/partner` — Partner (Expert) app

No native app store distribution for v1.

## Data model

Shaped to resemble what real Partner-master / CLM-master APIs would
eventually return, so swapping mock data for real data later is a
data-layer change, not a UI rewrite.

- **Hotspot** — `id`, `name`, `area` (Bellandur, BTM Layout, HSR,
  Jayanagar, Indiranagar, Koramangala, Whitefield, ...)
- **CLM** — `id`, `name`, `phone`, `selfieUrl`, `isOnDuty` (boolean,
  the Online/Offline toggle)
- **Partner** — `id`, `name`, `phone`, `selfieUrl`, `category`
  (`'hair_stylist' | 'makeup_artist' | 'mehendi_artist' |
  'spa_therapist' | 'nail_artist'`), `originalHotspotId` (their
  assigned area — fixed, set at registration), `shiftStart`,
  `shiftEnd`
- **AttendanceRecord** — `id`, `partnerId`, `date`, `status`
  (`'not_marked' | 'present' | 'logged_out' | 'logged_out_early' |
  'absent' | 'marked_absent'`, default `'not_marked'`), `checkInAt`,
  `checkInLat`, `checkInLng`, `currentHotspotId` (nearest hotspot to
  the check-in GPS point — this is the location-drift signal CLMs
  watch for), `checkOutAt`, `checkOutLat`, `checkOutLng`

**Status transitions:**
1. A Partner has an assigned shift (`shiftStart`/`shiftEnd` on their
   profile) for the day → an `AttendanceRecord` exists (or is implied)
   with `status = 'not_marked'`.
2. Partner taps Check-in in their app → browser Geolocation API
   captures lat/lng → matched to the nearest `Hotspot` →
   `currentHotspotId` set, `status` → `'present'`, `checkInAt`
   recorded. GPS is captured once, at the moment of check-in — no
   continuous/background tracking in v1.
3. Partner taps Check-out → same record updated with `checkOutAt` +
   coordinates. If checkout happens before `shiftEnd`, `status` →
   `'logged_out_early'`; otherwise → `'logged_out'`.
4. If a Partner never checks in and their shift has ended, their
   record is treated as `'absent'` for display purposes (derived, not
   a stored transition).
5. A CLM can manually set a record to `'marked_absent'` — a
   judgment-call override, no automation behind it.

No GPS/geofence fraud validation, no selfie liveness check — matching
the existing app's "simple record, not a fraud check" philosophy.
Location mismatch (`originalHotspotId` != `currentHotspotId`) is
surfaced for the CLM to *see and act on by calling the Partner*, not
auto-flagged as a violation.

## Screens

**CLM app (`/clm`)**
- Register: phone number → OTP (stubbed/mocked, no real SMS in v1) →
  selfie capture → profile created
- Login: phone → OTP (stubbed)
- Home dashboard:
  - Header: hotspot/area filter ("All" or specific), Online/Offline
    duty toggle, menu → profile
  - Select Category filter (salon service categories)
  - Today / Tomorrow toggle
  - Attendance summary card: total Partners in view, Present
    count+%, Absent count+%, tap to drill into the list
- Partner list (drill-down from summary card):
  - Search by name
  - Status filter pills (All / Present / Absent / Logged Out / Logged
    Out Early / Not Marked / Marked Absent)
  - Partner card: photo, name, ID, category tag, shift time,
    check-in/check-out time, Original Hotspot, Current Hotspot,
    status badge, call icon (`tel:` link), navigate icon (maps link
    using last known lat/lng), "mark absent" action
- Hotspot filter modal: Bangalore area list, multi-select
- Category filter modal: service category list, multi-select
- Profile/menu: CLM name + ID, Logout

**Partner app (`/partner`)**
- Register: phone number → OTP (stubbed) → selfie capture → pick
  service category → pick assigned hotspot → profile created
- Login: phone → OTP (stubbed)
- Home: today's shift time, big Check-in / Check-out button
  (geolocation-gated — permission denied shows inline retry message,
  blocks check-in until granted), current status display

**Explicitly dropped from the reference app for v1** (noise against
the "keep it simple" goal; easy to add back later): weather banner,
Scorecard/gamification, Breach tracker, Behavioural Issues card
(deallocations, AWOL), notification bell/feed, Leave management,
Manage week-offs, Merch Deliveries, My Team resource link.

## Error handling

- Geolocation permission denied → inline message + retry button;
  check-in/check-out blocked until granted (same pattern as the prior
  app version).
- No hotspot match found for a GPS point → `currentHotspotId` null,
  card shows "Location not matched" instead of a hotspot name.
- CLM with no hotspots in view → empty state, not an error.
- No shift assigned today → Partner sees a "no shift today" empty
  state instead of a broken check-in control.

## Data & build approach

Build first entirely against generated random mock data: ~6-8
hotspots across the Bangalore areas listed above, ~20-30 Partners with
varied categories/statuses, 2-3 CLMs. No Supabase/network calls in
this phase — `@supabase/supabase-js` stays an installed-but-unused
dependency until the integration phase. OTP send/verify is stubbed
(any code "works" in dev).

## Future integration phase (explicitly out of scope here)

Once the mock-data version is validated, real API integration will
need, at minimum:
- **OTP/auth API** — send OTP to a phone number, verify it (Supabase
  Auth phone provider, or Snabbit's existing SMS gateway if there is
  one)
- **Selfie storage API** — upload + retrieve selfie images (Supabase
  Storage or equivalent)
- **Partner master-data API** — fetch/sync real Partner records (name,
  phone, category, assigned hotspot) from Snabbit's partner/HRMS
  system
- **CLM master-data API** — same, for CLM identity/role data
- **Hotspot/zone master-list API** — authoritative list of Bangalore
  hotspots, if not sourced from the same system as Partner data
- **Attendance read/write API** — persist check-in/out events,
  queryable by the CLM dashboard

This spec does not design those integrations — only lists what will
be needed so the mock data model above stays compatible with them.

## Testing

Manual flow testing for the MVP: register a Partner → check-in
(location captured, matched to a hotspot) → register/login as CLM →
view dashboard → filter by hotspot/category → see the Partner's
Original vs Current Hotspot → Partner checks out → CLM sees updated
status. No automated test suite for v1 (consistent with the prior
app's YAGNI call); revisit if this moves toward production.

## Out of scope (v1)

- Team Lead login, registration, or any TL data in the app
- Selfie liveness / fraud verification
- Geofence-based automatic violation detection
- Continuous/background GPS tracking during a shift
- Real OTP/SMS delivery
- Real backend integration (Supabase or Snabbit internal APIs)
- Native mobile app (React Native/Flutter)
- Automated test suite
- Weather, gamification/scorecard, breach tracking, behavioural-issues
  analytics, notifications feed, leave/week-off management, merch
  deliveries
