"use strict";
/**
 * Kitchen Batch Production & Clinical Tray Service Engine
 * FOOD-TRAK / MealSuite KMS Parity
 *
 * Provides:
 * - Recipe Variant Graph Explosion (Regular, Pureed L4, Minced & Moist L5, NAS, NCS)
 * - Prep station partitioning (Hot Line, Cold Prep, Puree Station, Bakery)
 * - Pan yield scaling (2" hotel pans, sheet pans) & HACCP 165°F temp monitoring
 * - Signed QR verification tokens on individualized tray cards
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KitchenProductionEngine = void 0;
exports.iddsiFoodLevelForTexture = iddsiFoodLevelForTexture;
const traySafety_1 = require("./traySafety");
const units_1 = require("./units");
const census_1 = require("../db/census");
const pool_1 = require("../db/pool");
// ── B07: server-side mirror of B02's IDDSI texture mapping ───────────────────
// Canonical mapping lives in the frontend type layer:
//   src/types/resident.ts → IDDSI_TEXTURE_LEVELS / iddsiForTexture (B02).
// It is mirrored here because the server engine cannot import the Vite
// frontend bundle. Keep the two tables in sync.
// IDDSI food levels: 7 Regular · 6 Soft & Bite-Sized · 5 Minced & Moist ·
// 4 Pureed · 3 Liquidised (drink levels 0–4 are a separate scale).
const IDDSI_FOOD_LEVEL_FOR_TEXTURE = {
    'Regular': 7,
    'Cut-Up': 6,
    'Minced': 5,
    'Minced & Moist': 5,
    'Pureed': 4,
    'Liquid': 3,
};
/** Server-side mirror of B02's iddsiForTexture. Unknown texture → -1 (Unassigned Safety Hold). */
function iddsiFoodLevelForTexture(texture) {
    const key = (texture ?? '').trim();
    if (!key)
        return -1;
    return IDDSI_FOOD_LEVEL_FOR_TEXTURE[key] ?? -1;
}
// ── B07: therapeutic diet → variant bucket mapping ───────────────────────────
// Canonical diet vocabulary: src/types/resident.ts → DIET_TYPES.
// Assumption (documented in the response payload): sodium-restricted orders
// (Low Sodium, Cardiac, Renal) batch under the Low-Sodium (NAS) variant;
// carbohydrate-restricted orders (Diabetic) batch under the Carb-Controlled
// (NCS) variant. 'Regular' and 'Mechanical Soft' map to no diet bucket — they
// are texture assignments, handled by the texture buckets instead.
const NAS_DIET_TYPES = new Set(['Low Sodium', 'Cardiac', 'Renal']);
const NCS_DIET_TYPES = new Set(['Diabetic']);
class KitchenProductionEngine {
    /**
     * Determine kitchen prep station based on recipe category & texture
     */
    static determineStation(category, texture) {
        const tex = texture.toLowerCase();
        if (tex.includes('puree') || tex.includes('level 4') || tex.includes('minced') || tex.includes('level 5')) {
            return 'Puree Station';
        }
        const cat = category.toLowerCase();
        if (['cookies', 'muffins', 'desserts', 'bakery', 'pies', 'cakes'].includes(cat))
            return 'Bakery';
        if (['proteins', 'starches', 'soups', 'hot veggies', 'entrees', 'main'].includes(cat))
            return 'Hot Line';
        if (['beverages'].includes(cat))
            return 'Beverage Station';
        return 'Cold Prep';
    }
    /**
     * Calculate hotel pan requirements based on portions and category
     */
    static calculatePanLayout(portions, category) {
        const cat = category.toLowerCase();
        if (cat.includes('protein') || cat.includes('entree')) {
            const pans = Math.ceil(portions / 25);
            return `${pans} x Full 2-inch Hotel Pan${pans > 1 ? 's' : ''}`;
        }
        if (cat.includes('starch') || cat.includes('soup') || cat.includes('veggie')) {
            const pans = Math.ceil(portions / 30);
            return `${pans} x Full 4-inch Hotel Pan${pans > 1 ? 's' : ''}`;
        }
        const sheetPans = Math.ceil(portions / 24);
        return `${sheetPans} x Full Sheet Pan${sheetPans > 1 ? 's' : ''}`;
    }
    /**
     * Scale a master recipe to an exact target portion count for daily kitchen production
     */
    static scaleRecipeForBatch(recipe, targetPortions, targetTexture = 'Regular', variantType = 'Regular') {
        const base = Math.max(1, recipe.baseServings);
        const factor = targetPortions / base;
        const scaledIngredients = recipe.ingredients.map(ing => {
            let item = ing.item;
            let qty = ing.qty;
            // Therapeutic substitutions
            if (variantType === 'Low Sodium' && (item.toLowerCase().includes('salt') || item.toLowerCase().includes('seasoning salt'))) {
                item = `${item} (REPLACED with Salt-Free Garlic & Herb Blend)`;
            }
            if (variantType === 'Carb-Controlled' && item.toLowerCase().includes('sugar')) {
                item = `${item} (REPLACED with Splenda / Stevia sweetener)`;
            }
            const parsed = units_1.UnitConversionEngine.parseQuantityString(qty);
            const scaledAmount = Math.round(parsed.amount * factor * 100) / 100;
            return {
                item,
                baseQty: qty,
                scaledQty: `${scaledAmount} ${parsed.unit}`.trim(),
                vendorSku: ing.vendorSku,
            };
        });
        // Pureed & Minced specific additions
        if (variantType === 'Pureed') {
            const liquidRatio = Math.round(targetPortions * 0.25 * 10) / 10;
            scaledIngredients.push({
                item: 'Nutrient-Dense Chicken/Vegetable Broth or Puree Slurry',
                baseQty: '0.25 cups / portion',
                scaledQty: `${liquidRatio} cups`,
                notes: 'Add to commercial food processor to achieve cohesive IDDSI Level 4 Pudding texture.',
            });
        }
        else if (variantType === 'Minced & Moist') {
            const gravyRatio = Math.round(targetPortions * 0.2 * 10) / 10;
            scaledIngredients.push({
                item: 'Thickened Pan Gravy / Sauce',
                baseQty: '0.2 cups / portion',
                scaledQty: `${gravyRatio} cups`,
                notes: 'Moisten 4mm minced particles to meet IDDSI Level 5 standard without excess free liquid.',
            });
        }
        const station = this.determineStation(recipe.category, targetTexture);
        const haccpTargetTempF = station === 'Hot Line' ? 165 : station === 'Cold Prep' ? 41 : 140;
        const panRequirement = this.calculatePanLayout(targetPortions, recipe.category);
        const instructions = recipe.steps.map(s => `${s.step}. ${s.instruction}`);
        if (variantType === 'Pureed') {
            instructions.push('IDDSI Level 4 Puree Step: Process cooked batch in Robot Coupe until smooth. Fork drip test: must hold shape on spoon without pouring off.');
        }
        else if (variantType === 'Minced & Moist') {
            instructions.push('IDDSI Level 5 Minced Step: Chop or pulse to 4mm particle size (space between fork tines). Mix with warm moistening agent.');
        }
        return {
            recipeId: recipe.id,
            recipeName: `${recipe.name}${variantType !== 'Regular' ? ` (${variantType})` : ''}`,
            variantType,
            iddsiLevel: variantType === 'Pureed' ? 'IDDSI Level 4' : variantType === 'Minced & Moist' ? 'IDDSI Level 5' : 'IDDSI Level 7',
            station,
            targetPortions,
            scaleFactor: Math.round(factor * 100) / 100,
            haccpTargetTempF,
            panRequirement,
            scaledIngredients,
            instructions,
        };
    }
    /**
     * Recipe Variant Graph Explosion:
     * Explodes a single base recipe into discrete production sheets for Regular, Pureed, Minced, and Diet variations.
     */
    static explodeRecipeVariants(baseRecipe, censusHeadcounts) {
        const variants = [];
        const stationSummary = {};
        if (censusHeadcounts.regularCount > 0) {
            const reg = this.scaleRecipeForBatch(baseRecipe, censusHeadcounts.regularCount, 'Regular', 'Regular');
            variants.push(reg);
            stationSummary[reg.station] = (stationSummary[reg.station] || 0) + reg.targetPortions;
        }
        if (censusHeadcounts.pureedCount > 0) {
            const pur = this.scaleRecipeForBatch(baseRecipe, censusHeadcounts.pureedCount, 'Pureed', 'Pureed');
            variants.push(pur);
            stationSummary[pur.station] = (stationSummary[pur.station] || 0) + pur.targetPortions;
        }
        if (censusHeadcounts.mincedCount > 0) {
            const min = this.scaleRecipeForBatch(baseRecipe, censusHeadcounts.mincedCount, 'Mechanical Soft', 'Minced & Moist');
            variants.push(min);
            stationSummary[min.station] = (stationSummary[min.station] || 0) + min.targetPortions;
        }
        if (censusHeadcounts.nasCount > 0) {
            const nas = this.scaleRecipeForBatch(baseRecipe, censusHeadcounts.nasCount, 'Regular', 'Low Sodium');
            variants.push(nas);
            stationSummary[nas.station] = (stationSummary[nas.station] || 0) + nas.targetPortions;
        }
        if (censusHeadcounts.ncsCount > 0) {
            const ncs = this.scaleRecipeForBatch(baseRecipe, censusHeadcounts.ncsCount, 'Regular', 'Carb-Controlled');
            variants.push(ncs);
            stationSummary[ncs.station] = (stationSummary[ncs.station] || 0) + ncs.targetPortions;
        }
        const totalPortions = variants.reduce((sum, v) => sum + v.targetPortions, 0);
        return {
            baseRecipeName: baseRecipe.name,
            variants,
            totalPortions,
            stationSummary,
        };
    }
    /**
     * B07: derive therapeutic variant headcounts from the active census × diet
     * orders. Uses B03's canonical activeCensus() (status='Active' only) unless
     * an explicit census row set is supplied (fixture / testing seam).
     *
     * Texture → bucket (B02 IDDSI mapping, mirrored server-side): L4 → Pureed,
     * L5 → Minced & Moist; everything else (L7 Regular, L6 Soft & Bite-Sized,
     * L3 Liquidised, unknowns) → Regular base batch.
     *
     * diet_type → bucket: Low Sodium / Cardiac / Renal → NAS; Diabetic → NCS.
     * Texture and diet buckets are independent — a resident can contribute to
     * both a texture bucket and a diet bucket (separate batch sheets).
     *
     * NPO residents are excluded from every bucket. NPO is a non-overridable
     * clinical hard block: nothing the caller supplies can re-add them.
     */
    static async deriveVariantHeadcounts(mealSlot, census) {
        const rows = census ?? await (0, census_1.activeCensus)({
            columns: 'diet_type, texture, is_npo, status',
        });
        let regularCount = 0;
        let pureedCount = 0;
        let mincedCount = 0;
        let nasCount = 0;
        let ncsCount = 0;
        let censusCounted = 0;
        let npoExcluded = 0;
        let otherTextureCount = 0;
        for (const r of rows ?? []) {
            // NPO hard block: NPO residents never appear in batch headcounts.
            const isNpo = Boolean(r.is_npo ?? r.isNpo);
            if (isNpo) {
                npoExcluded += 1;
                continue;
            }
            const texture = String(r.texture ?? 'Regular');
            const dietType = String(r.diet_type ?? r.dietType ?? 'Regular');
            // Texture bucket — each resident counts exactly once here.
            const level = iddsiFoodLevelForTexture(texture);
            if (level === 4) {
                pureedCount += 1;
            }
            else if (level === 5) {
                mincedCount += 1;
            }
            else {
                // L7/L6/L3/unknown: the base Regular batch covers them; the kitchen
                // adapts at plating/processing (cut up, liquidise, substitute).
                regularCount += 1;
                if (texture.trim() !== 'Regular')
                    otherTextureCount += 1;
            }
            // Diet bucket — independent of texture (separate batch sheets).
            const dietKey = dietType.trim();
            if (NAS_DIET_TYPES.has(dietKey))
                nasCount += 1;
            else if (NCS_DIET_TYPES.has(dietKey))
                ncsCount += 1;
            censusCounted += 1;
        }
        const displayParts = [];
        if (regularCount > 0)
            displayParts.push(`${regularCount} Regular`);
        if (pureedCount > 0)
            displayParts.push(`${pureedCount} Pureed L4`);
        if (mincedCount > 0)
            displayParts.push(`${mincedCount} Minced L5`);
        if (nasCount > 0)
            displayParts.push(`${nasCount} NAS`);
        if (ncsCount > 0)
            displayParts.push(`${ncsCount} NCS`);
        let breakdownDisplay = displayParts.length > 0 ? displayParts.join(' · ') : '0 residents';
        if (npoExcluded > 0)
            breakdownDisplay += ` · ${npoExcluded} NPO excluded`;
        const mappingNotes = [
            'Texture → bucket uses the B02 IDDSI mapping (mirrored server-side): Pureed → L4, Minced / Minced & Moist → L5.',
            'Regular, Cut-Up (L6 Soft & Bite-Sized), Liquid (L3 Liquidised) and unknown textures fold into the Regular base batch; the kitchen adapts at plating.',
            'diet_type → NAS: Low Sodium, Cardiac, Renal. → NCS: Diabetic. Regular / Mechanical Soft → no diet bucket.',
            'Texture and diet buckets are independent — one resident can count in both.',
            'NPO residents are excluded from all buckets (non-overridable hard block).',
        ];
        return {
            mealSlot,
            regularCount,
            pureedCount,
            mincedCount,
            nasCount,
            ncsCount,
            censusCounted,
            npoExcluded,
            otherTextureCount,
            breakdownDisplay,
            mappingNotes,
        };
    }
    /**
     * Generate high-contrast clinical tray cards with signed QR tokens
     */
    static generateTrayCards(residents, mealInfo) {
        // B03: census filter is on `status` (Active/Hospital/LOA/Passed Away).
        // `servingLocation` is service routing (Dining Room / Room Tray / …),
        // NOT census — it must never be used to exclude residents. Absent status
        // is treated as Active (the residents.status DB default).
        return residents
            .filter(r => r.status == null || r.status === 'Active')
            .map(r => {
            const ticketId = `TKT-${r.id.slice(0, 8)}-${Date.now().toString(36).slice(-4)}`;
            const profileVersion = r.profileVersion || 1;
            let textureBannerColor = '#10b981'; // Green for regular
            if (r.texture === 'Pureed')
                textureBannerColor = '#f59e0b'; // Orange for puree
            if (r.texture === 'Mechanical Soft')
                textureBannerColor = '#8b5cf6'; // Purple for mech soft
            let entree = mealInfo.entreeName;
            if (r.isNpo) {
                entree = '⛔ NPO - DO NOT SERVE (ORAL INTAKE PROHIBITED)';
            }
            else if (r.texture === 'Pureed') {
                entree = `Pureed ${mealInfo.entreeName}`;
            }
            else if (r.texture === 'Mechanical Soft') {
                entree = `Minced & Moist ${mealInfo.entreeName}`;
            }
            const qrToken = (0, traySafety_1.signTray)({ ticketId, residentId: r.id, version: profileVersion,
                diet: r.dietType, texture: r.texture, allergies: r.allergies || [],
                mealSlot: mealInfo.mealSlot, serviceDate: mealInfo.serviceDate,
                foods: [mealInfo.entreeName, ...mealInfo.sideNames], beverages: r.beverages || ['Water'] });
            return {
                ticketId,
                residentId: r.id,
                residentName: r.name,
                room: r.room,
                table: r.tableAssignment || 'Dining Room',
                mealSlot: mealInfo.mealSlot,
                serviceDate: mealInfo.serviceDate,
                dietOrder: r.dietType,
                iddsiTexture: r.texture,
                textureBannerColor,
                hasCriticalAllergies: (r.allergies || []).length > 0,
                allergenList: r.allergies || [],
                portionSize: r.portionSize,
                isNpo: !!r.isNpo,
                npoReason: r.npoReason,
                fluidRestrictionMl: r.fluidRestrictionMl,
                profileVersion,
                qrToken,
                selectedEntree: entree,
                selectedSides: r.isNpo ? [] : mealInfo.sideNames,
                selectedBeverages: r.isNpo ? [] : (r.beverages || ['Water']),
                specialNotes: [
                    r.isNpo ? '⛔ STRICT NPO' : '',
                    r.fluidRestrictionMl ? `💧 Fluid Limit: ${r.fluidRestrictionMl}ml/day` : '',
                    r.specialInstructions,
                    r.dislikes ? `No: ${r.dislikes}` : '',
                ]
                    .filter(Boolean)
                    .join(' | '),
            };
        });
    }
    // ══════════════════════════════════════════════════════════════════════════
    // C05 — REAL FORECASTING
    // Scheduled meals = ACTIVE MENU WEEK × ACTIVE CENSUS × meal slot, with a
    // census-trend buffer and Opt1/Opt2 splits from real weekly_orders choices.
    // Nothing here is hardcoded: every number is derived from menu_weeks,
    // residents, weekly_orders, meal_options, and inventory_transactions.
    // ══════════════════════════════════════════════════════════════════════════
    /** Calendar day order used by menu_weeks.days and weekly_orders.day_of_week. */
    static FORECAST_DAYS = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ];
    /** Menu-week slots. Snack slots have no Opt1/Opt2 choice model. */
    static FORECAST_SLOTS = [
        'breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner', 'eveningSnack',
    ];
    /**
     * Menu-week slot (lowercase, B08) → kitchen meal vocabulary (weekly_orders
     * meal_type, kitchen tallies). null = no choice model (snacks); their
     * forecast is 100% of (census + buffer).
     */
    static SLOT_TO_MEAL = {
        breakfast: 'Breakfast',
        morningSnack: null,
        lunch: 'Lunch',
        afternoonSnack: null,
        dinner: 'Dinner',
        eveningSnack: null,
    };
    /** Normalize a name for cross-table matching (menu item ↔ recipe ↔ dish). */
    static normalizeForecastName(s) {
        return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }
    /** menu_weeks.days arrives as an object on PG and as a JSON string on SQLite. */
    static parseMenuDays(raw) {
        if (!raw)
            return {};
        if (typeof raw === 'string') {
            try {
                const parsed = JSON.parse(raw);
                return typeof parsed === 'object' && parsed !== null ? parsed : {};
            }
            catch {
                return {};
            }
        }
        return raw;
    }
    /** Sunday (YYYY-MM-DD) of the week containing `dateISO` — weekly_orders weeks start Sunday. */
    static weekStartFor(dateISO) {
        const d = new Date(`${dateISO}T12:00:00`);
        const sunday = new Date(d);
        sunday.setDate(d.getDate() - d.getDay());
        return sunday.toISOString().slice(0, 10);
    }
    /** Day name ('Monday', …) for a YYYY-MM-DD date. */
    static dayNameFor(dateISO) {
        return this.FORECAST_DAYS[new Date(`${dateISO}T12:00:00`).getDay()];
    }
    /** Portable predicate mapping legacy 'Supper' meal_type rows to 'Dinner' at read time (B08). */
    static mealTypeMatch(col, param) {
        return `CASE WHEN ${col} = 'Supper' THEN 'Dinner' ELSE ${col} END = ${param}`;
    }
    /** The active menu week, plus the week_start_date its days map to. */
    static async getActiveMenuWeek(weekId) {
        const { rows } = weekId
            ? await pool_1.pool.query('SELECT * FROM menu_weeks WHERE id = $1', [weekId])
            : await pool_1.pool.query("SELECT * FROM menu_weeks WHERE active = true ORDER BY created_at DESC LIMIT 1");
        const w = rows[0];
        if (!w)
            return null;
        const days = this.parseMenuDays(w.days);
        const weekStartDate = w.effective_from
            ? String(w.effective_from).slice(0, 10)
            : this.weekStartFor(new Date().toISOString().slice(0, 10));
        return { id: w.id, name: w.name, days, weekStartDate };
    }
    /**
     * Opt1/Opt2 split ratios for one slot, from REAL weekly_orders choices.
     *
     * Counts choice_selected 1 (Opt1) / 2 (Opt2) for the given week/day/meal,
     * restricted to active residents (B03) and to real selections (alternatives,
     * declines, and un-chosen rows are excluded — they never inflate a ratio).
     *
     * When the facility has recorded no choices for the slot, the fallback is
     * 100% Opt1 — the standing default the order grid pre-fills
     * (initialize-week defaults every resident to Choice 1). It is labelled as
     * a fallback in `source`; it is never a silent 50/50.
     */
    static async computeChoiceSplit(weekStartDate, dayOfWeek, mealType) {
        if (!mealType) {
            return { opt1Count: 0, opt2Count: 0, opt1Ratio: 1, opt2Ratio: 0, totalChoices: 0, source: 'fallback-opt1' };
        }
        const { rows } = await pool_1.pool.query(`SELECT choice_selected, COUNT(*) AS n
       FROM weekly_orders wo
       WHERE wo.week_start_date = $1
         AND wo.day_of_week = $2
         AND ${this.mealTypeMatch('wo.meal_type', '$3')}
         AND wo.is_alternative = 0
         AND wo.is_declined = 0
         AND wo.choice_selected IS NOT NULL
         AND wo.resident_id IN (SELECT id FROM residents WHERE status = 'Active')
       GROUP BY choice_selected`, [weekStartDate, dayOfWeek, mealType]);
        let opt1Count = 0;
        let opt2Count = 0;
        for (const r of rows) {
            const n = parseInt(r.n ?? r['count(*)'] ?? '0', 10);
            if (Number(r.choice_selected) === 1)
                opt1Count += n;
            else if (Number(r.choice_selected) === 2)
                opt2Count += n;
        }
        const total = opt1Count + opt2Count;
        if (total === 0) {
            return { opt1Count: 0, opt2Count: 0, opt1Ratio: 1, opt2Ratio: 0, totalChoices: 0, source: 'fallback-opt1' };
        }
        return {
            opt1Count,
            opt2Count,
            opt1Ratio: opt1Count / total,
            opt2Ratio: opt2Count / total,
            totalChoices: total,
            source: 'weekly_orders',
        };
    }
    /**
     * ── CENSUS-TREND BUFFER FORMULA (C05) ──────────────────────────────────
     * The dietitian's explanation of the number:
     *
     *   1. MEASURE real census movement from ordering history:
     *        weekly_census(w) = DISTINCT active residents who have at least one
     *        weekly_orders row for week_start_date w, over the trailing 28 days.
     *      (Recorded ordering participation — no external demand signals, no ML.)
     *   2. trend = (latest_week_census − mean(up to 3 prior weeks)) / mean(up to 3 prior weeks)
     *   3. growth = MAX(trend, 0)
     *      A declining census never shrinks the kitchen below current census —
     *      only observed growth adds buffer.
     *   4. buffer = CEIL( current_census × (0.03 + growth) )
     *      The 3% base rate is standing headroom for walk-ins, readmits, and
     *      portioning loss; the trend term adds exactly the observed growth
     *      rate on top. There is no fixed +5 and no blind 50/50 anywhere.
     *   5. Forecast portions per slot = census + buffer, then split across
     *      Opt1/Opt2 by the real choice ratios (computeChoiceSplit).
     *
     * With no order history yet (fresh database), trend is unknown and the
     * buffer is the 3% base rate only.
     * ─────────────────────────────────────────────────────────────────────────
     */
    static async computeCensusTrendBuffer(census) {
        const current = census ?? await (0, census_1.activeCensusCount)();
        const cutoff = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
        const { rows } = await pool_1.pool.query(`SELECT wo.week_start_date AS w, COUNT(DISTINCT wo.resident_id) AS n
       FROM weekly_orders wo
       JOIN residents r ON r.id = wo.resident_id
       WHERE r.status = 'Active' AND wo.week_start_date >= $1
       GROUP BY wo.week_start_date
       ORDER BY wo.week_start_date DESC
       LIMIT 4`, [cutoff]);
        const weeks = rows.map((r) => parseInt(r.n, 10)).filter((n) => Number.isFinite(n));
        let trendPct = null;
        if (weeks.length >= 2) {
            const latest = weeks[0];
            const prior = weeks.slice(1);
            const meanPrior = prior.reduce((a, b) => a + b, 0) / prior.length;
            trendPct = meanPrior > 0 ? (latest - meanPrior) / meanPrior : 0;
        }
        const growth = Math.max(0, trendPct ?? 0);
        const buffer = Math.ceil(current * (0.03 + growth));
        return {
            census: current,
            buffer,
            trendPct,
            historyWeeks: weeks.length,
            formula: 'buffer = CEIL(census × (0.03 + MAX(census-trend, 0))); ' +
                'trend = (latest weekly ordering census − mean of prior ≤3 weeks) / mean of prior ≤3 weeks ' +
                'over the trailing 28 days of weekly_orders.',
        };
    }
    /**
     * Build the real forecast: ACTIVE MENU WEEK × ACTIVE CENSUS × meal slot.
     *
     * For every requested day × slot in the active menu week, each scheduled
     * menu item becomes one ScheduledMealDemand with:
     *   - projectedPortions = (census + census-trend buffer) × item choice share
     *   - choice share from real weekly_orders ratios, classified per item via
     *     meal_options (dish_name ↔ choice_number) name matching
     *   - recipeLink resolved by menu-item-name → recipe-name matching
     *
     * Items with no matching recipe are skipped and reported in `skippedItems`
     * (demo-honesty: the MRP can only explode recipes it actually has).
     * Items with no meal_options classification share the slot's residual
     * portions evenly — documented per item in the returned portions note.
     */
    static async buildScheduledMeals(opts = {}) {
        const week = await this.getActiveMenuWeek(opts.weekId);
        if (!week) {
            throw Object.assign(new Error('No active menu week — cannot build a forecast'), { status: 404 });
        }
        const days = opts.days ?? [...this.FORECAST_DAYS];
        const slots = opts.slots ?? [...this.FORECAST_SLOTS];
        const census = await (0, census_1.activeCensusCount)();
        const buf = await this.computeCensusTrendBuffer(census);
        const slotPortions = census + buf.buffer; // per-slot base forecast portions
        // Menu items referenced by this week (one query).
        const itemIds = new Set();
        for (const day of days) {
            const dayMenu = week.days[day] ?? {};
            for (const slot of slots) {
                for (const id of (dayMenu[slot]?.itemIds ?? []))
                    itemIds.add(String(id));
            }
        }
        const itemById = new Map();
        if (itemIds.size > 0) {
            const ids = [...itemIds];
            const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
            const { rows } = await pool_1.pool.query(`SELECT * FROM menu_items WHERE id IN (${placeholders})`, ids);
            for (const r of rows)
                itemById.set(String(r.id), r);
        }
        // Recipe index for menu-item → recipe BOM resolution (name match).
        const { rows: recipeRows } = await pool_1.pool.query('SELECT id, name, base_servings, ingredients FROM recipes');
        const recipeByName = new Map();
        for (const r of recipeRows)
            recipeByName.set(this.normalizeForecastName(r.name), r);
        const matchRecipe = (itemName) => {
            const key = this.normalizeForecastName(itemName);
            if (recipeByName.has(key))
                return recipeByName.get(key);
            for (const [rkey, r] of recipeByName) {
                if (rkey.includes(key) || key.includes(rkey))
                    return r;
            }
            return null;
        };
        // meal_options: (day, mealType, dishName) → choice number.
        const optionChoice = new Map();
        {
            const { rows } = await pool_1.pool.query('SELECT day_of_week, meal_type, choice_number, dish_name FROM meal_options WHERE week_start_date = $1', [week.weekStartDate]);
            for (const r of rows) {
                const meal = r.meal_type === 'Supper' ? 'Dinner' : String(r.meal_type);
                optionChoice.set(`${r.day_of_week}|${meal}|${this.normalizeForecastName(r.dish_name)}`, Number(r.choice_number));
            }
        }
        // Choice splits, cached per (day, mealType).
        const splitCache = new Map();
        const splitFor = async (day, mealType) => {
            const key = `${day}|${mealType ?? 'snack'}`;
            if (!splitCache.has(key)) {
                splitCache.set(key, await this.computeChoiceSplit(week.weekStartDate, day, mealType));
            }
            return splitCache.get(key);
        };
        const meals = [];
        const skippedItems = [];
        for (const day of days) {
            const dayMenu = week.days[day] ?? {};
            for (const slot of slots) {
                const mealEntry = dayMenu[slot];
                if (!mealEntry)
                    continue;
                const mealType = this.SLOT_TO_MEAL[slot] ?? null;
                const split = await splitFor(day, mealType);
                const slotItems = (mealEntry.itemIds ?? [])
                    .map((id) => itemById.get(String(id)))
                    .filter(Boolean);
                // Classify each item as Opt1 / Opt2 / unclassified.
                const classified = [];
                const unclassified = [];
                for (const item of slotItems) {
                    const choice = mealType
                        ? optionChoice.get(`${day}|${mealType}|${this.normalizeForecastName(item.name)}`)
                        : undefined;
                    if (choice === 1)
                        classified.push({ item, share: split.opt1Ratio });
                    else if (choice === 2)
                        classified.push({ item, share: split.opt2Ratio });
                    else
                        unclassified.push(item);
                }
                const assigned = classified.reduce((s, c) => s + Math.round(slotPortions * c.share), 0);
                const residual = Math.max(0, slotPortions - assigned);
                const unclassifiedEach = unclassified.length > 0 ? residual / unclassified.length : 0;
                const allocations = [
                    ...classified.map(c => ({
                        item: c.item,
                        portions: Math.round(slotPortions * c.share),
                        shareNote: `choice ${c.share === split.opt1Ratio ? 1 : 2} ratio ${c.share.toFixed(3)} (source: ${split.source})`,
                    })),
                    ...unclassified.map(item => ({
                        item,
                        portions: Math.round(unclassifiedEach),
                        shareNote: unclassified.length === slotItems.length
                            ? `no meal_options classification for this slot — slot portions shared evenly across ${unclassified.length} item(s)`
                            : `unclassified item — residual slot portions shared evenly across ${unclassified.length} unclassified item(s)`,
                    })),
                ];
                for (const { item, portions, shareNote } of allocations) {
                    const recipe = matchRecipe(item.name);
                    if (!recipe) {
                        skippedItems.push({
                            day,
                            slot,
                            menuItemId: String(item.id),
                            menuItemName: item.name,
                            reason: 'No matching recipe in the recipe book — BOM explosion requires a recipe; portions excluded from MRP.',
                        });
                        continue;
                    }
                    let ingredients = recipe.ingredients;
                    if (typeof ingredients === 'string') {
                        try {
                            ingredients = JSON.parse(ingredients);
                        }
                        catch {
                            ingredients = [];
                        }
                    }
                    meals.push({
                        dayOfWeek: day,
                        mealSlot: slot,
                        projectedPortions: portions,
                        forecastNote: `census ${census} + trend buffer ${buf.buffer} = ${slotPortions} slot portions; ${shareNote}`,
                        recipeLink: {
                            menuItemId: String(item.id),
                            menuItemName: item.name,
                            recipeId: String(recipe.id),
                            recipeName: recipe.name,
                            baseServings: parseFloat(recipe.base_servings ?? 10),
                            portionMultiplier: 1.0,
                            ingredients: Array.isArray(ingredients) ? ingredients : [],
                        },
                    });
                }
            }
        }
        return {
            weekId: week.id,
            weekName: week.name,
            weekStartDate: week.weekStartDate,
            census,
            buffer: buf.buffer,
            trendPct: buf.trendPct,
            bufferFormula: buf.formula,
            forecastPortionsPerSlot: slotPortions,
            meals,
            skippedItems,
            generatedAt: new Date().toISOString(),
        };
    }
}
exports.KitchenProductionEngine = KitchenProductionEngine;
