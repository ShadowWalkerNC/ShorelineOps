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
        role        TEXT NOT NULL CHECK (role IN (
          'admin', 'manager', 'frontdesk', 'dietary',
          'activities', 'server', 'staff', 'readonly'
        )),
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
  {
    name: '006_facility_config_and_hipaa',
    sql: `
      CREATE TABLE IF NOT EXISTS facility_config (
        id                       TEXT PRIMARY KEY DEFAULT 'default',
        facility_name            TEXT NOT NULL,
        npi_license              TEXT DEFAULT '',
        address                  TEXT DEFAULT '',
        primary_contact_email    TEXT NOT NULL,
        facility_type            TEXT NOT NULL DEFAULT 'Assisted Living',
        wings                    TEXT DEFAULT '["West Wing","Memory Care","Rehab Unit"]',
        dining_rooms             TEXT DEFAULT '["Main Dining Room","Tray Delivery"]',
        is_initialized           BOOLEAN NOT NULL DEFAULT false,
        baa_accepted_at          TIMESTAMPTZ,
        baa_signee_name          TEXT DEFAULT '',
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    name: '007_audit_log_immutability',
    sql: `
      CREATE OR REPLACE FUNCTION prevent_audit_log_alteration()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'audit_log table is append-only for HIPAA/SOC2 compliance';
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_prevent_audit_log_update ON audit_log;
      CREATE TRIGGER trg_prevent_audit_log_update
      BEFORE UPDATE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_alteration();

      DROP TRIGGER IF EXISTS trg_prevent_audit_log_delete ON audit_log;
      CREATE TRIGGER trg_prevent_audit_log_delete
      BEFORE DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_alteration();
    `,
  },
  {
    name: '008_expand_user_roles',
    sql: `
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN (
          'admin', 'manager', 'dietitian', 'frontdesk', 'dietary',
          'distributor', 'activities', 'server', 'staff', 'readonly'
        ));
    `,
  },
  {
    name: '009_mfa_secret',
    sql: `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS mfa_secret TEXT;

      COMMENT ON COLUMN users.mfa_secret IS 'Base32 TOTP secret; null when MFA not enrolled';
    `,
  },
  {
    name: '010_purchasing_schema',
    sql: `
      -- Vendors (distributor-agnostic; Dennis Food Service is the first example)
      CREATE TABLE IF NOT EXISTS vendors (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name        TEXT NOT NULL,
        code        TEXT UNIQUE NOT NULL,
        phone       TEXT DEFAULT '',
        email       TEXT DEFAULT '',
        website     TEXT DEFAULT '',
        notes       TEXT DEFAULT '',
        active      BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Vendor catalog items (broadline SKUs, pack sizes, UOMs)
      CREATE TABLE IF NOT EXISTS vendor_items (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        vendor_sku      TEXT NOT NULL,
        name            TEXT NOT NULL,
        brand           TEXT DEFAULT '',
        pack_size       TEXT DEFAULT '',
        uom             TEXT DEFAULT 'case',
        category        TEXT DEFAULT '',
        unit_cost       NUMERIC(10,4) DEFAULT 0,
        active          BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(vendor_id, vendor_sku)
      );

      -- Maps facility ingredients to preferred vendor items (many-to-one preferred)
      CREATE TABLE IF NOT EXISTS facility_item_maps (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        facility_id         UUID REFERENCES facilities(id) ON DELETE CASCADE,
        ingredient_name     TEXT NOT NULL,
        vendor_item_id      UUID NOT NULL REFERENCES vendor_items(id) ON DELETE CASCADE,
        preferred           BOOLEAN NOT NULL DEFAULT true,
        conversion_factor   NUMERIC(10,4) DEFAULT 1.0,
        notes               TEXT DEFAULT '',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Standing order guide entries: par levels and on-hand counts per vendor item
      CREATE TABLE IF NOT EXISTS order_guides (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        facility_id     UUID REFERENCES facilities(id) ON DELETE CASCADE,
        vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        vendor_item_id  UUID NOT NULL REFERENCES vendor_items(id) ON DELETE CASCADE,
        par_level       NUMERIC(10,2) NOT NULL DEFAULT 0,
        on_hand         NUMERIC(10,2) NOT NULL DEFAULT 0,
        avg_usage       NUMERIC(10,2),
        sort_group      TEXT DEFAULT '',
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(facility_id, vendor_item_id)
      );

      -- Purchase orders (header)
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        facility_id     UUID REFERENCES facilities(id) ON DELETE CASCADE,
        vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','received','cancelled')),
        order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
        expected_date   DATE,
        notes           TEXT DEFAULT '',
        created_by      UUID REFERENCES users(id),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Purchase order line items
      CREATE TABLE IF NOT EXISTS purchase_order_lines (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        purchase_order_id   UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        vendor_item_id      UUID NOT NULL REFERENCES vendor_items(id) ON DELETE CASCADE,
        qty_ordered         NUMERIC(10,2) NOT NULL DEFAULT 0,
        qty_received        NUMERIC(10,2),
        unit_cost           NUMERIC(10,4),
        notes               TEXT DEFAULT '',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Seed Dennis Food Service as first vendor
      INSERT INTO vendors (name, code, website, notes)
      VALUES (
        'Dennis Food Service',
        'dennis',
        'https://dennisfoodservice.com',
        'Broadline distributor — primary V1 reference. Supports online ordering and order guide maintenance.'
      )
      ON CONFLICT (code) DO NOTHING;
    `,
  },
  {
    name: '011_reporting_tables',
    sql: `
      -- Substitution log: tracks when a menu item is swapped for a resident
      CREATE TABLE IF NOT EXISTS substitution_log (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        facility_id     UUID REFERENCES facilities(id) ON DELETE CASCADE,
        resident_id     UUID REFERENCES residents(id) ON DELETE SET NULL,
        meal_date       DATE NOT NULL,
        meal_type       TEXT NOT NULL DEFAULT '',
        original_item   TEXT NOT NULL DEFAULT '',
        substitute_item TEXT NOT NULL DEFAULT '',
        reason          TEXT DEFAULT '',
        logged_by       UUID REFERENCES users(id),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Daily cost snapshot (optional manual entry; reports can also be computed live)
      CREATE TABLE IF NOT EXISTS daily_cost_log (
        id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        facility_id           UUID REFERENCES facilities(id) ON DELETE CASCADE,
        log_date              DATE NOT NULL,
        resident_count        INT NOT NULL DEFAULT 0,
        food_cost             NUMERIC(10,2) NOT NULL DEFAULT 0,
        cost_per_resident_day NUMERIC(10,4) GENERATED ALWAYS AS (
          CASE WHEN resident_count > 0 THEN food_cost / resident_count ELSE 0 END
        ) STORED,
        notes                 TEXT DEFAULT '',
        created_by            UUID REFERENCES users(id),
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(facility_id, log_date)
      );
    `,
  },
  {
    name: '012_recipes_and_mrp_schema',
    sql: `
      -- Master Recipes Table
      CREATE TABLE IF NOT EXISTS recipes (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name              TEXT NOT NULL,
        category          TEXT NOT NULL DEFAULT 'Other',
        base_servings     NUMERIC(10,2) NOT NULL DEFAULT 10,
        prep_time_mins    INTEGER DEFAULT 15,
        cook_time_mins    INTEGER DEFAULT 30,
        haccp_temp_f      NUMERIC(5,1) DEFAULT 165.0,
        iddsi_level       INTEGER DEFAULT 7,
        allergens         TEXT[] DEFAULT '{}',
        ingredients       JSONB NOT NULL DEFAULT '[]',
        steps             JSONB NOT NULL DEFAULT '[]',
        notes             TEXT DEFAULT '',
        cost_per_serving  NUMERIC(10,4) DEFAULT 0,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);

      -- Recipe Nutritional Breakdown
      CREATE TABLE IF NOT EXISTS recipe_nutrients (
        recipe_id         UUID PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
        calories          NUMERIC(8,2) NOT NULL DEFAULT 0,
        protein_g         NUMERIC(8,2) NOT NULL DEFAULT 0,
        carbs_g           NUMERIC(8,2) NOT NULL DEFAULT 0,
        fat_g             NUMERIC(8,2) NOT NULL DEFAULT 0,
        sat_fat_g         NUMERIC(8,2) NOT NULL DEFAULT 0,
        sodium_mg         NUMERIC(8,2) NOT NULL DEFAULT 0,
        potassium_mg      NUMERIC(8,2) NOT NULL DEFAULT 0,
        phosphorus_mg     NUMERIC(8,2) NOT NULL DEFAULT 0,
        fiber_g           NUMERIC(8,2) NOT NULL DEFAULT 0,
        sugar_g           NUMERIC(8,2) NOT NULL DEFAULT 0,
        calculated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Menu Item to Recipe Mapping
      CREATE TABLE IF NOT EXISTS menu_item_recipes (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        menu_item_id        UUID REFERENCES menu_items(id) ON DELETE CASCADE,
        recipe_id           UUID REFERENCES recipes(id) ON DELETE CASCADE,
        portion_multiplier  NUMERIC(6,2) NOT NULL DEFAULT 1.0,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    name: '013_resident_profile_versions',
    sql: `
      ALTER TABLE residents ADD COLUMN IF NOT EXISTS profile_version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE residents ADD COLUMN IF NOT EXISTS is_npo BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE residents ADD COLUMN IF NOT EXISTS npo_reason TEXT NOT NULL DEFAULT '';
      ALTER TABLE residents ADD COLUMN IF NOT EXISTS fluid_restriction_ml INTEGER DEFAULT NULL;

      CREATE TABLE IF NOT EXISTS resident_profile_history (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        resident_id      UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
        profile_version  INTEGER NOT NULL,
        diet_type        TEXT NOT NULL,
        texture          TEXT NOT NULL,
        is_npo           BOOLEAN NOT NULL DEFAULT false,
        allergies        TEXT[] NOT NULL DEFAULT '{}',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_profile_hist_res ON resident_profile_history(resident_id, profile_version);
    `,
  },
  {
    name: '014_invoices_and_credit_memos',
    sql: `
      CREATE TABLE IF NOT EXISTS distributor_invoices (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        vendor_id        TEXT NOT NULL,
        vendor_name      TEXT NOT NULL,
        invoice_number   TEXT NOT NULL UNIQUE,
        invoice_date     DATE NOT NULL,
        po_reference     TEXT,
        total_amount     NUMERIC(10,2) NOT NULL,
        match_status     TEXT NOT NULL DEFAULT 'PENDING' CHECK (match_status IN ('MATCHED', 'PRICE_VARIANCE', 'QUANTITY_SHORT', 'DISPUTED', 'PENDING')),
        variance_summary JSONB NOT NULL DEFAULT '{}',
        raw_items        JSONB NOT NULL DEFAULT '[]',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS vendor_credit_memos (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        invoice_id       UUID REFERENCES distributor_invoices(id) ON DELETE CASCADE,
        vendor_name      TEXT NOT NULL,
        memo_number      TEXT NOT NULL UNIQUE,
        credit_amount    NUMERIC(10,2) NOT NULL,
        reason           TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'SUBMITTED_TO_VENDOR', 'CREDIT_APPLIED', 'REJECTED')),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_invoices_match ON distributor_invoices(match_status);
    `,
  },
  {
    name: '015_ehr_reconciliation_queue',
    sql: `
      CREATE TABLE IF NOT EXISTS ehr_reconciliation_queue (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        resident_id      TEXT,
        resident_name    TEXT NOT NULL,
        external_ehr_id  TEXT NOT NULL,
        source_ehr       TEXT NOT NULL DEFAULT 'PointClickCare',
        change_type      TEXT NOT NULL CHECK (change_type IN ('DIET_ORDER', 'TEXTURE_UPDATE', 'NEW_ALLERGEN', 'ADMISSION', 'DISCHARGE', 'NPO_ORDER')),
        incoming_payload JSONB NOT NULL,
        conflict_reason  TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'PENDING_TRIAGE' CHECK (status IN ('PENDING_TRIAGE', 'APPROVED_BY_RD', 'REJECTED_BY_RD', 'AUTO_MERGED')),
        resolved_by      TEXT,
        resolved_at      TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ehr_queue_status ON ehr_reconciliation_queue(status);
    `,
  },
]

export async function runMigrations(maxRetries = 5, retryDelayMs = 2000) {
  let attempt = 0
  while (attempt < maxRetries) {
    try {
      attempt++
      await pool.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          name       TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      break
    } catch (err: any) {
      if (attempt >= maxRetries) {
        console.error(`[migrate] Failed to connect to database after ${maxRetries} attempts:`, err.message)
        throw err
      }
      console.warn(`[migrate] Database connection attempt ${attempt}/${maxRetries} failed (${err.message}). Retrying in ${retryDelayMs}ms...`)
      await new Promise(r => setTimeout(r, retryDelayMs))
    }
  }

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
