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
  allergies         text[],
  serving_location  text,
  ensure_per_day    integer default 0,
  birthday_month    text,
  birthday_day      integer,
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
create table if not exists public.communications (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  subject     text not null,
  body        text not null default '',
  status      text not null default 'Draft',
  author      text,
  recipients  text[],
  attachments jsonb
);

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
    'production_sheets','communications'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;

-- ── Row Level Security ────────────────────────────────────────
-- Enable RLS on all tables. Currently allows all authenticated
-- users full access. Tighten per-role policies here as needed.
alter table public.residents         enable row level security;
alter table public.inventory         enable row level security;
alter table public.menu_items        enable row level security;
alter table public.menu_weeks        enable row level security;
alter table public.budget_periods    enable row level security;
alter table public.budget_entries    enable row level security;
alter table public.time_punches      enable row level security;
alter table public.production_sheets enable row level security;
alter table public.communications    enable row level security;

-- Authenticated users can read and write all tables
do $$ declare
  t text;
begin
  foreach t in array array[
    'residents','inventory','menu_items','menu_weeks',
    'budget_periods','budget_entries','time_punches',
    'production_sheets','communications'
  ] loop
    execute format(
      'create policy "auth_all" on public.%I
       for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
