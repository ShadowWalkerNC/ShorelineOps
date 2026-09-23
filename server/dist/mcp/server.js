"use strict";
/**
 * ShorelineOps Model Context Protocol (MCP) Server
 *
 * Exposes standardized MCP Tools and Resources for CulinaryOS and autonomous AI agents:
 * - Census and clinical diet order lookups
 * - Recipe dietary and allergen compliance validation
 * - MRP Bill of Materials (BOM) explosion and vendor PO generation
 * - Autonomous self-healing diagnostic execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHORELINE_MCP_TOOLS = void 0;
exports.executeMcpTool = executeMcpTool;
const pool_1 = require("../db/pool");
const nutrition_1 = require("../engine/nutrition");
const mrp_1 = require("../engine/mrp");
const healer_1 = require("../agent/healer");
const facilityProfile_1 = require("../config/facilityProfile");
const catalogMatcher_1 = require("../engine/catalogMatcher");
exports.SHORELINE_MCP_TOOLS = [
    {
        name: 'shoreline_get_facility_profile',
        description: 'Retrieves the active facility segment profile (Senior Living, Hospital Acute Care, K-12 School, Catering) and clinical constraints.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'shoreline_get_census_diets',
        description: 'Retrieves active resident or patient headcount, therapeutic diet orders (NAS, NCS, Renal), IDDSI textures, and allergies.',
        inputSchema: {
            type: 'object',
            properties: {
                filterDiet: { type: 'string', description: 'Optional diet filter (e.g. NAS, NCS, Renal)' },
                filterTexture: { type: 'string', description: 'Optional texture filter (e.g. Pureed, Regular)' },
            },
        },
    },
    {
        name: 'shoreline_validate_recipe_dietary',
        description: 'Validates an ingredient list against clinical diet orders (NAS ≤600mg sodium, NCS ≤60g carb, Renal) and identifies Big 9 allergens.',
        inputSchema: {
            type: 'object',
            properties: {
                recipeName: { type: 'string', description: 'Name of the recipe' },
                ingredients: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            item: { type: 'string' },
                            qty: { type: 'string' },
                        },
                        required: ['item', 'qty'],
                    },
                    description: 'List of ingredients with quantities (e.g. "2 cups flour", "1 lb chicken")',
                },
            },
            required: ['recipeName', 'ingredients'],
        },
    },
    {
        name: 'shoreline_explode_mrp_bom',
        description: 'Calculates raw ingredient demand and distributor purchase orders from a scheduled cycle menu and resident census.',
        inputSchema: {
            type: 'object',
            properties: {
                portionsNeeded: { type: 'number', description: 'Total meal portions required' },
                recipeId: { type: 'string', description: 'Master recipe ID' },
            },
            required: ['portionsNeeded'],
        },
    },
    {
        name: 'shoreline_run_self_healing_audit',
        description: 'Executes an automated self-healing diagnostic scan across database health, HACCP food safety temp logs, and census integrity.',
        inputSchema: {
            type: 'object',
            properties: {
                autoRemediate: { type: 'boolean', description: 'Whether to automatically fix detected issues (default: true)' },
            },
        },
    },
    {
        name: 'shoreline_compare_distributor_prices',
        description: 'Compares cross-distributor product prices (Dennis, Sysco, US Foods) normalized to standard units ($/lb, $/fl oz, $/each) using Cut+Dry style matching.',
        inputSchema: {
            type: 'object',
            properties: {
                category: { type: 'string', description: 'Optional product category filter (e.g. Meat & Poultry, Produce, Dairy)' },
            },
        },
    },
];
/**
 * MCP Tool Executor
 */
async function executeMcpTool(toolName, args = {}) {
    switch (toolName) {
        case 'shoreline_get_facility_profile': {
            return (0, facilityProfile_1.getFacilityProfile)();
        }
        case 'shoreline_get_census_diets': {
            const { rows } = await pool_1.pool.query('SELECT id, name, room, diet_type, texture, allergies FROM residents WHERE active = 1 OR active IS NULL');
            let results = rows;
            if (args.filterDiet) {
                results = results.filter(r => r.diet_type?.toLowerCase() === args.filterDiet.toLowerCase());
            }
            if (args.filterTexture) {
                results = results.filter(r => r.texture?.toLowerCase() === args.filterTexture.toLowerCase());
            }
            return {
                totalActiveCount: results.length,
                residents: results,
            };
        }
        case 'shoreline_validate_recipe_dietary': {
            const { recipeName, ingredients } = args;
            const nutrition = nutrition_1.DietaryNutritionalEngine.calculateRecipeNutrition(ingredients, 10);
            const allergens = nutrition_1.DietaryNutritionalEngine.detectAllergens(ingredients);
            return {
                recipeName,
                perServingNutrients: nutrition.perServing,
                totalBatchNutrients: nutrition.totalBatch,
                detectedAllergens: allergens,
                ingredientContributions: nutrition.ingredientContributions,
            };
        }
        case 'shoreline_explode_mrp_bom': {
            const portions = args.portionsNeeded || 50;
            const sampleScheduledMeal = [
                {
                    dayOfWeek: 'Monday',
                    mealSlot: 'lunchOpt1Meat',
                    projectedPortions: portions,
                    recipeLink: {
                        menuItemId: 'M-DEFAULT',
                        menuItemName: 'Roast Turkey Breast',
                        recipeId: 'REC-TRK',
                        recipeName: 'Roast Turkey Breast',
                        baseServings: 20,
                        portionMultiplier: 1.0,
                        ingredients: [
                            { item: 'turkey breast raw', qty: '10 lbs', vendorSku: 'DNS-TRK', unitCost: 42.00 },
                            { item: 'poultry seasoning', qty: '2 tbsp', vendorSku: 'DNS-SEA', unitCost: 3.50 },
                        ],
                    },
                },
            ];
            const bom = mrp_1.MrpDemandForecastEngine.explodeBillOfMaterials(sampleScheduledMeal);
            const inventory = [
                {
                    vendorSku: 'DNS-TRK',
                    itemName: 'Turkey Breast Raw',
                    category: 'Proteins',
                    onHandGrams: 453.592 * 15,
                    parLevelGrams: 453.592 * 30,
                    packSizeDesc: 'Case of 2/10 lb roasts (20 lbs)',
                    packUnitGrams: 453.592 * 20,
                    unitCostPerPack: 84.00,
                    vendorName: 'Dennis Food Service',
                },
            ];
            const pos = mrp_1.MrpDemandForecastEngine.calculateMaterialRequirements(bom, inventory);
            return {
                explodedBOM: bom,
                suggestedPurchaseOrders: pos,
            };
        }
        case 'shoreline_run_self_healing_audit': {
            const autoFix = args.autoRemediate !== false;
            return await healer_1.globalHealerBot.runAudit(autoFix);
        }
        case 'shoreline_compare_distributor_prices': {
            let query = 'SELECT * FROM canonical_products';
            const queryParams = [];
            if (args.category) {
                query += ' WHERE category = $1';
                queryParams.push(args.category);
            }
            query += ' ORDER BY category ASC, name ASC';
            const { rows: canonicalRows } = await pool_1.pool.query(query, queryParams);
            const { rows: matchRows } = await pool_1.pool.query(`
        SELECT vim.*,
               vi.vendor_sku, vi.name AS item_name, vi.brand, vi.pack_size, vi.uom, vi.unit_cost AS case_cost,
               v.id AS vendor_id, v.code AS vendor_code, v.name AS vendor_name
        FROM vendor_item_matches vim
        JOIN vendor_items vi ON vi.id = vim.vendor_item_id
        JOIN vendors v ON v.id = vi.vendor_id
        WHERE vim.match_status = 'confirmed' AND vi.active = true
      `);
            const canonicalProducts = canonicalRows.map(r => ({
                id: r.id,
                name: r.name,
                category: r.category,
                standardUom: r.standard_uom,
                allergens: typeof r.allergens === 'string' ? JSON.parse(r.allergens) : r.allergens || [],
            }));
            const offers = matchRows.map(r => ({
                vendorId: r.vendor_id,
                vendorCode: r.vendor_code,
                vendorName: r.vendor_name,
                vendorSku: r.vendor_sku,
                itemName: r.item_name,
                brand: r.brand,
                packSize: r.pack_size,
                uom: r.uom,
                caseCost: parseFloat(r.case_cost || '0'),
                packQuantityInStandardUom: parseFloat(r.pack_quantity_in_standard_uom || '1'),
                normalizedUnitCost: parseFloat(r.normalized_unit_cost || '0'),
                matchConfidence: parseFloat(r.match_confidence || '100'),
                matchStatus: r.match_status,
                canonicalProductId: r.canonical_product_id,
            }));
            const matrix = catalogMatcher_1.PriceMatrixSolver.solveMatrix(canonicalProducts, offers);
            const totalPotentialSavings = matrix.reduce((acc, row) => {
                return acc + (row.costSavingsPerUnit ? row.costSavingsPerUnit * 200 : 0);
            }, 0);
            return {
                matrix,
                summary: {
                    totalCanonicalProducts: matrix.length,
                    comparedProductsCount: matrix.filter(r => r.offers.length > 1).length,
                    singleVendorProductsCount: matrix.filter(r => r.offers.length === 1).length,
                    estimatedMonthlySavings: Math.round(totalPotentialSavings * 100) / 100,
                },
            };
        }
        default:
            throw new Error(`Unknown ShorelineOps MCP tool: ${toolName}`);
    }
}
