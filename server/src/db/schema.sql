-- Shoreline v5 PostgreSQL Schema
-- Run once to initialise the database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (staff accounts)
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,  -- bcrypt hash
  role        TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'readonly')),
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Residents (PHI — treat with care)
CREATE TABLE IF NOT EXISTS residents (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT NOT NULL,
  room                 TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'Active',
  diet_type            TEXT NOT NULL DEFAULT 'Regular',
  texture              TEXT NOT NULL DEFAULT 'Regular',
  portion_size         TEXT NOT NULL DEFAULT 'Regular',
  ensure_per_day       INTEGER NOT NULL DEFAULT 0,
  allergies            TEXT[] NOT NULL DEFAULT '{}',
  beverages            TEXT[] NOT NULL DEFAULT '{}',
  birthday_month       TEXT,
  birthday_day         INTEGER,
  serving_location     TEXT NOT NULL DEFAULT 'Dining Room',
  table_assignment     TEXT NOT NULL DEFAULT '',
  likes                TEXT NOT NULL DEFAULT '',
  dislikes             TEXT NOT NULL DEFAULT '',
  special_instructions TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refresh tokens (for JWT rotation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log (append-only — HIPAA §164.312(b))
CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action        TEXT NOT NULL,
  user_id       UUID REFERENCES users(id),
  resource_id   TEXT,
  resource_type TEXT,
  outcome       TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  ip_address    TEXT,
  user_agent    TEXT,
  details       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_residents_status ON residents(status);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
