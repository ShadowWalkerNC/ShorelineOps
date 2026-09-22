"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const pool_1 = require("../db/pool");
const requireAuth_1 = require("../middleware/requireAuth");
const healer_1 = require("../agent/healer");
const RoleEnum = zod_1.z.enum([
    'admin',
    'manager',
    'dietitian',
    'frontdesk',
    'dietary',
    'distributor',
    'activities',
    'server',
    'staff',
    'readonly',
]);
exports.adminRouter = (0, express_1.Router)();
// All admin routes require at minimum staff; most require admin.
// requireAuth is already applied at the app level for /api/admin.
// ── Mappers ────────────────────────────────────────────────────────────────────
function toUser(row) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        active: row.active,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at ?? null,
        facilityId: row.facility_id || 'default',
        platformAdmin: !!row.platform_admin,
    };
}
function toAuditEntry(row) {
    return {
        id: row.id,
        action: row.action,
        userId: row.user_id ?? undefined,
        userName: row.user_name ?? undefined,
        resourceId: row.resource_id ?? undefined,
        resourceType: row.resource_type ?? undefined,
        timestamp: row.created_at,
        outcome: row.outcome,
        ipAddress: row.ip_address ?? undefined,
        details: row.details ?? undefined,
    };
}
function toSettings(row) {
    return {
        facilityName: row.facility_name,
        timezone: row.timezone,
        sessionTimeoutMinutes: row.session_timeout_minutes,
        mfaRequired: row.mfa_required,
        allowReadonlyExport: row.allow_readonly_export,
        maintenanceMode: row.maintenance_mode,
        kitchenServiceMode: row.kitchen_service_mode || 'hybrid',
    };
}
// ════════════════════════════════════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════════════════════════════════════
// GET /api/admin/users
exports.adminRouter.get('/users', (0, requireAuth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const base = 'SELECT id, name, email, role, active, created_at, last_login_at, facility_id, platform_admin FROM users';
        const result = req.platformAdmin
            ? await pool_1.pool.query(`${base} ORDER BY name ASC`)
            : await pool_1.pool.query(`${base} WHERE facility_id = $1 ORDER BY name ASC`, [req.facilityId || 'default']);
        res.json(result.rows.map(toUser));
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/users
exports.adminRouter.post('/users', (0, requireAuth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const data = zod_1.z.object({
            name: zod_1.z.string().min(1),
            email: zod_1.z.string().email(),
            role: RoleEnum,
            password: zod_1.z.string().min(12).optional(),
            facilityId: zod_1.z.string().min(1).optional(),
            platformAdmin: zod_1.z.boolean().optional(),
            active: zod_1.z.boolean().optional(),
        }).parse(req.body);
        if (data.platformAdmin && !req.platformAdmin) {
            return res.status(403).json({ error: 'Only a platform owner can grant platform access.' });
        }
        const facilityId = req.platformAdmin
            ? (data.facilityId || req.facilityId || 'default')
            : (req.facilityId || 'default');
        const { rows: facilities } = await pool_1.pool.query('SELECT id, is_initialized, active FROM facility_config WHERE id = $1', [facilityId]);
        if (!facilities[0])
            return res.status(400).json({ error: 'Select a valid facility before creating this account.' });
        if (!req.platformAdmin && !facilities[0].active)
            return res.status(400).json({ error: 'This facility is not active.' });
        if (data.active && (!facilities[0].active || !facilities[0].is_initialized)) {
            return res.status(409).json({ error: 'Complete facility onboarding and enable the facility before activating accounts.' });
        }
        const { rows: duplicateUsers } = await pool_1.pool.query('SELECT id FROM users WHERE email = $1', [data.email.toLowerCase()]);
        if (duplicateUsers[0])
            return res.status(409).json({ error: 'An account with this email already exists.' });
        const plainPassword = data.password ?? (crypto_1.default.randomBytes(18).toString('base64url') + 'A1!');
        const passwordHash = await bcryptjs_1.default.hash(plainPassword, 12);
        const active = data.active ?? (!!facilities[0].is_initialized && !!facilities[0].active);
        const { rows } = await pool_1.pool.query(`INSERT INTO users (name, email, password, role, facility_id, platform_admin, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, role, active, created_at, last_login_at, facility_id, platform_admin`, [data.name, data.email.toLowerCase(), passwordHash, data.role, facilityId, !!data.platformAdmin, active]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
       VALUES ('CREATE_USER', $1, $2, 'user', 'success', $3)`, [req.userId, rows[0].id, JSON.stringify({ facilityId, role: data.role, platformAdmin: !!data.platformAdmin })]);
        res.status(201).json({ ...toUser(rows[0]), temporaryPassword: data.password ? undefined : plainPassword });
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/admin/users/:id
exports.adminRouter.patch('/users/:id', (0, requireAuth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const data = zod_1.z.object({
            name: zod_1.z.string().trim().min(2).max(120).optional(),
            role: RoleEnum.optional(),
            active: zod_1.z.boolean().optional(),
            password: zod_1.z.string().min(12).optional(),
            facilityId: zod_1.z.string().min(1).optional(),
            platformAdmin: zod_1.z.boolean().optional(),
        }).parse(req.body);
        const { rows: existing } = await pool_1.pool.query('SELECT id, facility_id, platform_admin FROM users WHERE id = $1', [req.params.id]);
        const target = existing[0];
        if (!target)
            return res.status(404).json({ error: 'User not found' });
        if (!req.platformAdmin && (target.platform_admin || target.facility_id !== (req.facilityId || 'default'))) {
            return res.status(403).json({ error: 'Facility administrators can manage only their own facility accounts.' });
        }
        if ((data.platformAdmin !== undefined || data.facilityId !== undefined) && !req.platformAdmin) {
            return res.status(403).json({ error: 'Only a platform owner can change platform or facility assignment.' });
        }
        let passwordHash = null;
        if (data.password)
            passwordHash = await bcryptjs_1.default.hash(data.password, 12);
        const { rows } = await pool_1.pool.query(`UPDATE users SET
         name = COALESCE($1, name),
         role = COALESCE($2, role),
         active = COALESCE($3, active),
         password = CASE WHEN $4::text IS NOT NULL THEN $4::text ELSE password END,
         platform_admin = COALESCE($5, platform_admin),
         facility_id = COALESCE($6, facility_id),
         updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, email, role, active, created_at, last_login_at, facility_id, platform_admin`, [data.name ?? null, data.role ?? null, data.active ?? null, passwordHash, data.platformAdmin ?? null, data.facilityId ?? null, req.params.id]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
       VALUES ('UPDATE_USER', $1, $2, 'user', 'success', $3)`, [req.userId, req.params.id, JSON.stringify({ changedFields: Object.keys(data).filter(k => k !== 'password') })]);
        res.json(toUser(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// GET /api/admin/facilities — ShorelineOps beta control plane
exports.adminRouter.get('/facilities', requireAuth_1.requirePlatformAdmin, async (_req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query(`SELECT f.*, COUNT(u.id) AS user_count
       FROM facility_config f
       LEFT JOIN users u ON u.facility_id = f.id
       GROUP BY f.id
       ORDER BY f.created_at ASC`);
        res.json(rows.map((row) => ({
            id: row.id,
            name: row.facility_name,
            facilityType: row.facility_type,
            primaryContactEmail: row.primary_contact_email,
            betaStatus: row.beta_status,
            planTier: row.plan_tier,
            active: !!row.active,
            initialized: !!row.is_initialized,
            userCount: Number(row.user_count || 0),
            createdAt: row.created_at,
        })));
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/facilities — register a beta tenant; access stays locked until provisioned
exports.adminRouter.post('/facilities', requireAuth_1.requirePlatformAdmin, async (req, res, next) => {
    try {
        const data = zod_1.z.object({
            name: zod_1.z.string().min(2),
            primaryContactEmail: zod_1.z.string().email(),
            facilityType: zod_1.z.enum(['Assisted Living', 'Skilled Nursing', 'Memory Care', 'Continuing Care']),
            address: zod_1.z.string().optional(),
            npiLicense: zod_1.z.string().optional(),
        }).parse(req.body);
        const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'facility';
        const id = `${slug}-${crypto_1.default.randomBytes(3).toString('hex')}`;
        const { rows } = await pool_1.pool.query(`INSERT INTO facility_config (
         id, facility_name, npi_license, address, primary_contact_email, facility_type,
         wings, dining_rooms, is_initialized, beta_status, plan_tier, active
       ) VALUES ($1, $2, $3, $4, $5, $6, '[]', '[]', false, 'onboarding', 'beta', false)
       RETURNING *`, [id, data.name, data.npiLicense || '', data.address || '', data.primaryContactEmail.toLowerCase(), data.facilityType]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
       VALUES ('REGISTER_BETA_FACILITY', $1, $2, 'facility', 'success', $3)`, [req.userId, id, JSON.stringify({ name: data.name })]);
        res.status(201).json({ id, name: rows[0].facility_name, betaStatus: rows[0].beta_status, initialized: false });
    }
    catch (err) {
        next(err);
    }
});
exports.adminRouter.patch('/facilities/:id', requireAuth_1.requirePlatformAdmin, async (req, res, next) => {
    try {
        const data = zod_1.z.object({
            betaStatus: zod_1.z.enum(['onboarding', 'beta', 'paused', 'graduated']).optional(),
            planTier: zod_1.z.enum(['community', 'pro', 'enterprise', 'beta']).optional(),
            active: zod_1.z.boolean().optional(),
        }).parse(req.body);
        if (data.active) {
            const { rows: candidates } = await pool_1.pool.query('SELECT is_initialized FROM facility_config WHERE id = $1', [req.params.id]);
            if (!candidates[0])
                return res.status(404).json({ error: 'Facility not found' });
            if (!candidates[0].is_initialized) {
                return res.status(409).json({ error: 'Facility onboarding must be complete before access can be enabled.' });
            }
        }
        const { rows } = await pool_1.pool.query(`UPDATE facility_config SET
         beta_status = COALESCE($1, beta_status),
         plan_tier = COALESCE($2, plan_tier),
         active = COALESCE($3, active),
         updated_at = NOW()
       WHERE id = $4 RETURNING *`, [data.betaStatus ?? null, data.planTier ?? null, data.active ?? null, req.params.id]);
        if (!rows[0])
            return res.status(404).json({ error: 'Facility not found' });
        res.json({ id: rows[0].id, name: rows[0].facility_name, betaStatus: rows[0].beta_status, planTier: rows[0].plan_tier, active: !!rows[0].active });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/admin/onboarding/status — deterministic required-data path
exports.adminRouter.get('/onboarding/status', (0, requireAuth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const facilityId = req.facilityId || 'default';
        const { rows: facilities } = await pool_1.pool.query('SELECT * FROM facility_config WHERE id = $1', [facilityId]);
        const facility = facilities[0];
        const { rows: admins } = await pool_1.pool.query("SELECT COUNT(*) AS count FROM users WHERE facility_id = $1 AND role = 'admin' AND active = true", [facilityId]);
        const parseList = (value) => {
            if (Array.isArray(value))
                return value;
            try {
                return JSON.parse(String(value || '[]'));
            }
            catch {
                return [];
            }
        };
        const steps = [
            { id: 'facility', label: 'Facility identity and contact', complete: !!facility?.facility_name && !!facility?.primary_contact_email && !!facility?.facility_type },
            { id: 'layout', label: 'At least one wing and dining location', complete: parseList(facility?.wings).length > 0 && parseList(facility?.dining_rooms).length > 0 },
            { id: 'baa', label: 'BAA authorization', complete: !!facility?.baa_accepted_at && !!facility?.baa_signee_name },
            { id: 'admin', label: 'Active facility administrator', complete: Number(admins[0]?.count || 0) > 0 },
        ];
        const next = steps.find(step => !step.complete) || null;
        res.json({ facilityId, facilityName: facility?.facility_name || '', complete: !next, steps, nextAction: next?.label || null });
    }
    catch (err) {
        next(err);
    }
});
// ════════════════════════════════════════════════════════════════════════════
// AUDIT LOG
// ════════════════════════════════════════════════════════════════════════════
// GET /api/admin/audit?limit=50&offset=0&userId=<uuid>
exports.adminRouter.get('/audit', (0, requireAuth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(String(req.query.limit ?? 50), 10), 200);
        const offset = parseInt(String(req.query.offset ?? 0), 10);
        const userId = typeof req.query.userId === 'string' ? req.query.userId : null;
        let queryText;
        let queryParams;
        if (req.platformAdmin && userId) {
            queryText = `
        SELECT a.*, u.name AS user_name
        FROM audit_log a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC
        LIMIT $2 OFFSET $3`;
            queryParams = [userId, limit, offset];
        }
        else if (req.platformAdmin) {
            queryText = `
        SELECT a.*, u.name AS user_name
        FROM audit_log a
        LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC
        LIMIT $1 OFFSET $2`;
            queryParams = [limit, offset];
        }
        else if (userId) {
            queryText = `
        SELECT a.*, u.name AS user_name
        FROM audit_log a
        JOIN users u ON u.id = a.user_id
        WHERE a.user_id = $1 AND u.facility_id = $2
        ORDER BY a.created_at DESC
        LIMIT $3 OFFSET $4`;
            queryParams = [userId, req.facilityId || 'default', limit, offset];
        }
        else {
            queryText = `
        SELECT a.*, u.name AS user_name
        FROM audit_log a
        JOIN users u ON u.id = a.user_id
        WHERE u.facility_id = $1
        ORDER BY a.created_at DESC
        LIMIT $2 OFFSET $3`;
            queryParams = [req.facilityId || 'default', limit, offset];
        }
        const { rows } = await pool_1.pool.query(queryText, queryParams);
        res.json(rows.map(toAuditEntry));
    }
    catch (err) {
        next(err);
    }
});
// ════════════════════════════════════════════════════════════════════════════
// SYSTEM SETTINGS
// ════════════════════════════════════════════════════════════════════════════
// GET /api/admin/settings
exports.adminRouter.get('/settings', (0, requireAuth_1.requireRole)('admin'), async (_req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT * FROM system_settings WHERE id = 1');
        if (!rows[0])
            return res.status(404).json({ error: 'Settings not found' });
        res.json(toSettings(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/admin/settings
exports.adminRouter.patch('/settings', (0, requireAuth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const data = zod_1.z.object({
            facilityName: zod_1.z.string().min(1).optional(),
            timezone: zod_1.z.string().optional(),
            sessionTimeoutMinutes: zod_1.z.number().int().min(1).max(1440).optional(),
            mfaRequired: zod_1.z.boolean().optional(),
            allowReadonlyExport: zod_1.z.boolean().optional(),
            maintenanceMode: zod_1.z.boolean().optional(),
            kitchenServiceMode: zod_1.z.enum(['dining-room', 'room-service-only', 'hybrid']).optional(),
        }).parse(req.body);
        const { rows } = await pool_1.pool.query(`UPDATE system_settings SET
         facility_name           = COALESCE($1, facility_name),
         timezone                = COALESCE($2, timezone),
         session_timeout_minutes = COALESCE($3, session_timeout_minutes),
         mfa_required            = COALESCE($4, mfa_required),
         allow_readonly_export   = COALESCE($5, allow_readonly_export),
         maintenance_mode        = COALESCE($6, maintenance_mode),
         kitchen_service_mode    = COALESCE($7, kitchen_service_mode),
         updated_at              = NOW()
       WHERE id = 1 RETURNING *`, [
            data.facilityName ?? null,
            data.timezone ?? null,
            data.sessionTimeoutMinutes ?? null,
            data.mfaRequired ?? null,
            data.allowReadonlyExport ?? null,
            data.maintenanceMode ?? null,
            data.kitchenServiceMode ?? null,
        ]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
       VALUES ('UPDATE_SETTINGS', $1, 'system_settings', 'success', $2)`, [req.userId, JSON.stringify(data)]);
        res.json(toSettings(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// ════════════════════════════════════════════════════════════════════════════
// FACILITY SETTINGS (C04: server-synced, multi-device)
// ════════════════════════════════════════════════════════════════════════════
//
// The Settings page sections (facility profile, operations, integrations,
// security) live in the facility_settings table keyed by (facility_id, key)
// so every device in the facility sees the same values. Reads require only
// authentication; writes require manager role and are audit-logged.
// Migration 024 owns the DDL + default seeds; the GET below also
// materializes rows once from the setup-wizard facility_config row so a
// facility that ran the wizard picks up its values automatically.
// Server-side copy of the client DEFAULT_SETTINGS in
// src/state/settingsStore.ts — fallback when no rows exist yet.
const DEFAULT_FACILITY_SETTINGS = {
    facility: {
        name: 'Shoreline Healthcare & Rehabilitation',
        organization: 'Shoreline Senior Living Group LLC',
        npiNumber: '1942857102',
        licenseNumber: 'SNF-ME-40891',
        facilityType: 'Skilled Nursing',
        address: '104 Shoreline Drive, Portland, ME 04101',
        phone: '(207) 555-0199',
        email: 'dietary.ops@shorelinecare.com',
        directorOfDining: 'Chef Marcus Vance, CDM, CFPP',
        registeredDietitian: 'Sarah Jenkins, MS, RDN, LD',
    },
    operations: {
        wings: ['Coastal Wing (Assisted Living)', 'Harbor View (Memory Care)', 'Atlantic Rehab Unit'],
        diningRooms: ['Main Dining Hall', 'Harbor Bistro', 'In-Room Bedside Tray Service'],
        targetCpd: 8.75,
        mealTimes: { breakfast: '07:30', lunch: '12:00', dinner: '17:30', snack: '20:00' },
        temperatureUnit: 'F',
        iddsiStrictEnforcement: true,
        fourteenHourRuleCheck: true,
    },
    integrations: {
        primaryDistributor: 'dennis',
        distributorCustomerNumber: 'DEN-884910',
        pccFacilityId: 'FAC-PORTLAND-01',
        autoSyncCensus: true,
        invoiceOcrAutoApprove: false,
    },
    security: {
        sessionTimeoutMinutes: 30,
        hipaaAuditRetentionDays: 2555,
        baaSignedDate: '2026-01-15',
        baaSignee: 'Marcus Vance (Executive Director)',
    },
};
const FACILITY_SETTING_KEYS = ['facility', 'operations', 'integrations', 'security'];
const FacilitySectionSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    organization: zod_1.z.string(),
    npiNumber: zod_1.z.string(),
    licenseNumber: zod_1.z.string(),
    facilityType: zod_1.z.string(),
    address: zod_1.z.string(),
    phone: zod_1.z.string(),
    email: zod_1.z.string(),
    directorOfDining: zod_1.z.string(),
    registeredDietitian: zod_1.z.string(),
}).partial();
const OperationsSectionSchema = zod_1.z.object({
    wings: zod_1.z.array(zod_1.z.string()),
    diningRooms: zod_1.z.array(zod_1.z.string()),
    targetCpd: zod_1.z.number().nonnegative(),
    mealTimes: zod_1.z.object({
        breakfast: zod_1.z.string(),
        lunch: zod_1.z.string(),
        dinner: zod_1.z.string(),
        snack: zod_1.z.string(),
    }).partial(),
    temperatureUnit: zod_1.z.enum(['F', 'C']),
    iddsiStrictEnforcement: zod_1.z.boolean(),
    fourteenHourRuleCheck: zod_1.z.boolean(),
}).partial();
const IntegrationsSectionSchema = zod_1.z.object({
    primaryDistributor: zod_1.z.enum(['dennis', 'sysco', 'usfoods', 'gordon', 'pfg']),
    distributorCustomerNumber: zod_1.z.string(),
    pccFacilityId: zod_1.z.string(),
    autoSyncCensus: zod_1.z.boolean(),
    invoiceOcrAutoApprove: zod_1.z.boolean(),
}).partial();
const SecuritySectionSchema = zod_1.z.object({
    sessionTimeoutMinutes: zod_1.z.number().int().min(1).max(1440),
    hipaaAuditRetentionDays: zod_1.z.number().int().positive(),
    baaSignedDate: zod_1.z.string(),
    baaSignee: zod_1.z.string(),
}).partial();
const FacilitySettingsBodySchema = zod_1.z.object({
    facility: FacilitySectionSchema.optional(),
    operations: OperationsSectionSchema.optional(),
    integrations: IntegrationsSectionSchema.optional(),
    security: SecuritySectionSchema.optional(),
}).refine(b => b.facility !== undefined || b.operations !== undefined ||
    b.integrations !== undefined || b.security !== undefined, { message: 'At least one settings section is required' });
function parseSettingValue(raw) {
    if (raw == null)
        return {};
    if (typeof raw === 'object')
        return raw;
    try {
        const parsed = JSON.parse(String(raw));
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    }
    catch {
        return {};
    }
}
function isPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
/** Deep-merge plain objects (arrays are replaced) so a partial nested patch
 *  like { mealTimes: { lunch: '12:30' } } never wipes sibling fields. */
function deepMerge(base, patch) {
    const out = { ...base };
    for (const [k, v] of Object.entries(patch)) {
        out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
    }
    return out;
}
// One-time materialization for databases that have no facility_settings rows
// yet (e.g. a facility that ran the setup wizard before migration 024):
// carry the wizard's facility_config values into the new table, layered over
// the default seeds so nothing the operator entered is lost.
async function seedFacilitySettingsFromConfig(facilityId, updatedBy) {
    const { rows: cfgRows } = await pool_1.pool.query('SELECT facility_name, npi_license, address, primary_contact_email, facility_type, wings, dining_rooms, baa_signee_name FROM facility_config WHERE id = $1', [facilityId]);
    const cfg = cfgRows[0];
    const sections = {
        facility: { ...DEFAULT_FACILITY_SETTINGS.facility },
        operations: { ...DEFAULT_FACILITY_SETTINGS.operations, mealTimes: { ...DEFAULT_FACILITY_SETTINGS.operations.mealTimes } },
        integrations: { ...DEFAULT_FACILITY_SETTINGS.integrations },
        security: { ...DEFAULT_FACILITY_SETTINGS.security },
    };
    if (cfg) {
        if (cfg.facility_name)
            sections.facility.name = cfg.facility_name;
        if (cfg.address)
            sections.facility.address = cfg.address;
        if (cfg.npi_license)
            sections.facility.npiNumber = cfg.npi_license;
        if (cfg.facility_type)
            sections.facility.facilityType = cfg.facility_type;
        if (cfg.primary_contact_email)
            sections.facility.email = cfg.primary_contact_email;
        if (cfg.baa_signee_name)
            sections.security.baaSignee = cfg.baa_signee_name;
        // facility_config stores wings/dining_rooms as JSON arrays (sqlite read
        // path may already have parsed them); accept either form.
        const wings = typeof cfg.wings === 'string' ? parseSettingValue(cfg.wings) : cfg.wings;
        if (Array.isArray(wings) && wings.length)
            sections.operations.wings = wings.map(String);
        const rooms = typeof cfg.dining_rooms === 'string' ? parseSettingValue(cfg.dining_rooms) : cfg.dining_rooms;
        if (Array.isArray(rooms) && rooms.length)
            sections.operations.diningRooms = rooms.map(String);
    }
    for (const key of FACILITY_SETTING_KEYS) {
        await pool_1.pool.query(`INSERT INTO facility_settings (facility_id, key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (facility_id, key) DO NOTHING`, [facilityId, key, JSON.stringify(sections[key]), updatedBy]);
    }
}
async function readFacilitySettings(facilityId) {
    const { rows } = await pool_1.pool.query('SELECT key, value, updated_by, updated_at FROM facility_settings WHERE facility_id = $1', [facilityId]);
    const settings = {};
    const meta = {};
    for (const row of rows) {
        settings[row.key] = parseSettingValue(row.value);
        meta[row.key] = { updatedBy: row.updated_by ?? null, updatedAt: row.updated_at ?? null };
    }
    for (const key of FACILITY_SETTING_KEYS) {
        if (!settings[key]) {
            settings[key] = JSON.parse(JSON.stringify(DEFAULT_FACILITY_SETTINGS[key]));
        }
    }
    return { settings, meta };
}
// GET /api/admin/facility-settings — any authenticated device can read
// (meal times, wings, dining rooms are needed by kitchen tablets).
exports.adminRouter.get('/facility-settings', async (req, res, next) => {
    try {
        const facilityId = req.facilityId || 'default';
        let { rows } = await pool_1.pool.query('SELECT 1 FROM facility_settings WHERE facility_id = $1 LIMIT 1', [facilityId]);
        if (rows.length === 0) {
            await seedFacilitySettingsFromConfig(facilityId, req.userId ?? null);
        }
        const { settings, meta } = await readFacilitySettings(facilityId);
        res.json({ facilityId, settings, meta });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/admin/facility-settings — manager+ only, audit-logged.
// Partial sections are merged server-side so concurrent edits to different
// sections don't clobber each other. Last write wins per section; the
// client surfaces "server wins" when it detects it was out of date.
exports.adminRouter.put('/facility-settings', (0, requireAuth_1.requireRole)('manager'), async (req, res, next) => {
    try {
        const body = FacilitySettingsBodySchema.parse(req.body);
        const facilityId = req.facilityId || 'default';
        const changedKeys = [];
        for (const key of FACILITY_SETTING_KEYS) {
            const patch = body[key];
            if (patch === undefined)
                continue;
            const { rows } = await pool_1.pool.query('SELECT value FROM facility_settings WHERE facility_id = $1 AND key = $2', [facilityId, key]);
            const current = rows[0] ? parseSettingValue(rows[0].value) : {};
            const merged = deepMerge(current, patch);
            await pool_1.pool.query(`INSERT INTO facility_settings (facility_id, key, value, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (facility_id, key)
         DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`, [facilityId, key, JSON.stringify(merged), req.userId ?? null]);
            changedKeys.push(key);
        }
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
       VALUES ('UPDATE_FACILITY_SETTINGS', $1, 'facility_settings', 'success', $2)`, [req.userId, JSON.stringify({ facilityId, keys: changedKeys })]);
        const { settings, meta } = await readFacilitySettings(facilityId);
        res.json({ facilityId, settings, meta });
    }
    catch (err) {
        next(err);
    }
});
// ════════════════════════════════════════════════════════════════════════════
// STAFF PROFILES & CALL-OUTS (Zero Split-Brain Persistence)
// ════════════════════════════════════════════════════════════════════════════
function toStaffProfile(row) {
    return {
        id: row.id,
        authUserId: row.auth_user_id || '',
        employeeNumber: row.employee_number || '',
        firstName: row.first_name || '',
        lastName: row.last_name || '',
        preferredName: row.preferred_name || undefined,
        role: row.role || 'staff',
        department: row.department || 'Dietary',
        position: row.position || '',
        hireDate: row.hire_date || '',
        status: row.status || 'Active',
        fullTime: Boolean(row.full_time),
        phone: row.phone || undefined,
        email: row.email || undefined,
        emergencyContact: typeof row.emergency_contact === 'string' ? JSON.parse(row.emergency_contact) : (row.emergency_contact || undefined),
        certifications: typeof row.certifications === 'string' ? JSON.parse(row.certifications) : (Array.isArray(row.certifications) ? row.certifications : []),
        managerNotes: row.manager_notes || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function toCallOut(row) {
    return {
        id: row.id,
        staffId: row.staff_id,
        filedById: row.filed_by_id,
        date: row.date,
        shift: row.shift || 'Morning',
        reason: row.reason || 'Sick',
        notes: row.notes || undefined,
        coverageStatus: row.coverage_status || 'Uncovered',
        replacementStaffId: row.replacement_staff_id || undefined,
        managerAcknowledged: Boolean(row.manager_acknowledged),
        createdAt: row.created_at,
    };
}
function toCommThread(row) {
    const parseJson = (v, def) => {
        if (v == null)
            return def;
        if (typeof v === 'object')
            return v;
        try {
            return JSON.parse(v);
        }
        catch {
            return def;
        }
    };
    return {
        id: row.id,
        type: row.type || 'general',
        subject: row.subject || '',
        status: row.status || 'Draft',
        createdById: row.created_by_id || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        entries: parseJson(row.entries, []),
        distributedTo: parseJson(row.distributed_to, []),
        distributedAt: row.distributed_at || undefined,
        wasPrinted: Boolean(row.was_printed),
        printedAt: row.printed_at || undefined,
        printedById: row.printed_by_id || undefined,
    };
}
// GET /api/admin/staff
exports.adminRouter.get('/staff', (0, requireAuth_1.requireRole)('staff'), async (_req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT * FROM staff_profiles ORDER BY last_name ASC, first_name ASC');
        res.json(rows.map(toStaffProfile));
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/staff
exports.adminRouter.post('/staff', (0, requireAuth_1.requireRole)('manager'), async (req, res, next) => {
    try {
        const d = req.body;
        const id = d.id || crypto_1.default.randomUUID();
        await pool_1.pool.query(`INSERT INTO staff_profiles (
        id, auth_user_id, employee_number, first_name, last_name, preferred_name,
        role, department, position, hire_date, status, full_time, phone, email,
        emergency_contact, certifications, manager_notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, [
            id, d.authUserId || null, d.employeeNumber || '', d.firstName, d.lastName, d.preferredName || null,
            d.role || 'staff', d.department || 'Dietary', d.position || '', d.hireDate || '', d.status || 'Active',
            Boolean(d.fullTime), d.phone || null, d.email || null,
            d.emergencyContact ? JSON.stringify(d.emergencyContact) : null,
            Array.isArray(d.certifications) ? d.certifications : [],
            d.managerNotes || null,
        ]);
        const { rows } = await pool_1.pool.query('SELECT * FROM staff_profiles WHERE id = $1', [id]);
        res.status(201).json(toStaffProfile(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/admin/staff/:id
exports.adminRouter.put('/staff/:id', (0, requireAuth_1.requireRole)('manager'), async (req, res, next) => {
    try {
        const d = req.body;
        await pool_1.pool.query(`UPDATE staff_profiles SET
        employee_number = COALESCE($1, employee_number),
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        preferred_name = COALESCE($4, preferred_name),
        role = COALESCE($5, role),
        department = COALESCE($6, department),
        position = COALESCE($7, position),
        hire_date = COALESCE($8, hire_date),
        status = COALESCE($9, status),
        full_time = COALESCE($10, full_time),
        phone = COALESCE($11, phone),
        email = COALESCE($12, email),
        manager_notes = COALESCE($13, manager_notes),
        updated_at = NOW()
       WHERE id = $14`, [
            d.employeeNumber, d.firstName, d.lastName, d.preferredName,
            d.role, d.department, d.position, d.hireDate, d.status,
            d.fullTime !== undefined ? Boolean(d.fullTime) : null,
            d.phone, d.email, d.managerNotes,
            req.params.id,
        ]);
        const { rows } = await pool_1.pool.query('SELECT * FROM staff_profiles WHERE id = $1', [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ error: 'Staff profile not found' });
        res.json(toStaffProfile(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/admin/staff/:id
exports.adminRouter.delete('/staff/:id', (0, requireAuth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        await pool_1.pool.query('DELETE FROM staff_profiles WHERE id = $1', [req.params.id]);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
// GET /api/admin/call-outs
exports.adminRouter.get('/call-outs', (0, requireAuth_1.requireRole)('staff'), async (_req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT * FROM call_outs ORDER BY date DESC, created_at DESC');
        res.json(rows.map(toCallOut));
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/call-outs
exports.adminRouter.post('/call-outs', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const d = req.body;
        const id = d.id || crypto_1.default.randomUUID();
        await pool_1.pool.query(`INSERT INTO call_outs (id, staff_id, filed_by_id, date, shift, reason, notes, coverage_status, replacement_staff_id, manager_acknowledged)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
            id, d.staffId, d.filedById || req.userId || 'system', d.date, d.shift || 'Morning',
            d.reason || 'Sick', d.notes || null, d.coverageStatus || 'Uncovered',
            d.replacementStaffId || null, Boolean(d.managerAcknowledged),
        ]);
        const { rows } = await pool_1.pool.query('SELECT * FROM call_outs WHERE id = $1', [id]);
        res.status(201).json(toCallOut(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/admin/call-outs/:id
exports.adminRouter.delete('/call-outs/:id', (0, requireAuth_1.requireRole)('manager'), async (req, res, next) => {
    try {
        await pool_1.pool.query('DELETE FROM call_outs WHERE id = $1', [req.params.id]);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
// GET /api/admin/communications
exports.adminRouter.get('/communications', (0, requireAuth_1.requireRole)('staff'), async (_req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT * FROM communications ORDER BY created_at DESC');
        res.json(rows.map(toCommThread));
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/communications
exports.adminRouter.post('/communications', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const d = req.body;
        const id = d.id || crypto_1.default.randomUUID();
        await pool_1.pool.query(`INSERT INTO communications (id, type, subject, status, created_by_id, entries, distributed_to, was_printed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
            id, d.type || 'general', d.subject || '', d.status || 'Draft',
            d.createdById || req.userId || '', JSON.stringify(d.entries || []),
            JSON.stringify(d.distributedTo || []), Boolean(d.wasPrinted),
        ]);
        const { rows } = await pool_1.pool.query('SELECT * FROM communications WHERE id = $1', [id]);
        res.status(201).json(toCommThread(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/admin/communications/:id
exports.adminRouter.put('/communications/:id', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const d = req.body;
        const { rows: existing } = await pool_1.pool.query('SELECT * FROM communications WHERE id = $1', [req.params.id]);
        if (!existing[0])
            return res.status(404).json({ error: 'Communication thread not found' });
        const entries = d.entries !== undefined ? JSON.stringify(d.entries) : existing[0].entries;
        const distributedTo = d.distributedTo !== undefined ? JSON.stringify(d.distributedTo) : existing[0].distributed_to;
        await pool_1.pool.query(`UPDATE communications SET
         subject = COALESCE($1, subject),
         status = COALESCE($2, status),
         entries = $3,
         distributed_to = $4,
         distributed_at = COALESCE($5, distributed_at),
         was_printed = COALESCE($6, was_printed),
         printed_at = COALESCE($7, printed_at),
         printed_by_id = COALESCE($8, printed_by_id),
         updated_at = NOW()
       WHERE id = $9`, [
            d.subject, d.status, entries, distributedTo,
            d.distributedAt, d.wasPrinted !== undefined ? Boolean(d.wasPrinted) : null,
            d.printedAt, d.printedById, req.params.id,
        ]);
        const { rows } = await pool_1.pool.query('SELECT * FROM communications WHERE id = $1', [req.params.id]);
        res.json(toCommThread(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/admin/communications/:id
exports.adminRouter.delete('/communications/:id', (0, requireAuth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        await pool_1.pool.query('DELETE FROM communications WHERE id = $1', [req.params.id]);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
// ════════════════════════════════════════════════════════════════════════════
// SYSTEM DIAGNOSTICS & AUTONOMOUS REPAIR
// ════════════════════════════════════════════════════════════════════════════
// GET /api/admin/diagnostics — runs full system health audit
exports.adminRouter.get('/diagnostics', (0, requireAuth_1.requireRole)('manager'), async (_req, res, next) => {
    try {
        const report = await healer_1.globalHealerBot.runAudit(false);
        res.json(report);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/repair — executes 1-click safe self-healing repair
exports.adminRouter.post('/repair', (0, requireAuth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const report = await healer_1.globalHealerBot.runAudit(true);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
       VALUES ('SYSTEM_REPAIR', $1, 'diagnostics', 'success', $2)`, [req.userId, JSON.stringify({ autoRemediationsApplied: report.autoRemediationsApplied, healthScorePct: report.healthScorePct })]);
        res.json(report);
    }
    catch (err) {
        next(err);
    }
});
// ════════════════════════════════════════════════════════════════════════════
// COMMUNITY DATA BACKUP & DISASTER RECOVERY
// ════════════════════════════════════════════════════════════════════════════
// GET /api/admin/backup/export — export facility data snapshot
exports.adminRouter.get('/backup/export', (0, requireAuth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const { rows: facilityRows } = await pool_1.pool.query('SELECT * FROM facility_config WHERE id = $1', ['default']);
        const { rows: settingsRows } = await pool_1.pool.query('SELECT * FROM system_settings WHERE id = 1');
        const { rows: residentRows } = await pool_1.pool.query('SELECT * FROM residents ORDER BY name ASC');
        const { rows: recipeRows } = await pool_1.pool.query('SELECT * FROM recipes ORDER BY name ASC');
        const { rows: inventoryRows } = await pool_1.pool.query('SELECT * FROM inventory_items ORDER BY item_name ASC');
        const { rows: staffRows } = await pool_1.pool.query('SELECT * FROM staff_profiles ORDER BY last_name ASC');
        const backupPayload = {
            meta: {
                application: 'Shoreline Care OS',
                version: '5.0.0',
                exportedAt: new Date().toISOString(),
                exportedBy: req.userId || 'admin',
                facilityName: facilityRows[0]?.facility_name || 'Shoreline Care Center',
                records: {
                    residents: residentRows.length,
                    recipes: recipeRows.length,
                    inventory: inventoryRows.length,
                    staff: staffRows.length,
                },
            },
            data: {
                facilityConfig: facilityRows[0] || null,
                systemSettings: settingsRows[0] || null,
                residents: residentRows,
                recipes: recipeRows,
                inventory: inventoryRows,
                staff: staffRows,
            },
        };
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
       VALUES ('BACKUP_EXPORT', $1, 'database', 'success', $2)`, [req.userId, JSON.stringify({ records: backupPayload.meta.records })]);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="shoreline_backup_${new Date().toISOString().slice(0, 10)}.json"`);
        res.json(backupPayload);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/backup/restore — safe pre-flight validated restore
exports.adminRouter.post('/backup/restore', (0, requireAuth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const backup = req.body;
        if (!backup?.meta?.application || !backup?.data) {
            return res.status(400).json({
                error: 'Invalid backup file format. Expected a valid Shoreline Care OS backup payload.',
            });
        }
        const { residents = [], recipes = [], inventory = [] } = backup.data;
        // If dryRun query parameter is passed, just inspect and validate
        if (req.query.dryRun === 'true') {
            return res.json({
                valid: true,
                summary: {
                    facilityName: backup.meta.facilityName,
                    exportedAt: backup.meta.exportedAt,
                    residentsToRestore: residents.length,
                    recipesToRestore: recipes.length,
                    inventoryToRestore: inventory.length,
                },
            });
        }
        // Safely upsert records without wiping database blindly
        let restoredResidents = 0;
        for (const r of residents) {
            if (!r.name)
                continue;
            await pool_1.pool.query(`INSERT INTO residents (id, name, room, diet_type, texture, serving_location, is_npo, allergies, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           room = EXCLUDED.room,
           diet_type = EXCLUDED.diet_type,
           texture = EXCLUDED.texture,
           serving_location = EXCLUDED.serving_location,
           is_npo = EXCLUDED.is_npo,
           allergies = EXCLUDED.allergies,
           updated_at = NOW()`, [
                r.id || crypto_1.default.randomUUID(),
                r.name,
                r.room || '101',
                r.diet_type || 'Regular',
                r.texture || 'Regular',
                r.serving_location || 'Dining Room',
                Boolean(r.is_npo),
                typeof r.allergies === 'string' ? r.allergies : JSON.stringify(r.allergies || []),
            ]);
            restoredResidents++;
        }
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
       VALUES ('BACKUP_RESTORE', $1, 'database', 'success', $2)`, [req.userId, JSON.stringify({ restoredResidents, sourceTimestamp: backup.meta.exportedAt })]);
        res.json({
            success: true,
            message: `Successfully restored and synchronized ${restoredResidents} resident clinical records from backup snapshot.`,
            restoredCount: restoredResidents,
        });
    }
    catch (err) {
        res.status(500).json({ error: `Restore process encountered an error: ${err.message}` });
    }
});
