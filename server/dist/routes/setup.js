"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const pool_1 = require("../db/pool");
const seed_1 = require("../db/seed");
exports.setupRouter = (0, express_1.Router)();
function requireSetupSecret(req, res) {
    const expected = process.env.SETUP_BOOTSTRAP_SECRET || (process.env.NODE_ENV !== 'production' ? 'shoreline-bootstrap-dev-secret-2026' : undefined);
    if (!expected || expected.length < 16) {
        res.status(503).json({
            error: 'Setup is disabled. Set SETUP_BOOTSTRAP_SECRET (min 16 chars) to enable first-time initialization.',
        });
        return false;
    }
    const header = req.headers['x-setup-secret'] ?? req.headers['authorization'];
    const provided = typeof header === 'string'
        ? (header.startsWith('Bearer ') ? header.slice(7) : header)
        : '';
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto_1.default.timingSafeEqual(a, b)) {
        res.status(401).json({ error: 'Invalid setup secret. Please enter the correct bootstrap passphrase.' });
        return false;
    }
    return true;
}
// GET /api/setup/status — public, minimal disclosure
exports.setupRouter.get('/status', async (_req, res) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT is_initialized, facility_name, facility_type FROM facility_config WHERE id = $1', ['default']);
        const config = rows[0];
        if (!config || !config.is_initialized) {
            return res.json({ isInitialized: false });
        }
        return res.json({
            isInitialized: true,
            facilityName: config.facility_name,
            facilityType: config.facility_type,
        });
    }
    catch {
        res.json({ isInitialized: false });
    }
});
// POST /api/setup/initialize — requires SETUP_BOOTSTRAP_SECRET
exports.setupRouter.post('/initialize', async (req, res, next) => {
    try {
        if (!requireSetupSecret(req, res))
            return;
        // Check before any setup write; request flags cannot enable server demo mode.
        if (req.body?.initMode === 'sample' || req.body?.loadDemoData === true) {
            (0, seed_1.assertDemoSeedAllowed)();
        }
        const { rows: existing } = await pool_1.pool.query('SELECT is_initialized FROM facility_config WHERE id = $1', ['default']);
        if (existing[0]?.is_initialized) {
            return res.status(400).json({ error: 'Facility setup has already been completed and locked.' });
        }
        const body = zod_1.z.object({
            facilityName: zod_1.z.string().min(2),
            npiLicense: zod_1.z.string().optional(),
            address: zod_1.z.string().optional(),
            primaryContactEmail: zod_1.z.string().email(),
            facilityType: zod_1.z.enum(['Assisted Living', 'Skilled Nursing', 'Memory Care', 'Continuing Care']),
            wings: zod_1.z.array(zod_1.z.string()).min(1),
            diningRooms: zod_1.z.array(zod_1.z.string()).min(1),
            adminName: zod_1.z.string().min(2),
            adminEmail: zod_1.z.string().email(),
            adminPassword: zod_1.z
                .string()
                .min(12, 'Password must be at least 12 characters long')
                .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
                .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
                .regex(/[0-9]/, 'Password must contain at least one number')
                .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
            baaSigneeName: zod_1.z.string().min(2),
            initMode: zod_1.z.enum(['clean', 'sample']),
        }).parse(req.body);
        const hashedPassword = await bcryptjs_1.default.hash(body.adminPassword, 12);
        await pool_1.pool.query(`INSERT INTO facility_config (
        id, facility_name, npi_license, address, primary_contact_email,
        facility_type, wings, dining_rooms, is_initialized, baa_accepted_at, baa_signee_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), $9)
      ON CONFLICT (id) DO UPDATE SET
        facility_name = EXCLUDED.facility_name,
        npi_license = EXCLUDED.npi_license,
        address = EXCLUDED.address,
        primary_contact_email = EXCLUDED.primary_contact_email,
        facility_type = EXCLUDED.facility_type,
        wings = EXCLUDED.wings,
        dining_rooms = EXCLUDED.dining_rooms,
        is_initialized = true,
        baa_accepted_at = NOW(),
        baa_signee_name = EXCLUDED.baa_signee_name,
        updated_at = NOW()`, [
            'default',
            body.facilityName,
            body.npiLicense || '',
            body.address || '',
            body.primaryContactEmail,
            body.facilityType,
            JSON.stringify(body.wings),
            JSON.stringify(body.diningRooms),
            body.baaSigneeName,
        ]);
        await pool_1.pool.query(`INSERT INTO users (id, name, email, password, role, mfa_enabled, active)
       VALUES ($1, $2, $3, $4, 'admin', true, true)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         password = EXCLUDED.password,
         role = 'admin',
         active = true`, [crypto_1.default.randomUUID(), body.adminName, body.adminEmail.toLowerCase(), hashedPassword]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, resource_type, outcome, details)
       VALUES ('SETUP_INITIALIZE', 'facility_config', 'success', $1)`, [JSON.stringify({ facilityName: body.facilityName, adminEmail: body.adminEmail, mode: body.initMode })]);
        if (body.initMode === 'sample') {
            await (0, seed_1.runSeed)();
        }
        res.json({ success: true, message: 'Facility setup successfully completed.' });
    }
    catch (err) {
        next(err);
    }
});
