import { databaseDialect, pool } from './pool'

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
          'admin', 'manager', 'dietitian', 'frontdesk', 'dietary',
          'distributor', 'activities', 'server', 'staff', 'readonly'
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
        facility_id         TEXT REFERENCES facility_config(id) ON DELETE CASCADE,
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
        facility_id     TEXT REFERENCES facility_config(id) ON DELETE CASCADE,
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
        facility_id     TEXT REFERENCES facility_config(id) ON DELETE CASCADE,
        vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','submitted','received','cancelled')),
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
        facility_id     TEXT REFERENCES facility_config(id) ON DELETE CASCADE,
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
        facility_id           TEXT REFERENCES facility_config(id) ON DELETE CASCADE,
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
  {
    // A02: backfill — the 8 tables below were defined in 010/011/012 but were never
    // created in databases where those migrations were already marked applied
    // (append-only rule means those migrations can never re-run). Definitions are
    // copied verbatim from the original migrations; IF NOT EXISTS keeps it idempotent.
    name: '016_purchasing_reporting_backfill',
    sql: `
      -- From 010: Vendor catalog items (broadline SKUs, pack sizes, UOMs)
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

      -- From 010: Maps facility ingredients to preferred vendor items (many-to-one preferred)
      CREATE TABLE IF NOT EXISTS facility_item_maps (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        facility_id         TEXT REFERENCES facility_config(id) ON DELETE CASCADE,
        ingredient_name     TEXT NOT NULL,
        vendor_item_id      UUID NOT NULL REFERENCES vendor_items(id) ON DELETE CASCADE,
        preferred           BOOLEAN NOT NULL DEFAULT true,
        conversion_factor   NUMERIC(10,4) DEFAULT 1.0,
        notes               TEXT DEFAULT '',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- From 010: Standing order guide entries: par levels and on-hand counts per vendor item
      CREATE TABLE IF NOT EXISTS order_guides (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        facility_id     TEXT REFERENCES facility_config(id) ON DELETE CASCADE,
        vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        vendor_item_id  UUID NOT NULL REFERENCES vendor_items(id) ON DELETE CASCADE,
        par_level       NUMERIC(10,2) NOT NULL DEFAULT 0,
        on_hand         NUMERIC(10,2) NOT NULL DEFAULT 0,
        avg_usage       NUMERIC(10,2),
        sort_group      TEXT DEFAULT '',
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(facility_id, vendor_item_id)
      );

      -- From 010: Purchase orders (header)
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        facility_id     TEXT REFERENCES facility_config(id) ON DELETE CASCADE,
        vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','submitted','received','cancelled')),
        order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
        expected_date   DATE,
        notes           TEXT DEFAULT '',
        created_by      UUID REFERENCES users(id),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- From 010: Purchase order line items
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

      -- From 011: Daily cost snapshot (optional manual entry; reports can also be computed live)
      CREATE TABLE IF NOT EXISTS daily_cost_log (
        id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        facility_id           TEXT REFERENCES facility_config(id) ON DELETE CASCADE,
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

      -- From 012: Recipe Nutritional Breakdown
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

      -- From 012: Menu Item to Recipe Mapping
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
    // B09: server-side inventory — stock items, append-only transaction log,
    // and count-sheet sessions so the five inventory tabs are multi-user.
    name: '017_inventory_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS inventory_items (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        sku         TEXT DEFAULT '',
        vendor_sku  TEXT DEFAULT '',
        name        TEXT NOT NULL,
        category    TEXT NOT NULL DEFAULT 'Other',
        unit        TEXT NOT NULL DEFAULT 'each',
        par_level   NUMERIC(10,2) NOT NULL DEFAULT 0,
        on_hand     NUMERIC(10,2) NOT NULL DEFAULT 0,
        unit_cost   NUMERIC(10,4),
        vendor      TEXT DEFAULT '',
        location    TEXT DEFAULT '',
        notes       TEXT DEFAULT '',
        active      BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON inventory_items(name);

      -- Append-only stock ledger. Corrections are new adjusting rows (type
      -- 'count_adjust'), never edits or deletes — no UPDATE/DELETE triggers
      -- are wired here because the API layer is the only writer.
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id     UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
        type        TEXT NOT NULL CHECK (type IN ('receipt', 'issue', 'waste', 'count_adjust')),
        qty         NUMERIC(10,2) NOT NULL,
        unit        TEXT NOT NULL DEFAULT 'each',
        user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
        note        TEXT DEFAULT '',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_tx_item
        ON inventory_transactions(item_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_inventory_tx_type
        ON inventory_transactions(type, created_at DESC);

      -- Count-sheet sessions (zero-balance counts). The adjusting
      -- transactions written on submit keep the ledger as the source of truth
      -- for on-hand quantities; the session preserves who counted what.
      CREATE TABLE IF NOT EXISTS inventory_counts (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        count_date    DATE NOT NULL,
        submitted_by  TEXT DEFAULT '',
        status        TEXT NOT NULL DEFAULT 'Draft'
                      CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Discrepancy')),
        items         TEXT NOT NULL DEFAULT '[]',
        notes         TEXT DEFAULT '',
        submitted_at  TIMESTAMPTZ,
        approved_by   TEXT DEFAULT '',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_counts_date
        ON inventory_counts(count_date DESC);
    `,
  },
  {
    // B12: tray run tracking — every meal service gets a tracked tray run
    // (assembled → dispatched → delivered, plus missed/remade), with a
    // missed-tray SLA surfaced on the dispatch checklist.
    //
    // tray_events is append-only: the API layer exposes no UPDATE/DELETE for
    // it, and the trayTracking engine enforces forward-only transitions, so
    // every event keeps its original user + timestamp.
    name: '018_tray_tracking',
    sql: `
      CREATE TABLE IF NOT EXISTS tray_runs (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        meal_slot    TEXT NOT NULL CHECK (meal_slot IN ('breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner')),
        service_date DATE NOT NULL,
        wing         TEXT NOT NULL DEFAULT '',
        notes        TEXT NOT NULL DEFAULT '',
        created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (service_date, meal_slot, wing)
      );

      CREATE INDEX IF NOT EXISTS idx_tray_runs_date
        ON tray_runs(service_date DESC);

      CREATE TABLE IF NOT EXISTS tray_events (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        run_id      UUID NOT NULL REFERENCES tray_runs(id) ON DELETE CASCADE,
        resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
        ticket_id   TEXT NOT NULL DEFAULT '',
        event       TEXT NOT NULL CHECK (event IN ('assembled', 'dispatched', 'delivered', 'missed', 'remade')),
        at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        by          TEXT,
        note        TEXT NOT NULL DEFAULT '',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tray_events_run
        ON tray_events(run_id, at);
      CREATE INDEX IF NOT EXISTS idx_tray_events_resident
        ON tray_events(resident_id);
    `,
  },
  {
    // B11: widen the purchase_orders status CHECK to include 'approved' so the
    // manager approval step (draft → approved → submitted) is a real status.
    // Follows the 008 users_role_check precedent: effective on PostgreSQL;
    // the SQLite translation layer strips ALTER TABLE … CONSTRAINT statements
    // (see pool.ts translateQuery), where fresh databases instead pick up the
    // widened CHECK from the updated CREATE TABLE definitions in 010/016.
    // Legacy SQLite databases keep the old 4-value CHECK and fail closed
    // (CHECK violation → 500) rather than silently accepting 'approved'.
    name: '019_po_approval_status',
    sql: `
      ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
      ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check
        CHECK (status IN ('draft','approved','submitted','received','cancelled'));
    `,
  },
  {
    // B04 (Owner Decision 3): therapeutic diet order provenance + the aide
    // "flag for RD review" worklist table. Numbered 020 — B11 owns 019.
    name: '020_diet_order_provenance',
    sql: `
      ALTER TABLE residents ADD COLUMN IF NOT EXISTS diet_ordered_by TEXT DEFAULT NULL;
      ALTER TABLE residents ADD COLUMN IF NOT EXISTS diet_order_date TIMESTAMPTZ DEFAULT NULL;
      ALTER TABLE residents ADD COLUMN IF NOT EXISTS diet_effective_date TIMESTAMPTZ DEFAULT NULL;

      CREATE TABLE IF NOT EXISTS diet_review_flags (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        resident_id TEXT NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
        message     TEXT NOT NULL DEFAULT '',
        flagged_by  TEXT,
        status      TEXT NOT NULL DEFAULT 'OPEN'
                      CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED')),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_by TEXT,
        resolved_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_diet_review_flags_status
        ON diet_review_flags(status);
      CREATE INDEX IF NOT EXISTS idx_diet_review_flags_resident
        ON diet_review_flags(resident_id);
    `,
  },
  {
    // B05: real hydration-pass logging (F807 survey territory). One row per
    // resident per pass per day; POST upserts on (resident_id, pass, today).
    // refusals are stored distinctly from zero-consumption (refused=true).
    // resident_id is TEXT: residents.id is UUID on pg / TEXT on sqlite
    // (see pool.ts translation). Client code generates the id (A02 pattern:
    // uuid_generate_v4() defaults do not exist on SQLite).
    name: '021_hydration_records',
    sql: `
      CREATE TABLE IF NOT EXISTS hydration_records (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        resident_id TEXT NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
        pass        TEXT NOT NULL
                      CHECK (pass IN ('morning', 'afternoon', 'evening')),
        target_oz   NUMERIC(8,2) NOT NULL DEFAULT 0,
        offered_oz  NUMERIC(8,2) NOT NULL DEFAULT 0,
        consumed_oz NUMERIC(8,2) NOT NULL DEFAULT 0,
        refused     BOOLEAN NOT NULL DEFAULT false,
        supplement  TEXT NOT NULL DEFAULT '',
        recorded_by TEXT,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_hydration_records_date
        ON hydration_records(recorded_at);
      CREATE INDEX IF NOT EXISTS idx_hydration_records_resident
        ON hydration_records(resident_id);
    `,
  },
  {
    // C00: align the users.role CHECK with the canonical 001 definition so
    // 'dietitian' is a valid role on every database. Clinical dietitians
    // write therapeutic diet orders (B04 Owner Decision 3), so a CHECK that
    // rejects the role is a hard blocker. Follows the 008/019 precedent:
    // effective on PostgreSQL; the SQLite translation layer strips
    // ALTER TABLE … CONSTRAINT statements (see pool.ts translateQuery),
    // where fresh databases instead pick up the widened CHECK from the
    // updated CREATE TABLE users definition in 001 above.
    name: '022_users_role_dietitian_check',
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
    // C01: durable HACCP temperature logging. haccp_equipment holds the
    // facility's monitored equipment (fridge/freezer/dishwasher/hot-hold)
    // with target temps and check frequency; haccp_logs holds every temp
    // check with the measured reading, server-computed compliance, and
    // corrective action (violations cannot close without one).
    // equipment_id is TEXT: haccp_equipment.id is UUID on pg / TEXT on
    // sqlite (see pool.ts translation). Client code generates the id
    // (A02 pattern: uuid_generate_v4() defaults do not exist on SQLite).
    name: '023_haccp_temperature_logging',
    sql: `
      CREATE TABLE IF NOT EXISTS haccp_equipment (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name            TEXT NOT NULL,
        type            TEXT NOT NULL
                          CHECK (type IN ('fridge', 'freezer', 'dishwasher', 'hot-hold')),
        target_temp_f   NUMERIC(6,2) NOT NULL,
        check_frequency TEXT NOT NULL DEFAULT 'daily'
                          CHECK (check_frequency IN ('shift', 'daily', 'weekly')),
        active          BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS haccp_logs (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        check_type       TEXT NOT NULL
                           CHECK (check_type IN ('food', 'equipment')),
        item_name        TEXT NOT NULL DEFAULT '',
        equipment_id     TEXT REFERENCES haccp_equipment(id) ON DELETE SET NULL,
        temp_f           NUMERIC(6,2) NOT NULL,
        target_temp_f    NUMERIC(6,2) NOT NULL,
        compliant        BOOLEAN NOT NULL DEFAULT true,
        violation_type   TEXT,
        corrective_action TEXT NOT NULL DEFAULT '',
        source           TEXT NOT NULL DEFAULT 'manual'
                           CHECK (source IN ('manual', 'probe')),
        probe_device     TEXT,
        recorded_by      TEXT,
        recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_haccp_logs_recorded_at
        ON haccp_logs(recorded_at DESC);
      CREATE INDEX IF NOT EXISTS idx_haccp_logs_equipment
        ON haccp_logs(equipment_id);
      CREATE INDEX IF NOT EXISTS idx_haccp_logs_compliant
        ON haccp_logs(compliant);
      CREATE INDEX IF NOT EXISTS idx_haccp_equipment_type
        ON haccp_equipment(type);
      CREATE INDEX IF NOT EXISTS idx_haccp_equipment_active
        ON haccp_equipment(active);
    `,
  },
  {
    // C04: server-synced facility settings. facility_settings is the single
    // server-side source of truth for the Settings page sections (facility
    // profile, operations, integrations, security), keyed (facility_id, key)
    // with JSON values. Writes are manager-gated and audit-logged at the
    // API layer. Seed inserts mirror the client defaults and are idempotent
    // (ON CONFLICT DO NOTHING) — they never clobber operator data.
    name: '024_facility_settings',
    sql: `
      CREATE TABLE IF NOT EXISTS facility_settings (
        facility_id TEXT NOT NULL DEFAULT 'default',
        key         TEXT NOT NULL,
        value       JSONB NOT NULL,
        updated_by  TEXT,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (facility_id, key)
      );

      CREATE INDEX IF NOT EXISTS idx_facility_settings_facility
        ON facility_settings(facility_id);

      INSERT INTO facility_settings (facility_id, key, value) VALUES
      ('default', 'facility', '{"name":"Shoreline Healthcare & Rehabilitation","organization":"Shoreline Senior Living Group LLC","npiNumber":"1942857102","licenseNumber":"SNF-ME-40891","facilityType":"Skilled Nursing","address":"104 Shoreline Drive, Portland, ME 04101","phone":"(207) 555-0199","email":"dietary.ops@shorelinecare.com","directorOfDining":"Chef Marcus Vance, CDM, CFPP","registeredDietitian":"Sarah Jenkins, MS, RDN, LD"}'),
      ('default', 'operations', '{"wings":["Coastal Wing (Assisted Living)","Harbor View (Memory Care)","Atlantic Rehab Unit"],"diningRooms":["Main Dining Hall","Harbor Bistro","In-Room Bedside Tray Service"],"targetCpd":8.75,"mealTimes":{"breakfast":"07:30","lunch":"12:00","dinner":"17:30","snack":"20:00"},"temperatureUnit":"F","iddsiStrictEnforcement":true,"fourteenHourRuleCheck":true}'),
      ('default', 'integrations', '{"primaryDistributor":"dennis","distributorCustomerNumber":"DEN-884910","pccFacilityId":"FAC-PORTLAND-01","autoSyncCensus":true,"invoiceOcrAutoApprove":false}'),
      ('default', 'security', '{"sessionTimeoutMinutes":30,"hipaaAuditRetentionDays":2555,"baaSignedDate":"2026-01-15","baaSignee":"Marcus Vance (Executive Director)"}')
      ON CONFLICT (facility_id, key) DO NOTHING;
    `,
  },
  {
    // Migration 025: Zero Split-Brain Persistence Layer.
    // Migrates staff profiles, call-outs, budget periods/entries, and communications
    // to central database persistence with full auditability across all tablets/kiosks.
    name: '025_staff_budget_communications',
    sql: `
      CREATE TABLE IF NOT EXISTS staff_profiles (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        auth_user_id      TEXT,
        employee_number   TEXT NOT NULL DEFAULT '',
        first_name        TEXT NOT NULL,
        last_name         TEXT NOT NULL,
        preferred_name    TEXT,
        role              TEXT NOT NULL DEFAULT 'staff',
        department        TEXT NOT NULL DEFAULT 'Dietary',
        position          TEXT NOT NULL DEFAULT '',
        hire_date         TEXT NOT NULL DEFAULT '',
        status            TEXT NOT NULL DEFAULT 'Active',
        full_time         BOOLEAN NOT NULL DEFAULT false,
        phone             TEXT,
        email             TEXT,
        emergency_contact JSONB,
        certifications    TEXT[] NOT NULL DEFAULT '{}',
        manager_notes     TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_staff_profiles_status ON staff_profiles(status);

      CREATE TABLE IF NOT EXISTS call_outs (
        id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        staff_id              TEXT NOT NULL,
        filed_by_id           TEXT NOT NULL,
        date                  TEXT NOT NULL,
        shift                 TEXT NOT NULL DEFAULT 'Morning',
        reason                TEXT NOT NULL DEFAULT 'Sick',
        notes                 TEXT,
        coverage_status       TEXT NOT NULL DEFAULT 'Uncovered',
        replacement_staff_id  TEXT,
        manager_acknowledged  BOOLEAN NOT NULL DEFAULT false,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_call_outs_date ON call_outs(date);

      CREATE TABLE IF NOT EXISTS budget_periods (
        id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        label                       TEXT NOT NULL,
        month                       INTEGER NOT NULL,
        year                        INTEGER NOT NULL,
        total_budget                NUMERIC(12,2) NOT NULL DEFAULT 0,
        resident_count              INTEGER NOT NULL DEFAULT 1,
        budget_per_resident_per_day NUMERIC(10,4) NOT NULL DEFAULT 0,
        start_date                  TEXT,
        end_date                    TEXT,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_budget_periods_year_month ON budget_periods(year, month);

      CREATE TABLE IF NOT EXISTS budget_entries (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        period_id   TEXT NOT NULL,
        date        TEXT NOT NULL,
        vendor      TEXT,
        description TEXT NOT NULL DEFAULT '',
        amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
        category    TEXT,
        invoice_ref TEXT,
        logged_by   TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_budget_entries_period ON budget_entries(period_id);

      CREATE TABLE IF NOT EXISTS communications (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        type           TEXT NOT NULL DEFAULT 'general',
        subject        TEXT NOT NULL DEFAULT '',
        status         TEXT NOT NULL DEFAULT 'Draft',
        created_by_id  TEXT NOT NULL DEFAULT '',
        entries        JSONB NOT NULL DEFAULT '[]',
        distributed_to TEXT[] NOT NULL DEFAULT '{}',
        distributed_at TIMESTAMPTZ,
        was_printed    BOOLEAN NOT NULL DEFAULT false,
        printed_at     TIMESTAMPTZ,
        printed_by_id  TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_communications_created ON communications(created_at DESC);
    `,
  },
  {
    name: '026_canonical_products_and_distributor_matching',
    sql: `
      -- Canonical products (universal ingredients/products independent of any single vendor)
      CREATE TABLE IF NOT EXISTS canonical_products (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name           TEXT NOT NULL,
        category       TEXT NOT NULL,
        standard_uom   TEXT NOT NULL,
        description    TEXT DEFAULT '',
        allergens      TEXT[] DEFAULT '{}',
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_canonical_products_name ON canonical_products(name);

      -- Cross-vendor SKU mappings with normalized pricing and match confidence
      CREATE TABLE IF NOT EXISTS vendor_item_matches (
        id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        canonical_product_id          UUID NOT NULL REFERENCES canonical_products(id) ON DELETE CASCADE,
        vendor_item_id                UUID NOT NULL REFERENCES vendor_items(id) ON DELETE CASCADE,
        pack_quantity_in_standard_uom NUMERIC(10,4) NOT NULL DEFAULT 1.0,
        normalized_unit_cost          NUMERIC(10,4) NOT NULL DEFAULT 0.0,
        match_confidence              NUMERIC(5,2) DEFAULT 100.0,
        match_status                  TEXT NOT NULL DEFAULT 'confirmed',
        matched_by                    TEXT DEFAULT 'system',
        created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(canonical_product_id, vendor_item_id)
      );

      CREATE INDEX IF NOT EXISTS idx_vendor_item_matches_canon ON vendor_item_matches(canonical_product_id);
      CREATE INDEX IF NOT EXISTS idx_vendor_item_matches_item ON vendor_item_matches(vendor_item_id);
    `,
  },
]

// A02: every table migrate.ts expects to exist after a full migration run.
// Used by assertSchemaIntegrity() — a boot-time fail-closed drift guard.
export const EXPECTED_TABLES: string[] = [
  '_migrations',
  'users',
  'residents',
  'refresh_tokens',
  'audit_log',
  'menu_items',
  'menu_weeks',
  'production_sheets',
  'system_settings',
  'timecard_punches',
  'meal_options',
  'weekly_orders',
  'facility_config',
  'vendors',
  'vendor_items',
  'facility_item_maps',
  'order_guides',
  'purchase_orders',
  'purchase_order_lines',
  'substitution_log',
  'daily_cost_log',
  'recipes',
  'recipe_nutrients',
  'menu_item_recipes',
  'resident_profile_history',
  'distributor_invoices',
  'vendor_credit_memos',
  'ehr_reconciliation_queue',
  // B04: aide "flag for RD review" worklist (migration 020).
  'diet_review_flags',
  'inventory_items',
  'inventory_transactions',
  'inventory_counts',
  'tray_runs',
  'tray_events',
  // B05: hydration pass log (migration 021).
  'hydration_records',
  // C01: durable HACCP temperature logging (migration 023).
  'haccp_logs',
  'haccp_equipment',
  // C04: server-synced facility settings (migration 024).
  'facility_settings',
  // Zero Split-Brain: Staff profiles, call-outs, budget, communications (migration 025).
  'staff_profiles',
  'call_outs',
  'budget_periods',
  'budget_entries',
  'communications',
  // Wave J: Canonical products & cross-distributor matching (migration 026).
  'canonical_products',
  'vendor_item_matches',
]

/**
 * A02 boot-time schema drift assertion (fail closed).
 *
 * After migrations run, verifies that every table migrate.ts expects actually
 * exists in the connected database. On mismatch, throws an explicit error
 * naming the missing tables — the boot path must treat this as fatal and
 * refuse to start (fail loud, not silent).
 *
 * Table-existence only (not a full column diff) — deliberately surgical.
 * Works against SQLite (sqlite_master) and PostgreSQL (pg_tables); the backend
 * is detected by probing, so the pg→sqlite fallback in pool.ts is handled.
 */
export async function assertSchemaIntegrity(): Promise<void> {
  const { rows } = databaseDialect === 'postgres'
    ? await pool.query(`SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public'`)
    : await pool.query(`SELECT name FROM sqlite_master WHERE type = 'table'`)

  if (rows.length === 0) {
    throw new Error('[schema-drift] FATAL: database returned no schema inventory. Refusing to boot the API.')
  }

  const present = new Set(rows.map((r: any) => r.name))
  const missing = EXPECTED_TABLES.filter((t) => !present.has(t))

  if (missing.length > 0) {
    throw new Error(
      `[schema-drift] FATAL: ${missing.length} expected table(s) missing from the database: ${missing.join(', ')}. ` +
      `The database schema is out of sync with server/src/db/migrate.ts. Refusing to boot.`
    )
  }

  console.log(`[migrate] Schema integrity check passed (${EXPECTED_TABLES.length}/${EXPECTED_TABLES.length} tables present)`)
}

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

  // A02: fail-closed drift guard — verify the migrated DB actually has every
  // table the schema definition expects before any boot proceeds.
  await assertSchemaIntegrity()

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
