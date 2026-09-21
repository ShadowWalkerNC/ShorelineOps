"use strict";
/**
 * Recipe Costing Rollup Engine — C06 (care-facility dietary budget lens)
 *
 * Wires together the pieces that already exist:
 *   vendor_items.unit_cost  →  recipe ingredient (SKU match; estimatedCost
 *   fallback, explicitly flagged)  →  recipes.cost_per_serving
 *   →  menu-slot plate cost (via menu_item_recipes + portion_multiplier)
 *   →  daily food cost  →  daily_cost_log  →  $/CPD reporting.
 *
 * Reuses the units engine and MRP's AP/EP yield formula
 * (MrpDemandForecastEngine.calculateEdibleVsPurchasedCost — same formula and
 * yield clamp, without its cent-rounding so per-gram costs keep precision).
 *
 * Internal food-cost only: this engine never touches vendor catalog pricing,
 * MRP ordering, budget targets, or anything the facility charges.
 *
 * Provenance model (demo-honesty): every ingredient line is tagged
 * 'sku' | 'estimated' | 'none'. Recipe/menu/day rollups aggregate those tags,
 * so any consumer can display which inputs are SKU-matched vs estimated.
 * If SKU coverage is poor, the flagged-fallback path IS the deliverable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecipeCostingEngine = void 0;
exports.ediblePortionCostPerGram = ediblePortionCostPerGram;
exports.parsePackSizeToGrams = parsePackSizeToGrams;
exports.vendorCostPerGram = vendorCostPerGram;
exports.aggregateProvenance = aggregateProvenance;
exports.aggregateRecipeProvenance = aggregateRecipeProvenance;
exports.fetchVendorCatalog = fetchVendorCatalog;
exports.recalcRecipeCost = recalcRecipeCost;
exports.recalcAllRecipeCosts = recalcAllRecipeCosts;
exports.getMenuSlotCosts = getMenuSlotCosts;
exports.rollupDailyCost = rollupDailyCost;
const units_1 = require("./units");
// ─── Pack-size → grams ─────────────────────────────────────────────────────
// vendor_items.unit_cost is the price for one `uom` (often 'case'). To cost an
// ingredient we need $/gram, so we parse pack_size text (e.g. "6 x 104 oz").
const WEIGHT_TOKENS = [
    { re: /#?\s*10\s*#?\s*cans?/i, unit: '#10 can' },
    { re: /cans?/i, unit: 'can' },
    { re: /fl\.?\s*oz/i, unit: 'fl oz' },
    { re: /ounces?/i, unit: 'oz' },
    { re: /pounds?/i, unit: 'lb' },
    { re: /liters?/i, unit: 'l' },
    { re: /quarts?/i, unit: 'qt' },
    { re: /gallons?/i, unit: 'gal' },
    { re: /pints?/i, unit: 'pt' },
    { re: /cups?/i, unit: 'cup' },
    { re: /\bkgs?\b/i, unit: 'kg' },
    { re: /\boz\b/i, unit: 'oz' },
    { re: /\blbs?\b/i, unit: 'lb' },
    { re: /\bg\b/i, unit: 'g' },
    { re: /\bml\b/i, unit: 'ml' },
];
/**
 * AP→EP cost conversion preserving per-gram precision.
 * Reuses MRP's AP/EP yield formula (edible cost = as-purchased ÷ yield
 * fraction — see MrpDemandForecastEngine.calculateEdibleVsPurchasedCost)
 * WITHOUT its cent-rounding: that helper rounds to $0.01 for display, which
 * would collapse per-gram costs (e.g. $0.0018/g) to zero. The formula and the
 * 1–100 yield clamp are identical to MRP's; only the display rounding differs.
 */
function ediblePortionCostPerGram(asPurchasedCostPerGram, yieldPct) {
    const validYield = Math.max(1, Math.min(100, yieldPct ?? 100));
    return asPurchasedCostPerGram / (validYield / 100);
}
/**
 * Parse a vendor pack_size string into total grams. Returns null when the
 * pack cannot be weighed (e.g. "12 ct", "1 case") — the caller then falls
 * back to the estimated-cost path rather than guessing.
 */
function parsePackSizeToGrams(packSize) {
    if (!packSize || !packSize.trim())
        return null;
    const s = packSize.trim();
    // "6 x 104 oz", "6x104oz", "2 / 10 lb"
    const multi = s.match(/^(\d+(?:\.\d+)?)\s*[x×/]\s*(\d+(?:\.\d+)?)\s*(.+)$/);
    if (multi) {
        const packs = parseFloat(multi[1]);
        const size = parseFloat(multi[2]);
        const gramsPerSub = weightTokenToGrams(multi[3]);
        if (gramsPerSub != null && packs > 0 && size > 0)
            return packs * size * gramsPerSub;
    }
    // "40 lb", "128 fl oz", "2.5 gal"
    const single = s.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
    if (single) {
        const size = parseFloat(single[1]);
        const gramsPerUnit = weightTokenToGrams(single[2]);
        if (gramsPerUnit != null && size > 0)
            return size * gramsPerUnit;
    }
    return null;
}
function weightTokenToGrams(token) {
    const t = token.trim();
    for (const { re, unit } of WEIGHT_TOKENS) {
        if (re.test(t)) {
            try {
                const { convertedAmount } = units_1.UnitConversionEngine.convert(1, unit, 'g', 'vendor pack');
                return convertedAmount;
            }
            catch {
                return null;
            }
        }
    }
    return null;
}
/**
 * Derive $/gram from a vendor catalog entry. Returns null when the entry
 * cannot be converted to a per-gram basis (zero/negative cost, unparseable
 * pack, count-only uom) — the ingredient then uses the estimated fallback.
 */
function vendorCostPerGram(entry) {
    const unitCost = Number(entry.unitCost);
    if (!Number.isFinite(unitCost) || unitCost <= 0)
        return null;
    const sku = (entry.vendorSku || '').trim();
    // Path 1: parse pack_size (e.g. "6 x 104 oz") → total grams
    const packGrams = parsePackSizeToGrams(entry.packSize);
    if (packGrams != null && packGrams > 0) {
        const perGram = unitCost / packGrams;
        return { perGram, basis: `$${unitCost.toFixed(2)}/${entry.uom || 'unit'} (${sku})` };
    }
    // Path 2: uom itself is a weighable unit → unit_cost is per that unit
    if (entry.uom) {
        const gramsPerUnit = weightTokenToGrams(entry.uom);
        if (gramsPerUnit != null && gramsPerUnit > 0) {
            return { perGram: unitCost / gramsPerUnit, basis: `$${unitCost.toFixed(2)}/${entry.uom} (${sku})` };
        }
    }
    return null;
}
// ─── Provenance aggregation ────────────────────────────────────────────────
function aggregateProvenance(sources) {
    if (sources.length === 0)
        return 'none';
    const hasSku = sources.includes('sku');
    const hasEst = sources.includes('estimated');
    const hasNone = sources.includes('none');
    if (hasSku && (hasEst || hasNone))
        return 'mixed';
    if (hasSku)
        return 'sku-matched';
    if (hasEst)
        return 'estimated';
    return 'none';
}
/** Aggregate recipe-level provenances (menu-slot and day level). */
function aggregateRecipeProvenance(list) {
    if (list.length === 0)
        return 'none';
    const set = new Set(list);
    if (set.size === 1)
        return list[0];
    const hasSku = list.includes('sku-matched') || list.includes('mixed');
    const hasNonSku = list.includes('estimated') || list.includes('none') || list.includes('mixed');
    if (hasSku && hasNonSku)
        return 'mixed';
    if (hasSku)
        return 'sku-matched';
    if (list.includes('estimated'))
        return 'estimated';
    return 'none';
}
// ─── Pure rollup engine ────────────────────────────────────────────────────
class RecipeCostingEngine {
    /**
     * SKU-match lookup: ingredient.vendorSku (or vendorItemSku alias) →
     * vendor catalog. Case/whitespace-insensitive.
     */
    static buildCatalogIndex(catalog) {
        const idx = new Map();
        for (const entry of catalog) {
            const key = (entry.vendorSku || '').trim().toLowerCase();
            if (key && !idx.has(key))
                idx.set(key, entry);
        }
        return idx;
    }
    /** Cost one ingredient line. Never throws — unparseable lines cost $0 with source 'none'. */
    static costIngredient(ing, catalog) {
        const sku = (ing.vendorSku ?? ing.vendorItemSku ?? '').trim();
        let grams = 0;
        try {
            const parsed = units_1.UnitConversionEngine.parseQuantityString(ing.qty || '');
            if (parsed.amount > 0) {
                const converted = units_1.UnitConversionEngine.convert(parsed.amount, parsed.unit, 'g', ing.item);
                grams = Math.max(0, converted.convertedAmount);
            }
        }
        catch {
            grams = 0;
        }
        const yieldPct = ing.yieldPct;
        const yieldFactor = (yieldPct && yieldPct > 0 && yieldPct <= 100) ? yieldPct / 100 : 1.0;
        // Path 1: SKU-matched vendor cost → AP $/gram, then MRP's AP/EP math
        // (precision-preserving variant — see ediblePortionCostPerGram)
        if (sku) {
            const entry = catalog.get(sku.toLowerCase());
            const perGram = entry ? vendorCostPerGram(entry) : null;
            if (entry && perGram) {
                const epPerGram = ediblePortionCostPerGram(perGram.perGram, yieldPct);
                const lineCost = Math.round(grams * epPerGram * 10000) / 10000;
                return {
                    item: ing.item, qty: ing.qty,
                    grams: Math.round(grams * 10) / 10,
                    source: 'sku', vendorSku: sku,
                    costBasis: perGram.basis,
                    lineCost,
                };
            }
        }
        // Path 2: explicit estimated fallback — visibly flagged as 'estimated'
        const estimated = Number(ing.estimatedCost);
        if (Number.isFinite(estimated) && estimated > 0) {
            const lineCost = Math.round((estimated / yieldFactor) * 10000) / 10000;
            return {
                item: ing.item, qty: ing.qty,
                grams: Math.round(grams * 10) / 10,
                source: 'estimated', vendorSku: sku || undefined,
                costBasis: `estimated $${estimated.toFixed(2)} for listed qty`,
                lineCost,
            };
        }
        // Path 3: no cost input at all
        return {
            item: ing.item, qty: ing.qty,
            grams: Math.round(grams * 10) / 10,
            source: 'none', vendorSku: sku || undefined,
            costBasis: 'no vendor SKU or estimated cost on file',
            lineCost: 0,
        };
    }
    /** Roll a full recipe ingredient list up to batch cost and cost_per_serving. */
    static costRecipe(ingredients, baseServings, catalogRows, recipeId) {
        const catalog = this.buildCatalogIndex(catalogRows);
        const lines = (ingredients || []).map(ing => this.costIngredient(ing, catalog));
        const batchCost = Math.round(lines.reduce((s, l) => s + l.lineCost, 0) * 10000) / 10000;
        const servings = Math.max(1, Number(baseServings) || 1);
        const costPerServing = Math.round((batchCost / servings) * 10000) / 10000;
        return {
            recipeId,
            baseServings: servings,
            batchCost,
            costPerServing,
            provenance: aggregateProvenance(lines.map(l => l.source)),
            skuMatchedCount: lines.filter(l => l.source === 'sku').length,
            estimatedCount: lines.filter(l => l.source === 'estimated').length,
            unknownCount: lines.filter(l => l.source === 'none').length,
            lines,
        };
    }
    /**
     * Lightweight provenance-only check (no math) — used on read paths so the
     * recipe book / $/CPD views can flag provenance from current catalog
     * coverage without recomputing every line cost.
     */
    static ingredientProvenance(ingredients, catalogRows) {
        const catalog = this.buildCatalogIndex(catalogRows);
        const sources = (ingredients || []).map(ing => {
            const sku = (ing.vendorSku ?? ing.vendorItemSku ?? '').trim().toLowerCase();
            if (sku) {
                const entry = catalog.get(sku);
                if (entry && vendorCostPerGram(entry))
                    return 'sku';
            }
            const estimated = Number(ing.estimatedCost);
            if (Number.isFinite(estimated) && estimated > 0)
                return 'estimated';
            return 'none';
        });
        return aggregateProvenance(sources);
    }
    /** Menu-slot plate cost: Σ linked recipes' cost_per_serving × portion_multiplier. */
    static plateCostForItem(links) {
        const total = links.reduce((s, l) => s + (Number(l.costPerServing) || 0) * (Number(l.portionMultiplier) || 1), 0);
        return Math.round(total * 10000) / 10000;
    }
}
exports.RecipeCostingEngine = RecipeCostingEngine;
// ─── DB wiring ─────────────────────────────────────────────────────────────
// All queries use $n placeholders; the shared pool translates for SQLite.
function parseJsonb(value) {
    if (value == null)
        return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
    return value;
}
async function fetchVendorCatalog(client) {
    const { rows } = await client.query(`
    SELECT vendor_sku, unit_cost, uom, pack_size
    FROM vendor_items
    WHERE active = TRUE AND unit_cost IS NOT NULL AND unit_cost > 0
  `);
    return rows.map(r => ({
        vendorSku: r.vendor_sku || '',
        unitCost: parseFloat(r.unit_cost || 0),
        uom: r.uom || undefined,
        packSize: r.pack_size || undefined,
    }));
}
/**
 * Recompute one recipe's cost_per_serving from the vendor catalog and persist
 * it. Idempotent: same inputs → same stored value (plain overwrite).
 */
async function recalcRecipeCost(client, recipeId) {
    const { rows } = await client.query(`SELECT id, base_servings, ingredients FROM recipes WHERE id = $1`, [recipeId]);
    if (!rows[0])
        return null;
    const catalog = await fetchVendorCatalog(client);
    const breakdown = RecipeCostingEngine.costRecipe(parseJsonb(rows[0].ingredients) || [], parseFloat(rows[0].base_servings) || 1, catalog, recipeId);
    await client.query(`UPDATE recipes SET cost_per_serving = $1, updated_at = NOW() WHERE id = $2`, [
        breakdown.costPerServing,
        recipeId,
    ]);
    return breakdown;
}
/** Backfill cost_per_serving for every recipe. Idempotent (overwrite). */
async function recalcAllRecipeCosts(client) {
    const catalog = await fetchVendorCatalog(client);
    const { rows } = await client.query(`SELECT id, name, base_servings, ingredients FROM recipes ORDER BY name`);
    const results = [];
    for (const r of rows) {
        const breakdown = RecipeCostingEngine.costRecipe(parseJsonb(r.ingredients) || [], parseFloat(r.base_servings) || 1, catalog, r.id);
        await client.query(`UPDATE recipes SET cost_per_serving = $1, updated_at = NOW() WHERE id = $2`, [
            breakdown.costPerServing,
            r.id,
        ]);
        results.push({ id: r.id, name: r.name, costPerServing: breakdown.costPerServing, provenance: breakdown.provenance });
    }
    return { updated: results.length, results };
}
const MEAL_SLOT_ORDER = ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner', 'eveningSnack'];
/**
 * Menu-slot plate costs for one weekday of the ACTIVE cycle menu week.
 * Each menu item's plate cost = Σ linked recipes cost_per_serving ×
 * portion_multiplier (via menu_item_recipes).
 */
async function getMenuSlotCosts(client, dayName) {
    const { rows: weekRows } = await client.query(`SELECT id, name, days FROM menu_weeks WHERE active = TRUE ORDER BY updated_at DESC LIMIT 1`);
    if (!weekRows[0])
        return { weekName: null, slots: [] };
    const days = parseJsonb(weekRows[0].days) || {};
    const day = days[dayName];
    if (!day)
        return { weekName: weekRows[0].name, slots: [] };
    const catalog = await fetchVendorCatalog(client);
    const slots = [];
    for (const slot of MEAL_SLOT_ORDER) {
        const entry = day[slot];
        const itemIds = (entry && Array.isArray(entry.itemIds)) ? entry.itemIds : [];
        if (itemIds.length === 0)
            continue;
        const items = [];
        for (const itemId of itemIds) {
            const { rows: itemRows } = await client.query(`SELECT id, name FROM menu_items WHERE id = $1`, [itemId]);
            if (!itemRows[0])
                continue;
            const { rows: linkRows } = await client.query(`SELECT r.id, r.name, r.cost_per_serving, r.ingredients, r.base_servings,
                mir.portion_multiplier
         FROM menu_item_recipes mir
         JOIN recipes r ON r.id = mir.recipe_id
         WHERE mir.menu_item_id = $1`, [itemId]);
            const links = linkRows.map(lr => ({
                costPerServing: parseFloat(lr.cost_per_serving) || 0,
                portionMultiplier: parseFloat(lr.portion_multiplier) || 1,
            }));
            const provenance = aggregateRecipeProvenance(linkRows.map(lr => RecipeCostingEngine.ingredientProvenance(parseJsonb(lr.ingredients) || [], catalog)));
            items.push({
                itemId,
                itemName: itemRows[0].name,
                plateCost: RecipeCostingEngine.plateCostForItem(links),
                recipeCount: linkRows.length,
                provenance,
            });
        }
        const slotSources = items.map(i => i.provenance);
        slots.push({
            slot,
            items,
            slotPlateCost: Math.round(items.reduce((s, i) => s + i.plateCost, 0) * 10000) / 10000,
            provenance: aggregateRecipeProvenance(slotSources),
        });
    }
    return { weekName: weekRows[0].name, slots };
}
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/**
 * Roll a full service day's menu into daily food cost and upsert
 * daily_cost_log. Idempotent: re-running for the same log_date overwrites
 * the rolled entry (notes are rewritten, never duplicated).
 *
 * Daily food cost = (Σ slot plate costs) × active resident census.
 * Auto-rollup entries are marked in `notes` with an "[auto-rollup]" prefix
 * carrying the provenance split, so $/CPD reporting can distinguish rolled
 * costs from manual entries.
 */
async function rollupDailyCost(client, logDate, createdBy) {
    const dayName = DAY_NAMES[new Date(`${logDate}T12:00:00`).getDay()];
    const { weekName, slots } = await getMenuSlotCosts(client, dayName);
    const { rows: censusRows } = await client.query(`SELECT COUNT(*) AS cnt FROM residents WHERE status = 'active'`);
    const residentCount = parseInt(censusRows[0]?.cnt || '0', 10);
    const perResidentDayCost = Math.round(slots.reduce((s, slot) => s + slot.slotPlateCost, 0) * 10000) / 10000;
    const dailyFoodCost = Math.round(perResidentDayCost * residentCount * 100) / 100;
    const provenanceDetail = { sku: 0, estimated: 0, none: 0 };
    for (const slot of slots) {
        for (const item of slot.items) {
            if (item.provenance === 'sku-matched')
                provenanceDetail.sku++;
            else if (item.provenance === 'mixed') {
                provenanceDetail.sku++;
                provenanceDetail.estimated++;
            }
            else if (item.provenance === 'estimated')
                provenanceDetail.estimated++;
            else
                provenanceDetail.none++;
        }
    }
    const itemProvenances = slots.flatMap(s => s.items.map(i => i.provenance));
    const provenance = aggregateRecipeProvenance(itemProvenances);
    const notes = `[auto-rollup] ${dayName} menu from week '${weekName ?? 'none'}': ` +
        `$${perResidentDayCost.toFixed(2)}/resident-day × ${residentCount} residents. ` +
        `Provenance: ${provenanceDetail.sku} SKU-matched / ${provenanceDetail.estimated} estimated / ` +
        `${provenanceDetail.none} no-cost-data menu items (${provenance}).`;
    // Idempotent upsert — daily_cost_log has UNIQUE(facility_id, log_date); do a
    // manual check/update instead of ON CONFLICT so NULL facility_id entries
    // overwrite rather than duplicate.
    const { rows: existing } = await client.query(`SELECT id FROM daily_cost_log WHERE log_date = $1 AND (facility_id IS NULL OR facility_id = $2) LIMIT 1`, [logDate, null]);
    let logId;
    if (existing[0]) {
        logId = existing[0].id;
        await client.query(`UPDATE daily_cost_log
       SET resident_count = $1, food_cost = $2, notes = $3, created_by = COALESCE($4, created_by)
       WHERE id = $5`, [residentCount, dailyFoodCost, notes, createdBy ?? null, logId]);
    }
    else {
        const { rows: inserted } = await client.query(`INSERT INTO daily_cost_log (log_date, resident_count, food_cost, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`, [logDate, residentCount, dailyFoodCost, notes, createdBy ?? null]);
        logId = inserted[0]?.id;
    }
    return {
        dayName,
        weekName,
        slots,
        perResidentDayCost,
        residentCount,
        dailyFoodCost,
        provenance,
        provenanceDetail,
        notes,
        logged: true,
        logId,
    };
}
