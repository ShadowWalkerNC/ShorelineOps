"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const express_1 = __importDefault(require("express"));
process.env.SQLITE_PATH = (0, node_path_1.join)((0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'shoreline-tray-')), 'test.db');
delete process.env.DATABASE_URL;
process.env.JWT_SECRET = 'test-only-tray-secret-at-least-32-characters';
(0, node_test_1.after)(async () => {
    const { pool } = await Promise.resolve().then(() => __importStar(require('./db/pool')));
    await pool.end();
});
(0, node_test_1.test)('signed trays fail closed and action boundary rechecks current safety', async () => {
    const { pool } = await Promise.resolve().then(() => __importStar(require('./db/pool')));
    const { signTray, verifyTray, readTray } = await Promise.resolve().then(() => __importStar(require('./engine/traySafety')));
    const { trayrunsRouter } = await Promise.resolve().then(() => __importStar(require('./routes/trayruns')));
    await pool.query('CREATE TABLE residents (id TEXT PRIMARY KEY, name TEXT, room TEXT, status TEXT, profile_version INTEGER, is_npo INTEGER, allergies TEXT, texture TEXT, diet_type TEXT, fluid_restriction_ml INTEGER)');
    await pool.query('CREATE TABLE ehr_reconciliation_queue (id TEXT, resident_id TEXT, status TEXT)');
    await pool.query('CREATE TABLE recipes (id TEXT, name TEXT, category TEXT DEFAULT "Entree", base_servings NUMERIC DEFAULT 10, prep_time_mins INTEGER DEFAULT 15, cook_time_mins INTEGER DEFAULT 30, haccp_temp_f NUMERIC DEFAULT 165, allergens TEXT, iddsi_level INTEGER, ingredients TEXT DEFAULT "[]", steps TEXT DEFAULT "[]", notes TEXT DEFAULT "", cost_per_serving NUMERIC DEFAULT 0, clinical_verified INTEGER DEFAULT 0, verified_by TEXT, verified_at TEXT, approved_diets TEXT DEFAULT "[]", fluid_ml_per_serving INTEGER, updated_at TEXT)');
    await pool.query('CREATE TABLE recipe_nutrients (recipe_id TEXT PRIMARY KEY, calories NUMERIC DEFAULT 0, protein_g NUMERIC DEFAULT 0, carbs_g NUMERIC DEFAULT 0, fat_g NUMERIC DEFAULT 0, sat_fat_g NUMERIC DEFAULT 0, sodium_mg NUMERIC DEFAULT 0, potassium_mg NUMERIC DEFAULT 0, phosphorus_mg NUMERIC DEFAULT 0, fiber_g NUMERIC DEFAULT 0, sugar_g NUMERIC DEFAULT 0, calculated_at TEXT)');
    await pool.query('CREATE TABLE hydration_records (id TEXT PRIMARY KEY, resident_id TEXT, consumed_ml INTEGER, recorded_at TEXT)');
    await pool.query('CREATE TABLE vendor_items (id TEXT PRIMARY KEY, vendor_sku TEXT, name TEXT, unit_cost NUMERIC, pack_size TEXT, uom TEXT, active INTEGER DEFAULT 1)');
    await pool.query('CREATE TABLE tray_runs (id TEXT PRIMARY KEY, meal_slot TEXT, service_date TEXT)');
    await pool.query('CREATE TABLE tray_events (id TEXT, run_id TEXT, resident_id TEXT, ticket_id TEXT, event TEXT, by TEXT, note TEXT, at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP)');
    await pool.query('CREATE TABLE audit_log (action TEXT, user_id TEXT, resource_id TEXT, resource_type TEXT, outcome TEXT, details TEXT)');
    await pool.query("INSERT INTO residents VALUES ('r1','Test','1','Active',1,0,'[]','Regular','Regular',NULL)");
    await pool.query("INSERT INTO recipes (id, name, allergens, iddsi_level) VALUES ('rec-rice','Rice','[]',7)");
    await pool.query("INSERT INTO tray_runs VALUES ('run1','lunch','2026-09-23')");
    const claims = { residentId: 'r1', ticketId: 'TKT-test', version: 1, diet: 'Regular', texture: 'Regular', allergies: [], foods: ['Rice'], beverages: ['Water'], mealSlot: 'lunch', serviceDate: '2026-09-23' };
    const rawQrPayload = signTray(claims);
    strict_1.default.equal((await verifyTray(rawQrPayload)).status, 'VALID');
    strict_1.default.equal(readTray(rawQrPayload + 'x'), null);
    strict_1.default.equal((await verifyTray('TKT-test:1:fake')).status, 'INVALID_HASH');
    strict_1.default.equal((await verifyTray(signTray({ ...claims, version: 2 }))).status, 'SUPERSEDED');
    await pool.query("INSERT INTO ehr_reconciliation_queue VALUES ('q','r1','PENDING_TRIAGE')");
    strict_1.default.notEqual((await verifyTray(rawQrPayload)).status, 'VALID');
    await pool.query('DELETE FROM ehr_reconciliation_queue');
    await pool.query("UPDATE recipes SET iddsi_level = 4 WHERE id = 'rec-rice'");
    strict_1.default.notEqual((await verifyTray(rawQrPayload)).status, 'VALID');
    await pool.query("UPDATE recipes SET iddsi_level = 7 WHERE id = 'rec-rice'");
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use((req, _res, next) => { req.userRole = 'staff'; next(); });
    app.use('/trayruns', trayrunsRouter);
    app.use((err, _req, res, _next) => res.status(400).json({ error: err.message }));
    const server = app.listen(0);
    const address = server.address();
    const post = (body) => fetch(`http://127.0.0.1:${address.port}/trayruns/run1/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    try {
        strict_1.default.equal((await post({ residentId: 'r1', event: 'assembled' })).status, 400);
        strict_1.default.equal((await post({ rawQrPayload, event: 'assembled' })).status, 201);
        await pool.query('UPDATE residents SET is_npo = 1');
        strict_1.default.equal((await post({ rawQrPayload, event: 'dispatched' })).status, 409);
        strict_1.default.equal((await pool.query('SELECT * FROM tray_events')).rows.length, 1);
        await pool.query('UPDATE residents SET is_npo = 0');
        await pool.query('DROP TABLE ehr_reconciliation_queue');
        await strict_1.default.rejects(() => verifyTray(rawQrPayload));
        strict_1.default.equal((await post({ rawQrPayload, event: 'dispatched' })).status, 400);
        strict_1.default.equal((await pool.query('SELECT * FROM tray_events')).rows.length, 1);
    }
    finally {
        await new Promise(resolve => server.close(() => resolve()));
        await pool.query('CREATE TABLE ehr_reconciliation_queue (id TEXT, resident_id TEXT, status TEXT)');
    }
});
(0, node_test_1.test)('clinical provenance: canonical allergen synonyms, restricted diet ceilings, fluid allowance, and tamper-reset', async () => {
    const { pool } = await Promise.resolve().then(() => __importStar(require('./db/pool')));
    const { signTray, verifyTray, normalizeCanonicalAllergen } = await Promise.resolve().then(() => __importStar(require('./engine/traySafety')));
    const { recipesRouter } = await Promise.resolve().then(() => __importStar(require('./routes/recipes')));
    strict_1.default.equal(normalizeCanonicalAllergen('Dairy'), 'milk');
    strict_1.default.equal(normalizeCanonicalAllergen('Butter'), 'milk');
    strict_1.default.equal(normalizeCanonicalAllergen('Gluten'), 'wheat');
    strict_1.default.equal(normalizeCanonicalAllergen('Shrimp'), 'crustacean shellfish');
    strict_1.default.equal(normalizeCanonicalAllergen('Unknown Exotic Fruit'), null);
    await pool.query("INSERT INTO residents VALUES ('r-clin','Clinical Resident','204','Active',1,0,'[\"Dairy\"]','Regular','Low Sodium',1000)");
    await pool.query("INSERT INTO recipes (id, name, allergens, iddsi_level) VALUES ('rec-herb-chicken','Herb Chicken','[]',7)");
    await pool.query("INSERT INTO recipe_nutrients (recipe_id, calories, protein_g, sodium_mg, sat_fat_g) VALUES ('rec-herb-chicken', 320, 28, 240, 2.5)");
    await pool.query("INSERT INTO recipes (id, name, allergens, iddsi_level) VALUES ('rec-water','Water','[]',7)");
    await pool.query("INSERT INTO recipe_nutrients (recipe_id, calories, protein_g, sodium_mg, sat_fat_g) VALUES ('rec-water', 0, 0, 0, 0)");
    const ticket = signTray({
        residentId: 'r-clin',
        ticketId: 'TKT-clin-1',
        version: 1,
        diet: 'Low Sodium',
        texture: 'Regular',
        allergies: ['Dairy'],
        foods: ['Herb Chicken'],
        beverages: ['Water'],
        mealSlot: 'dinner',
        serviceDate: '2026-10-16',
    });
    // 1. Unverified recipes fail closed even with 0 allergens
    const unverifiedCheck = await verifyTray(ticket);
    strict_1.default.equal(unverifiedCheck.status, 'HOLD_TRAY_RD_SIGNOFF');
    // 2. Mount recipesRouter with role-injected test harness
    let currentRole = 'staff';
    let currentUserId = 'user-staff-1';
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use((req, _res, next) => {
        req.userRole = currentRole;
        req.userId = currentUserId;
        next();
    });
    app.use('/recipes', recipesRouter);
    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/recipes`;
    try {
        // Staff and admin cannot clinically verify recipes (strictly dietitian/manager)
        const deniedStaff = await fetch(`${baseUrl}/rec-herb-chicken/verify-clinical`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedDiets: ['Low Sodium'], fluidMlPerServing: 60, canonicalAllergens: [] }),
        });
        strict_1.default.equal(deniedStaff.status, 403);
        currentRole = 'admin';
        const deniedAdmin = await fetch(`${baseUrl}/rec-herb-chicken/verify-clinical`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedDiets: ['Low Sodium'], fluidMlPerServing: 60, canonicalAllergens: [] }),
        });
        strict_1.default.equal(deniedAdmin.status, 403);
        // Dietitian can verify both recipes
        currentRole = 'dietitian';
        currentUserId = 'rd-sarah-1';
        const verifyChicken = await fetch(`${baseUrl}/rec-herb-chicken/verify-clinical`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedDiets: ['Low Sodium'], fluidMlPerServing: 60, canonicalAllergens: [] }),
        });
        strict_1.default.equal(verifyChicken.status, 200);
        const verifyWater = await fetch(`${baseUrl}/rec-water/verify-clinical`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedDiets: ['Low Sodium', 'Regular'], fluidMlPerServing: 240, canonicalAllergens: [] }),
        });
        strict_1.default.equal(verifyWater.status, 200);
        // 3. Now that both recipes are RD-verified for Low Sodium, dairy-free, and total 300 mL <= 1000 mL, tray is VALID!
        const validCheck = await verifyTray(ticket);
        strict_1.default.equal(validCheck.status, 'VALID');
        // 4. Canonical synonym conflict: recipe containing "Butter" blocks resident with "Dairy" allergy
        await pool.query("UPDATE recipes SET allergens = '[\"Butter\"]' WHERE id = 'rec-herb-chicken'");
        const synonymConflict = await verifyTray(ticket);
        strict_1.default.equal(synonymConflict.status, 'HOLD_TRAY_RD_SIGNOFF');
        strict_1.default.match(synonymConflict.message, /Allergen conflict/i);
        await pool.query("UPDATE recipes SET allergens = '[]' WHERE id = 'rec-herb-chicken'");
        // 5. Nutrient ceiling enforcement: Low Sodium max is 600 mg per meal
        await pool.query("UPDATE recipe_nutrients SET sodium_mg = 680 WHERE recipe_id = 'rec-herb-chicken'");
        const sodiumHold = await verifyTray(ticket);
        strict_1.default.equal(sodiumHold.status, 'HOLD_TRAY_RD_SIGNOFF');
        strict_1.default.match(sodiumHold.message, /nutrient ceiling exceeded/i);
        await pool.query("UPDATE recipe_nutrients SET sodium_mg = 240 WHERE recipe_id = 'rec-herb-chicken'");
        // 6. Fluid restriction enforcement: 750 mL already consumed today + 300 mL tray = 1050 mL > 1000 mL limit
        await pool.query("INSERT INTO hydration_records VALUES ('hyd-1', 'r-clin', 750, '2026-10-16T09:00:00Z')");
        const fluidHold = await verifyTray(ticket);
        strict_1.default.equal(fluidHold.status, 'HOLD_TRAY_RD_SIGNOFF');
        strict_1.default.match(fluidHold.message, /Fluid restriction allowance exceeded/i);
        await pool.query("DELETE FROM hydration_records WHERE id = 'hyd-1'");
        strict_1.default.equal((await verifyTray(ticket)).status, 'VALID');
        // 7. Kitchen recipe edit automatically invalidates clinical verification (tamper-reset)
        currentRole = 'staff';
        const editRes = await fetch(`${baseUrl}/rec-herb-chicken`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: 'Modified seasoning on line' }),
        });
        strict_1.default.equal(editRes.status, 200);
        const afterEditHold = await verifyTray(ticket);
        strict_1.default.equal(afterEditHold.status, 'HOLD_TRAY_RD_SIGNOFF');
    }
    finally {
        await new Promise(resolve => server.close(() => resolve()));
    }
});
