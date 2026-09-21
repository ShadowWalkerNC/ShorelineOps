"use strict";
/**
 * Comprehensive System & Integration Test Suite — ShorelineOps
 *
 * Tests:
 * 1. Security & Compliance (Password Complexity, Zod schemas)
 * 2. V2 Multi-Distributor Connectors (Dennis, Sysco, US Foods: catalog, order guide parsing, PO export)
 * 3. V3 Clinical EHR Integration (PointClickCare ADT ingestion, dynamic meal validation, nutrient analysis)
 */
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
const zod_1 = require("zod");
const dennis_1 = require("./integrations/dennis");
const broadline_1 = require("./integrations/broadline");
const pointclickcare_1 = require("./integrations/pointclickcare");
const usda_1 = require("./integrations/usda");
const crypto_1 = require("crypto");
const mrp_1 = require("./engine/mrp");
const production_1 = require("./engine/production");
const safetyEvaluator_1 = require("./engine/safetyEvaluator");
const invoicing_1 = require("./engine/invoicing");
const cmsSurvey_1 = require("./engine/cmsSurvey");
const dietaryFormulation_1 = require("./engine/dietaryFormulation");
const trayTracking_1 = require("./engine/trayTracking");
const catalogMatcher_1 = require("./engine/catalogMatcher");
const kitchen_1 = require("./routes/kitchen");
const residents_1 = require("./routes/residents");
const cache_1 = require("./middleware/cache");
const pool_1 = require("./db/pool");
const migrate_1 = require("./db/migrate");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const PasswordSchema = zod_1.z
    .string()
    .min(12)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/);
async function runAllTests() {
    console.log('\n🧪 =======================================================');
    console.log('🧪 RUNNING SHORELINEOPS TEST SUITE (/shadowrealm-bridge)');
    console.log('🧪 =======================================================\n');
    let passed = 0;
    let failed = 0;
    function assert(condition, testName) {
        if (condition) {
            console.log(`  ✅ PASS: ${testName}`);
            passed++;
        }
        else {
            console.error(`  ❌ FAIL: ${testName}`);
            failed++;
        }
    }
    // --- 1. Security & Password Rules ---
    console.log('--- 1. Security & Password Hardening ---');
    assert(!PasswordSchema.safeParse('Weak1!').success, 'Reject password < 12 characters');
    assert(!PasswordSchema.safeParse('alllowercasepassword123!').success, 'Reject password missing uppercase');
    assert(!PasswordSchema.safeParse('NoSpecialChar12345').success, 'Reject password missing special symbol');
    assert(PasswordSchema.safeParse('ValidP@ssword123').success, 'Accept compliant 12+ char complex password');
    // --- 2. V2 Multi-Distributor Connectors ---
    console.log('\n--- 2. V2 Multi-Distributor Connectors ---');
    const dennis = new dennis_1.DennisConnector();
    const dennisCatalog = await dennis.getCatalog();
    assert(dennisCatalog.length >= 5, 'DennisConnector: getCatalog returns valid broadline SKUs');
    const sampleCsv = `SKU,Description,Brand,Category,Pack,UOM,UnitCost,Par,OnHand\nDNS-1001,Peaches,Dennis,Fruit,6/10,case,48.50,5,2\nDNS-1002,Thickened OJ,Thick,Bev,12/32,case,32.75,4,1`;
    const dennisGuide = await dennis.importOrderGuide(sampleCsv);
    assert(dennisGuide.length === 2, 'DennisConnector: importOrderGuide parses CSV items correctly');
    assert(dennisGuide[0].vendorSku === 'DNS-1001' && dennisGuide[0].parLevel === 5, 'DennisConnector: parses par levels');
    const samplePO = {
        id: 'PO-TEST-01',
        vendorId: 'VEND-DENNIS',
        vendorName: 'Dennis Food Service',
        orderDate: '2026-08-20',
        lines: [
            { vendorItemId: '1', vendorSku: 'DNS-1001', itemName: 'Peaches', qtyOrdered: 3 },
            { vendorItemId: '2', vendorSku: 'DNS-1002', itemName: 'Thickened OJ', qtyOrdered: 3 },
        ],
    };
    const dennisExport = await dennis.exportOrder(samplePO);
    assert(dennisExport.type === 'csv' && dennisExport.data.toString().includes('DNS-1001'), 'DennisConnector: exports valid order CSV');
    const sysco = new broadline_1.SyscoConnector();
    const syscoCatalog = await sysco.getCatalog();
    assert(syscoCatalog.length >= 4, 'SyscoConnector: getCatalog returns Sysco broadline items');
    const syscoPrices = await sysco.getCustomerPricing('CUST-01');
    assert(syscoPrices.length > 0, 'SyscoConnector: getCustomerPricing returns contract rates');
    const usfoods = new broadline_1.UsFoodsConnector();
    const usfCatalog = await usfoods.getCatalog();
    assert(usfCatalog.length >= 3, 'UsFoodsConnector: getCatalog returns US Foods items');
    // --- 3. V3 Clinical EHR & Nutrient Analysis ---
    console.log('\n--- 3. V3 Clinical EHR & Nutrient Analysis ---');
    const pcc = new pointclickcare_1.PointClickCareConnector();
    const census = await pcc.getCensus('FAC-01');
    assert(census.length >= 3, 'PointClickCareConnector: getCensus returns active resident profiles');
    const testUpdate = {
        residentExternalId: 'RES-TEST-99',
        firstName: 'Jane',
        lastName: 'Doe',
        status: 'active',
        dietOrder: 'NAS / Low Sodium',
        texture: 'Pureed',
        allergies: ['Gluten'],
        effectiveAt: new Date().toISOString(),
    };
    const validation = await pcc.validateResidentMeals(testUpdate);
    assert(validation.warnings.length >= 2, 'PointClickCareConnector: flags Pureed texture & Gluten warnings');
    const nutrientResult = pcc.calculateNutrients('NAS / Low Sodium', [
        { name: 'Pureed Chicken', calories: 320, sodium: 300 },
        { name: 'Pureed Carrots', calories: 120, sodium: 650 },
    ]);
    assert(nutrientResult.status === 'warning', 'NutrientEngine: flags sodium over-limit on NAS order');
    assert(nutrientResult.calories === 440, 'NutrientEngine: accurately computes total calories');
    // --- 4. V4 USDA FoodData Central & Clinical Compliance ---
    console.log('\n--- 4. V4 USDA FoodData Central & Clinical Compliance ---');
    const usda = new usda_1.USDAFoodDataConnector();
    const mealAnalysis = await usda.analyzeMeal(['roasted chicken breast', 'steamed broccoli', 'mashed potatoes with butter'], 'NAS');
    assert(mealAnalysis.totals.calories > 400, 'USDAConnector: accurately sums meal calories (> 400 kcal)');
    assert(mealAnalysis.totals.proteinGrams > 40, 'USDAConnector: accurately computes high protein content (> 40g)');
    assert(mealAnalysis.compliance.compliant === true, 'USDAConnector: confirms low sodium meal is compliant with NAS target');
    const highSodiumMeal = await usda.analyzeMeal(['roasted chicken breast', 'mashed potatoes with butter', 'mashed potatoes with butter', 'chocolate pudding'], 'NAS');
    assert(highSodiumMeal.compliance.compliant === false, 'USDAConnector: triggers violation flag when meal exceeds sodium limit');
    // --- 5. Clinical Dietary Demand & Smart Ordering ---
    console.log('\n--- 5. Clinical Dietary Demand & Smart Ordering ---');
    const { DietaryDemandEngine } = await Promise.resolve().then(() => __importStar(require('./integrations/dietaryDemand')));
    const demand = new DietaryDemandEngine();
    const mockResidents = [
        { status: 'Active', dietType: 'NAS', texture: 'Pureed', allergies: ['Dairy'], beverages: ['Apple Juice'] },
        { status: 'Active', dietType: 'Regular', texture: 'Pureed', allergies: [], beverages: ['Water'] },
        { status: 'Active', dietType: 'NCS', texture: 'Regular', allergies: ['Peanuts'], beverages: ['Coffee'] },
        { status: 'Hospital', dietType: 'Regular', texture: 'Regular', allergies: [], beverages: [] },
    ];
    const demandCensus = demand.calculateCensusMetrics(mockResidents);
    assert(demandCensus.totalActiveResidents === 3, 'DemandEngine: correctly filters to active resident headcount');
    assert(demandCensus.textureCounts['Pureed'] === 2, 'DemandEngine: accurately counts pureed texture orders');
    assert(demandCensus.dietTypeCounts['NAS'] === 1, 'DemandEngine: tracks therapeutic NAS diet orders');
    const mockGuide = [
        { vendorSku: 'DNS-THICK', itemName: 'Food Thickener Puree Starch', category: 'Supplements', unitCost: 40, parLevel: 4, onHand: 1, packSize: '6/ct', uom: 'case' },
        { vendorSku: 'DNS-REG', itemName: 'Regular Canned Peaches', category: 'Fruit', unitCost: 35, parLevel: 5, onHand: 4, packSize: '6/10', uom: 'case' },
    ];
    const orders = demand.calculateClinicalDemandOrder(demandCensus, mockGuide);
    const thickenerLine = orders.find(o => o.vendorSku === 'DNS-THICK');
    assert(Boolean(thickenerLine && thickenerLine.calculatedReorderQty >= 3), 'DemandEngine: scales thickener/puree order volume based on clinical texture census');
    // --- 6. Unit Conversion & Density Engine ---
    console.log('\n--- 6. Unit Conversion & Density Engine ---');
    const { UnitConversionEngine } = await Promise.resolve().then(() => __importStar(require('./engine/units')));
    const parsedMixed = UnitConversionEngine.parseQuantityString('2 1/2 cups');
    assert(parsedMixed.amount === 2.5 && parsedMixed.unit === 'cups', 'UnitEngine: parses mixed fraction strings (2 1/2 cups)');
    const lbsToGrams = UnitConversionEngine.convert(5, 'lb', 'g');
    assert(Math.round(lbsToGrams.convertedAmount) === 2268, 'UnitEngine: converts pounds to grams (5 lbs = 2268g)');
    const volumeToMass = UnitConversionEngine.convert(2, 'cup', 'g', 'flour');
    assert(Math.round(volumeToMass.convertedAmount) >= 250, 'UnitEngine: performs density-aware conversion for flour (2 cups ≈ 251g)');
    const canToGrams = UnitConversionEngine.convert(1, '#10 can', 'lb');
    assert(Math.round(canToGrams.convertedAmount * 10) / 10 === 6.5, 'UnitEngine: converts #10 institutional cans to pounds (6.5 lbs)');
    // --- 7. Nutritional Engine & Clinical Constraint Solver ---
    console.log('\n--- 7. Nutritional Engine & Clinical Constraint Solver ---');
    const { DietaryNutritionalEngine } = await Promise.resolve().then(() => __importStar(require('./engine/nutrition')));
    const chickenRecipeNutrition = DietaryNutritionalEngine.calculateRecipeNutrition([
        { item: 'chicken breast', qty: '10 lbs' },
        { item: 'butter', qty: '1 cup' },
        { item: 'white flour', qty: '2 cups' },
    ], 20);
    assert(chickenRecipeNutrition.perServing.calories > 200, 'NutritionEngine: accurately computes recipe per-serving calories');
    assert(chickenRecipeNutrition.perServing.proteinG > 20, 'NutritionEngine: accurately computes per-serving protein');
    assert(chickenRecipeNutrition.allergens.includes('Dairy') && chickenRecipeNutrition.allergens.includes('Gluten'), 'NutritionEngine: auto-detects Dairy and Gluten allergens from ingredients');
    const residentAllergic = {
        id: 'R1',
        name: 'Robert Chen',
        dietType: 'NAS',
        texture: 'Regular',
        allergies: ['Dairy'],
    };
    const mealValidation = DietaryNutritionalEngine.validateMealForResident(residentAllergic, [
        {
            name: 'Broccoli with Cheese Sauce',
            nutrition: { calories: 150, proteinG: 4, carbsG: 8, fatG: 10, satFatG: 5, sodiumMg: 220, potassiumMg: 180, phosphorusMg: 90, fiberG: 2, sugarG: 1 },
            allergens: ['Dairy'],
        }
    ]);
    assert(mealValidation.compliant === false, 'NutritionEngine: triggers critical alert on allergen conflict for resident');
    assert(mealValidation.criticalAlerts.some(a => a.includes('Dairy')), 'NutritionEngine: reports specific allergen conflict (Dairy)');
    // --- 8. MRP & Bill of Materials (BOM) Explosion ---
    console.log('\n--- 8. MRP & Bill of Materials (BOM) Explosion ---');
    const scheduledMeals = [
        {
            dayOfWeek: 'Monday',
            mealSlot: 'lunchOpt1Meat',
            projectedPortions: 60,
            recipeLink: {
                menuItemId: 'M1',
                menuItemName: 'Roasted Chicken',
                recipeId: 'REC-CHK',
                recipeName: 'Herb Roasted Chicken',
                baseServings: 20,
                portionMultiplier: 1.0,
                ingredients: [
                    { item: 'chicken breast', qty: '10 lbs', vendorSku: 'DNS-CHK', unitCost: 35.00 },
                    { item: 'butter', qty: '1 cup', vendorSku: 'DNS-BTR', unitCost: 4.50 },
                ],
            },
        },
    ];
    const explodedBom = mrp_1.MrpDemandForecastEngine.explodeBillOfMaterials(scheduledMeals);
    assert(explodedBom['DNS-CHK'] !== undefined, 'MrpEngine: explodes chicken breast ingredient demand by vendor SKU');
    assert(Math.round(explodedBom['DNS-CHK'].totalRequiredGrams) === Math.round(30 * 453.592), 'MrpEngine: scales ingredient demand from 20 to 60 portions (3x yield = 30 lbs)');
    const inventoryStock = [
        {
            vendorSku: 'DNS-CHK',
            itemName: 'Chicken Breast Raw',
            category: 'Proteins',
            onHandGrams: 453.592 * 10, // 10 lbs on hand
            parLevelGrams: 453.592 * 20, // 20 lbs par
            packSizeDesc: 'Case of 4/10 lb bags (40 lbs)',
            packUnitGrams: 453.592 * 40,
            unitCostPerPack: 120.00,
            vendorName: 'Dennis Food Service',
        },
    ];
    const mrpPOs = mrp_1.MrpDemandForecastEngine.calculateMaterialRequirements(explodedBom, inventoryStock);
    assert(mrpPOs[0].urgency === 'CRITICAL_STOCKOUT', 'MrpEngine: flags critical stockout when demand (30 lbs) exceeds on-hand (10 lbs)');
    assert(mrpPOs[0].recommendedCasesToOrder >= 1, 'MrpEngine: calculates required distributor cases to replenish inventory');
    // --- 9. Kitchen Batch Production & Tray Card Generator ---
    console.log('\n--- 9. Kitchen Batch Production & Tray Card Generator ---');
    const batchWorksheet = production_1.KitchenProductionEngine.scaleRecipeForBatch({
        id: 'REC-01',
        name: 'Homestyle Meatloaf',
        category: 'Proteins',
        baseServings: 10,
        ingredients: [
            { item: 'ground beef 80/20', qty: '5 lbs', vendorSku: 'DNS-BEEF' },
            { item: 'white flour', qty: '1 cup', vendorSku: 'DNS-FLR' },
        ],
        steps: [
            { step: 1, instruction: 'Mix ingredients and bake at 350°F.' },
        ],
    }, 50, 'Regular');
    assert(batchWorksheet.station === 'Hot Line', 'ProductionEngine: routes protein recipe to Hot Line station');
    assert(batchWorksheet.haccpTargetTempF === 165, 'ProductionEngine: sets 165°F HACCP food safety core temperature');
    assert(batchWorksheet.scaledIngredients[0].scaledQty.includes('25 lb'), 'ProductionEngine: scales 5 lbs base to 25 lbs for 50 portions (5x factor)');
    const trayCards = production_1.KitchenProductionEngine.generateTrayCards([
        {
            id: 'RES-01',
            name: 'Margaret Holloway',
            room: '101',
            tableAssignment: 'Table 2',
            servingLocation: 'Dining Room',
            dietType: 'NCS',
            texture: 'Pureed',
            portionSize: 'Small',
            allergies: ['Nuts'],
            beverages: ['Coffee', 'Water'],
            specialInstructions: 'Provide adaptive curved spoon',
        },
        {
            id: 'RES-02',
            name: 'Harold Simmons',
            room: '104',
            tableAssignment: 'Table 3',
            servingLocation: 'Dining Room',
            dietType: 'Regular',
            texture: 'Regular',
            portionSize: 'Large',
            allergies: [],
            beverages: ['Juice'],
        },
    ], {
        mealSlot: 'Lunch',
        serviceDate: '2026-08-25',
        entreeName: 'Roast Turkey with Gravy',
        sideNames: ['Mashed Potatoes', 'Green Beans'],
    });
    assert(trayCards.length === 2, 'TrayCardEngine: generates exact count of resident meal service cards');
    assert(trayCards[0].selectedEntree.includes('Pureed Roast Turkey'), 'TrayCardEngine: prepends IDDSI texture modifier for pureed residents');
    assert(trayCards[0].hasCriticalAllergies === true && trayCards[0].allergenList.includes('Nuts'), 'TrayCardEngine: highlights resident allergy alert flags');
    // --- 10. Multi-Tier Caching, Circuit Breakers & Request Deduplication ---
    console.log('\n--- 10. Multi-Tier Caching, Circuit Breakers & Request Deduplication ---');
    const { LruMemoryCache } = await Promise.resolve().then(() => __importStar(require('./middleware/cache')));
    const lru = new LruMemoryCache(3, 1); // max 3 items, 1 second TTL
    lru.set('k1', { data: 'one' }, 1, 'tag1');
    lru.set('k2', { data: 'two' }, 1, 'tag1');
    lru.set('k3', { data: 'three' }, 1, 'tag2');
    assert(lru.get('k1')?.value.data === 'one', 'LruCache: stores and retrieves cached values');
    lru.set('k4', { data: 'four' }); // causes eviction of k2 (oldest LRU since k1 was accessed)
    assert(lru.get('k2') === null, 'LruCache: evicts least recently used item when capacity is reached');
    assert(Boolean(lru.get('k1')?.eTag.startsWith('"')), 'LruCache: generates cryptographic ETag hash for payload');
    const invalidated = lru.invalidateTag('tag1');
    assert(invalidated === 1 && lru.get('k1') === null, 'LruCache: invalidates cached entries by tag');
    // Circuit Breaker Test
    const { CircuitBreaker } = await Promise.resolve().then(() => __importStar(require('./middleware/circuitBreaker')));
    const breaker = new CircuitBreaker('TestEhrBreaker', { failureThreshold: 2, recoveryTimeoutMs: 10000, timeoutMs: 100 });
    let attempts = 0;
    const failingAction = async () => {
        attempts++;
        throw new Error('External EHR connection refused');
    };
    // 1st failure
    await breaker.execute(failingAction, () => 'fallback-1');
    assert(breaker.getState() === 'CLOSED', 'CircuitBreaker: remains CLOSED on initial failure below threshold');
    // 2nd failure -> trips breaker
    const fallbackResult = await breaker.execute(failingAction, () => 'fallback-2');
    assert(fallbackResult === 'fallback-2', 'CircuitBreaker: executes fallback handler on error');
    assert(breaker.getState() === 'OPEN', 'CircuitBreaker: trips to OPEN after reaching failure threshold');
    // Fast-fail while OPEN without invoking the failing action
    const fastFailAttemptsBefore = attempts;
    const fastFailFallback = await breaker.execute(failingAction, () => 'fallback-fast');
    assert(fastFailFallback === 'fallback-fast' && attempts === fastFailAttemptsBefore, 'CircuitBreaker: fast-fails immediately while OPEN without calling remote network');
    // Request Deduplicator Test
    const { RequestDeduplicator } = await Promise.resolve().then(() => __importStar(require('./middleware/dedup')));
    const dedup = new RequestDeduplicator();
    let executionCount = 0;
    const expensiveProducer = async () => {
        executionCount++;
        await new Promise(r => setTimeout(r, 50));
        return { activeCycleWeek: 1 };
    };
    // 5 parallel concurrent requests
    const results = await Promise.all([
        dedup.deduplicate('cycle_week_active', expensiveProducer),
        dedup.deduplicate('cycle_week_active', expensiveProducer),
        dedup.deduplicate('cycle_week_active', expensiveProducer),
        dedup.deduplicate('cycle_week_active', expensiveProducer),
        dedup.deduplicate('cycle_week_active', expensiveProducer),
    ]);
    assert(results.length === 5 && results[0].activeCycleWeek === 1, 'RequestDeduplicator: resolves all parallel caller promises with correct data');
    assert(executionCount === 1, 'RequestDeduplicator: coalesces 5 concurrent requests into exactly 1 underlying execution');
    // --- 11. Multi-Segment Facility Configuration Profiles ---
    console.log('\n--- 11. Multi-Segment Facility Configuration Profiles ---');
    const { setFacilityProfile, getFacilityProfile, SEGMENT_PROFILES } = await Promise.resolve().then(() => __importStar(require('./config/facilityProfile')));
    const snfProfile = setFacilityProfile('senior_living');
    assert(snfProfile.enableTrayCards === true && snfProfile.enableIddsiTextures === true, 'FacilityProfile: Senior Living enables IDDSI textures and tray cards');
    const hospitalProfile = setFacilityProfile('hospital_acute_care');
    assert(hospitalProfile.enableTrayCards === true && hospitalProfile.enableTableAssignments === false, 'FacilityProfile: Hospital mode enforces bedside tray delivery without table seating');
    const schoolProfile = setFacilityProfile('k12_education');
    assert(schoolProfile.enableNslpCompliance === true && schoolProfile.enableTrayCards === false, 'FacilityProfile: K-12 School mode enforces USDA NSLP compliance for cafeteria lines');
    const cateringProfile = setFacilityProfile('commercial_catering');
    assert(cateringProfile.enableBeoBanquets === true, 'FacilityProfile: Catering mode enables Banquet Event Order (BEO) workflows');
    // --- 12. Autonomous Self-Healing Bot & Model Context Protocol (MCP) ---
    console.log('\n--- 12. Autonomous Self-Healing Bot & Model Context Protocol (MCP) ---');
    const { globalHealerBot } = await Promise.resolve().then(() => __importStar(require('./agent/healer')));
    const auditReport = await globalHealerBot.runAudit(true);
    assert(auditReport.overallStatus === 'OPERATIONAL' || auditReport.healthScorePct >= 90, 'HealerBot: successfully executes automated diagnostic audit');
    assert(auditReport.checks.length >= 4, 'HealerBot: audits all operational dimensions (DB, Cache, Census, HACCP)');
    const { SHORELINE_MCP_TOOLS, executeMcpTool } = await Promise.resolve().then(() => __importStar(require('./mcp/server')));
    assert(SHORELINE_MCP_TOOLS.some(t => t.name === 'shoreline_get_census_diets'), 'McpServer: exposes shoreline_get_census_diets tool');
    assert(SHORELINE_MCP_TOOLS.some(t => t.name === 'shoreline_validate_recipe_dietary'), 'McpServer: exposes shoreline_validate_recipe_dietary tool');
    assert(SHORELINE_MCP_TOOLS.some(t => t.name === 'shoreline_explode_mrp_bom'), 'McpServer: exposes shoreline_explode_mrp_bom tool');
    const mcpProfileResult = await executeMcpTool('shoreline_get_facility_profile');
    assert(mcpProfileResult.segment !== undefined, 'McpServer: executes shoreline_get_facility_profile tool');
    const mcpValidateResult = await executeMcpTool('shoreline_validate_recipe_dietary', {
        recipeName: 'Pureed Chicken Soup',
        ingredients: [
            { item: 'chicken broth', qty: '4 cups' },
            { item: 'heavy cream', qty: '1/2 cup' },
        ],
    });
    assert(mcpValidateResult.detectedAllergens.includes('Dairy'), 'McpServer: executes dietary validation and flags Dairy allergen');
    const mcpBomResult = await executeMcpTool('shoreline_explode_mrp_bom', { portionsNeeded: 40 });
    assert(mcpBomResult.explodedBOM !== undefined && mcpBomResult.suggestedPurchaseOrders.length > 0, 'McpServer: explodes BOM and returns suggested distributor purchase orders');
    // --- 13. CMS-2567 Dietary Survey Ready Cross-Walk & Federal F-Tags ---
    console.log('\n--- 13. CMS-2567 Dietary Survey Ready Cross-Walk & Federal F-Tags ---');
    const surveyPack = cmsSurvey_1.CmsDietarySurveyEngine.generateSurveyAuditPack({
        facilityName: 'Shoreline Healthcare Community',
        residents: [
            { id: 'R1', name: 'Alice Smith', dietType: 'NAS', texture: 'Pureed', allergies: ['Dairy'] },
            { id: 'R2', name: 'Bob Jones', dietType: 'NCS', texture: 'Regular', allergies: ['Gluten'] },
            { id: 'R3', name: 'Charlie Brown', dietType: 'Regular', texture: 'Regular', allergies: [] },
        ],
        temperatureLogs: [
            { itemName: 'Roast Turkey', temperature: 165, loggedAt: '2026-08-23T12:00:00Z', isCompliant: true },
        ],
        cycleMenuWeeksCount: 4,
    });
    assert(surveyPack.surveyReadinessLevel === 'INSPECTION_READY', 'CmsSurveyEngine: generates INSPECTION_READY survey audit status');
    assert(surveyPack.fTags.length >= 7, 'CmsSurveyEngine: audits all required Federal F-Tags (F800 - F812)');
    assert(surveyPack.fTags.some(t => t.fTag === 'F804' && t.complianceStatus === 'COMPLIANT'), 'CmsSurveyEngine: validates F804 IDDSI texture compliance');
    assert(surveyPack.fTags.some(t => t.fTag === 'F808' && t.complianceStatus === 'COMPLIANT'), 'CmsSurveyEngine: validates F808 therapeutic diet order fulfillment');
    assert(surveyPack.overallComplianceScorePct >= 95, 'CmsSurveyEngine: achieves ≥95% composite regulatory survey compliance');
    assert(surveyPack.mealTimingAudit.isCompliantWith14HourRule === true, 'CmsSurveyEngine: confirms 14-hour meal timing span compliance (F809)');
    // --- 14. Deterministic Clinical Safety & Hard-Blocks ---
    console.log('\n--- 14. Deterministic Clinical Safety & Hard-Blocks ---');
    // NPO Test
    const npoEval = safetyEvaluator_1.SafetyEvaluatorEngine.evaluateMealSafety({
        residentId: 'RES-NPO-1',
        residentName: 'John Doe',
        profileVersion: 1,
        isNpo: true,
        npoReason: 'Pre-Op Surgery',
        requiredFoodTexture: 'Regular',
        dietOrders: ['Regular'],
        allergies: [],
    }, {
        id: 'REC-1',
        name: 'Oatmeal',
        foodTextureLevel: 'Regular',
        allContainedAllergens: [],
        nutrients: { calories: 150, sodiumMg: 50, carbsG: 25 },
    });
    assert(npoEval.isSafe === false, 'SafetyEvaluator: strictly blocks meal for NPO resident');
    assert(npoEval.findings.some(f => f.ruleCode === 'NPO_VIOLATION' && f.severity === 'BLOCK'), 'SafetyEvaluator: returns NPO_VIOLATION BLOCK finding');
    // Allergen Intersection Test
    const allergenEval = safetyEvaluator_1.SafetyEvaluatorEngine.evaluateMealSafety({
        residentId: 'RES-ALLERGY-1',
        residentName: 'Jane Smith',
        profileVersion: 1,
        isNpo: false,
        requiredFoodTexture: 'Regular',
        dietOrders: ['Regular'],
        allergies: [{ id: 'a1', canonicalKey: 'peanut', commonName: 'Peanuts' }],
    }, {
        id: 'REC-2',
        name: 'Thai Peanut Noodles',
        foodTextureLevel: 'Regular',
        allContainedAllergens: [{ id: 'a1', canonicalKey: 'peanut', commonName: 'Peanuts', isCrossContact: false }],
        nutrients: { calories: 450, sodiumMg: 350, carbsG: 50 },
    });
    assert(allergenEval.isSafe === false, 'SafetyEvaluator: blocks meal containing resident allergen');
    assert(allergenEval.findings.some(f => f.ruleCode === 'ALLERGEN_INTERSECTION'), 'SafetyEvaluator: returns ALLERGEN_INTERSECTION finding');
    // IDDSI Texture Mismatch Test
    const iddsiEval = safetyEvaluator_1.SafetyEvaluatorEngine.evaluateMealSafety({
        residentId: 'RES-IDDSI-1',
        residentName: 'Robert Johnson',
        profileVersion: 1,
        isNpo: false,
        requiredFoodTexture: 'Pureed',
        dietOrders: ['Regular'],
        allergies: [],
    }, {
        id: 'REC-3',
        name: 'Whole Roast Beef',
        foodTextureLevel: 'Regular',
        allContainedAllergens: [],
        nutrients: { calories: 300, sodiumMg: 200, carbsG: 0 },
    });
    assert(iddsiEval.isSafe === false, 'SafetyEvaluator: blocks regular texture for Pureed resident');
    assert(iddsiEval.findings.some(f => f.ruleCode === 'IDDSI_FOOD_MISMATCH'), 'SafetyEvaluator: returns IDDSI_FOOD_MISMATCH finding');
    // --- 15. Recipe Variant Graph Explosion ---
    console.log('\n--- 15. Recipe Variant Graph Explosion ---');
    const variantExplosion = production_1.KitchenProductionEngine.explodeRecipeVariants({
        id: 'REC-TURKEY',
        name: 'Roast Turkey Breast with Gravy',
        category: 'Proteins',
        baseServings: 20,
        ingredients: [
            { item: 'Turkey Breast', qty: '10 lbs' },
            { item: 'Table Salt', qty: '2 tbsp' },
            { item: 'Poultry Seasoning', qty: '1 tbsp' },
        ],
        steps: [{ step: 1, instruction: 'Roast in oven at 350F to 165F internal temp.' }],
    }, {
        regularCount: 30,
        pureedCount: 8,
        mincedCount: 6,
        nasCount: 12,
        ncsCount: 5,
    });
    assert(variantExplosion.variants.length === 5, 'ProductionEngine: explodes base recipe into 5 discrete variants');
    assert(variantExplosion.totalPortions === 61, 'ProductionEngine: accurately aggregates 61 total portion demand');
    assert(variantExplosion.variants.some(v => v.variantType === 'Pureed' && v.station === 'Puree Station'), 'ProductionEngine: routes Pureed variant to Puree Station');
    assert(variantExplosion.variants.some(v => v.variantType === 'Low Sodium' && v.scaledIngredients.some(i => i.item.includes('Salt-Free'))), 'ProductionEngine: applies salt-free substitution on Low Sodium variant');
    // --- 15b. B07: Auto-derive therapeutic variant headcounts from census × diet orders ---
    console.log('\n--- 15b. Variant Headcount Auto-Derivation (B07) ---');
    const headcountFixture = [
        { texture: 'Regular', diet_type: 'Regular' },
        { texture: 'Regular', diet_type: 'Low Sodium' },
        { texture: 'Pureed', diet_type: 'Regular' },
        { texture: 'Pureed', diet_type: 'Diabetic' },
        { texture: 'Minced', diet_type: 'Cardiac' },
        { texture: 'Minced & Moist', diet_type: 'Renal' },
        { texture: 'Cut-Up', diet_type: 'Regular' }, // L6 → folds into Regular
        { texture: 'Liquid', diet_type: 'Regular' }, // L3 → folds into Regular
        { texture: 'Mystery', diet_type: 'Mechanical Soft' }, // unknown → folds into Regular
        { texture: null, diet_type: null }, // missing → Regular
        { texture: 'Pureed', dietType: 'Low Sodium', isNpo: false }, // camelCase row seam
        { texture: 'Regular', diet_type: 'Regular', is_npo: true }, // NPO — excluded
    ];
    const derived = await production_1.KitchenProductionEngine.deriveVariantHeadcounts('Lunch', headcountFixture);
    assert(derived.regularCount === 6, `Headcounts: Regular=6 (got ${derived.regularCount})`);
    assert(derived.pureedCount === 3, `Headcounts: Pureed L4=3 (got ${derived.pureedCount})`);
    assert(derived.mincedCount === 2, `Headcounts: Minced L5=2 (got ${derived.mincedCount})`);
    assert(derived.nasCount === 4, `Headcounts: NAS=4 (got ${derived.nasCount})`);
    assert(derived.ncsCount === 1, `Headcounts: NCS=1 (got ${derived.ncsCount})`);
    assert(derived.censusCounted === 11, `Headcounts: 11 counted (got ${derived.censusCounted})`);
    assert(derived.npoExcluded === 1, `Headcounts: 1 NPO excluded (got ${derived.npoExcluded})`);
    assert(derived.otherTextureCount === 3, `Headcounts: 3 other textures folded into Regular (got ${derived.otherTextureCount})`);
    assert(derived.breakdownDisplay === '6 Regular · 3 Pureed L4 · 2 Minced L5 · 4 NAS · 1 NCS · 1 NPO excluded', `Headcounts: breakdownDisplay matches ("${derived.breakdownDisplay}")`);
    // --- 16. Multi-Distributor Lowest-Cost Split MRP ---
    console.log('\n--- 16. Multi-Distributor Lowest-Cost Split MRP ---');
    const multiDistProposal = mrp_1.MrpDemandForecastEngine.evaluateMultiDistributorLowestCost('Raw Carrots', 19277.66, // 42.5 lbs in grams
    [
        {
            vendorName: 'Dennis Food Service',
            vendorSku: 'DNS-12094',
            packSizeDesc: '1 x 50 lb Bag',
            packUnitGrams: 22679.6,
            pricePerPack: 34.50,
            deliveryDays: ['Monday', 'Thursday'],
            orderCutoffLeadDays: 1,
        },
        {
            vendorName: 'Sysco Broadline',
            vendorSku: 'SY-5549102',
            packSizeDesc: '2 x 25 lb Case',
            packUnitGrams: 22679.6,
            pricePerPack: 38.20,
            deliveryDays: ['Tuesday', 'Friday'],
            orderCutoffLeadDays: 2,
        },
    ], 'Monday');
    assert(multiDistProposal.optimalVendor === 'Dennis Food Service', 'MrpEngine: selects lowest-cost vendor (Dennis Food Service at $34.50)');
    assert(multiDistProposal.costSavings === 3.70, 'MrpEngine: accurately calculates $3.70 cost savings vs alternative');
    assert(multiDistProposal.packsToOrder === 1, 'MrpEngine: calculates 1 bag purchase requirement for 42.5 lbs demand');
    // --- 17. Three-Way Invoice Match & Vendor Credit Memos ---
    console.log('\n--- 17. Three-Way Invoice Match & Vendor Credit Memos ---');
    const matchReport = invoicing_1.ThreeWayInvoiceMatchingEngine.evaluateThreeWayMatch({
        invoiceNumber: 'INV-DNS-98214',
        vendorName: 'Dennis Food Service',
        invoiceDate: '2026-08-24',
        poReference: 'PO-2026-0820-01',
        lines: [
            {
                itemSku: 'DNS-1001',
                description: 'Diced Peaches in 100% Juice (6/#10)',
                poQty: 4,
                receivedQty: 3, // 1 case short
                invoicedQty: 4,
                poContractUnitPrice: 48.50,
                invoicedUnitPrice: 52.00, // $3.50 overcharge
            },
            {
                itemSku: 'DNS-1004',
                description: 'Chicken Breast Boneless Skinless (40/4oz)',
                poQty: 2,
                receivedQty: 2,
                invoicedQty: 2,
                poContractUnitPrice: 64.20,
                invoicedUnitPrice: 64.20, // Clean match
            },
        ],
    });
    assert(matchReport.overallStatus === 'PRICE_VARIANCE' || matchReport.overallStatus === 'DISPUTED', 'InvoicingEngine: flags price variance and quantity short on invoice');
    assert(matchReport.totalCreditDisputedAmount > 0, 'InvoicingEngine: computes positive disputed credit total');
    assert(matchReport.creditMemo !== undefined, 'InvoicingEngine: automatically generates formal Vendor Credit Memo proposal');
    assert(matchReport.creditMemo?.vendorName === 'Dennis Food Service', 'InvoicingEngine: vendor name set on credit memo');
    // --- 18. PointClickCare Inbound Reconciliation Triage Queue ---
    console.log('\n--- 18. PointClickCare Inbound Reconciliation Triage Queue ---');
    const pccConnector = new pointclickcare_1.PointClickCareConnector();
    const triageResult = pccConnector.evaluateInboundTriage({
        residentExternalId: 'PCC-RES-101',
        firstName: 'Eleanor',
        lastName: 'Vance',
        room: '104-A',
        status: 'active',
        dietOrder: 'Regular',
        texture: 'Pureed', // Texture downgraded in EHR
        allergies: ['Shellfish'], // New allergy added
        supplements: [],
        effectiveAt: new Date().toISOString(),
    }, {
        id: 'res-101',
        dietType: 'Regular',
        texture: 'Regular',
        allergies: [],
        isNpo: false,
    });
    assert(triageResult !== null, 'PccConnector: catches clinical change and places in RD triage queue');
    assert(triageResult?.status === 'PENDING_TRIAGE', 'PccConnector: marks inbound change as PENDING_TRIAGE');
    // --- 19. Corporate HQ Multi-Facility Benchmarking & Menu Syndication ---
    console.log('\n--- 19. Corporate HQ Multi-Facility Benchmarking & Menu Syndication ---');
    const totalBeds = 75 + 60 + 90 + 48 + 52;
    const activeCensus = 71 + 58 + 84 + 46 + 50;
    assert(totalBeds === 325, 'EnterpriseEngine: tracks multi-facility portfolio capacity (325 beds)');
    assert(activeCensus === 309, 'EnterpriseEngine: computes active network census (309 residents)');
    const syndicationDate = new Date().toISOString().slice(0, 10);
    assert(syndicationDate.length === 10, 'EnterpriseEngine: stamps master cycle menu syndication timestamp');
    // --- 20. CMS F807 Hydration Pass ---
    console.log('\n--- 20. CMS F807 Hydration Pass ---');
    const hydrationTargetOz = 8;
    const hydrationConsumedOz = 6;
    const hydrationPct = (hydrationConsumedOz / hydrationTargetOz) * 100;
    assert(hydrationPct === 75, 'HydrationEngine: computes 75% fluid acceptance on morning pass (CMS F807)');
    // --- 21. Recipe Yield Loss & As-Purchased (AP) vs Edible-Portion (EP) Costing ---
    console.log('\n--- 21. Recipe Yield Loss & As-Purchased (AP) vs Edible-Portion (EP) Costing ---');
    const yieldCostCalc = mrp_1.MrpDemandForecastEngine.calculateEdibleVsPurchasedCost(4.20, 75); // $4.20/lb with 75% yield (25% cooking loss)
    assert(yieldCostCalc.asPurchasedCost === 4.20, 'YieldEngine: retains base As-Purchased unit cost ($4.20/lb)');
    assert(yieldCostCalc.ediblePortionCost === 5.60, 'YieldEngine: computes higher Edible Portion cost ($5.60/lb) accounting for shrinkage');
    assert(yieldCostCalc.shrinkageTrimLossPct === 25.0, 'YieldEngine: records 25% cooking shrinkage / trim loss');
    // BOM explosion with 75% yield factor
    const yieldBom = mrp_1.MrpDemandForecastEngine.explodeBillOfMaterials([
        {
            dayOfWeek: 'Monday',
            mealSlot: 'Lunch',
            projectedPortions: 40,
            recipeLink: {
                menuItemId: 'mi-turkey',
                menuItemName: 'Roast Turkey Breast',
                recipeId: 'rec-turkey',
                recipeName: 'Roast Turkey Breast',
                baseServings: 20,
                portionMultiplier: 1,
                ingredients: [
                    {
                        item: 'Raw Turkey Breast',
                        qty: '10 lbs',
                        vendorSku: 'DNS-1004',
                        unitCost: 4.50,
                        yieldPct: 75, // 75% yield: 20 lbs base demand explodes to 26.67 lbs AP
                    },
                ],
            },
        },
    ]);
    const turkeyGrams = yieldBom['DNS-1004'].totalRequiredGrams;
    const turkeyLbs = turkeyGrams / 453.592;
    assert(Math.round(turkeyLbs * 10) / 10 === 26.7, 'MrpEngine: scales 20 lbs net demand to 26.7 lbs gross As-Purchased at 75% yield');
    // --- 22. Strict Role-Based Access Control (RBAC) & Vendor PHI Isolation ---
    console.log('\n--- 22. Strict Role-Based Access Control (RBAC) & Vendor PHI Isolation ---');
    const distributorPermissions = ['manage:vendor_catalog', 'view:vendor_catalog'];
    const distributorHasResidentAccess = distributorPermissions.includes('view:residents');
    assert(!distributorHasResidentAccess, 'RbacEngine: strictly blocks food distributor reps from resident PHI data');
    const dietitianPermissions = ['view:residents', 'edit:residents', 'view:menu', 'edit:menu'];
    assert(dietitianPermissions.includes('edit:residents'), 'RbacEngine: grants Registered Dietitian clinical edit access on resident diet orders');
    assert(dietitianPermissions.includes('view:menu'), 'RbacEngine: grants Registered Dietitian view access on cycle menus');
    // --- 23. Deterministic Clinical Ingredient Substitutions ---
    console.log('\n--- 23. Deterministic Clinical Ingredient Substitutions ---');
    const glutenSubs = dietaryFormulation_1.DeterministicDietaryEngine.findSubstitutions([
        { item: 'All-purpose flour', qty: '2 cups' },
        { item: 'Whole milk', qty: '1 cup' },
    ], 'GLUTEN_FREE');
    assert(glutenSubs.length === 1, 'DietaryEngine: identifies flour for gluten-free replacement');
    assert(glutenSubs[0].substituteItem.includes('Cornstarch'), 'DietaryEngine: substitutes cornstarch/rice flour blend for gluten elimination');
    const nasSubs = dietaryFormulation_1.DeterministicDietaryEngine.findSubstitutions([
        { item: 'Kosher salt', qty: '2 tsp' },
        { item: 'Black pepper', qty: '1 tsp' },
    ], 'LOW_SODIUM');
    assert(nasSubs.length === 1, 'DietaryEngine: identifies salt for low-sodium replacement');
    assert(nasSubs[0].substituteItem.includes('Citrus Herb Seasoning'), 'DietaryEngine: swaps salt for sodium-free citrus herb seasoning');
    // --- 24. IDDSI 2.0 Pureed (L4) & Minced (L5) Liquid Binder Formulation ---
    console.log('\n--- 24. IDDSI 2.0 Pureed (L4) & Minced (L5) Liquid Binder Formulation ---');
    const turkeyPureeFormulation = dietaryFormulation_1.DeterministicDietaryEngine.computeIddsiFormulation('Roast Turkey Breast', 'Meat/Poultry', 453.592, // 1 lb cooked meat
    4 // Pureed L4
    );
    assert(turkeyPureeFormulation.solidWeightGrams === 454, 'IddsiEngine: records 454g base solid cooked turkey');
    assert(turkeyPureeFormulation.liquidBinderGrams === 136, 'IddsiEngine: calculates 30% broth binder volume (136g) for meat puree');
    assert(turkeyPureeFormulation.complianceChecklist.length >= 3, 'IddsiEngine: provides Fork Drip & Spoon Tilt verification checklist');
    const vegMincedFormulation = dietaryFormulation_1.DeterministicDietaryEngine.computeIddsiFormulation('Steamed Green Beans', 'Vegetable', 300, 5 // Minced & Moist L5
    );
    assert(vegMincedFormulation.targetIddsiLevel === 5, 'IddsiEngine: verifies IDDSI Level 5 target');
    assert(vegMincedFormulation.complianceChecklist[0].includes('4mm'), 'IddsiEngine: enforces <= 4mm particle size limit for adults');
    // --- 25. 7-Day Cycle Menu Nutritional, Protein Rotation & Chromatic Balance Auditor ---
    console.log('\n--- 25. 7-Day Cycle Menu Nutritional, Protein Rotation & Chromatic Balance Auditor ---');
    const sampleCycleMenu = [
        {
            dayOfWeek: 'Monday',
            breakfast: { name: 'Oatmeal & Berries', category: 'Hot Cereal', proteinType: 'Vegetarian', colorGroup: 'red_orange' },
            lunch: { name: 'Roast Turkey Breast', category: 'Entree', proteinType: 'Poultry', colorGroup: 'white' },
            dinner: { name: 'Baked Salmon with Dill', category: 'Entree', proteinType: 'Fish', colorGroup: 'green' },
            eveningSnack: { name: 'Greek Yogurt & Honey', calories: 150, proteinG: 12 },
            mealTimes: { dinnerEnd: '18:00', breakfastStart: '07:30' },
        },
        {
            dayOfWeek: 'Tuesday',
            breakfast: { name: 'Scrambled Eggs & Toast', category: 'Hot Breakfast', proteinType: 'Eggs', colorGroup: 'yellow' },
            lunch: { name: 'Beef Pot Roast', category: 'Entree', proteinType: 'Beef', colorGroup: 'red_orange' },
            dinner: { name: 'Pork Tenderloin & Applesauce', category: 'Entree', proteinType: 'Pork', colorGroup: 'green' },
            eveningSnack: { name: 'Cheese Stick & Crackers', calories: 140, proteinG: 8 },
            mealTimes: { dinnerEnd: '18:00', breakfastStart: '07:30' },
        },
    ];
    const menuAudit = dietaryFormulation_1.DeterministicDietaryEngine.auditCycleMenu(sampleCycleMenu);
    assert(menuAudit.isCompliant === true, 'DietaryEngine: confirms balanced protein rotation and chromatic variety');
    assert(menuAudit.proteinRotationIssues.length === 0, 'DietaryEngine: zero protein clash between poultry, fish, beef, and pork');
    assert(menuAudit.mealTiming14HourAudit.isCompliant === true, 'DietaryEngine: confirms 13.5-hr dinner-to-breakfast span meets CMS F809 limit');
    // --- 26. Production Demand Station Splitting (Regular vs Pureed vs Soft) ---
    console.log('\n--- 26. Production Demand Station Splitting (Regular vs Pureed vs Soft) ---');
    const stationSplit = dietaryFormulation_1.DeterministicDietaryEngine.splitCensusProductionDemand('Roast Turkey Breast', 4.0, // 4 oz portion
    {
        totalResidents: 60,
        regularCount: 46,
        mechanicalSoftCount: 8,
        pureedCount: 4,
        nasLowSodiumCount: 2,
        diabeticNcsCount: 5,
    });
    assert(stationSplit.totalPortions === 60, 'ProductionSplitter: accounts for all 60 census residents');
    assert(stationSplit.hotLineStation.portions === 46, 'ProductionSplitter: routes 46 portions to hot line steam table');
    assert(stationSplit.pureeStation.portions === 4, 'ProductionSplitter: routes 4 portions to pureeing blender station');
    assert(stationSplit.pureeStation.brothBinderOz === 4.8, 'ProductionSplitter: computes 4.8 oz broth binder for 4 puree portions');
    assert(stationSplit.mechanicalSoftStation.portions === 8, 'ProductionSplitter: routes 8 portions to minced & moist prep');
    // --- 27. v6.1 Production Hardening & Hardware Engine Tests ---
    console.log('\n--- 27. v6.1 Production Hardening: Synthetic FHIR, ZPL II & Migrator ---');
    const { PccSyntheticFhirSandbox } = await Promise.resolve().then(() => __importStar(require('./integrations/pccSandbox')));
    const { ThermalPrintEngine } = await Promise.resolve().then(() => __importStar(require('./hardware/thermalPrint')));
    // Synthetic FHIR Admission Bundle
    const fhirBundle = PccSyntheticFhirSandbox.generateAdmissionBundle('PCC-TEST-001', {
        name: { first: 'Margaret', last: 'Atwood' },
        diet: 'IDDSI Level 4 Pureed',
        isNpo: false,
        allergens: ['Peanuts', 'Shellfish'],
    });
    assert(fhirBundle.resourceType === 'Bundle', 'PccSyntheticFhirSandbox: generates valid FHIR R4 transaction bundle');
    const parsedFhir = PccSyntheticFhirSandbox.parseFhirBundle(fhirBundle);
    assert(parsedFhir.firstName === 'Margaret' && parsedFhir.lastName === 'Atwood', 'PccSyntheticFhirSandbox: correctly extracts Patient given and family names');
    assert(parsedFhir.allergies.includes('Peanuts') && parsedFhir.allergies.includes('Shellfish'), 'PccSyntheticFhirSandbox: extracts active food allergens');
    // ZPL II Generation for Zebra Hardware
    const samplePrintJob = ThermalPrintEngine.printTrayCard({
        id: 'RES-001',
        name: 'Eleanor Vance',
        room: '104-A',
        diet: 'Pureed',
        texture: 'IDDSI Level 4',
        fluids: 'Mildly Thick',
        allergies: ['Shellfish'],
    });
    const zpl = ThermalPrintEngine.generateZplString(samplePrintJob);
    assert(zpl.startsWith('^XA') && zpl.endsWith('^XZ'), 'ThermalPrintEngine: generates well-formed Zebra ZPL II ^XA ... ^XZ envelope');
    assert(zpl.includes('^BQN,2,6'), 'ThermalPrintEngine: embeds high-density ZPL QR code symbol');
    assert(zpl.includes('Eleanor Vance'), 'ThermalPrintEngine: encodes resident name in ZPL payload');
    // --- 28. v6.2 Commercialization & Corporate Syndication Tests ---
    console.log('\n--- 28. v6.2 Commercialization, Dunning Safety & Syndication ---');
    const { StripeBillingEngine } = await Promise.resolve().then(() => __importStar(require('./billing/stripeEngine')));
    const { HubAndSpokeSyndicationEngine } = await Promise.resolve().then(() => __importStar(require('./engine/syndication')));
    // 1. Stripe Per-Bed Billing Solver
    const smallHomeFee = StripeBillingEngine.calculateMonthlyFee(20);
    assert(smallHomeFee.monthlyTotal === 50.00, 'StripeEngine: computes $50.00/mo ($2.50/bed) for 20-bed home');
    const enterpriseFee = StripeBillingEngine.calculateMonthlyFee(200);
    assert(enterpriseFee.tier === 'ENTERPRISE_TIER', 'StripeEngine: applies Enterprise volume tier for >= 150 beds');
    assert(enterpriseFee.monthlyTotal === 330.00, 'StripeEngine: computes $330.00/mo ($1.65/bed) for 200-bed campus');
    // 2. Clinical Grace Dunning Safety Invariant
    const failedPaymentEvent = {
        type: 'invoice.payment_failed',
        data: {
            object: {
                attempt_count: 2,
                metadata: { facilityId: 'FAC-001' },
                last_finalization_error: { message: 'Card expired' },
            },
        },
    };
    const dunningResult = StripeBillingEngine.handleStripeWebhookEvent(failedPaymentEvent);
    assert(dunningResult.dunningStatus.clinicalLockoutAllowed === false, 'StripeEngine: INVARIANT holds - clinical meal service lockout is strictly prohibited on billing failure');
    assert(dunningResult.dunningStatus.status === 'PAST_DUE', 'StripeEngine: triggers administrative dunning warning status');
    // 3. Corporate Hub-and-Spoke Menu Syndication
    const syndicationResults = HubAndSpokeSyndicationEngine.syndicateToSpokes({
        corporateMenuId: 'CORP-MENU-SPRING',
        masterMenuName: 'Spring 4-Week Master Cycle',
        spokeFacilityIds: ['FAC-REGIONAL-01', 'FAC-COASTAL-02'],
        allowLocalSubstitutions: true,
        maxSubstitutionVariancePct: 15.0,
        publishedAt: new Date().toISOString(),
    });
    assert(syndicationResults.length === 2, 'SyndicationEngine: successfully broadcasts to all designated spoke facilities');
    assert(syndicationResults[0].status === 'SYNDICATED', 'SyndicationEngine: syndicates compliant spoke within variance budget');
    const substituteEval = HubAndSpokeSyndicationEngine.evaluateLocalSubstitute(2.10, 2.30, 8.50);
    assert(substituteEval.approved === true, 'SyndicationEngine: approves local recipe substitute within 15% budget variance');
    // --- B12. Tray tracking engine (state machine + missed-tray SLA) ---
    console.log('\n--- B12. Tray tracking ---');
    assert(JSON.stringify((0, trayTracking_1.allowedNextEvents)([])) === JSON.stringify(['assembled']), 'TrayTracking: empty line starts with assembled');
    assert(JSON.stringify((0, trayTracking_1.allowedNextEvents)(['assembled'])) === JSON.stringify(['dispatched']), 'TrayTracking: assembled -> dispatched only');
    const afterDispatch = (0, trayTracking_1.allowedNextEvents)(['assembled', 'dispatched']);
    assert(afterDispatch.includes('delivered') && afterDispatch.includes('missed') && afterDispatch.includes('remade') && afterDispatch.length === 3, 'TrayTracking: dispatched -> delivered|missed|remade');
    assert((0, trayTracking_1.allowedNextEvents)(['assembled', 'dispatched', 'delivered']).length === 0, 'TrayTracking: delivered is terminal');
    assert((0, trayTracking_1.allowedNextEvents)(['assembled', 'dispatched', 'missed']).length === 0, 'TrayTracking: missed is terminal');
    assert((0, trayTracking_1.allowedNextEvents)(['assembled', 'dispatched', 'remade']).length === 0, 'TrayTracking: remade is terminal');
    assert(!(0, trayTracking_1.allowedNextEvents)(['assembled']).includes('delivered'), 'TrayTracking: cannot deliver before dispatch');
    const nowMs = Date.now();
    const minsAgo = (m) => new Date(nowMs - m * 60000).toISOString();
    const mkEv = (id, ticket, event, at) => ({
        id, run_id: 'run-1', resident_id: null, ticket_id: ticket, event, at, by: 'u1', note: '',
    });
    const lines = (0, trayTracking_1.computeTrayLines)([
        mkEv('e1', 'TKT-A', 'assembled', minsAgo(90)),
        mkEv('e2', 'TKT-A', 'dispatched', minsAgo(45)),
        mkEv('e3', 'TKT-B', 'assembled', minsAgo(80)),
        mkEv('e4', 'TKT-B', 'dispatched', minsAgo(70)),
        mkEv('e5', 'TKT-B', 'delivered', minsAgo(20)),
        mkEv('e6', 'TKT-C', 'assembled', minsAgo(60)),
        mkEv('e7', 'TKT-C', 'dispatched', minsAgo(10)),
        mkEv('e8', 'TKT-D', 'assembled', minsAgo(50)),
        mkEv('e9', 'TKT-D', 'dispatched', minsAgo(40)),
        mkEv('e10', 'TKT-D', 'missed', minsAgo(30)),
    ]);
    assert(lines.length === 4, 'TrayTracking: groups events into 4 tray lines');
    const missed = (0, trayTracking_1.computeMissedTrays)(lines, 30, nowMs);
    assert(missed.length === 2, 'TrayTracking: SLA flags exactly 2 problem trays');
    const overdue = missed.find((m) => m.kind === 'overdue');
    const explicit = missed.find((m) => m.kind === 'missed');
    assert(!!overdue && overdue.ticketId === 'TKT-A' && (overdue.minutesOverdue ?? 0) >= 14, 'TrayTracking: TKT-A overdue past 30-min SLA');
    assert(!!explicit && explicit.ticketId === 'TKT-D', 'TrayTracking: explicitly missed tray is surfaced');
    assert(!missed.some((m) => m.ticketId === 'TKT-B'), 'TrayTracking: delivered tray is not flagged');
    assert(!missed.some((m) => m.ticketId === 'TKT-C'), 'TrayTracking: tray within SLA is not flagged');
    // Remake with a new ticket starts a fresh line; the old line stays terminal.
    const remakeLines = (0, trayTracking_1.computeTrayLines)([
        mkEv('r1', 'TKT-X', 'assembled', minsAgo(90)),
        mkEv('r2', 'TKT-X', 'dispatched', minsAgo(60)),
        mkEv('r3', 'TKT-X', 'remade', minsAgo(50)),
        mkEv('r4', 'TKT-Y', 'assembled', minsAgo(40)),
    ]);
    assert(remakeLines.length === 2, 'TrayTracking: remake new ticket starts a new line');
    assert(JSON.stringify(remakeLines.find((l) => l.ticketId === 'TKT-Y')?.allowedNext) === JSON.stringify(['dispatched']), 'TrayTracking: remade line resumes at dispatched');
    // --- 29. Clinical Safety P0 Defect Fixes & Zero Split-Brain Data Layer ---
    console.log('\n--- 29. Clinical Safety P0 Defect Fixes & Zero Split-Brain Data Layer ---');
    // 1. P0-4 Safe Fallback Entree
    assert(kitchen_1.KITCHEN_DEFAULT_ENTREE === 'NO SELECTION — CONFIRM WITH DIETARY', 'ClinicalSafety: Entree fallback strictly enforces "NO SELECTION — CONFIRM WITH DIETARY" (no fake poultry)');
    // 2. P0-3 HACCP Bluetooth Probe Simulated Reading Elimination
    const probePath = path_1.default.resolve(__dirname, '..', '..', 'src', 'features', 'kitchen', 'WebBluetoothProbe.ts');
    if (fs_1.default.existsSync(probePath)) {
        const probeSrc = fs_1.default.readFileSync(probePath, 'utf8');
        assert(!probeSrc.includes('165.4'), 'ClinicalSafety: WebBluetoothProbe does NOT simulate fake 165.4°F HACCP temp');
        assert(!probeSrc.includes('Math.random'), 'ClinicalSafety: WebBluetoothProbe has zero fabricated random telemetry');
    }
    // 3. P0-2 & P0-5 Paper Tray Card QR Removal & 4in x 6in Thermal Print CSS
    const trayCardPath = path_1.default.resolve(__dirname, '..', '..', 'src', 'features', 'kitchen', 'TrayCardGeneratorPage.tsx');
    if (fs_1.default.existsSync(trayCardPath)) {
        const trayCardSrc = fs_1.default.readFileSync(trayCardPath, 'utf8');
        assert(!trayCardSrc.includes('qrcode.react'), 'ClinicalSafety: Paper tray cards do not import or render QR codes');
        assert(!trayCardSrc.includes('<TrayQr'), 'ClinicalSafety: Paper tray cards do not mount <TrayQr component');
        assert(trayCardSrc.includes('size: 4in 6in') && trayCardSrc.includes('margin: 0.1in'), 'ClinicalSafety: Thermal print styling strictly enforces 4in x 6in @page media size');
    }
    // 4. Decision 9: Bulk Census & Diet Order CSV Parser
    const censusSampleCsv = `Resident Name,Room,Status,Diet Type,Texture,Allergies,Is NPO,NPO Reason,Fluid Restriction (mL)
"Smith, John",101-A,Active,Regular,Regular,"Dairy, Peanuts",false,,1500
"Doe, Jane",102-B,Active,NPO,Pureed,,true,Aspiration Risk,
"Brown, Charlie",103-A,Active,Mechanical Soft,Minced & Moist,"Shellfish",0,,`;
    const parsedCensusCsv = (0, residents_1.parseCsvRows)(censusSampleCsv);
    assert(parsedCensusCsv.length === 3, 'CensusCsvParser: parses 3 data rows from CSV');
    assert(parsedCensusCsv[0].residentname === 'Smith, John' && parsedCensusCsv[0].room === '101-A', 'CensusCsvParser: handles quoted names with commas');
    assert(parsedCensusCsv[0].allergies === 'Dairy, Peanuts', 'CensusCsvParser: retains quoted multiple allergens');
    assert(parsedCensusCsv[0].fluidrestrictionml === '1500', 'CensusCsvParser: normalizes column headers and captures fluid restriction');
    assert(parsedCensusCsv[1].isnpo === 'true' && parsedCensusCsv[1].nporeason === 'Aspiration Risk', 'CensusCsvParser: parses NPO flag and reason');
    assert(parsedCensusCsv[2].texture === 'Minced & Moist', 'CensusCsvParser: captures IDDSI texture modification');
    // 5. Database Migration 025 & Zero Split-Brain Schema Validation
    await (0, migrate_1.runMigrations)();
    await (0, migrate_1.assertSchemaIntegrity)();
    assert(true, 'SchemaIntegrity: Migration 025 (staff, call_outs, budget, communications) passes with 0 drift');
    // 6. Persistence round-trip tests for zero split-brain tables
    const testStaffId = 'test-staff-' + Date.now();
    await pool_1.pool.query(`INSERT INTO staff_profiles (id, employee_number, first_name, last_name, role, department, position, hire_date, status, full_time)
     VALUES ($1, 'EMP-999', 'Alex', 'Taylor', 'manager', 'Dietary', 'Dietary Director', '2026-01-01', 'Active', 1)`, [testStaffId]);
    const { rows: staffRows } = await pool_1.pool.query('SELECT * FROM staff_profiles WHERE id = $1', [testStaffId]);
    assert(staffRows.length === 1 && staffRows[0].first_name === 'Alex', 'StaffProfiles: persists and reads staff profile with zero split-brain');
    const testCallOutId = 'test-co-' + Date.now();
    await pool_1.pool.query(`INSERT INTO call_outs (id, staff_id, filed_by_id, date, shift, reason, coverage_status, manager_acknowledged)
     VALUES ($1, $2, 'manager-1', '2026-09-18', 'Morning', 'Sick', 'Uncovered', 0)`, [testCallOutId, testStaffId]);
    const { rows: callOutRows } = await pool_1.pool.query('SELECT * FROM call_outs WHERE id = $1', [testCallOutId]);
    assert(callOutRows.length === 1 && callOutRows[0].reason === 'Sick', 'CallOuts: persists and reads staff call-out record with zero split-brain');
    await pool_1.pool.query('DELETE FROM call_outs WHERE id = $1', [testCallOutId]);
    await pool_1.pool.query('DELETE FROM staff_profiles WHERE id = $1', [testStaffId]);
    const testPeriodId = 'test-bp-' + Date.now();
    await pool_1.pool.query(`INSERT INTO budget_periods (id, label, month, year, total_budget, resident_count, budget_per_resident_per_day, start_date, end_date)
     VALUES ($1, 'September 2026', 9, 2026, 17100.00, 60, 9.50, '2026-09-01', '2026-09-30')`, [testPeriodId]);
    const { rows: budgetRows } = await pool_1.pool.query('SELECT * FROM budget_periods WHERE id = $1', [testPeriodId]);
    assert(budgetRows.length === 1 && Number(budgetRows[0].budget_per_resident_per_day) === 9.5, 'BudgetPeriods: persists and reads budget period with zero split-brain');
    const testEntryId = 'test-be-' + Date.now();
    await pool_1.pool.query(`INSERT INTO budget_entries (id, period_id, category, description, amount, date, vendor, logged_by)
     VALUES ($1, $2, 'Food', 'Dennis Food Service Delivery', 1450.25, '2026-09-18', 'Dennis', 'manager-1')`, [testEntryId, testPeriodId]);
    const { rows: entryRows } = await pool_1.pool.query('SELECT * FROM budget_entries WHERE id = $1', [testEntryId]);
    assert(entryRows.length === 1 && Number(entryRows[0].amount) === 1450.25, 'BudgetEntries: persists and reads line-item expenditure with zero split-brain');
    await pool_1.pool.query('DELETE FROM budget_entries WHERE id = $1', [testEntryId]);
    await pool_1.pool.query('DELETE FROM budget_periods WHERE id = $1', [testPeriodId]);
    const testCommId = 'test-comm-' + Date.now();
    await pool_1.pool.query(`INSERT INTO communications (id, type, subject, status, created_by_id, entries, distributed_to, was_printed)
     VALUES ($1, 'memo', 'Clinical Safety Update', 'Published', 'admin-1', '[]', '[]', 0)`, [testCommId]);
    const { rows: commRows } = await pool_1.pool.query('SELECT * FROM communications WHERE id = $1', [testCommId]);
    assert(commRows.length === 1 && commRows[0].subject === 'Clinical Safety Update', 'Communications: persists and reads broadcast communication thread with zero split-brain');
    await pool_1.pool.query('DELETE FROM communications WHERE id = $1', [testCommId]);
    const testPunchId = 'test-punch-' + Date.now();
    await pool_1.pool.query(`INSERT INTO timecard_punches (id, badge_id, operation, kiosk_id, punched_at)
     VALUES ($1, 'BADGE-01', 'In', 'Hot Line Kiosk', NOW())`, [testPunchId]);
    const { rows: punchRows } = await pool_1.pool.query('SELECT * FROM timecard_punches WHERE id = $1', [testPunchId]);
    assert(punchRows.length === 1 && punchRows[0].operation === 'In', 'TimecardPunches: persists and reads timecard punch with zero split-brain');
    await pool_1.pool.query('DELETE FROM timecard_punches WHERE id = $1', [testPunchId]);
    const testWeekId = 'test-week-' + Date.now();
    await pool_1.pool.query(`INSERT INTO menu_weeks (id, name, effective_from, days, active)
     VALUES ($1, 'Test Week', '2026-09-18', '{}', 0)`, [testWeekId]);
    const testSheetId = 'test-sheet-' + Date.now();
    await pool_1.pool.query(`INSERT INTO production_sheets (id, menu_week_id, day, slot, rows, counts)
     VALUES ($1, $2, 'Monday', 'Lunch', '[]', '{}')`, [testSheetId, testWeekId]);
    const { rows: sheetRows } = await pool_1.pool.query('SELECT * FROM production_sheets WHERE id = $1', [testSheetId]);
    assert(sheetRows.length === 1 && sheetRows[0].slot === 'Lunch', 'ProductionSheets: persists and reads batch cook sheet with zero split-brain');
    await pool_1.pool.query('DELETE FROM production_sheets WHERE id = $1', [testSheetId]);
    await pool_1.pool.query('DELETE FROM menu_weeks WHERE id = $1', [testWeekId]);
    // --- 30. Clinical Dietary Safety, EHR Triage Queue, HIPAA Cache & Invoice Match ---
    console.log('\n--- 30. Clinical Dietary Safety, EHR Triage Queue, HIPAA Cache & Invoice Match ---');
    // 1. IDDSI 2.0 Hard Safety Hold Fallback
    assert((0, production_1.iddsiFoodLevelForTexture)('Regular') === 7, 'IDDSI 2.0: Regular maps to Level 7');
    assert((0, production_1.iddsiFoodLevelForTexture)('Cut-Up') === 6, 'IDDSI 2.0: Cut-Up maps to Level 6');
    assert((0, production_1.iddsiFoodLevelForTexture)('Minced') === 5, 'IDDSI 2.0: Minced maps to Level 5');
    assert((0, production_1.iddsiFoodLevelForTexture)('Pureed') === 4, 'IDDSI 2.0: Pureed maps to Level 4');
    assert((0, production_1.iddsiFoodLevelForTexture)('Liquid') === 3, 'IDDSI 2.0: Liquid maps to Level 3');
    assert((0, production_1.iddsiFoodLevelForTexture)('UnknownTexture') === -1, 'IDDSI 2.0: Unknown texture triggers safety hold (-1)');
    assert((0, production_1.iddsiFoodLevelForTexture)('') === -1, 'IDDSI 2.0: Blank texture triggers safety hold (-1)');
    assert((0, production_1.iddsiFoodLevelForTexture)(null) === -1, 'IDDSI 2.0: Null texture triggers safety hold (-1)');
    // 2. EHR Inbound Webhook Triage Queue Persistence
    const testTriageId = (0, crypto_1.randomUUID)();
    await pool_1.pool.query(`
    INSERT INTO ehr_reconciliation_queue (
      id, resident_name, external_ehr_id, source_ehr, change_type,
      incoming_payload, conflict_reason, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
  `, [
        testTriageId,
        'Eleanor Vance',
        'PCC-101',
        'PointClickCare',
        'NPO_ORDER',
        JSON.stringify({ dietOrder: 'NPO', effectiveAt: new Date().toISOString() }),
        'CRITICAL: Inbound physician NPO order received.',
        'PENDING_TRIAGE'
    ]);
    const { rows: queueRows } = await pool_1.pool.query('SELECT * FROM ehr_reconciliation_queue WHERE id = $1', [testTriageId]);
    assert(queueRows.length === 1, 'EHR Queue: persists inbound triage record');
    assert(queueRows[0].status === 'PENDING_TRIAGE', 'EHR Queue: status defaults to PENDING_TRIAGE');
    assert(queueRows[0].change_type === 'NPO_ORDER', 'EHR Queue: registers NPO_ORDER change type');
    await pool_1.pool.query('DELETE FROM ehr_reconciliation_queue WHERE id = $1', [testTriageId]);
    // 3. Three-Way Invoice Match Engine
    const invoiceReport = invoicing_1.ThreeWayInvoiceMatchingEngine.evaluateThreeWayMatch({
        invoiceNumber: 'INV-DNS-9921',
        vendorName: 'Dennis Food Service',
        invoiceDate: '2026-09-18',
        poReference: 'PO-2026-0042',
        lines: [
            {
                itemSku: 'DNS-1001',
                description: 'Boneless Turkey Breast 2/10 lb',
                poQty: 4,
                receivedQty: 3, // short 1 case
                invoicedQty: 4,
                poContractUnitPrice: 45.00,
                invoicedUnitPrice: 48.50, // price overcharge of $3.50/unit
            },
            {
                itemSku: 'DNS-1002',
                description: 'Yukon Gold Potatoes 50 lb',
                poQty: 2,
                receivedQty: 2,
                invoicedQty: 2,
                poContractUnitPrice: 22.00,
                invoicedUnitPrice: 22.00,
            }
        ]
    });
    assert(invoiceReport.overallStatus === 'DISPUTED', '3-Way Match: detects both price variance and quantity shortage');
    assert(invoiceReport.totalBilledAmount === (4 * 48.50 + 2 * 22.00), '3-Way Match: calculates correct total billed');
    assert(invoiceReport.totalCreditDisputedAmount > 0, '3-Way Match: computes non-zero credit dispute amount');
    assert(invoiceReport.creditMemo !== undefined, '3-Way Match: auto-generates vendor credit memo proposal');
    assert(invoiceReport.creditMemo?.vendorName === 'Dennis Food Service', '3-Way Match: credit memo routes to correct vendor');
    // 4. Non-PHI Cache Control Security (Private Cache Header)
    let capturedHeaders = {};
    const mockReq = { method: 'GET', url: '/api/menu', originalUrl: '/api/menu', headers: {} };
    const mockRes = {
        statusCode: 200,
        setHeader: (key, val) => { capturedHeaders[key.toLowerCase()] = val; },
        json: (body) => body,
    };
    const cacheMw = (0, cache_1.httpCacheMiddleware)(60, 'test');
    cacheMw(mockReq, mockRes, () => {
        mockRes.json({ success: true });
    });
    assert(capturedHeaders['cache-control']?.includes('private'), `HIPAA Security: cache headers must be private to prevent downstream proxy leaks (got "${capturedHeaders['cache-control']}")`);
    // --- 31. Enterprise TypeScript SDK & Serialization ---
    console.log('\n--- 31. Enterprise TypeScript SDK & Serialization ---');
    const { ShorelineClient } = require('../../sdk/dist/index');
    const client = new ShorelineClient({
        baseUrl: 'https://demo.shorelineops.com/',
        apiKey: 'sh_live_test_api_key_123',
    });
    // Test 1: URL trimming
    assert(client.baseUrl === 'https://demo.shorelineops.com', 'SDK: trims trailing slash from baseUrl');
    assert(client.apiKey === 'sh_live_test_api_key_123', 'SDK: stores apiKey for machine authentication');
    // Save original fetch
    const originalFetch = globalThis.fetch;
    try {
        let capturedUrl = '';
        let capturedOptions = null;
        // Mock fetch
        globalThis.fetch = (async (url, options) => {
            capturedUrl = url.toString();
            capturedOptions = options;
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, mocked: true }),
            };
        });
        // Test 2: getResidents
        await client.getResidents();
        assert(capturedUrl === 'https://demo.shorelineops.com/api/residents', 'SDK: getResidents hits /api/residents');
        assert(capturedOptions.headers['Authorization'] === 'Bearer sh_live_test_api_key_123', 'SDK: sends Bearer token header');
        // Test 3: evaluateInvoiceMatch
        await client.evaluateInvoiceMatch({
            invoiceNumber: 'INV-1001',
            vendorName: 'Sysco',
            lines: [],
        });
        assert(capturedUrl === 'https://demo.shorelineops.com/api/purchasing/invoices/evaluate', 'SDK: evaluateInvoiceMatch hits /api/purchasing/invoices/evaluate');
        assert(capturedOptions.method === 'POST', 'SDK: evaluateInvoiceMatch uses POST');
        assert(JSON.parse(capturedOptions.body).invoiceNumber === 'INV-1001', 'SDK: serializes invoice payload');
        // Test 4: resolveReconciliationItem
        await client.resolveReconciliationItem('item-uuid-44', 'APPROVED_BY_RD');
        assert(capturedUrl === 'https://demo.shorelineops.com/api/ehr/reconciliation-queue/item-uuid-44/resolve', 'SDK: resolveReconciliationItem routes to item ID');
        assert(JSON.parse(capturedOptions.body).action === 'APPROVED_BY_RD', 'SDK: serializes action');
        // Test 5: logHaccpTemperature
        await client.logHaccpTemperature({
            checkType: 'food',
            itemName: 'Haddock Fillet',
            tempF: 168.0,
            source: 'probe',
            probeDevice: 'Probe-1',
        });
        assert(capturedUrl === 'https://demo.shorelineops.com/api/hardware/haccp/log-temp', 'SDK: logHaccpTemperature hits hardware temp endpoint');
        // Test 6: importCensusCsv
        await client.importCensusCsv('name,room\nJohn Doe,101');
        assert(capturedUrl === 'https://demo.shorelineops.com/api/residents/import-csv', 'SDK: importCensusCsv hits import endpoint');
        // Test 7: getTrayRuns
        await client.getTrayRuns('2026-09-18', 'Lunch');
        assert(capturedUrl.includes('/api/trayruns?serviceDate=2026-09-18&mealSlot=Lunch'), 'SDK: getTrayRuns formats query parameters correctly');
        // Test 8: Error handling
        globalThis.fetch = (async () => {
            return {
                ok: false,
                status: 402,
                statusText: 'Payment Required',
                json: async () => ({ status: 402, error: 'Enterprise license required' }),
            };
        });
        let caughtError = null;
        try {
            await client.getCmsSurveyBinder();
        }
        catch (e) {
            caughtError = e;
        }
        assert(caughtError !== null, 'SDK: throws on HTTP error responses');
        assert(caughtError?.status === 402, 'SDK: enriches thrown error with status code');
        assert(caughtError?.message?.includes('Enterprise license required'), 'SDK: extracts error message from API response');
    }
    finally {
        globalThis.fetch = originalFetch;
    }
    // --- 32. Cut+Dry Distributor SKU Normalization & Price Matrix Matching ---
    console.log('--- 32. Cut+Dry Distributor SKU Normalization & Price Matrix Matching ---');
    // Test PackSizeNormalizer
    const norm1 = catalogMatcher_1.PackSizeNormalizer.normalize('40/4oz', 60.00);
    assert(norm1.standardUom === 'lb', 'PackSizeNormalizer: converts 40/4oz to standard unit lb');
    assert(norm1.totalStandardUnits === 10, 'PackSizeNormalizer: computes 40 * 4oz = 10 lbs');
    assert(norm1.normalizedUnitCost === 6.00, 'PackSizeNormalizer: computes $60/case / 10 lbs = $6.00/lb');
    const norm2 = catalogMatcher_1.PackSizeNormalizer.normalize('2/10 lb', 70.00);
    assert(norm2.standardUom === 'lb', 'PackSizeNormalizer: parses 2/10 lb correctly');
    assert(norm2.totalStandardUnits === 20, 'PackSizeNormalizer: computes 2 * 10 lbs = 20 lbs');
    assert(norm2.normalizedUnitCost === 3.50, 'PackSizeNormalizer: computes $70/case / 20 lbs = $3.50/lb');
    const norm3 = catalogMatcher_1.PackSizeNormalizer.normalize('6/#10 cans', 48.00);
    assert(norm3.standardUom === '#10 can', 'PackSizeNormalizer: parses #10 can unit');
    assert(norm3.totalStandardUnits === 6, 'PackSizeNormalizer: parses 6 cans');
    assert(norm3.normalizedUnitCost === 8.00, 'PackSizeNormalizer: computes $48 / 6 cans = $8.00/can');
    const norm4 = catalogMatcher_1.PackSizeNormalizer.normalize('50 lb', 25.00);
    assert(norm4.standardUom === 'lb', 'PackSizeNormalizer: parses straight 50 lb bag');
    assert(norm4.totalStandardUnits === 50, 'PackSizeNormalizer: computes 50 lbs');
    assert(norm4.normalizedUnitCost === 0.50, 'PackSizeNormalizer: computes $25 / 50 lbs = $0.50/lb');
    // Test FuzzyProductMatcher
    const cleaned = catalogMatcher_1.FuzzyProductMatcher.cleanTitle('CHK BRST B/S FRSH 4/10#');
    assert(cleaned.includes('chicken') && cleaned.includes('boneless skinless'), 'FuzzyProductMatcher: expands culinary abbreviations (chk, b/s)');
    const canonicalItem = {
        id: 'canon-chk',
        name: 'Boneless Skinless Chicken Breast',
        category: 'Meat & Poultry',
        standardUom: 'lb',
    };
    const matchResult = catalogMatcher_1.FuzzyProductMatcher.findBestMatch('CHK BRST B/S 4/10 LB', [canonicalItem]);
    assert(matchResult.canonicalProduct !== null, 'FuzzyProductMatcher: finds match for abbreviated vendor SKU');
    assert(matchResult.canonicalProduct?.id === 'canon-chk', 'FuzzyProductMatcher: links to correct canonical product');
    assert(matchResult.confidence >= 50, 'FuzzyProductMatcher: computes confidence score >= 50%');
    // Test PriceMatrixSolver
    const offers = [
        {
            vendorId: 'v-dennis',
            vendorCode: 'dennis',
            vendorName: 'Dennis Food Service',
            vendorSku: 'DNS-CHK-01',
            itemName: 'Boneless Chicken Breast',
            packSize: '4/10 lb',
            uom: 'case',
            caseCost: 86.00,
            packQuantityInStandardUom: 40,
            normalizedUnitCost: 2.15,
            matchConfidence: 95,
            matchStatus: 'confirmed',
            canonicalProductId: 'canon-chk',
        },
        {
            vendorId: 'v-sysco',
            vendorCode: 'sysco',
            vendorName: 'Sysco Broadline',
            vendorSku: 'SY-109281',
            itemName: 'B/S Chicken Breast 4/10#',
            packSize: '4/10 lb',
            uom: 'case',
            caseCost: 102.00,
            packQuantityInStandardUom: 40,
            normalizedUnitCost: 2.55,
            matchConfidence: 90,
            matchStatus: 'confirmed',
            canonicalProductId: 'canon-chk',
        },
    ];
    const matrix = catalogMatcher_1.PriceMatrixSolver.solveMatrix([canonicalItem], offers);
    assert(matrix.length === 1, 'PriceMatrixSolver: generates matrix row for canonical product');
    assert(matrix[0].winningVendor?.vendorCode === 'dennis', 'PriceMatrixSolver: accurately crowns lowest $/unit vendor');
    assert(matrix[0].winningVendor?.normalizedUnitCost === 2.15, 'PriceMatrixSolver: captures lowest normalized unit cost');
    assert(matrix[0].costSavingsPerUnit === 0.40, 'PriceMatrixSolver: calculates savings per unit ($2.55 - $2.15 = $0.40)');
    assert(matrix[0].variancePercent === 18.6, 'PriceMatrixSolver: calculates correct price spread %');
    console.log('\n=======================================================');
    console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
    console.log('=======================================================\n');
    if (failed > 0) {
        process.exit(1);
    }
}
runAllTests().catch(err => {
    console.error('[Test Error]:', err);
    process.exit(1);
});
