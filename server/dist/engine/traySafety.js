"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.THERAPEUTIC_DIET_CONTRACTS = exports.CANONICAL_ALLERGEN_SYNONYMS = void 0;
exports.signTray = signTray;
exports.readTray = readTray;
exports.normalizeCanonicalAllergen = normalizeCanonicalAllergen;
exports.resolveDietContract = resolveDietContract;
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
exports.CANONICAL_ALLERGEN_SYNONYMS = {
    milk: ['milk', 'dairy', 'lactose', 'casein', 'whey', 'butter', 'cheese', 'cream'],
    eggs: ['eggs', 'egg', 'albumin', 'mayonnaise'],
    fish: ['fish', 'salmon', 'cod', 'tuna', 'tilapia', 'halibut', 'haddock'],
    'crustacean shellfish': ['crustacean shellfish', 'shellfish', 'shrimp', 'crab', 'lobster', 'prawn', 'crayfish'],
    'tree nuts': ['tree nuts', 'tree nut', 'almond', 'almonds', 'walnut', 'walnuts', 'pecan', 'pecans', 'cashew', 'cashews', 'pistachio', 'pistachios', 'hazelnut', 'hazelnuts', 'macadamia'],
    peanuts: ['peanuts', 'peanut', 'arachis'],
    wheat: ['wheat', 'gluten', 'triticale', 'spelt', 'semolina', 'farina'],
    soybeans: ['soybeans', 'soybean', 'soy', 'soya', 'tofu', 'edamame', 'lecithin (soy)'],
    sesame: ['sesame', 'tahini', 'sesame seeds', 'sesame oil'],
    pork: ['pork', 'bacon', 'ham', 'swine'],
    beef: ['beef', 'veal'],
    poultry: ['poultry', 'chicken', 'turkey'],
    citrus: ['citrus', 'orange', 'lemon', 'lime', 'grapefruit'],
    strawberries: ['strawberries', 'strawberry'],
    tomato: ['tomato', 'tomatoes', 'nightshade'],
    corn: ['corn', 'maize'],
    msg: ['msg', 'monosodium glutamate'],
    sulfites: ['sulfites', 'sulfite', 'sulphites'],
};
const ALLERGEN_LOOKUP = new Map();
for (const [canonical, synonyms] of Object.entries(exports.CANONICAL_ALLERGEN_SYNONYMS)) {
    ALLERGEN_LOOKUP.set(canonical, canonical);
    for (const syn of synonyms)
        ALLERGEN_LOOKUP.set(syn.toLowerCase(), canonical);
}
function normalizeCanonicalAllergen(raw) {
    if (typeof raw !== 'string')
        return null;
    const token = raw.trim().toLowerCase();
    if (!token)
        return null;
    return ALLERGEN_LOOKUP.get(token) ?? null;
}
exports.THERAPEUTIC_DIET_CONTRACTS = {
    'low sodium': { maxSodiumMg: 600, maxSatFatG: 7 },
    'no added salt': { maxSodiumMg: 600, maxSatFatG: 7 },
    nas: { maxSodiumMg: 600, maxSatFatG: 7 },
    cardiac: { maxSodiumMg: 600, maxSatFatG: 7 },
    'heart healthy': { maxSodiumMg: 600, maxSatFatG: 7 },
    'no concentrated sweets': { maxCarbsG: 65, maxSugarG: 15 },
    ncs: { maxCarbsG: 65, maxSugarG: 15 },
    'carb-controlled': { maxCarbsG: 65, maxSugarG: 15 },
    'consistent carbohydrate': { maxCarbsG: 65, maxSugarG: 15 },
    diabetic: { maxCarbsG: 65, maxSugarG: 15 },
    renal: { maxSodiumMg: 600, maxPotassiumMg: 700, maxPhosphorusMg: 350 },
    'high protein': { minProteinG: 15, minCalories: 350 },
    'high calorie': { minProteinG: 15, minCalories: 350 },
    fortified: { minProteinG: 15, minCalories: 350 },
};
function resolveDietContract(dietType) {
    if (typeof dietType !== 'string')
        return null;
    return exports.THERAPEUTIC_DIET_CONTRACTS[dietType.trim().toLowerCase()] ?? null;
}
function isClinicallyVerifiedRecipe(recipe) {
    return Boolean(recipe.clinical_verified) && typeof recipe.verified_by === 'string' && recipe.verified_by.trim().length > 0;
}
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
    const isRestrictedDiet = r.diet_type !== 'Regular';
    const fluidRestrictionMl = Number(r.fluid_restriction_ml || 0);
    const hasFluidRestriction = Number.isFinite(fluidRestrictionMl) && fluidRestrictionMl > 0;
    const hasNonWaterBeverage = c.beverages.some(x => x !== 'Water');
    const canonicalResidentAllergies = [];
    for (const a of allergies) {
        const mapped = normalizeCanonicalAllergen(a);
        if (mapped)
            canonicalResidentAllergies.push(mapped);
    }
    const hasUnmappedResidentAllergy = allergies.length > 0 && canonicalResidentAllergies.length !== allergies.length;
    const resolvedFoodRecipes = [];
    for (const food of c.foods) {
        const recipes = await db.query('SELECT * FROM recipes WHERE name = $1', [food]);
        if (recipes.rows.length !== 1)
            return hold('Food recipe is missing or ambiguous. Hold tray.');
        const recipe = recipes.rows[0], contained = list(recipe.allergens);
        if (!contained || recipe.iddsi_level == null)
            return hold('Recipe safety data is missing. Hold tray.');
        if (Number(recipe.iddsi_level) !== level[r.texture])
            return hold('Recipe texture does not match the order. Hold tray.');
        if (allergies.some(a => contained.some(b => {
            const rawMatch = a.trim().toLowerCase() === b.trim().toLowerCase();
            const canonA = normalizeCanonicalAllergen(a);
            const canonB = normalizeCanonicalAllergen(b);
            return rawMatch || (canonA !== null && canonA === canonB);
        })))
            return hold('Allergen conflict. Do not serve.');
        if (allergies.length) {
            if (hasUnmappedResidentAllergy || !isClinicallyVerifiedRecipe(recipe) || contained.some(b => normalizeCanonicalAllergen(b) === null)) {
                return hold('Allergy equivalence requires verified canonical recipe data. Hold tray.');
            }
        }
        resolvedFoodRecipes.push(recipe);
    }
    const resolvedBeverageRecipes = [];
    if (hasNonWaterBeverage || hasFluidRestriction) {
        for (const bev of c.beverages) {
            if (bev === 'Water' && !hasFluidRestriction)
                continue;
            const bevRows = await db.query('SELECT * FROM recipes WHERE name = $1', [bev]);
            if (bevRows.rows.length !== 1)
                return hold('Restricted diet or beverage data requires verified recipe specifications. Hold tray.');
            const bevRecipe = bevRows.rows[0], contained = list(bevRecipe.allergens);
            if (!contained || !isClinicallyVerifiedRecipe(bevRecipe)) {
                return hold('Restricted diet or beverage data requires verified recipe specifications. Hold tray.');
            }
            if (allergies.some(a => contained.some(b => {
                const rawMatch = a.trim().toLowerCase() === b.trim().toLowerCase();
                const canonA = normalizeCanonicalAllergen(a);
                const canonB = normalizeCanonicalAllergen(b);
                return rawMatch || (canonA !== null && canonA === canonB);
            })))
                return hold('Allergen conflict. Do not serve.');
            if (allergies.length && (hasUnmappedResidentAllergy || contained.some(b => normalizeCanonicalAllergen(b) === null))) {
                return hold('Allergy equivalence requires verified canonical recipe data. Hold tray.');
            }
            resolvedBeverageRecipes.push(bevRecipe);
        }
    }
    if (isRestrictedDiet) {
        const contract = resolveDietContract(r.diet_type);
        if (!contract)
            return hold('Restricted diet or beverage data requires verified recipe specifications. Hold tray.');
        const allTrayRecipes = [...resolvedFoodRecipes, ...resolvedBeverageRecipes];
        let totalSodiumMg = 0, totalSatFatG = 0, totalCarbsG = 0, totalSugarG = 0, totalPotassiumMg = 0, totalPhosphorusMg = 0, totalProteinG = 0, totalCalories = 0;
        for (const recipe of allTrayRecipes) {
            if (!isClinicallyVerifiedRecipe(recipe)) {
                return hold('Restricted diet or beverage data requires verified recipe specifications. Hold tray.');
            }
            const approvedDiets = list(recipe.approved_diets);
            if (!approvedDiets || !approvedDiets.some(d => d.trim().toLowerCase() === String(r.diet_type).trim().toLowerCase())) {
                return hold('Restricted diet or beverage data requires verified recipe specifications. Hold tray.');
            }
            if (!recipe.id)
                return hold('Restricted diet or beverage data requires verified recipe specifications. Hold tray.');
            const nutRows = await db.query('SELECT * FROM recipe_nutrients WHERE recipe_id = $1', [recipe.id]);
            if (nutRows.rows.length !== 1)
                return hold('Restricted diet or beverage data requires verified recipe specifications. Hold tray.');
            const nut = nutRows.rows[0];
            totalSodiumMg += Number(nut.sodium_mg || 0);
            totalSatFatG += Number(nut.sat_fat_g || 0);
            totalCarbsG += Number(nut.carbs_g || 0);
            totalSugarG += Number(nut.sugar_g || 0);
            totalPotassiumMg += Number(nut.potassium_mg || 0);
            totalPhosphorusMg += Number(nut.phosphorus_mg || 0);
            totalProteinG += Number(nut.protein_g || 0);
            totalCalories += Number(nut.calories || 0);
        }
        if ((contract.maxSodiumMg !== undefined && totalSodiumMg > contract.maxSodiumMg) ||
            (contract.maxSatFatG !== undefined && totalSatFatG > contract.maxSatFatG) ||
            (contract.maxCarbsG !== undefined && totalCarbsG > contract.maxCarbsG) ||
            (contract.maxSugarG !== undefined && totalSugarG > contract.maxSugarG) ||
            (contract.maxPotassiumMg !== undefined && totalPotassiumMg > contract.maxPotassiumMg) ||
            (contract.maxPhosphorusMg !== undefined && totalPhosphorusMg > contract.maxPhosphorusMg) ||
            (contract.minProteinG !== undefined && totalProteinG < contract.minProteinG) ||
            (contract.minCalories !== undefined && totalCalories < contract.minCalories)) {
            return hold('Therapeutic diet nutrient ceiling exceeded. Hold tray.');
        }
    }
    if (hasFluidRestriction) {
        const allTrayRecipes = [...resolvedFoodRecipes, ...resolvedBeverageRecipes];
        let trayFluidMl = 0;
        for (const recipe of allTrayRecipes) {
            if (!isClinicallyVerifiedRecipe(recipe) || recipe.fluid_ml_per_serving === null || recipe.fluid_ml_per_serving === undefined) {
                return hold('Restricted diet or beverage data requires verified recipe specifications. Hold tray.');
            }
            const ml = Number(recipe.fluid_ml_per_serving);
            if (!Number.isFinite(ml) || ml < 0) {
                return hold('Restricted diet or beverage data requires verified recipe specifications. Hold tray.');
            }
            trayFluidMl += ml;
        }
        if (c.beverages.length > 0 && trayFluidMl <= 0) {
            return hold('Restricted diet or beverage data requires verified recipe specifications. Hold tray.');
        }
        const hydRows = await db.query('SELECT COALESCE(SUM(consumed_ml), 0) AS consumed FROM hydration_records WHERE resident_id = $1 AND substr(CAST(recorded_at AS TEXT), 1, 10) = $2', [r.id, c.serviceDate]);
        const consumedTodayMl = Number(hydRows.rows[0]?.consumed || 0);
        if (consumedTodayMl + trayFluidMl > fluidRestrictionMl) {
            return hold('Fluid restriction allowance exceeded. Hold tray.');
        }
    }
    return { status: 'VALID', message: 'Current signed tray verified.', claims: c, ...details };
}
