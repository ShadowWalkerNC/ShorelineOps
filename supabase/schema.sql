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

-- ── profiles (auth role source of truth for RLS) ─────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  role       text not null default 'staff'
             check (role in (
               'admin','manager','frontdesk','dietary',
               'activities','server','staff','readonly'
             )),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ── Row Level Security ────────────────────────────────────────
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

-- Helper: current user's app role from profiles
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.role_at_least(min_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case public.current_app_role()
        when 'admin' then 7
        when 'manager' then 6
        when 'frontdesk' then 5
        when 'dietary' then 4
        when 'activities' then 3
        when 'server' then 2
        when 'staff' then 1
        when 'readonly' then 0
        else -1
      end
    ) >= (
      case min_role
        when 'admin' then 7
        when 'manager' then 6
        when 'frontdesk' then 5
        when 'dietary' then 4
        when 'activities' then 3
        when 'server' then 2
        when 'staff' then 1
        when 'readonly' then 0
        else 99
      end
    ),
    false
  )
$$;

-- Drop legacy permissive policies if present
do $$ declare
  t text;
  p text;
begin
  foreach t in array array[
    'residents','inventory','menu_items','menu_weeks',
    'budget_periods','budget_entries','time_punches',
    'production_sheets','communications',
    'staff_profiles','call_outs','profiles'
  ] loop
    foreach p in array array['auth_all','authenticated_select'] loop
      execute format('drop policy if exists %I on public.%I', p, t);
    end loop;
  end loop;
end $$;

-- profiles: users read self; managers+ manage all
create policy "profiles_select_self_or_manager"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.role_at_least('manager'));

create policy "profiles_update_self"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles_admin_write"
  on public.profiles for all to authenticated
  using (public.role_at_least('admin'))
  with check (public.role_at_least('admin'));

-- PHI / operational tables: authenticated read for readonly+; write for staff+
create policy "residents_select" on public.residents
  for select to authenticated using (public.role_at_least('readonly'));
create policy "residents_write" on public.residents
  for all to authenticated
  using (public.role_at_least('staff'))
  with check (public.role_at_least('staff'));

create policy "inventory_select" on public.inventory
  for select to authenticated using (public.role_at_least('readonly'));
create policy "inventory_write" on public.inventory
  for all to authenticated
  using (public.role_at_least('dietary'))
  with check (public.role_at_least('dietary'));

create policy "menu_items_select" on public.menu_items
  for select to authenticated using (public.role_at_least('readonly'));
create policy "menu_items_write" on public.menu_items
  for all to authenticated
  using (public.role_at_least('staff'))
  with check (public.role_at_least('staff'));

create policy "menu_weeks_select" on public.menu_weeks
  for select to authenticated using (public.role_at_least('readonly'));
create policy "menu_weeks_write" on public.menu_weeks
  for all to authenticated
  using (public.role_at_least('staff'))
  with check (public.role_at_least('staff'));

create policy "budget_periods_select" on public.budget_periods
  for select to authenticated using (public.role_at_least('manager'));
create policy "budget_periods_write" on public.budget_periods
  for all to authenticated
  using (public.role_at_least('manager'))
  with check (public.role_at_least('manager'));

create policy "budget_entries_select" on public.budget_entries
  for select to authenticated using (public.role_at_least('manager'));
create policy "budget_entries_write" on public.budget_entries
  for all to authenticated
  using (public.role_at_least('manager'))
  with check (public.role_at_least('manager'));

create policy "time_punches_select" on public.time_punches
  for select to authenticated using (public.role_at_least('staff'));
create policy "time_punches_write" on public.time_punches
  for insert to authenticated
  with check (public.role_at_least('staff'));

create policy "production_sheets_select" on public.production_sheets
  for select to authenticated using (public.role_at_least('readonly'));
create policy "production_sheets_write" on public.production_sheets
  for all to authenticated
  using (public.role_at_least('dietary'))
  with check (public.role_at_least('dietary'));

create policy "communications_select" on public.communications
  for select to authenticated using (public.role_at_least('readonly'));
create policy "communications_write" on public.communications
  for all to authenticated
  using (public.role_at_least('staff'))
  with check (public.role_at_least('staff'));

-- staff_profiles: all authenticated can read; manager+ write
create policy "staff_profiles_select" on public.staff_profiles
  for select to authenticated using (public.role_at_least('readonly'));
create policy "staff_profiles_write" on public.staff_profiles
  for all to authenticated
  using (public.role_at_least('manager'))
  with check (public.role_at_least('manager'));

-- call_outs: never visible to the subject staff member; managers file/read others
create policy "call_outs_select" on public.call_outs
  for select to authenticated
  using (
    public.role_at_least('manager')
    and staff_id <> (
      select id from public.staff_profiles where auth_user_id = auth.uid() limit 1
    )
  );
create policy "call_outs_write" on public.call_outs
  for all to authenticated
  using (public.role_at_least('manager'))
  with check (public.role_at_least('manager'));

