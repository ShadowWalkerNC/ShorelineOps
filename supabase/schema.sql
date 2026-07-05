-- ============================================================
-- SHORELINE — Supabase Schema
-- Paste this entire file into:
-- Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── residents ────────────────────────────────────────────────
create table if not exists public.residents (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  name              text not null,
  room              text not null,
  status            text not null default 'Active',
  diet_type         text,
  texture           text,
  portion_size      text,
  allergies         text[],
  beverages         text[],
  serving_location  text,
  table_assignment  text,
  ensure_per_day    integer default 0,
  birthday_month    text,
  birthday_day      integer,
  likes             text,
  dislikes          text,
  special_instructions text,
  notes             text
);

-- ── inventory ────────────────────────────────────────────────
create table if not exists public.inventory (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  item        text not null,
  category    text,
  quantity    numeric not null default 0,
  unit        text,
  par_level   numeric default 0,
  notes       text
);

-- ── menu_items ───────────────────────────────────────────────
create table if not exists public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  category    text
);

-- ── menu_weeks ───────────────────────────────────────────────
-- days is a JSONB column storing the full week structure:
-- { Monday: { lunchOpt1Meat: { itemIds: [...] }, ... }, ... }
create table if not exists public.menu_weeks (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  label       text not null,
  active      boolean not null default false,
  days        jsonb not null default '{}'::jsonb
);

-- Only one week can be active at a time
create unique index if not exists menu_weeks_active_unique
  on public.menu_weeks (active)
  where active = true;

-- ── budget_periods ───────────────────────────────────────────
create table if not exists public.budget_periods (
  id                            uuid primary key default gen_random_uuid(),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  label                         text not null,
  month                         integer not null check (month between 1 and 12),
  year                          integer not null,
  total_budget                  numeric not null default 0,
  resident_count                integer not null default 0,
  budget_per_resident_per_day   numeric not null default 0,
  unique (month, year)
);

-- ── budget_entries ───────────────────────────────────────────
create table if not exists public.budget_entries (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  period_id   uuid not null references public.budget_periods(id) on delete cascade,
  date        date not null,
  vendor      text,
  description text not null,
  amount      numeric not null,
  category    text
);

-- ── time_punches ─────────────────────────────────────────────
create table if not exists public.time_punches (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  badge_id    text not null,
  operation   text not null check (operation in ('In', 'Out')),
  kiosk_id    text not null default 'Main Terminal',
  punched_at  timestamptz not null default now(),
  notes       text
);

create index if not exists time_punches_badge_id_idx on public.time_punches (badge_id);
create index if not exists time_punches_punched_at_idx on public.time_punches (punched_at desc);

-- ── production_sheets ────────────────────────────────────────
create table if not exists public.production_sheets (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  label         text not null,
  meal          text not null,
  date          date not null,
  items         jsonb not null default '[]'::jsonb,
  signed_off_at timestamptz,
  signed_off_by text
);

create index if not exists production_sheets_date_idx on public.production_sheets (date desc);

-- ── communications ───────────────────────────────────────────
-- entries: JSONB array of ThreadEntry objects
-- distributed_to: array of staff profile IDs
create table if not exists public.communications (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  subject          text not null,
  type             text not null default 'general',
  status           text not null default 'Draft',
  created_by_id    text,
  entries          jsonb not null default '[]'::jsonb,
  distributed_to   text[] not null default '{}',
  distributed_at   timestamptz,
  was_printed      boolean not null default false,
  printed_at       timestamptz,
  printed_by_id    text
);

-- ── staff_profiles ───────────────────────────────────────────
-- auth_user_id links to auth.users.id (Supabase Auth)
-- certifications: JSONB array of Certification objects
-- emergency_contact: JSONB object { name, relationship, phone }
-- manager_notes: visible to manager/admin only — enforce via RLS
create table if not exists public.staff_profiles (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  auth_user_id      uuid unique references auth.users(id) on delete set null,
  employee_number   text unique,
  first_name        text not null,
  last_name         text not null,
  preferred_name    text,
  role              text not null default 'staff',
  department        text not null default 'Dietary',
  position          text,
  hire_date         date,
  status            text not null default 'Active',
  full_time         boolean not null default true,
  phone             text,
  email             text,
  emergency_contact jsonb,
  certifications    jsonb not null default '[]'::jsonb,
  manager_notes     text
);

create index if not exists staff_profiles_auth_user_id_idx on public.staff_profiles (auth_user_id);
create index if not exists staff_profiles_last_name_idx    on public.staff_profiles (last_name);
create index if not exists staff_profiles_status_idx       on public.staff_profiles (status);

-- ── call_outs ────────────────────────────────────────────────
-- staff_id:     FK to staff_profiles — the person who called out
-- filed_by_id:  FK to staff_profiles — the manager who filed it
-- covered_by_id: FK to staff_profiles — who covered the shift
-- SECURITY: a staff member must NEVER see their own call-out rows.
--   The store filters in JS; enforce at RLS level below as well.
create table if not exists public.call_outs (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  staff_id            uuid not null references public.staff_profiles(id) on delete cascade,
  filed_by_id         uuid not null references public.staff_profiles(id),
  date                date not null,
  shift               text not null check (shift in ('Morning','Evening','All Day','Split')),
  reason              text not null check (reason in (
                        'Sick','Personal','Family Emergency',
                        'No Call No Show','Approved Leave',
                        'Bereavement','Medical Appointment','Other'
                      )),
  notes               text,
  follow_up_required  boolean not null default false,
  follow_up_notes     text,
  was_covered         boolean not null default false,
  covered_by_id       uuid references public.staff_profiles(id)
);

create index if not exists call_outs_staff_id_idx  on public.call_outs (staff_id);
create index if not exists call_outs_date_idx      on public.call_outs (date desc);
create index if not exists call_outs_filed_by_idx  on public.call_outs (filed_by_id);

-- ── updated_at auto-trigger ───────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ declare
  t text;
begin
  foreach t in array array[
    'residents','inventory','menu_weeks','budget_periods',
    'production_sheets','communications','staff_profiles','call_outs'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;

-- ── Row Level Security ────────────────────────────────────────
-- RLS enabled on all tables.
-- staff_profiles: all authenticated users can read profiles
--   (needed for name resolution across the app).
--   Only manager/admin should write — enforce via app role checks
--   and tighten these policies when Supabase Auth roles are wired.
-- call_outs: authenticated users can read/write EXCEPT a staff
--   member must not see their own records. Add a per-row policy
--   here once auth.uid() → staff_profiles.auth_user_id is live:
--     using (staff_id != (select id from staff_profiles where auth_user_id = auth.uid()))
--   For now, the JS store layer enforces this filter.
alter table public.residents         enable row level security;
alter table public.inventory         enable row level security;
alter table public.menu_items        enable row level security;
alter table public.menu_weeks        enable row level security;
alter table public.budget_periods    enable row level security;
alter table public.budget_entries    enable row level security;
alter table public.time_punches      enable row level security;
alter table public.production_sheets enable row level security;
alter table public.communications    enable row level security;
alter table public.staff_profiles    enable row level security;
alter table public.call_outs         enable row level security;

-- Authenticated users can read and write all tables
-- Tighten call_outs and staff_profiles policies before go-live
do $$ declare
  t text;
begin
  foreach t in array array[
    'residents','inventory','menu_items','menu_weeks',
    'budget_periods','budget_entries','time_punches',
    'production_sheets','communications',
    'staff_profiles','call_outs'
  ] loop
    execute format(
      'create policy "auth_all" on public.%I
       for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
