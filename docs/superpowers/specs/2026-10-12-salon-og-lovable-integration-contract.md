# Salon OG — Lovable Frontend Integration Contract

Date: 2026-10-12

This is the reference to paste into Lovable (or give to whoever prompts
it) when building the Hub Manager / CLM frontend. It describes exactly
what to call against Supabase — Lovable's own schema introspection will
show the raw tables, but not the business rules (status vocab, hotspot
resolution, which field means what) that live in this document and in
the migration at
`supabase/migrations/20261012000000_salon_og_hotspots_and_dashboard.sql`.

**That migration has not been applied yet.** Nothing below works until
it's run against the "Blush Master" Supabase project
(`acuwcmnijzltwvhrvjmh`) and reviewed/approved.

## Connect Lovable to the right project

Use Supabase project **Blush Master** (`acuwcmnijzltwvhrvjmh`), not
"blush-inventory" — that's a different, unrelated project. Lovable's
native Supabase integration should point at Blush Master's URL and
publishable (anon) key.

## Auth

Hub Manager and CLM both sign in with their `@snabbit.com` email via
Supabase Auth (standard email/password, or magic link — either works;
email/password is simplest for Lovable to scaffold). After sign-in,
access is granted by the existing `is_admin()` Postgres function, which
checks the signed-in email against the `app_admins` table. **A user
must already have a row in `app_admins` (with their `@snabbit.com`
email) before they can do anything in this app** — creating a Supabase
Auth account alone isn't enough. Adding someone to `app_admins` is a
manual step for now (run as SQL, or a tiny internal tool later — not
part of this app's UI).

The new `app_admins.role` column (`'hub_manager'` | `'clm'` | `null`)
decides which screens to show after login:
- `'hub_manager'` → registration + attendance-marking screens
- `'clm'` → hotspot/live-order tracking screens
- `null` → generic admin, can see both (useful for testing)

There is **no partner-facing login** in this app at all — partners are
tracked data only, never an authenticated user here.

## Reading the dashboard

Query the `salon_partner_board` view — one row per active partner,
already joined to their hotspot, today's attendance, and today's most
relevant booking:

```js
const { data, error } = await supabase
  .from('salon_partner_board')
  .select('*')
```

Useful filters: `.eq('hotspot_id', selectedHotspotId)` for the CLM's
area filter, `.is('manual_status', null)` for "not yet marked today."

Columns and what they mean:

| Column | Meaning |
|---|---|
| `partner_id`, `partner_name`, `mobile`, `partner_status` | From `partners` |
| `hotspot_id`, `hotspot_name` | Assigned area, or both `null` if unassigned |
| `manual_status` | Hub Manager's attendance call for today: `present` / `absent` / `off_present` / `week_off` / `half_day`, or `null` if not marked yet |
| `attendance_state` | System-level attendance bucket: `present` / `leave` / `week_off_absent` / `week_off_present`, or `null` |
| `punctuality_status` | `early` / `on_time` / `late`, or `null` |
| `hub_check_in`, `hub_check_out` | Timestamps from the hub check-in step |
| `attendance_edited_by`, `attendance_edited_at` | Who last touched today's attendance row and when (audit trail) |
| `today_booking_id`, `today_service_stage`, `today_scheduled_time`, `today_started_at`, `today_reached_at`, `today_ended_at` | The partner's current/next booking today. `today_service_stage` null = **no job today**, show that as an empty state, not an error. Otherwise one of `assigned` / `order_accepted` / `ready_to_go` / `reached` / `service_ended` |

"Is this partner actually on a job right now" (the CLM's live-order
check) = `today_service_stage` is not `null` and not `service_ended`,
and ideally `today_started_at` is set.

## Fetching hotspots (for the area filter/switcher)

```js
const { data: hotspots } = await supabase
  .from('hotspots')
  .select('id, name')
  .order('name')
```

Always exactly 4 rows: Bellandur, Sarjapur 1, Sarjapur 2, HSR.

## Hub Manager: marking attendance

Upsert directly against `partner_attendance`, keyed on the real unique
constraint `(partner_id, date)`:

```js
const { error } = await supabase
  .from('partner_attendance')
  .upsert(
    {
      partner_id: partnerId,
      date: todayIso,               // 'YYYY-MM-DD'
      manual_status: 'present',     // present | absent | off_present | week_off | half_day
      attendance_state: 'present',  // present | leave | week_off_absent | week_off_present
      hub_check_in: new Date().toISOString(),
    },
    { onConflict: 'partner_id,date' }
  )
```

`edited_by`/`edited_at` are set automatically by existing DB
defaults/triggers where present — if they aren't populated after
testing this, set `edited_by` to the signed-in user's email explicitly
in the same upsert call.

This works under RLS as-is for any `is_admin()` user — no new backend
code is required for this action, the existing `partner_attendance`
policies already allow it.

## Hub Manager: registering a new partner

```js
const { data: code } = await supabase.rpc('next_partner_code')

const { error } = await supabase.from('partners').insert({
  partner_code: code,
  name: fullName,
  mobile: phoneNumber,
  start_time: '09:00:00',   // required column — ask for it or default it
  status: 'active',
  hotspot_id: selectedHotspotId,  // nullable — can be set later instead
})
```

**Do not set `is_verified_at_hub` from this app.** That flag gates the
real partner-facing field app's own login elsewhere in the system;
leave it untouched (null/default) so this registration flow doesn't
accidentally grant access it isn't meant to.

## CLM: assigning or reassigning a partner's hotspot

```js
const { error } = await supabase
  .from('partners')
  .update({ hotspot_id: newHotspotId })
  .eq('id', partnerId)
```

## What NOT to query directly from the frontend

`bookings`, `societies`, and `addresses` carry the hotspot-resolution
and live-order logic already baked into `salon_partner_board` — don't
reimplement the zone-matching rules in frontend code. If a future
screen needs booking detail beyond what the view exposes, extend the
view (migration change) rather than duplicating the join logic in
JavaScript.
