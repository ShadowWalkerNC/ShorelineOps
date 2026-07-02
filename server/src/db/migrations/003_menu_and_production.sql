-- Migration 003: Menu items, menu weeks, production sheets, system settings
-- Also adds last_login_at to users for the admin panel

-- ── Menu item library ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  notes            TEXT NOT NULL DEFAULT '',
  texture_modified BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Weekly cycle menus ────────────────────────────────────────────────────────
-- days stores the full Record<DayOfWeek, DayMenu> JSON blob.
-- We keep it denormalised for simplicity; it is re-validated on write.
CREATE TABLE IF NOT EXISTS menu_weeks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  effective_from DATE,
  days           JSONB NOT NULL DEFAULT '{}',
  active         BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_weeks_active ON menu_weeks(active);

-- ── Production sheets ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_sheets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_week_id  UUID NOT NULL REFERENCES menu_weeks(id) ON DELETE CASCADE,
  day           TEXT NOT NULL,
  slot          TEXT NOT NULL,
  rows          JSONB NOT NULL DEFAULT '[]',
  counts        JSONB NOT NULL DEFAULT '{}',
  signed_off_by TEXT,
  signed_off_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (menu_week_id, day, slot)
);

CREATE INDEX IF NOT EXISTS idx_production_sheets_week ON production_sheets(menu_week_id);

-- ── System settings (single-row table) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  id                       INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  facility_name            TEXT NOT NULL DEFAULT 'Shoreline',
  timezone                 TEXT NOT NULL DEFAULT 'America/New_York',
  session_timeout_minutes  INTEGER NOT NULL DEFAULT 30,
  mfa_required             BOOLEAN NOT NULL DEFAULT false,
  allow_readonly_export    BOOLEAN NOT NULL DEFAULT true,
  maintenance_mode         BOOLEAN NOT NULL DEFAULT false,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the single settings row if it doesn't exist yet
INSERT INTO system_settings DEFAULT VALUES
ON CONFLICT (id) DO NOTHING;

-- ── Add last_login_at to users ────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
