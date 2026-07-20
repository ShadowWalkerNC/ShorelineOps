import { pool } from './pool'

const migrations: { name: string; sql: string }[] = [
  {
    name: '001_initial_schema',
    sql: `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS users (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name        TEXT NOT NULL,
        email       TEXT UNIQUE NOT NULL,
        password    TEXT NOT NULL,
        role        TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'readonly')),
        mfa_enabled BOOLEAN NOT NULL DEFAULT false,
        active      BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

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

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

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

      CREATE INDEX IF NOT EXISTS idx_audit_log_user_id      ON audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at   ON audit_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_residents_status        ON residents(status);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id  ON refresh_tokens(user_id);
    `,
  },
  {
    name: '002_residents_search_index',
    sql: `
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS idx_residents_name_trgm
        ON residents USING GIN (name gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS idx_residents_room_trgm
        ON residents USING GIN (room gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS idx_residents_diet_type_trgm
        ON residents USING GIN (diet_type gin_trgm_ops);
    `,
  },
  {
    name: '003_menu_and_production',
    sql: `
      CREATE TABLE IF NOT EXISTS menu_items (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name             TEXT NOT NULL,
        notes            TEXT NOT NULL DEFAULT '',
        texture_modified BOOLEAN NOT NULL DEFAULT false,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

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

      INSERT INTO system_settings DEFAULT VALUES
      ON CONFLICT (id) DO NOTHING;

      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
    `,
  },
  {
    name: '004_timecard_punches',
    sql: `
      CREATE TABLE IF NOT EXISTS timecard_punches (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        badge_id     TEXT NOT NULL,
        operation    TEXT NOT NULL,
        kiosk_id     TEXT DEFAULT 'Default',
        punched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_timecard_punches_badge_id ON timecard_punches(badge_id);
      CREATE INDEX IF NOT EXISTS idx_timecard_punches_punched_at ON timecard_punches(punched_at DESC);
    `,
  },
  {
    name: '005_kitchen_orders',
    sql: `
      ALTER TABLE residents ADD COLUMN IF NOT EXISTS standing_modifiers TEXT DEFAULT '';
      ALTER TABLE residents ADD COLUMN IF NOT EXISTS has_standing_alternative INTEGER DEFAULT 0;
      ALTER TABLE residents ADD COLUMN IF NOT EXISTS alternative_description TEXT DEFAULT '';

      CREATE TABLE IF NOT EXISTS meal_options (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        week_start_date TEXT NOT NULL,
        day_of_week     TEXT NOT NULL,
        meal_type       TEXT NOT NULL,
        choice_number   INTEGER NOT NULL,
        dish_name       TEXT NOT NULL,
        UNIQUE(week_start_date, day_of_week, meal_type, choice_number)
      );

      CREATE TABLE IF NOT EXISTS weekly_orders (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        resident_id     UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
        week_start_date TEXT NOT NULL,
        day_of_week     TEXT NOT NULL,
        meal_type       TEXT NOT NULL,
        choice_selected INTEGER,
        modifier_text   TEXT DEFAULT '',
        is_alternative  INTEGER DEFAULT 0,
        is_declined     INTEGER DEFAULT 0,
        UNIQUE(resident_id, week_start_date, day_of_week, meal_type)
      );
    `,
  },
]

export async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  for (const { name, sql } of migrations) {
    const { rows } = await pool.query(
      'SELECT 1 FROM _migrations WHERE name = $1', [name]
    )
    if (rows.length > 0) {
      console.log(`[migrate] Skipping ${name} (already applied)`)
      continue
    }
    console.log(`[migrate] Applying ${name}...`)
    await pool.query(sql)
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [name])
    console.log(`[migrate] Applied ${name}`)
  }

  console.log('[migrate] Done.')
}

if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[migrate] Error:', err)
      process.exit(1)
    })
}
