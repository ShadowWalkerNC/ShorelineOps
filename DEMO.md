# Shoreline — Demo Mode & Production Setup Guide

> **Current deployment:** Static demo hosted on Render.  
> **Auth:** Hardcoded local credentials (no backend required).  
> **Data:** All resident, menu, and production data is static/in-memory and resets on page refresh.

---

## Demo Credentials

Three accounts are available on the login screen. Click any row to auto-fill.

| Role      | Email                        | Password        | Access Level                          |
|-----------|------------------------------|-----------------|---------------------------------------|
| Admin     | admin@shoreline.demo         | Admin1234!      | Full access — all features + settings |
| Staff     | staff@shoreline.demo         | Staff1234!      | Residents, menu, production, recipes  |
| Read-Only | readonly@shoreline.demo      | Readonly1234!   | View-only, no edits                   |

---

## What "Demo Mode" Means

- Login is validated locally — no network call is made.
- Resident and menu records exist only in React state; they reset on refresh.
- Audit logging calls are no-ops.
- Session timeout is disabled.
- The `src/api/` folder still exists but is **not called** in demo mode.

---

## Migrating to Production with Supabase

This section documents the intended production architecture so the demo can be
upgraded to a live system without a full rewrite.

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **anon public key** from Project Settings → API.
3. Add them to your Render environment variables:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### 2. Install the Supabase Client

```bash
npm install @supabase/supabase-js
```

Create `src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### 3. Replace Demo Auth with Supabase Auth

Replace `src/security/AuthContext.tsx` with a Supabase-backed version:

```ts
// In login():
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
if (error) throw error

// In logout():
await supabase.auth.signOut()

// Session restore on mount:
const { data: { session } } = await supabase.auth.getSession()
```

User roles should be stored in a `profiles` table in Supabase and fetched
after login to populate the `role` field on `AuthUser`.

### 4. Database Schema

Run the following migrations in Supabase's SQL editor or via the Supabase CLI.

#### `profiles` table (extends Supabase Auth users)
```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('admin', 'staff', 'readonly')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);
```

#### `residents` table
```sql
create table residents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  room text not null,
  status text not null default 'Active'
    check (status in ('Active', 'Hospital', 'LOA', 'Passed Away')),
  diet_type text not null default 'Regular',
  texture text not null default 'Regular',
  portion_size text not null default 'Regular',
  ensure_per_day integer not null default 0,
  allergies text[] not null default '{}',
  beverages text[] not null default '{}',
  birthday_month text,
  birthday_day integer,
  serving_location text not null default 'Dining Room',
  table_assignment text not null default '',
  likes text not null default '',
  dislikes text not null default '',
  special_instructions text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table residents enable row level security;
create policy "Authenticated users can read residents"
  on residents for select to authenticated using (true);
create policy "Staff and admin can modify residents"
  on residents for all to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );
```

#### `menu_weeks` and `menu_items` tables
```sql
create table menu_weeks (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  active boolean not null default false,
  created_at timestamptz default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  week_id uuid references menu_weeks(id) on delete cascade,
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'dinner')),
  day_of_week integer not null check (day_of_week between 0 and 6),
  option_a text,
  option_b text,
  created_at timestamptz default now()
);

alter table menu_weeks enable row level security;
alter table menu_items  enable row level security;
create policy "Authenticated read" on menu_weeks for select to authenticated using (true);
create policy "Authenticated read" on menu_items  for select to authenticated using (true);
```

### 5. Replace API Layer

The `src/api/` files already use an Axios client pointed at `VITE_API_URL`.
For Supabase, replace each file to use the Supabase JS client directly instead
of Axios. Example for `src/api/residents.ts`:

```ts
import { supabase } from '../lib/supabase'
import type { Resident } from '../types'

export const residentsApi = {
  getAll: async () => {
    const { data, error } = await supabase.from('residents').select('*').order('name')
    if (error) throw error
    return data as Resident[]
  },
  create: async (r: Omit<Resident, 'id'>) => {
    const { data, error } = await supabase.from('residents').insert(r).select().single()
    if (error) throw error
    return data as Resident
  },
  update: async (id: string, r: Partial<Resident>) => {
    const { data, error } = await supabase.from('residents').update(r).eq('id', id).select().single()
    if (error) throw error
    return data as Resident
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('residents').delete().eq('id', id)
    if (error) throw error
  },
}
```

Repeat the same pattern for `menu.ts`, `recipes.ts`, `production.ts`, and `admin.ts`.

### 6. Render Environment Variables

In your Render dashboard → Environment:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

Remove `VITE_API_URL` — it is no longer needed when using the Supabase JS client directly.

### 7. Remove Demo Code

Once the above is in place:
- Delete the `DEMO_USERS` array from `AuthContext.tsx`.
- Remove the demo credentials panel from `LoginPage.tsx`.
- Delete this file (`DEMO.md`) or archive it.

---

## File Map — What to Change for Production

| File | Demo behaviour | Production replacement |
|------|---------------|------------------------|
| `src/security/AuthContext.tsx` | Local credential check | Supabase `signInWithPassword` + profiles table |
| `src/api/client.ts` | Axios to `VITE_API_URL` | Replace with Supabase JS client |
| `src/api/auth.ts` | REST calls | Remove — handled by Supabase Auth SDK |
| `src/api/residents.ts` | Axios CRUD | Supabase `from('residents')` |
| `src/api/menu.ts` | Axios CRUD | Supabase `from('menu_weeks')` / `from('menu_items')` |
| `src/api/recipes.ts` | Axios CRUD | Supabase `from('recipes')` |
| `src/api/production.ts` | Axios CRUD | Supabase `from(...)` |
| `src/api/admin.ts` | Axios CRUD | Supabase `from('profiles')` (admin-only RLS) |
| `src/security/tokenManager.ts` | JWT in sessionStorage | Managed automatically by Supabase Auth |
| `src/security/auditLog.ts` | console.log no-op | Insert to a `audit_log` table in Supabase |

---

*Shoreline is designed to be production-ready with a Supabase backend.
This demo deployment exists solely for review and demonstration purposes.*
