# Salon OG Attendance App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an installable PWA for Snabbit's salon category on-ground ops: staff/team-lead attendance check-in/out, team-lead status marking, manager multi-hotspot attendance dashboard, shift assignment, and leave request/approval.

**Architecture:** Single Next.js (App Router) app. `/staff` routes serve both the `staff` and `team_lead` roles (same check-in/out flow, with an extra status-marking screen for team leads). `/admin` routes serve the `manager` role. Supabase (Postgres + Auth + RLS) is the backend, accessed via `@supabase/ssr` browser/server clients and Next.js Server Actions.

**Tech Stack:** Next.js (App Router, TypeScript), Tailwind CSS, `next-pwa`, Supabase (`@supabase/supabase-js`, `@supabase/ssr`).

**Spec:** `docs/superpowers/specs/2026-10-10-salon-og-attendance-design.md`

## Global Constraints

- Standalone backend (own Supabase project/database/auth) — no integration with Snabbit production systems in v1.
- GPS captured at check-in/out; no selfie, no geofence/fraud validation — status marking is manual judgment only.
- Three roles: `staff`, `team_lead`, `manager`. Leave approval is manager-only.
- No automated test suite for v1 — every task is verified by manually exercising the flow in the browser, per the spec's Testing section.
- No hotspot-creation or manager-assignment UI in v1 — hotspots and `hotspot_managers` rows are seeded directly via SQL.
- Visual style matches the provided reference screens: warm cream background, blue primary cards/buttons, rounded pill badges, bold rounded headers, color-coded stat cards (blue = attendance, green = false negative, red/salmon = absent breakdown).

---

## Task 1: Project scaffold + design tokens

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `.gitignore`
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

**Interfaces:**
- Produces: Tailwind color tokens `cream`, `brand` (+ `brand-dark`), `success`, `danger` — used by every later UI task.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "snabbit-salon-og",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install next@latest react@latest react-dom@latest @supabase/supabase-js@latest @supabase/ssr@latest next-pwa@latest
npm install -D typescript@latest @types/node@latest @types/react@latest @types/react-dom@latest tailwindcss@latest postcss@latest autoprefixer@latest eslint@latest eslint-config-next@latest
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.js`**

```js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = withPWA(nextConfig)
```

- [ ] **Step 5: Create `tailwind.config.js` with the reference-screen palette**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FBF2DD',
        brand: { DEFAULT: '#4C5FEA', dark: '#3B4ACB' },
        success: '#3F9065',
        danger: '#D97462',
      },
      borderRadius: {
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 6: Create `postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules
.next
.env.local
public/sw.js
public/workbox-*.js
public/worker-*.js
public/sw.js.map
```

- [ ] **Step 8: Create `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #f3f4f6;
}
```

- [ ] **Step 9: Create `src/app/layout.tsx`**

```tsx
import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Snabbit Salon OG',
  description: 'On-ground attendance app for the Snabbit salon category',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 10: Create a placeholder `src/app/page.tsx` (replaced in Task 4)**

```tsx
export default function Home() {
  return <main className="p-8">Snabbit Salon OG — coming up.</main>
}
```

- [ ] **Step 11: Verify**

Run: `npm run dev`
Open `http://localhost:3000` — confirm the page loads and shows "Snabbit Salon OG — coming up." with no console errors.

- [ ] **Step 12: Commit**

```bash
git add package.json tsconfig.json next.config.js tailwind.config.js postcss.config.js .gitignore src package-lock.json
git commit -m "chore: scaffold Next.js app with Tailwind design tokens"
```

---

## Task 2: Supabase project + client setup

**Files:**
- Create: `src/lib/supabase/types.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `middleware.ts`
- Create: `.env.local` (not committed)

**Interfaces:**
- Produces: `createClient()` (browser, from `src/lib/supabase/client.ts`), `createClient()` (server/async, from `src/lib/supabase/server.ts`), and shared types `Role`, `Profile`, `Hotspot`, `Shift`, `AttendanceStatus`, `Attendance`, `LeaveStatus`, `LeaveRequest`, `AppNotification` — consumed by every subsequent task.

- [ ] **Step 1: Create or find the Supabase project**

Using the Supabase MCP tools: call `list_organizations`, then `list_projects` to check for an existing "snabbit-salon-og" project. If none exists, call `create_project` with that name under your organization. Wait for it to become active, then call `get_project_url` and `get_publishable_keys` to get the project URL and anon key.

- [ ] **Step 2: Create `.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=<project URL from Step 1>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key from Step 1>
```

- [ ] **Step 3: Create `src/lib/supabase/types.ts`**

```ts
export type Role = 'staff' | 'team_lead' | 'manager'

export interface Profile {
  id: string
  full_name: string
  role: Role
  hotspot_id: string | null
  is_on_duty: boolean
  created_at: string
}

export interface Hotspot {
  id: string
  name: string
  created_at: string
}

export interface Shift {
  id: string
  staff_id: string
  hotspot_id: string
  date: string
  start_time: string
  end_time: string
  assigned_by: string
  created_at: string
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
  staff_id: string
  shift_id: string
  hotspot_id: string
  date: string
  status: AttendanceStatus
  check_in_at: string | null
  check_in_lat: number | null
  check_in_lng: number | null
  check_out_at: string | null
  check_out_lat: number | null
  check_out_lng: number | null
  is_false_negative: boolean
  marked_by: string | null
  created_at: string
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveRequest {
  id: string
  staff_id: string
  start_date: string
  end_date: string
  reason: string
  status: LeaveStatus
  reviewed_by: string | null
  created_at: string
}

export interface AppNotification {
  id: string
  manager_id: string
  message: string
  hotspot_id: string | null
  read_at: string | null
  created_at: string
}
```

- [ ] **Step 4: Create `src/lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 5: Create `src/lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // called from a Server Component render; middleware refreshes the session
          }
        },
      },
    }
  )
}
```

- [ ] **Step 6: Create `middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = path.startsWith('/staff') || path.startsWith('/admin')

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/staff/:path*', '/admin/:path*'],
}
```

- [ ] **Step 7: Verify**

Run: `npm run dev`
Open `http://localhost:3000` — confirm it still loads with no errors (middleware only guards `/staff` and `/admin`, which don't exist yet, so this is just confirming the app still boots cleanly with the new files in place).

- [ ] **Step 8: Commit**

```bash
git add src/lib middleware.ts
git commit -m "feat: add Supabase client/server setup and shared types"
```

---

## Task 3: Database schema, triggers, and RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tables `hotspots`, `hotspot_managers`, `profiles`, `shifts`, `attendance`, `leave_requests`, `notifications` with the columns defined in `src/lib/supabase/types.ts` (Task 2), plus a trigger that creates a `profiles` row on signup and a trigger that notifies managers when a team lead checks in.

- [ ] **Step 1: Write `supabase/migrations/0001_init.sql`**

```sql
create extension if not exists "pgcrypto";

create table hotspots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('staff','team_lead','manager')),
  hotspot_id uuid references hotspots(id),
  is_on_duty boolean not null default false,
  created_at timestamptz not null default now()
);

create table hotspot_managers (
  hotspot_id uuid not null references hotspots(id) on delete cascade,
  manager_id uuid not null references profiles(id) on delete cascade,
  primary key (hotspot_id, manager_id)
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles(id) on delete cascade,
  hotspot_id uuid not null references hotspots(id),
  date date not null,
  start_time time not null,
  end_time time not null,
  assigned_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (staff_id, date)
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles(id) on delete cascade,
  shift_id uuid not null references shifts(id) on delete cascade,
  hotspot_id uuid not null references hotspots(id),
  date date not null,
  status text not null default 'not_marked' check (
    status in ('present','marked_absent','no_show','not_marked','false_attendance','on_leave')
  ),
  check_in_at timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_out_at timestamptz,
  check_out_lat double precision,
  check_out_lng double precision,
  is_false_negative boolean not null default false,
  marked_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (staff_id, shift_id)
);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  hotspot_id uuid references hotspots(id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
-- full_name/role/hotspot_id are passed via auth.signUp's options.data.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, hotspot_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'staff'),
    nullif(new.raw_user_meta_data->>'hotspot_id', '')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Notify every manager of a hotspot when a team lead checks in there.
create or replace function notify_managers_on_tl_checkin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tl_name text;
  tl_role text;
  should_notify boolean := false;
  mgr record;
begin
  if TG_OP = 'INSERT' then
    should_notify := new.check_in_at is not null;
  elsif TG_OP = 'UPDATE' then
    should_notify := new.check_in_at is not null and old.check_in_at is null;
  end if;

  if should_notify then
    select full_name, role into tl_name, tl_role from profiles where id = new.staff_id;
    if tl_role = 'team_lead' then
      for mgr in select manager_id from hotspot_managers where hotspot_id = new.hotspot_id loop
        insert into notifications (manager_id, message, hotspot_id)
        values (mgr.manager_id, 'TL ' || tl_name || ' has reached the hotspot', new.hotspot_id);
      end loop;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_attendance_checkin
  after insert or update on attendance
  for each row execute function notify_managers_on_tl_checkin();

-- RLS
alter table hotspots enable row level security;
alter table hotspot_managers enable row level security;
alter table profiles enable row level security;
alter table shifts enable row level security;
alter table attendance enable row level security;
alter table leave_requests enable row level security;
alter table notifications enable row level security;

create or replace function current_role_is(r text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = r);
$$;

create or replace function current_hotspot_id()
returns uuid language sql security definer stable set search_path = public as $$
  select hotspot_id from profiles where id = auth.uid();
$$;

create or replace function is_manager_of_hotspot(h uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from hotspot_managers
    where hotspot_id = h and manager_id = auth.uid()
  );
$$;

create policy "hotspots_select_all" on hotspots for select using (true);

create policy "hotspot_managers_select_own" on hotspot_managers
  for select using (manager_id = auth.uid());

create policy "profiles_select_self_or_scoped" on profiles
  for select using (
    id = auth.uid()
    or current_role_is('manager')
    or (current_role_is('team_lead') and hotspot_id = current_hotspot_id())
  );
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

create policy "shifts_select_scoped" on shifts
  for select using (
    staff_id = auth.uid()
    or (current_role_is('team_lead') and hotspot_id = current_hotspot_id())
    or is_manager_of_hotspot(hotspot_id)
  );
create policy "shifts_insert_manager" on shifts
  for insert with check (is_manager_of_hotspot(hotspot_id));
create policy "shifts_update_manager" on shifts
  for update using (is_manager_of_hotspot(hotspot_id));

create policy "attendance_select_scoped" on attendance
  for select using (
    staff_id = auth.uid()
    or (current_role_is('team_lead') and hotspot_id = current_hotspot_id())
    or is_manager_of_hotspot(hotspot_id)
  );
create policy "attendance_insert_own" on attendance
  for insert with check (staff_id = auth.uid());
create policy "attendance_update_own_or_scoped" on attendance
  for update using (
    staff_id = auth.uid()
    or (current_role_is('team_lead') and hotspot_id = current_hotspot_id())
    or is_manager_of_hotspot(hotspot_id)
  );

create policy "leave_select_scoped" on leave_requests
  for select using (staff_id = auth.uid() or current_role_is('manager'));
create policy "leave_insert_own" on leave_requests
  for insert with check (staff_id = auth.uid());
create policy "leave_update_manager" on leave_requests
  for update using (current_role_is('manager'));

create policy "notifications_select_own" on notifications
  for select using (manager_id = auth.uid());
create policy "notifications_update_own" on notifications
  for update using (manager_id = auth.uid());
```

- [ ] **Step 2: Apply the migration**

Using the Supabase MCP tools: call `apply_migration` with `name: "init_schema"` and the SQL content from Step 1, against the project created in Task 2.

- [ ] **Step 3: Verify**

Call `list_tables` and confirm all 7 tables exist. Call `get_advisors` (type `security`) and confirm there are no "RLS disabled" warnings for any of the 7 tables.

- [ ] **Step 4: Seed two hotspots**

Using `execute_sql`, run:
```sql
insert into hotspots (name) values ('Raheja'), ('Andheri West');
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add database schema, RLS policies, and signup/notification triggers"
```

---

## Task 4: Auth — signup, login, role-based routing

**Files:**
- Create: `src/app/signup/page.tsx`
- Create: `src/app/login/page.tsx`
- Modify: `src/app/page.tsx` (from Task 1's placeholder)
- Create: `src/app/staff/layout.tsx`
- Create: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `createClient()` (browser + server), `Profile`, `Role` from Task 2.
- Produces: `/staff/layout.tsx` renders a shared header/nav for `staff` and `team_lead` roles; `/admin/layout.tsx` renders the manager shell — both redirect out if the signed-in user's role doesn't match.

- [ ] **Step 1: Disable email confirmation (one-time manual step)**

In the Supabase Dashboard for this project: Authentication → Providers → Email → turn off "Confirm email". This lets signed-up test accounts log in immediately, which matters for manual verification in later tasks.

- [ ] **Step 2: Create `src/app/signup/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Hotspot, Role } from '@/lib/supabase/types'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [hotspotId, setHotspotId] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('hotspots')
      .select('*')
      .then(({ data }) => setHotspots(data ?? []))
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          hotspot_id: role === 'manager' ? '' : hotspotId,
        },
      },
    })
    if (signUpError) {
      setError(signUpError.message)
      return
    }
    router.push('/login')
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-gray-900">Sign up</h1>
        {error && <p className="text-danger text-sm">{error}</p>}
        <input
          className="w-full border rounded-xl px-3 py-2"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <input
          className="w-full border rounded-xl px-3 py-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border rounded-xl px-3 py-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <select
          className="w-full border rounded-xl px-3 py-2"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          <option value="staff">Staff</option>
          <option value="team_lead">Team Lead</option>
          <option value="manager">Manager</option>
        </select>
        {role !== 'manager' && (
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
        )}
        <button
          type="submit"
          className="w-full bg-brand text-white rounded-xl py-2 font-semibold hover:bg-brand-dark"
        >
          Create account
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Create `src/app/login/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError) {
      setError(signInError.message)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-gray-900">Log in</h1>
        {error && <p className="text-danger text-sm">{error}</p>}
        <input
          className="w-full border rounded-xl px-3 py-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border rounded-xl px-3 py-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full bg-brand text-white rounded-xl py-2 font-semibold hover:bg-brand-dark"
        >
          Log in
        </button>
        <a href="/signup" className="block text-center text-sm text-brand">
          Need an account? Sign up
        </a>
      </form>
    </main>
  )
}
```

- [ ] **Step 4: Replace `src/app/page.tsx` with role-based redirect**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile) {
    redirect('/login')
  }

  redirect(profile.role === 'manager' ? '/admin' : '/staff')
}
```

- [ ] **Step 5: Create `src/app/staff/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile || profile.role === 'manager') {
    redirect('/admin')
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white px-4 py-3 shadow-sm flex gap-4 items-center">
        <span className="font-bold text-gray-900">{profile.full_name}</span>
        <nav className="flex gap-3 text-sm">
          <Link href="/staff" className="text-brand">
            Home
          </Link>
          <Link href="/staff/leave" className="text-brand">
            Leave
          </Link>
          {profile.role === 'team_lead' && (
            <Link href="/staff/team" className="text-brand">
              Team
            </Link>
          )}
        </nav>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
```

- [ ] **Step 6: Create `src/app/admin/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile || profile.role !== 'manager') {
    redirect('/staff')
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white px-4 py-3 shadow-sm flex gap-4 items-center">
        <span className="font-bold text-gray-900">{profile.full_name}</span>
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

- [ ] **Step 7: Create placeholder pages so layouts render**

Create `src/app/staff/page.tsx`:
```tsx
export default function StaffHome() {
  return <p>Staff home — built in Task 5.</p>
}
```

Create `src/app/admin/page.tsx`:
```tsx
export default function AdminHome() {
  return <p>Admin dashboard — built in Task 8.</p>
}
```

- [ ] **Step 8: Verify**

Run: `npm run dev`. In the browser:
1. Go to `/signup`, create a staff account tied to "Raheja" — confirm redirect to `/login`.
2. Log in — confirm redirect to `/` then `/staff`, showing "Staff home — built in Task 5." and the header with your name.
3. Sign up a second account with role "Manager" (no hotspot) — log in — confirm redirect to `/admin` showing "Admin dashboard — built in Task 8."
4. While logged in as the manager, manually navigate to `/staff` in the URL bar — confirm it redirects back to `/admin` (role guard working).

- [ ] **Step 9: Commit**

```bash
git add src/app
git commit -m "feat: add signup, login, and role-based routing"
```

---

## Task 5: Staff/TL check-in and check-out

**Files:**
- Create: `src/app/actions/shifts.ts`
- Create: `src/app/actions/attendance.ts`
- Create: `src/components/staff/CheckInCard.tsx`
- Modify: `src/app/staff/page.tsx`

**Interfaces:**
- Consumes: `createClient()` (server), `Shift`, `Attendance` from Task 2.
- Produces: `getTodayShift(): Promise<Shift | null>`, `getTodayAttendance(shiftId: string): Promise<Attendance | null>`, `checkIn(shiftId: string, hotspotId: string, lat: number, lng: number): Promise<void>`, `checkOut(attendanceId: string, lat: number, lng: number): Promise<void>` — consumed by Task 7 (team page reads shift/attendance shape) and the admin dashboard tasks (read the same `attendance` rows).

- [ ] **Step 1: Create `src/app/actions/shifts.ts`**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import type { Shift } from '@/lib/supabase/types'

export async function getTodayShift(): Promise<Shift | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('shifts')
    .select('*')
    .eq('staff_id', user.id)
    .eq('date', today)
    .maybeSingle<Shift>()

  return data
}
```

- [ ] **Step 2: Create `src/app/actions/attendance.ts`**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import type { Attendance } from '@/lib/supabase/types'

export async function getTodayAttendance(
  shiftId: string
): Promise<Attendance | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('attendance')
    .select('*')
    .eq('shift_id', shiftId)
    .maybeSingle<Attendance>()
  return data
}

export async function checkIn(
  shiftId: string,
  hotspotId: string,
  lat: number,
  lng: number
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase.from('attendance').insert({
    staff_id: user.id,
    shift_id: shiftId,
    hotspot_id: hotspotId,
    date: today,
    status: 'present',
    check_in_at: new Date().toISOString(),
    check_in_lat: lat,
    check_in_lng: lng,
  })
  if (error) throw error
}

export async function checkOut(
  attendanceId: string,
  lat: number,
  lng: number
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('attendance')
    .update({
      check_out_at: new Date().toISOString(),
      check_out_lat: lat,
      check_out_lng: lng,
    })
    .eq('id', attendanceId)
  if (error) throw error
}
```

- [ ] **Step 3: Create `src/components/staff/CheckInCard.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { getTodayShift } from '@/app/actions/shifts'
import {
  getTodayAttendance,
  checkIn,
  checkOut,
} from '@/app/actions/attendance'
import type { Attendance, Shift } from '@/lib/supabase/types'

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject)
  })
}

export default function CheckInCard() {
  const [shift, setShift] = useState<Shift | null>(null)
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const s = await getTodayShift()
    setShift(s)
    if (s) {
      const a = await getTodayAttendance(s.id)
      setAttendance(a)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCheckIn() {
    if (!shift) return
    setError(null)
    setBusy(true)
    try {
      const pos = await getPosition()
      await checkIn(
        shift.id,
        shift.hotspot_id,
        pos.coords.latitude,
        pos.coords.longitude
      )
      await load()
    } catch {
      setError(
        'Location is required to check in. Please allow location access and try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleCheckOut() {
    if (!attendance) return
    setError(null)
    setBusy(true)
    try {
      const pos = await getPosition()
      await checkOut(attendance.id, pos.coords.latitude, pos.coords.longitude)
      await load()
    } catch {
      setError(
        'Location is required to check out. Please allow location access and try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p>Loading…</p>

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
        {shift.start_time} – {shift.end_time}
      </p>
      {error && <p className="text-sm bg-danger/80 rounded-xl p-2">{error}</p>}
      {!attendance?.check_in_at && (
        <button
          onClick={handleCheckIn}
          disabled={busy}
          className="w-full bg-white text-brand rounded-xl py-2 font-semibold disabled:opacity-50"
        >
          Check In
        </button>
      )}
      {attendance?.check_in_at && !attendance?.check_out_at && (
        <button
          onClick={handleCheckOut}
          disabled={busy}
          className="w-full bg-white text-brand rounded-xl py-2 font-semibold disabled:opacity-50"
        >
          Check Out
        </button>
      )}
      {attendance?.check_out_at && (
        <p className="font-semibold">Shift complete ✓</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Replace `src/app/staff/page.tsx`**

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

- [ ] **Step 5: Seed a shift for manual verification**

Using the Supabase MCP `execute_sql` tool, find your staff test user's id and the "Raheja" hotspot id, then insert a shift for today:
```sql
insert into shifts (staff_id, hotspot_id, date, start_time, end_time, assigned_by)
values (
  (select id from auth.users where email = 'YOUR_STAFF_TEST_EMAIL'),
  (select id from hotspots where name = 'Raheja'),
  current_date, '09:00', '18:00',
  (select id from auth.users where email = 'YOUR_STAFF_TEST_EMAIL')
);
```

- [ ] **Step 6: Verify**

Run `npm run dev`, log in as the staff test account. Confirm the shift card shows "09:00 – 18:00" and a Check In button. Click it, grant location permission when prompted, confirm the button changes to Check Out. Click Check Out, confirm it changes to "Shift complete ✓". Reload the page and confirm the completed state persists.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions src/components/staff src/app/staff/page.tsx
git commit -m "feat: add staff/team-lead check-in and check-out flow"
```

---

## Task 6: Leave request + history

**Files:**
- Create: `src/app/actions/leave.ts`
- Create: `src/components/staff/LeaveForm.tsx`
- Create: `src/components/staff/LeaveList.tsx`
- Create: `src/app/staff/leave/page.tsx`

**Interfaces:**
- Consumes: `createClient()` (server), `LeaveRequest` from Task 2.
- Produces: `requestLeave(startDate: string, endDate: string, reason: string): Promise<void>`, `listMyLeaveRequests(): Promise<LeaveRequest[]>` — `listMyLeaveRequests` pattern reused (with a manager-scoped variant) by Task 11.

- [ ] **Step 1: Create `src/app/actions/leave.ts`**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import type { LeaveRequest } from '@/lib/supabase/types'

export async function requestLeave(
  startDate: string,
  endDate: string,
  reason: string
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('leave_requests').insert({
    staff_id: user.id,
    start_date: startDate,
    end_date: endDate,
    reason,
  })
  if (error) throw error
}

export async function listMyLeaveRequests(): Promise<LeaveRequest[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('staff_id', user.id)
    .order('created_at', { ascending: false })

  return data ?? []
}
```

- [ ] **Step 2: Create `src/components/staff/LeaveForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestLeave } from '@/app/actions/leave'

export default function LeaveForm() {
  const router = useRouter()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await requestLeave(startDate, endDate, reason)
      setStartDate('')
      setEndDate('')
      setReason('')
      router.refresh()
    } catch {
      setError('Could not submit leave request. Please try again.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-3xl shadow-lg p-6 space-y-3"
    >
      <h2 className="font-bold text-gray-900">Request leave</h2>
      {error && <p className="text-danger text-sm">{error}</p>}
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
  )
}
```

- [ ] **Step 3: Create `src/components/staff/LeaveList.tsx`**

```tsx
import type { LeaveRequest } from '@/lib/supabase/types'

const STATUS_COLOR: Record<LeaveRequest['status'], string> = {
  pending: 'bg-gray-200 text-gray-800',
  approved: 'bg-success/20 text-success',
  rejected: 'bg-danger/20 text-danger',
}

export default function LeaveList({ requests }: { requests: LeaveRequest[] }) {
  if (requests.length === 0) {
    return <p className="text-gray-500">No leave requests yet.</p>
  }

  return (
    <ul className="space-y-2">
      {requests.map((r) => (
        <li
          key={r.id}
          className="bg-white rounded-2xl shadow p-4 flex justify-between items-center"
        >
          <div>
            <p className="font-semibold">
              {r.start_date} → {r.end_date}
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
  )
}
```

- [ ] **Step 4: Create `src/app/staff/leave/page.tsx`**

```tsx
import { listMyLeaveRequests } from '@/app/actions/leave'
import LeaveForm from '@/components/staff/LeaveForm'
import LeaveList from '@/components/staff/LeaveList'

export default async function StaffLeavePage() {
  const requests = await listMyLeaveRequests()
  return (
    <div className="max-w-md mx-auto space-y-4">
      <LeaveForm />
      <LeaveList requests={requests} />
    </div>
  )
}
```

- [ ] **Step 5: Verify**

Run `npm run dev`, log in as the staff test account, go to `/staff/leave`. Submit a leave request — confirm it appears in the list below with a "pending" badge.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/leave.ts src/components/staff/LeaveForm.tsx src/components/staff/LeaveList.tsx src/app/staff/leave
git commit -m "feat: add staff leave request form and history"
```

---

## Task 7: Team-lead status marking

**Files:**
- Modify: `src/app/actions/attendance.ts`
- Create: `src/components/staff/TeamStatusTable.tsx`
- Create: `src/app/staff/team/page.tsx`

**Interfaces:**
- Consumes: `Attendance`, `AttendanceStatus`, `Profile` from Task 2; `createClient()` (server).
- Produces: `listHotspotAttendanceToday(): Promise<(Attendance & { profiles: Profile })[]>`, `markStatus(attendanceId: string, status: AttendanceStatus): Promise<void>`, `setFalseNegative(attendanceId: string, flag: boolean): Promise<void>` — `markStatus`'s status values are reused by Task 10's attendance report and Task 9's dashboard summary (same `AttendanceStatus` union); `setFalseNegative` feeds the `falseNegative` count in Task 9's dashboard summary.

- [ ] **Step 1: Add to `src/app/actions/attendance.ts`**

```ts
import type { AttendanceStatus, Profile } from '@/lib/supabase/types'

export async function listHotspotAttendanceToday(): Promise<
  (Attendance & { profiles: Profile })[]
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: me } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()
  if (!me || me.role !== 'team_lead' || !me.hotspot_id) return []

  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('attendance')
    .select('*, profiles!attendance_staff_id_fkey(*)')
    .eq('hotspot_id', me.hotspot_id)
    .eq('date', today)

  return (data as (Attendance & { profiles: Profile })[]) ?? []
}

export async function markStatus(
  attendanceId: string,
  status: AttendanceStatus
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('attendance')
    .update({ status, marked_by: user.id })
    .eq('id', attendanceId)
  if (error) throw error
}

export async function setFalseNegative(
  attendanceId: string,
  flag: boolean
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('attendance')
    .update({ is_false_negative: flag, marked_by: user.id })
    .eq('id', attendanceId)
  if (error) throw error
}
```

- [ ] **Step 2: Create `src/components/staff/TeamStatusTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markStatus, setFalseNegative } from '@/app/actions/attendance'
import type { Attendance, AttendanceStatus, Profile } from '@/lib/supabase/types'

const MARKABLE_STATUSES: AttendanceStatus[] = [
  'marked_absent',
  'no_show',
  'false_attendance',
]

export default function TeamStatusTable({
  rows,
}: {
  rows: (Attendance & { profiles: Profile })[]
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleMark(attendanceId: string, status: AttendanceStatus) {
    setBusyId(attendanceId)
    await markStatus(attendanceId, status)
    router.refresh()
    setBusyId(null)
  }

  async function handleFalseNegativeToggle(
    attendanceId: string,
    current: boolean
  ) {
    setBusyId(attendanceId)
    await setFalseNegative(attendanceId, !current)
    router.refresh()
    setBusyId(null)
  }

  if (rows.length === 0) {
    return <p className="text-gray-500">No staff shifts at your hotspot today.</p>
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className="bg-white rounded-2xl shadow p-4 flex justify-between items-center gap-3"
        >
          <div>
            <p className="font-semibold">{row.profiles.full_name}</p>
            <p className="text-sm text-gray-500">{row.status}</p>
          </div>
          <div className="flex items-center gap-2">
            {row.status === 'not_marked' && (
              <select
                className="border rounded-xl px-2 py-1 text-sm"
                disabled={busyId === row.id}
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
              onClick={() =>
                handleFalseNegativeToggle(row.id, row.is_false_negative)
              }
              disabled={busyId === row.id}
              className={`text-xs px-2 py-1 rounded-full font-semibold ${
                row.is_false_negative
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
  )
}
```

- [ ] **Step 3: Create `src/app/staff/team/page.tsx`**

```tsx
import { listHotspotAttendanceToday } from '@/app/actions/attendance'
import TeamStatusTable from '@/components/staff/TeamStatusTable'

export default async function TeamPage() {
  const rows = await listHotspotAttendanceToday()
  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Today&apos;s hotspot attendance</h1>
      <TeamStatusTable rows={rows} />
    </div>
  )
}
```

- [ ] **Step 4: Seed a team-lead account and a second staff shift for manual verification**

Sign up a `team_lead` account at the "Raheja" hotspot via `/signup`. Using `execute_sql`, insert a shift today for the original staff test account at the same hotspot (reuse Task 5's insert with a new `assigned_by`), so there's a `not_marked` row for the team lead to review once that staff member hasn't checked in.

- [ ] **Step 5: Verify**

Log in as the team lead, go to `/staff/team`. Confirm the staff member's row shows with a "Mark as…" dropdown. Select "no_show" — confirm the row updates to show "no_show" and the dropdown disappears (status no longer `not_marked`). Click the "False Negative" button on that row — confirm it turns green/active; click again — confirm it toggles back off.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/attendance.ts src/components/staff/TeamStatusTable.tsx src/app/staff/team
git commit -m "feat: add team-lead attendance status marking"
```

---

## Task 8: Hotspot context + on-duty toggle

**Files:**
- Create: `src/app/actions/hotspots.ts`
- Create: `src/components/admin/HotspotSwitcher.tsx`
- Create: `src/components/admin/OnDutyToggle.tsx`

**Interfaces:**
- Consumes: `createClient()` (server + browser), `Hotspot`, `Profile` from Task 2.
- Produces: `listManagerHotspots(): Promise<Hotspot[]>`, `getMyProfile(): Promise<Profile | null>`, `toggleOnDuty(onDuty: boolean): Promise<void>` server actions; `<HotspotSwitcher hotspots selectedId onChange />` and `<OnDutyToggle initialOnDuty />` client components — all consumed by Task 9's dashboard page.

- [ ] **Step 1: Create `src/app/actions/hotspots.ts`**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import type { Hotspot, Profile } from '@/lib/supabase/types'

export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()
  return data
}

export async function listManagerHotspots(): Promise<Hotspot[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('hotspot_managers')
    .select('hotspots(*)')
    .eq('manager_id', user.id)

  return (data ?? []).map((row) => row.hotspots as unknown as Hotspot)
}

export async function toggleOnDuty(onDuty: boolean): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('profiles')
    .update({ is_on_duty: onDuty })
    .eq('id', user.id)
  if (error) throw error
}
```

- [ ] **Step 2: Create `src/components/admin/HotspotSwitcher.tsx`**

```tsx
'use client'

import type { Hotspot } from '@/lib/supabase/types'

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
import { toggleOnDuty } from '@/app/actions/hotspots'

export default function OnDutyToggle({
  initialOnDuty,
}: {
  initialOnDuty: boolean
}) {
  const [onDuty, setOnDuty] = useState(initialOnDuty)

  async function handleToggle() {
    const next = !onDuty
    setOnDuty(next)
    await toggleOnDuty(next)
  }

  return (
    <button
      onClick={handleToggle}
      className={`rounded-full px-3 py-1 text-sm font-semibold ${
        onDuty ? 'bg-success text-white' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {onDuty ? 'Online' : 'Offline'}
    </button>
  )
}
```

- [ ] **Step 4: Seed `hotspot_managers` for manual verification**

Using `execute_sql`, link your manager test account to both seeded hotspots:
```sql
insert into hotspot_managers (hotspot_id, manager_id)
select id, (select id from auth.users where email = 'YOUR_MANAGER_TEST_EMAIL')
from hotspots;
```

- [ ] **Step 5: Verify**

These components aren't wired into a page yet — verification happens as part of Task 9, which assembles them into the dashboard. Confirm this task's three files compile with no TypeScript errors: run `npm run build` and check it completes without errors from these files (unused-export warnings are fine; the build fails loudly on real type errors).

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/hotspots.ts src/components/admin
git commit -m "feat: add manager hotspot listing and on-duty toggle"
```

---

## Task 9: Admin dashboard home (attendance summary)

**Files:**
- Create: `src/app/actions/dashboard.ts`
- Create: `src/components/admin/AttendanceSummaryCard.tsx`
- Create: `src/components/admin/FalseNegativeRow.tsx`
- Create: `src/components/admin/AbsentBreakdownCard.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `createClient()` (server), `AttendanceStatus`, `Hotspot` from Task 2; `listManagerHotspots`, `getMyProfile`, `<OnDutyToggle>` from Task 8.
- Produces: `getAttendanceSummary(hotspotId: string, date: string): Promise<AttendanceSummary>` where `AttendanceSummary = { totalExpected: number; present: number; absent: number; falseNegative: number; breakdown: { marked_absent: number; no_show: number; not_marked: number; false_attendance: number; on_leave: number } }`.

- [ ] **Step 1: Create `src/app/actions/dashboard.ts`**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import type { AttendanceStatus } from '@/lib/supabase/types'

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

export async function getAttendanceSummary(
  hotspotId: string,
  date: string
): Promise<AttendanceSummary> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('attendance')
    .select('status, is_false_negative')
    .eq('hotspot_id', hotspotId)
    .eq('date', date)

  const rows = data ?? []
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
    const status = row.status as AttendanceStatus
    if (status === 'present') {
      present += 1
    } else {
      breakdown[status as keyof typeof breakdown] += 1
    }
    if (row.is_false_negative) falseNegative += 1
  }

  const absent = rows.length - present

  return {
    totalExpected: rows.length,
    present,
    absent,
    falseNegative,
    breakdown,
  }
}
```

- [ ] **Step 2: Create `src/components/admin/AttendanceSummaryCard.tsx`**

```tsx
import type { AttendanceSummary } from '@/app/actions/dashboard'

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

- [ ] **Step 3: Create `src/components/admin/FalseNegativeRow.tsx`**

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

- [ ] **Step 4: Create `src/components/admin/AbsentBreakdownCard.tsx`**

```tsx
import type { AttendanceSummary } from '@/app/actions/dashboard'

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

- [ ] **Step 5: Replace `src/app/admin/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { listManagerHotspots, getMyProfile } from '@/app/actions/hotspots'
import { getAttendanceSummary, type AttendanceSummary } from '@/app/actions/dashboard'
import HotspotSwitcher from '@/components/admin/HotspotSwitcher'
import OnDutyToggle from '@/components/admin/OnDutyToggle'
import AttendanceSummaryCard from '@/components/admin/AttendanceSummaryCard'
import FalseNegativeRow from '@/components/admin/FalseNegativeRow'
import AbsentBreakdownCard from '@/components/admin/AbsentBreakdownCard'
import type { Hotspot, Profile } from '@/lib/supabase/types'

export default function AdminHome() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [summary, setSummary] = useState<AttendanceSummary | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    listManagerHotspots().then((hs) => {
      setHotspots(hs)
      if (hs.length > 0) setSelectedId(hs[0].id)
    })
    getMyProfile().then(setProfile)
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const today = new Date().toISOString().slice(0, 10)
    getAttendanceSummary(selectedId, today).then(setSummary)
  }, [selectedId])

  if (hotspots.length === 0) {
    return <p className="text-gray-500">No hotspots assigned to you yet.</p>
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <HotspotSwitcher
          hotspots={hotspots}
          selectedId={selectedId}
          onChange={setSelectedId}
        />
        {profile && <OnDutyToggle initialOnDuty={profile.is_on_duty} />}
      </div>
      {summary && (
        <>
          <AttendanceSummaryCard summary={summary} />
          <FalseNegativeRow count={summary.falseNegative} />
          <AbsentBreakdownCard summary={summary} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Verify**

Run `npm run dev`, log in as the manager test account. Confirm the dashboard shows the hotspot switcher with "Raheja" and "Andheri West", an Online/Offline toggle next to it, and the Attendance/False Negative/Absent cards render with real counts from the seeded shifts (from Tasks 5 and 7 — you should see 1 present, 1 no_show reflected). Click the toggle and confirm it flips between "Online"/"Offline". Switch hotspots to "Andheri West" and confirm the summary cards update to all zeros (no shifts there).

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/dashboard.ts src/components/admin/AttendanceSummaryCard.tsx src/components/admin/FalseNegativeRow.tsx src/components/admin/AbsentBreakdownCard.tsx src/app/admin/page.tsx
git commit -m "feat: add manager attendance dashboard home"
```

---

## Task 10: Notifications

**Files:**
- Create: `src/app/actions/notifications.ts`
- Create: `src/components/admin/NotificationBell.tsx`
- Create: `src/app/admin/notifications/page.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `createClient()` (server), `AppNotification` from Task 2.
- Produces: `listNotifications(): Promise<AppNotification[]>`, `markNotificationRead(id: string): Promise<void>`.

- [ ] **Step 1: Create `src/app/actions/notifications.ts`**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import type { AppNotification } from '@/lib/supabase/types'

export async function listNotifications(): Promise<AppNotification[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('manager_id', user.id)
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Create `src/components/admin/NotificationBell.tsx`**

```tsx
import Link from 'next/link'
import type { AppNotification } from '@/lib/supabase/types'

export default function NotificationBell({
  notifications,
}: {
  notifications: AppNotification[]
}) {
  const unreadCount = notifications.filter((n) => !n.read_at).length
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

- [ ] **Step 3: Create `src/app/admin/notifications/page.tsx`**

```tsx
import { listNotifications } from '@/app/actions/notifications'

export default async function NotificationsPage() {
  const notifications = await listNotifications()

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
              n.read_at ? 'bg-white' : 'bg-brand/10'
            }`}
          >
            <p className="font-medium">{n.message}</p>
            <p className="text-xs text-gray-500">
              {new Date(n.created_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Wire the bell into `src/app/admin/layout.tsx`**

Add the import and render `NotificationBell` in the header. Modify the header's `<nav>` block to include the bell before it:

```tsx
import { listNotifications } from '@/app/actions/notifications'
import NotificationBell from '@/components/admin/NotificationBell'
```

And inside the component, before the `return`:

```tsx
  const notifications = await listNotifications()
```

And in the JSX, change:

```tsx
        <span className="font-bold text-gray-900">{profile.full_name}</span>
        <nav className="flex gap-3 text-sm">
```

to:

```tsx
        <span className="font-bold text-gray-900">{profile.full_name}</span>
        <NotificationBell notifications={notifications} />
        <nav className="flex gap-3 text-sm">
```

- [ ] **Step 5: Verify**

With the manager and team-lead test accounts from earlier tasks: log in as the team lead at "Raheja", go to `/staff`, check in (if not already checked in — use a fresh seeded shift via `execute_sql` if Task 5/7's shift is already checked in). Log in as the manager, confirm the bell shows an unread badge, click it, confirm `/admin/notifications` lists "TL {name} has reached the hotspot".

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/notifications.ts src/components/admin/NotificationBell.tsx src/app/admin/notifications src/app/admin/layout.tsx
git commit -m "feat: add manager notification feed"
```

---

## Task 11: Staff list + shift assignment

**Files:**
- Modify: `src/app/actions/shifts.ts`
- Create: `src/components/admin/StaffTable.tsx`
- Create: `src/components/admin/ShiftAssignForm.tsx`
- Create: `src/app/admin/staff/page.tsx`
- Create: `src/app/admin/shifts/page.tsx`

**Interfaces:**
- Consumes: `createClient()` (server), `Profile`, `Shift` from Task 2; `listManagerHotspots` from Task 8.
- Produces: `listStaffForManager(): Promise<Profile[]>`, `assignShift(staffId: string, hotspotId: string, date: string, startTime: string, endTime: string): Promise<void>`.

- [ ] **Step 1: Add to `src/app/actions/shifts.ts`**

```ts
import type { Profile } from '@/lib/supabase/types'

export async function listStaffForManager(): Promise<Profile[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: hotspotRows } = await supabase
    .from('hotspot_managers')
    .select('hotspot_id')
    .eq('manager_id', user.id)
  const hotspotIds = (hotspotRows ?? []).map((r) => r.hotspot_id)
  if (hotspotIds.length === 0) return []

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .in('hotspot_id', hotspotIds)
    .in('role', ['staff', 'team_lead'])

  return data ?? []
}

export async function assignShift(
  staffId: string,
  hotspotId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('shifts').upsert(
    {
      staff_id: staffId,
      hotspot_id: hotspotId,
      date,
      start_time: startTime,
      end_time: endTime,
      assigned_by: user.id,
    },
    { onConflict: 'staff_id,date' }
  )
  if (error) throw error
}
```

- [ ] **Step 2: Create `src/components/admin/StaffTable.tsx`**

```tsx
import type { Profile } from '@/lib/supabase/types'

export default function StaffTable({ staff }: { staff: Profile[] }) {
  if (staff.length === 0) {
    return <p className="text-gray-500">No staff at your hotspots yet.</p>
  }

  return (
    <ul className="space-y-2">
      {staff.map((s) => (
        <li key={s.id} className="bg-white rounded-2xl shadow p-4 flex justify-between">
          <span className="font-semibold">{s.full_name}</span>
          <span className="text-sm text-gray-500">{s.role}</span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Create `src/components/admin/ShiftAssignForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignShift } from '@/app/actions/shifts'
import type { Hotspot, Profile } from '@/lib/supabase/types'

export default function ShiftAssignForm({
  staff,
  hotspots,
}: {
  staff: Profile[]
  hotspots: Hotspot[]
}) {
  const router = useRouter()
  const [staffId, setStaffId] = useState('')
  const [hotspotId, setHotspotId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await assignShift(staffId, hotspotId, date, startTime, endTime)
      router.refresh()
    } catch {
      setError('Could not assign shift. Please try again.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-3xl shadow-lg p-6 space-y-3"
    >
      <h2 className="font-bold text-gray-900">Assign shift</h2>
      {error && <p className="text-danger text-sm">{error}</p>}
      <select
        className="w-full border rounded-xl px-3 py-2"
        value={staffId}
        onChange={(e) => setStaffId(e.target.value)}
        required
      >
        <option value="">Select staff</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.full_name}
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
  )
}
```

- [ ] **Step 4: Create `src/app/admin/staff/page.tsx`**

```tsx
import { listStaffForManager } from '@/app/actions/shifts'
import StaffTable from '@/components/admin/StaffTable'

export default async function AdminStaffPage() {
  const staff = await listStaffForManager()
  return (
    <div className="max-w-md mx-auto">
      <StaffTable staff={staff} />
    </div>
  )
}
```

- [ ] **Step 5: Create `src/app/admin/shifts/page.tsx`**

```tsx
import { listStaffForManager } from '@/app/actions/shifts'
import { listManagerHotspots } from '@/app/actions/hotspots'
import ShiftAssignForm from '@/components/admin/ShiftAssignForm'

export default async function AdminShiftsPage() {
  const [staff, hotspots] = await Promise.all([
    listStaffForManager(),
    listManagerHotspots(),
  ])
  return (
    <div className="max-w-md mx-auto">
      <ShiftAssignForm staff={staff} hotspots={hotspots} />
    </div>
  )
}
```

- [ ] **Step 6: Verify**

Log in as the manager. Go to `/admin/staff` — confirm it lists the staff and team-lead test accounts. Go to `/admin/shifts`, assign a new shift to the staff test account for tomorrow. Confirm no error. Using `execute_sql`, run `select * from shifts order by created_at desc limit 1;` and confirm the new row matches what was submitted.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/shifts.ts src/components/admin/StaffTable.tsx src/components/admin/ShiftAssignForm.tsx src/app/admin/staff src/app/admin/shifts
git commit -m "feat: add manager staff list and shift assignment"
```

---

## Task 12: Leave approval queue

**Files:**
- Modify: `src/app/actions/leave.ts`
- Create: `src/components/admin/LeaveApprovalQueue.tsx`
- Create: `src/app/admin/leave/page.tsx`

**Interfaces:**
- Consumes: `createClient()` (server), `LeaveRequest`, `Profile` from Task 2.
- Produces: `listPendingLeaveRequests(): Promise<(LeaveRequest & { profiles: Profile })[]>`, `reviewLeave(requestId: string, status: 'approved' | 'rejected'): Promise<void>` — on approval, syncs `attendance.status` to `'on_leave'` for each covered date that has a shift.

- [ ] **Step 1: Add to `src/app/actions/leave.ts`**

```ts
import type { Profile } from '@/lib/supabase/types'

export async function listPendingLeaveRequests(): Promise<
  (LeaveRequest & { profiles: Profile })[]
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leave_requests')
    .select('*, profiles!leave_requests_staff_id_fkey(*)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return (data as (LeaveRequest & { profiles: Profile })[]) ?? []
}

export async function reviewLeave(
  requestId: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: request, error: fetchError } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', requestId)
    .single<LeaveRequest>()
  if (fetchError || !request) throw fetchError ?? new Error('Not found')

  const { error } = await supabase
    .from('leave_requests')
    .update({ status, reviewed_by: user.id })
    .eq('id', requestId)
  if (error) throw error

  if (status === 'approved') {
    await supabase
      .from('attendance')
      .update({ status: 'on_leave', marked_by: user.id })
      .eq('staff_id', request.staff_id)
      .gte('date', request.start_date)
      .lte('date', request.end_date)
  }
}
```

- [ ] **Step 2: Create `src/components/admin/LeaveApprovalQueue.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { reviewLeave } from '@/app/actions/leave'
import type { LeaveRequest, Profile } from '@/lib/supabase/types'

export default function LeaveApprovalQueue({
  requests,
}: {
  requests: (LeaveRequest & { profiles: Profile })[]
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleReview(id: string, status: 'approved' | 'rejected') {
    setBusyId(id)
    await reviewLeave(id, status)
    router.refresh()
    setBusyId(null)
  }

  if (requests.length === 0) {
    return <p className="text-gray-500">No pending leave requests.</p>
  }

  return (
    <ul className="space-y-2">
      {requests.map((r) => (
        <li key={r.id} className="bg-white rounded-2xl shadow p-4 space-y-2">
          <p className="font-semibold">{r.profiles.full_name}</p>
          <p className="text-sm text-gray-500">
            {r.start_date} → {r.end_date}
          </p>
          <p className="text-sm">{r.reason}</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleReview(r.id, 'approved')}
              disabled={busyId === r.id}
              className="flex-1 bg-success text-white rounded-xl py-1 text-sm font-semibold disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => handleReview(r.id, 'rejected')}
              disabled={busyId === r.id}
              className="flex-1 bg-danger text-white rounded-xl py-1 text-sm font-semibold disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Create `src/app/admin/leave/page.tsx`**

```tsx
import { listPendingLeaveRequests } from '@/app/actions/leave'
import LeaveApprovalQueue from '@/components/admin/LeaveApprovalQueue'

export default async function AdminLeavePage() {
  const requests = await listPendingLeaveRequests()
  return (
    <div className="max-w-md mx-auto">
      <LeaveApprovalQueue requests={requests} />
    </div>
  )
}
```

- [ ] **Step 4: Verify**

Log in as the staff test account, submit a leave request covering today's date via `/staff/leave`. Log in as the manager, go to `/admin/leave`, confirm the request appears. Click Approve. Using `execute_sql`, run `select status from attendance where staff_id = (select id from auth.users where email = 'YOUR_STAFF_TEST_EMAIL') and date = current_date;` and confirm `status = 'on_leave'`.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/leave.ts src/components/admin/LeaveApprovalQueue.tsx src/app/admin/leave
git commit -m "feat: add manager leave approval with attendance status sync"
```

---

## Task 13: Attendance report + PWA installability

**Files:**
- Modify: `src/app/actions/dashboard.ts`
- Create: `src/components/admin/AttendanceTable.tsx`
- Create: `src/app/admin/attendance/page.tsx`
- Create: `public/manifest.json`
- Create: `public/icons/icon.svg`

**Interfaces:**
- Consumes: `createClient()` (server), `Attendance`, `Profile` from Task 2.
- Produces: `listAttendanceReport(hotspotId: string, date: string): Promise<(Attendance & { profiles: Profile })[]>`.

- [ ] **Step 1: Add to `src/app/actions/dashboard.ts`**

```ts
import type { Attendance, Profile } from '@/lib/supabase/types'

export async function listAttendanceReport(
  hotspotId: string,
  date: string
): Promise<(Attendance & { profiles: Profile })[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('attendance')
    .select('*, profiles!attendance_staff_id_fkey(*)')
    .eq('hotspot_id', hotspotId)
    .eq('date', date)

  return (data as (Attendance & { profiles: Profile })[]) ?? []
}
```

- [ ] **Step 2: Create `src/components/admin/AttendanceTable.tsx`**

```tsx
import type { Attendance, Profile } from '@/lib/supabase/types'

export default function AttendanceTable({
  rows,
}: {
  rows: (Attendance & { profiles: Profile })[]
}) {
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
            <td className="p-2">{r.profiles.full_name}</td>
            <td className="p-2">{r.status}</td>
            <td className="p-2">
              {r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString() : '—'}
            </td>
            <td className="p-2">
              {r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString() : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 3: Create `src/app/admin/attendance/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { listManagerHotspots } from '@/app/actions/hotspots'
import { listAttendanceReport } from '@/app/actions/dashboard'
import HotspotSwitcher from '@/components/admin/HotspotSwitcher'
import AttendanceTable from '@/components/admin/AttendanceTable'
import type { Attendance, Hotspot, Profile } from '@/lib/supabase/types'

export default function AttendanceReportPage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [rows, setRows] = useState<(Attendance & { profiles: Profile })[]>([])

  useEffect(() => {
    listManagerHotspots().then((hs) => {
      setHotspots(hs)
      if (hs.length > 0) setSelectedId(hs[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const today = new Date().toISOString().slice(0, 10)
    listAttendanceReport(selectedId, today).then(setRows)
  }, [selectedId])

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {hotspots.length > 0 && (
        <HotspotSwitcher
          hotspots={hotspots}
          selectedId={selectedId}
          onChange={setSelectedId}
        />
      )}
      <AttendanceTable rows={rows} />
    </div>
  )
}
```

- [ ] **Step 4: Create `public/icons/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <rect width="192" height="192" rx="32" fill="#4C5FEA"/>
  <text x="96" y="124" font-size="96" fill="#ffffff" text-anchor="middle" font-family="sans-serif" font-weight="bold">S</text>
</svg>
```

- [ ] **Step 5: Create `public/manifest.json`**

```json
{
  "name": "Snabbit Salon OG",
  "short_name": "Salon OG",
  "start_url": "/staff",
  "display": "standalone",
  "background_color": "#FBF2DD",
  "theme_color": "#4C5FEA",
  "icons": [
    { "src": "/icons/icon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

- [ ] **Step 6: Verify**

Run `npm run build && npm run start`. Open `http://localhost:3000` in Chrome. Open DevTools → Application → Manifest and confirm it loads with no errors and shows the "S" icon. Log in as the manager, go to `/admin/attendance`, confirm the table shows the seeded attendance rows with correct statuses and check-in/out times. Confirm Chrome's install icon appears in the address bar (or "Add to Home Screen" works on a mobile browser).

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/dashboard.ts src/components/admin/AttendanceTable.tsx src/app/admin/attendance public/manifest.json public/icons
git commit -m "feat: add attendance report table and PWA manifest"
```
