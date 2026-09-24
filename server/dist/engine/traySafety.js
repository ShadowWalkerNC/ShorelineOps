"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signTray = signTray;
exports.readTray = readTray;
exports.verifyTray = verifyTray;
const crypto_1 = require("crypto");
const pool_1 = require("../db/pool");
const ephemeralKey = (0, crypto_1.randomBytes)(32).toString('hex');
const key = () => process.env.TRAY_SIGNING_SECRET || process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('Tray signing key required'); })() : ephemeralKey);
function signTray(claims) {
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `ST1.${body}.${(0, crypto_1.createHmac)('sha256', key()).update(body).digest('hex')}`;
}
function readTray(raw) {
    if (typeof raw !== 'string' || raw.length > 8192)
        return null;
    const [tag, body, mac, extra] = raw.split('.');
    if (tag !== 'ST1' || !body || !/^[a-f0-9]{64}$/.test(mac || '') || extra)
        return null;
    const expected = (0, crypto_1.createHmac)('sha256', key()).update(body).digest();
    if (!(0, crypto_1.timingSafeEqual)(expected, Buffer.from(mac, 'hex')))
        return null;
    try {
        const c = JSON.parse(Buffer.from(body, 'base64url').toString());
        if (!c.residentId || !c.ticketId || !Number.isSafeInteger(c.version) || c.version < 1 || !Array.isArray(c.foods) || !c.foods.length || !Array.isArray(c.allergies) || !Array.isArray(c.beverages))
            return null;
        return c;
    }
    catch {
        return null;
    }
}
function list(value) {
    if (value === '{}')
        return [];
    if (Array.isArray(value) && value.every(x => typeof x === 'string'))
        return value;
    if (typeof value === 'string') {
        try {
            return list(JSON.parse(value));
        }
        catch {
            if (value === '{}')
                return [];
        }
    }
    return null;
}
const sorted = (v) => JSON.stringify(v.map(x => x.trim().toLowerCase()).sort());
/** Shared fail-closed gate. A caller performing a write must supply its transaction client. */
async function verifyTray(raw, db = pool_1.pool, lock = false) {
    const c = readTray(raw);
    const hold = (message, status = 'HOLD_TRAY_RD_SIGNOFF') => ({ status, message, claims: c });
    if (!c)
        return hold('Invalid or legacy ticket. Reprint a signed tray card.', 'INVALID_HASH');
    const { rows } = await db.query('SELECT * FROM residents WHERE id = $1' + (lock && pool_1.databaseDialect === 'postgres' ? ' FOR UPDATE' : ''), [c.residentId]);
    const r = rows[0];
    if (!r || r.status !== 'Active')
        return hold('Resident is not active.', 'INVALID_HASH');
    const details = { residentName: r.name, roomBed: r.room, currentProfileVersion: Number(r.profile_version || 1), ticketProfileVersion: c.version };
    if (r.is_npo)
        return { ...hold('NPO: All oral service is prohibited.', 'NPO_ALERT'), ...details };
    const allergies = list(r.allergies);
    if (!allergies || !r.texture || !r.diet_type)
        return hold('Clinical data is incomplete. Hold tray.');
    if (c.version !== details.currentProfileVersion || c.diet !== r.diet_type || c.texture !== r.texture || sorted(c.allergies) !== sorted(allergies))
        return { ...hold('Orders changed. Reprint the tray card.', 'SUPERSEDED'), ...details };
    const pending = await db.query("SELECT id FROM ehr_reconciliation_queue WHERE resident_id = $1 AND status = 'PENDING_TRIAGE' LIMIT 1", [r.id]);
    if (pending.rows.length)
        return { ...hold('Clinical change awaits reconciliation. Hold tray.'), ...details };
    const level = { Regular: 7, Pureed: 4, 'Mechanical Soft': 5, 'Minced & Moist': 5, 'Soft & Bite-Sized': 6 };
    if (!level[r.texture])
        return hold('Unknown food texture. Hold tray.');
    // No trustworthy nutrient/liquid recipe contract exists for restricted diets yet.
    if (r.diet_type !== 'Regular' || Number(r.fluid_restriction_ml || 0) > 0 || c.beverages.some(x => x !== 'Water'))
        return hold('Restricted diet or beverage data requires verified recipe specifications. Hold tray.');
    for (const food of c.foods) {
        const recipes = await db.query('SELECT allergens, iddsi_level FROM recipes WHERE name = $1', [food]);
        if (recipes.rows.length !== 1)
            return hold('Food recipe is missing or ambiguous. Hold tray.');
        const recipe = recipes.rows[0], contained = list(recipe.allergens);
        if (!contained || recipe.iddsi_level == null)
            return hold('Recipe safety data is missing. Hold tray.');
        if (Number(recipe.iddsi_level) !== level[r.texture])
            return hold('Recipe texture does not match the order. Hold tray.');
        if (allergies.some(a => contained.some(b => a.trim().toLowerCase() === b.trim().toLowerCase())))
            return hold('Allergen conflict. Do not serve.');
        // Custom allergy naming is not a validated canonical vocabulary.
        if (allergies.length)
            return hold('Allergy equivalence requires verified canonical recipe data. Hold tray.');
    }
    return { status: 'VALID', message: 'Current signed tray verified.', claims: c, ...details };
}
