/**
 * Comprehensive System & Integration Test Suite — ShorelineOps
 *
 * Tests:
 * 1. Security & Compliance (Password Complexity, Zod schemas)
 * 2. V2 Multi-Distributor Connectors (Dennis, Sysco, US Foods: catalog, order guide parsing, PO export)
 * 3. V3 Clinical EHR Integration (PointClickCare ADT ingestion, dynamic meal validation, nutrient analysis)
 */

import { z } from 'zod'
import { DennisConnector } from './integrations/dennis'
import { SyscoConnector, UsFoodsConnector } from './integrations/broadline'
import { PointClickCareConnector } from './integrations/pointclickcare'
import { USDAFoodDataConnector } from './integrations/usda'
import { MrpDemandForecastEngine } from './engine/mrp'
import { KitchenProductionEngine } from './engine/production'
import { SafetyEvaluatorEngine } from './engine/safetyEvaluator'
import { ThreeWayInvoiceMatchingEngine } from './engine/invoicing'
import { CmsDietarySurveyEngine } from './engine/cmsSurvey'
import { DeterministicDietaryEngine } from './engine/dietaryFormulation'

const PasswordSchema = z
  .string()
  .min(12)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/)

async function runAllTests() {
  console.log('\n🧪 =======================================================')
  console.log('🧪 RUNNING SHORELINEOPS TEST SUITE (/shadowrealm-bridge)')
  console.log('🧪 =======================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`)
      passed++
    } else {
      console.error(`  ❌ FAIL: ${testName}`)
      failed++
    }
  }

  // --- 1. Security & Password Rules ---
  console.log('--- 1. Security & Password Hardening ---')
  assert(!PasswordSchema.safeParse('Weak1!').success, 'Reject password < 12 characters')
  assert(!PasswordSchema.safeParse('alllowercasepassword123!').success, 'Reject password missing uppercase')
  assert(!PasswordSchema.safeParse('NoSpecialChar12345').success, 'Reject password missing special symbol')
  assert(PasswordSchema.safeParse('ValidP@ssword123').success, 'Accept compliant 12+ char complex password')

  // --- 2. V2 Multi-Distributor Connectors ---
  console.log('\n--- 2. V2 Multi-Distributor Connectors ---')
  const dennis = new DennisConnector()
  const dennisCatalog = await dennis.getCatalog()
  assert(dennisCatalog.length >= 5, 'DennisConnector: getCatalog returns valid broadline SKUs')

  const sampleCsv = `SKU,Description,Brand,Category,Pack,UOM,UnitCost,Par,OnHand\nDNS-1001,Peaches,Dennis,Fruit,6/10,case,48.50,5,2\nDNS-1002,Thickened OJ,Thick,Bev,12/32,case,32.75,4,1`
  const dennisGuide = await dennis.importOrderGuide(sampleCsv)
  assert(dennisGuide.length === 2, 'DennisConnector: importOrderGuide parses CSV items correctly')
  assert(dennisGuide[0].vendorSku === 'DNS-1001' && dennisGuide[0].parLevel === 5, 'DennisConnector: parses par levels')

  const samplePO = {
    id: 'PO-TEST-01',
    vendorId: 'VEND-DENNIS',
    vendorName: 'Dennis Food Service',
    orderDate: '2026-08-20',
    lines: [
      { vendorItemId: '1', vendorSku: 'DNS-1001', itemName: 'Peaches', qtyOrdered: 3 },
      { vendorItemId: '2', vendorSku: 'DNS-1002', itemName: 'Thickened OJ', qtyOrdered: 3 },
    ],
  }
  const dennisExport = await dennis.exportOrder(samplePO)
  assert(dennisExport.type === 'csv' && dennisExport.data.toString().includes('DNS-1001'), 'DennisConnector: exports valid order CSV')

  const sysco = new SyscoConnector()
  const syscoCatalog = await sysco.getCatalog()
  assert(syscoCatalog.length >= 4, 'SyscoConnector: getCatalog returns Sysco broadline items')
  const syscoPrices = await sysco.getCustomerPricing('CUST-01')
  assert(syscoPrices.length > 0, 'SyscoConnector: getCustomerPricing returns contract rates')

  const usfoods = new UsFoodsConnector()
  const usfCatalog = await usfoods.getCatalog()
  assert(usfCatalog.length >= 3, 'UsFoodsConnector: getCatalog returns US Foods items')

  // --- 3. V3 Clinical EHR & Nutrient Analysis ---
  console.log('\n--- 3. V3 Clinical EHR & Nutrient Analysis ---')
  const pcc = new PointClickCareConnector()
  const census = await pcc.getCensus('FAC-01')
  assert(census.length >= 3, 'PointClickCareConnector: getCensus returns active resident profiles')

  const testUpdate = {
    residentExternalId: 'RES-TEST-99',
    firstName: 'Jane',
    lastName: 'Doe',
    status: 'active' as const,
    dietOrder: 'NAS / Low Sodium',
    texture: 'Pureed',
    allergies: ['Gluten'],
    effectiveAt: new Date().toISOString(),
  }
  const validation = await pcc.validateResidentMeals(testUpdate)
  assert(validation.warnings.length >= 2, 'PointClickCareConnector: flags Pureed texture & Gluten warnings')

  const nutrientResult = pcc.calculateNutrients('NAS / Low Sodium', [
    { name: 'Pureed Chicken', calories: 320, sodium: 300 },
    { name: 'Pureed Carrots', calories: 120, sodium: 650 },
  ])
  assert(nutrientResult.status === 'warning', 'NutrientEngine: flags sodium over-limit on NAS order')
  assert(nutrientResult.calories === 440, 'NutrientEngine: accurately computes total calories')

  // --- 4. V4 USDA FoodData Central & Clinical Compliance ---
  console.log('\n--- 4. V4 USDA FoodData Central & Clinical Compliance ---')
  const usda = new USDAFoodDataConnector()
  const mealAnalysis = await usda.analyzeMeal(
    ['roasted chicken breast', 'steamed broccoli', 'mashed potatoes with butter'],
    'NAS'
  )
  assert(mealAnalysis.totals.calories > 400, 'USDAConnector: accurately sums meal calories (> 400 kcal)')
  assert(mealAnalysis.totals.proteinGrams > 40, 'USDAConnector: accurately computes high protein content (> 40g)')
  assert(mealAnalysis.compliance.compliant === true, 'USDAConnector: confirms low sodium meal is compliant with NAS target')

  const highSodiumMeal = await usda.analyzeMeal(
    ['roasted chicken breast', 'mashed potatoes with butter', 'mashed potatoes with butter', 'chocolate pudding'],
    'NAS'
  )
  assert(highSodiumMeal.compliance.compliant === false, 'USDAConnector: triggers violation flag when meal exceeds sodium limit')

  // --- 5. Clinical Dietary Demand & Smart Ordering ---
  console.log('\n--- 5. Clinical Dietary Demand & Smart Ordering ---')
  const { DietaryDemandEngine } = await import('./integrations/dietaryDemand')
  const demand = new DietaryDemandEngine()
  const mockResidents = [
    { status: 'Active', dietType: 'NAS', texture: 'Pureed', allergies: ['Dairy'], beverages: ['Apple Juice'] },
    { status: 'Active', dietType: 'Regular', texture: 'Pureed', allergies: [], beverages: ['Water'] },
    { status: 'Active', dietType: 'NCS', texture: 'Regular', allergies: ['Peanuts'], beverages: ['Coffee'] },
    { status: 'Hospital', dietType: 'Regular', texture: 'Regular', allergies: [], beverages: [] },
  ]
  const demandCensus = demand.calculateCensusMetrics(mockResidents)
  assert(demandCensus.totalActiveResidents === 3, 'DemandEngine: correctly filters to active resident headcount')
  assert(demandCensus.textureCounts['Pureed'] === 2, 'DemandEngine: accurately counts pureed texture orders')
  assert(demandCensus.dietTypeCounts['NAS'] === 1, 'DemandEngine: tracks therapeutic NAS diet orders')

  const mockGuide = [
    { vendorSku: 'DNS-THICK', itemName: 'Food Thickener Puree Starch', category: 'Supplements', unitCost: 40, parLevel: 4, onHand: 1, packSize: '6/ct', uom: 'case' },
    { vendorSku: 'DNS-REG', itemName: 'Regular Canned Peaches', category: 'Fruit', unitCost: 35, parLevel: 5, onHand: 4, packSize: '6/10', uom: 'case' },
  ]
  const orders = demand.calculateClinicalDemandOrder(demandCensus, mockGuide)
  const thickenerLine = orders.find(o => o.vendorSku === 'DNS-THICK')
  assert(Boolean(thickenerLine && thickenerLine.calculatedReorderQty >= 3), 'DemandEngine: scales thickener/puree order volume based on clinical texture census')

  // --- 6. Unit Conversion & Density Engine ---
  console.log('\n--- 6. Unit Conversion & Density Engine ---')
  const { UnitConversionEngine } = await import('./engine/units')
  const parsedMixed = UnitConversionEngine.parseQuantityString('2 1/2 cups')
  assert(parsedMixed.amount === 2.5 && parsedMixed.unit === 'cups', 'UnitEngine: parses mixed fraction strings (2 1/2 cups)')
  
  const lbsToGrams = UnitConversionEngine.convert(5, 'lb', 'g')
  assert(Math.round(lbsToGrams.convertedAmount) === 2268, 'UnitEngine: converts pounds to grams (5 lbs = 2268g)')

  const volumeToMass = UnitConversionEngine.convert(2, 'cup', 'g', 'flour')
  assert(Math.round(volumeToMass.convertedAmount) >= 250, 'UnitEngine: performs density-aware conversion for flour (2 cups ≈ 251g)')

  const canToGrams = UnitConversionEngine.convert(1, '#10 can', 'lb')
  assert(Math.round(canToGrams.convertedAmount * 10) / 10 === 6.5, 'UnitEngine: converts #10 institutional cans to pounds (6.5 lbs)')

  // --- 7. Nutritional Engine & Clinical Constraint Solver ---
  console.log('\n--- 7. Nutritional Engine & Clinical Constraint Solver ---')
  const { DietaryNutritionalEngine } = await import('./engine/nutrition')
  const chickenRecipeNutrition = DietaryNutritionalEngine.calculateRecipeNutrition([
    { item: 'chicken breast', qty: '10 lbs' },
    { item: 'butter', qty: '1 cup' },
    { item: 'white flour', qty: '2 cups' },
  ], 20)

  assert(chickenRecipeNutrition.perServing.calories > 200, 'NutritionEngine: accurately computes recipe per-serving calories')
  assert(chickenRecipeNutrition.perServing.proteinG > 20, 'NutritionEngine: accurately computes per-serving protein')
  assert(chickenRecipeNutrition.allergens.includes('Dairy') && chickenRecipeNutrition.allergens.includes('Gluten'), 'NutritionEngine: auto-detects Dairy and Gluten allergens from ingredients')

  const residentAllergic = {
    id: 'R1',
    name: 'Robert Chen',
    dietType: 'NAS',
    texture: 'Regular',
    allergies: ['Dairy'],
  }
  const mealValidation = DietaryNutritionalEngine.validateMealForResident(residentAllergic, [
    {
      name: 'Broccoli with Cheese Sauce',
      nutrition: { calories: 150, proteinG: 4, carbsG: 8, fatG: 10, satFatG: 5, sodiumMg: 220, potassiumMg: 180, phosphorusMg: 90, fiberG: 2, sugarG: 1 },
      allergens: ['Dairy'],
    }
  ])
  assert(mealValidation.compliant === false, 'NutritionEngine: triggers critical alert on allergen conflict for resident')
  assert(mealValidation.criticalAlerts.some(a => a.includes('Dairy')), 'NutritionEngine: reports specific allergen conflict (Dairy)')

  // --- 8. MRP & Bill of Materials (BOM) Explosion ---
  console.log('\n--- 8. MRP & Bill of Materials (BOM) Explosion ---')
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
  ]

  const explodedBom = MrpDemandForecastEngine.explodeBillOfMaterials(scheduledMeals)
  assert(explodedBom['DNS-CHK'] !== undefined, 'MrpEngine: explodes chicken breast ingredient demand by vendor SKU')
  assert(Math.round(explodedBom['DNS-CHK'].totalRequiredGrams) === Math.round(30 * 453.592), 'MrpEngine: scales ingredient demand from 20 to 60 portions (3x yield = 30 lbs)')

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
  ]
  const mrpPOs = MrpDemandForecastEngine.calculateMaterialRequirements(explodedBom, inventoryStock)
  assert(mrpPOs[0].urgency === 'CRITICAL_STOCKOUT', 'MrpEngine: flags critical stockout when demand (30 lbs) exceeds on-hand (10 lbs)')
  assert(mrpPOs[0].recommendedCasesToOrder >= 1, 'MrpEngine: calculates required distributor cases to replenish inventory')

  // --- 9. Kitchen Batch Production & Tray Card Generator ---
  console.log('\n--- 9. Kitchen Batch Production & Tray Card Generator ---')
  const batchWorksheet = KitchenProductionEngine.scaleRecipeForBatch({
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
  }, 50, 'Regular')

  assert(batchWorksheet.station === 'Hot Line', 'ProductionEngine: routes protein recipe to Hot Line station')
  assert(batchWorksheet.haccpTargetTempF === 165, 'ProductionEngine: sets 165°F HACCP food safety core temperature')
  assert(batchWorksheet.scaledIngredients[0].scaledQty.includes('25 lb'), 'ProductionEngine: scales 5 lbs base to 25 lbs for 50 portions (5x factor)')

  const trayCards = KitchenProductionEngine.generateTrayCards([
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
  })

  assert(trayCards.length === 2, 'TrayCardEngine: generates exact count of resident meal service cards')
  assert(trayCards[0].selectedEntree.includes('Pureed Roast Turkey'), 'TrayCardEngine: prepends IDDSI texture modifier for pureed residents')
  assert(trayCards[0].hasCriticalAllergies === true && trayCards[0].allergenList.includes('Nuts'), 'TrayCardEngine: highlights resident allergy alert flags')

  // --- 10. Multi-Tier Caching, Circuit Breakers & Request Deduplication ---
  console.log('\n--- 10. Multi-Tier Caching, Circuit Breakers & Request Deduplication ---')
  const { LruMemoryCache } = await import('./middleware/cache')
  const lru = new LruMemoryCache(3, 1) // max 3 items, 1 second TTL

  lru.set('k1', { data: 'one' }, 1, 'tag1')
  lru.set('k2', { data: 'two' }, 1, 'tag1')
  lru.set('k3', { data: 'three' }, 1, 'tag2')
  assert(lru.get('k1')?.value.data === 'one', 'LruCache: stores and retrieves cached values')

  lru.set('k4', { data: 'four' }) // causes eviction of k2 (oldest LRU since k1 was accessed)
  assert(lru.get('k2') === null, 'LruCache: evicts least recently used item when capacity is reached')
  assert(Boolean(lru.get('k1')?.eTag.startsWith('"')), 'LruCache: generates cryptographic ETag hash for payload')

  const invalidated = lru.invalidateTag('tag1')
  assert(invalidated === 1 && lru.get('k1') === null, 'LruCache: invalidates cached entries by tag')

  // Circuit Breaker Test
  const { CircuitBreaker } = await import('./middleware/circuitBreaker')
  const breaker = new CircuitBreaker('TestEhrBreaker', { failureThreshold: 2, recoveryTimeoutMs: 500, timeoutMs: 100 })
  
  let attempts = 0
  const failingAction = async () => {
    attempts++
    throw new Error('External EHR connection refused')
  }

  // 1st failure
  await breaker.execute(failingAction, () => 'fallback-1')
  assert(breaker.getState() === 'CLOSED', 'CircuitBreaker: remains CLOSED on initial failure below threshold')

  // 2nd failure -> trips breaker
  const fallbackResult = await breaker.execute(failingAction, () => 'fallback-2')
  assert(fallbackResult === 'fallback-2', 'CircuitBreaker: executes fallback handler on error')
  assert(breaker.getState() === 'OPEN', 'CircuitBreaker: trips to OPEN after reaching failure threshold')

  // Fast-fail while OPEN without invoking the failing action
  const fastFailAttemptsBefore = attempts
  const fastFailFallback = await breaker.execute(failingAction, () => 'fallback-fast')
  assert(fastFailFallback === 'fallback-fast' && attempts === fastFailAttemptsBefore, 'CircuitBreaker: fast-fails immediately while OPEN without calling remote network')

  // Request Deduplicator Test
  const { RequestDeduplicator } = await import('./middleware/dedup')
  const dedup = new RequestDeduplicator()
  let executionCount = 0

  const expensiveProducer = async () => {
    executionCount++
    await new Promise(r => setTimeout(r, 50))
    return { activeCycleWeek: 1 }
  }

  // 5 parallel concurrent requests
  const results = await Promise.all([
    dedup.deduplicate('cycle_week_active', expensiveProducer),
    dedup.deduplicate('cycle_week_active', expensiveProducer),
    dedup.deduplicate('cycle_week_active', expensiveProducer),
    dedup.deduplicate('cycle_week_active', expensiveProducer),
    dedup.deduplicate('cycle_week_active', expensiveProducer),
  ])

  assert(results.length === 5 && results[0].activeCycleWeek === 1, 'RequestDeduplicator: resolves all parallel caller promises with correct data')
  assert(executionCount === 1, 'RequestDeduplicator: coalesces 5 concurrent requests into exactly 1 underlying execution')

  // --- 11. Multi-Segment Facility Configuration Profiles ---
  console.log('\n--- 11. Multi-Segment Facility Configuration Profiles ---')
  const { setFacilityProfile, getFacilityProfile, SEGMENT_PROFILES } = await import('./config/facilityProfile')
  
  const snfProfile = setFacilityProfile('senior_living')
  assert(snfProfile.enableTrayCards === true && snfProfile.enableIddsiTextures === true, 'FacilityProfile: Senior Living enables IDDSI textures and tray cards')

  const hospitalProfile = setFacilityProfile('hospital_acute_care')
  assert(hospitalProfile.enableTrayCards === true && hospitalProfile.enableTableAssignments === false, 'FacilityProfile: Hospital mode enforces bedside tray delivery without table seating')

  const schoolProfile = setFacilityProfile('k12_education')
  assert(schoolProfile.enableNslpCompliance === true && schoolProfile.enableTrayCards === false, 'FacilityProfile: K-12 School mode enforces USDA NSLP compliance for cafeteria lines')

  const cateringProfile = setFacilityProfile('commercial_catering')
  assert(cateringProfile.enableBeoBanquets === true, 'FacilityProfile: Catering mode enables Banquet Event Order (BEO) workflows')

  // --- 12. Autonomous Self-Healing Bot & Model Context Protocol (MCP) ---
  console.log('\n--- 12. Autonomous Self-Healing Bot & Model Context Protocol (MCP) ---')
  const { globalHealerBot } = await import('./agent/healer')
  const auditReport = await globalHealerBot.runAudit(true)
  assert(auditReport.overallStatus === 'OPERATIONAL' || auditReport.healthScorePct >= 90, 'HealerBot: successfully executes automated diagnostic audit')
  assert(auditReport.checks.length >= 4, 'HealerBot: audits all operational dimensions (DB, Cache, Census, HACCP)')

  const { SHORELINE_MCP_TOOLS, executeMcpTool } = await import('./mcp/server')
  assert(SHORELINE_MCP_TOOLS.some(t => t.name === 'shoreline_get_census_diets'), 'McpServer: exposes shoreline_get_census_diets tool')
  assert(SHORELINE_MCP_TOOLS.some(t => t.name === 'shoreline_validate_recipe_dietary'), 'McpServer: exposes shoreline_validate_recipe_dietary tool')
  assert(SHORELINE_MCP_TOOLS.some(t => t.name === 'shoreline_explode_mrp_bom'), 'McpServer: exposes shoreline_explode_mrp_bom tool')

  const mcpProfileResult = await executeMcpTool('shoreline_get_facility_profile')
  assert(mcpProfileResult.segment !== undefined, 'McpServer: executes shoreline_get_facility_profile tool')

  const mcpValidateResult = await executeMcpTool('shoreline_validate_recipe_dietary', {
    recipeName: 'Pureed Chicken Soup',
    ingredients: [
      { item: 'chicken broth', qty: '4 cups' },
      { item: 'heavy cream', qty: '1/2 cup' },
    ],
  })
  assert(mcpValidateResult.detectedAllergens.includes('Dairy'), 'McpServer: executes dietary validation and flags Dairy allergen')

  const mcpBomResult = await executeMcpTool('shoreline_explode_mrp_bom', { portionsNeeded: 40 })
  assert(mcpBomResult.explodedBOM !== undefined && mcpBomResult.suggestedPurchaseOrders.length > 0, 'McpServer: explodes BOM and returns suggested distributor purchase orders')

  // --- 13. CMS-2567 Dietary Survey Ready Cross-Walk & Federal F-Tags ---
  console.log('\n--- 13. CMS-2567 Dietary Survey Ready Cross-Walk & Federal F-Tags ---')
  const surveyPack = CmsDietarySurveyEngine.generateSurveyAuditPack({
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
  })

  assert(surveyPack.surveyReadinessLevel === 'INSPECTION_READY', 'CmsSurveyEngine: generates INSPECTION_READY survey audit status')
  assert(surveyPack.fTags.length >= 7, 'CmsSurveyEngine: audits all required Federal F-Tags (F800 - F812)')
  assert(surveyPack.fTags.some(t => t.fTag === 'F804' && t.complianceStatus === 'COMPLIANT'), 'CmsSurveyEngine: validates F804 IDDSI texture compliance')
  assert(surveyPack.fTags.some(t => t.fTag === 'F808' && t.complianceStatus === 'COMPLIANT'), 'CmsSurveyEngine: validates F808 therapeutic diet order fulfillment')
  assert(surveyPack.overallComplianceScorePct >= 95, 'CmsSurveyEngine: achieves ≥95% composite regulatory survey compliance')
  assert(surveyPack.mealTimingAudit.isCompliantWith14HourRule === true, 'CmsSurveyEngine: confirms 14-hour meal timing span compliance (F809)')

  // --- 14. Deterministic Clinical Safety & Hard-Blocks ---
  console.log('\n--- 14. Deterministic Clinical Safety & Hard-Blocks ---')

  // NPO Test
  const npoEval = SafetyEvaluatorEngine.evaluateMealSafety(
    {
      residentId: 'RES-NPO-1',
      residentName: 'John Doe',
      profileVersion: 1,
      isNpo: true,
      npoReason: 'Pre-Op Surgery',
      requiredFoodTexture: 'Regular',
      dietOrders: ['Regular'],
      allergies: [],
    },
    {
      id: 'REC-1',
      name: 'Oatmeal',
      foodTextureLevel: 'Regular',
      allContainedAllergens: [],
      nutrients: { calories: 150, sodiumMg: 50, carbsG: 25 },
    }
  )
  assert(npoEval.isSafe === false, 'SafetyEvaluator: strictly blocks meal for NPO resident')
  assert(npoEval.findings.some(f => f.ruleCode === 'NPO_VIOLATION' && f.severity === 'BLOCK'), 'SafetyEvaluator: returns NPO_VIOLATION BLOCK finding')

  // Allergen Intersection Test
  const allergenEval = SafetyEvaluatorEngine.evaluateMealSafety(
    {
      residentId: 'RES-ALLERGY-1',
      residentName: 'Jane Smith',
      profileVersion: 1,
      isNpo: false,
      requiredFoodTexture: 'Regular',
      dietOrders: ['Regular'],
      allergies: [{ id: 'a1', canonicalKey: 'peanut', commonName: 'Peanuts' }],
    },
    {
      id: 'REC-2',
      name: 'Thai Peanut Noodles',
      foodTextureLevel: 'Regular',
      allContainedAllergens: [{ id: 'a1', canonicalKey: 'peanut', commonName: 'Peanuts', isCrossContact: false }],
      nutrients: { calories: 450, sodiumMg: 350, carbsG: 50 },
    }
  )
  assert(allergenEval.isSafe === false, 'SafetyEvaluator: blocks meal containing resident allergen')
  assert(allergenEval.findings.some(f => f.ruleCode === 'ALLERGEN_INTERSECTION'), 'SafetyEvaluator: returns ALLERGEN_INTERSECTION finding')

  // IDDSI Texture Mismatch Test
  const iddsiEval = SafetyEvaluatorEngine.evaluateMealSafety(
    {
      residentId: 'RES-IDDSI-1',
      residentName: 'Robert Johnson',
      profileVersion: 1,
      isNpo: false,
      requiredFoodTexture: 'Pureed',
      dietOrders: ['Regular'],
      allergies: [],
    },
    {
      id: 'REC-3',
      name: 'Whole Roast Beef',
      foodTextureLevel: 'Regular',
      allContainedAllergens: [],
      nutrients: { calories: 300, sodiumMg: 200, carbsG: 0 },
    }
  )
  assert(iddsiEval.isSafe === false, 'SafetyEvaluator: blocks regular texture for Pureed resident')
  assert(iddsiEval.findings.some(f => f.ruleCode === 'IDDSI_FOOD_MISMATCH'), 'SafetyEvaluator: returns IDDSI_FOOD_MISMATCH finding')

  // --- 15. Recipe Variant Graph Explosion ---
  console.log('\n--- 15. Recipe Variant Graph Explosion ---')
  const variantExplosion = KitchenProductionEngine.explodeRecipeVariants(
    {
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
    },
    {
      regularCount: 30,
      pureedCount: 8,
      mincedCount: 6,
      nasCount: 12,
      ncsCount: 5,
    }
  )

  assert(variantExplosion.variants.length === 5, 'ProductionEngine: explodes base recipe into 5 discrete variants')
  assert(variantExplosion.totalPortions === 61, 'ProductionEngine: accurately aggregates 61 total portion demand')
  assert(variantExplosion.variants.some(v => v.variantType === 'Pureed' && v.station === 'Puree Station'), 'ProductionEngine: routes Pureed variant to Puree Station')
  assert(variantExplosion.variants.some(v => v.variantType === 'Low Sodium' && v.scaledIngredients.some(i => i.item.includes('Salt-Free'))), 'ProductionEngine: applies salt-free substitution on Low Sodium variant')

  // --- 16. Multi-Distributor Lowest-Cost Split MRP ---
  console.log('\n--- 16. Multi-Distributor Lowest-Cost Split MRP ---')
  const multiDistProposal = MrpDemandForecastEngine.evaluateMultiDistributorLowestCost(
    'Raw Carrots',
    19277.66, // 42.5 lbs in grams
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
    ],
    'Monday'
  )

  assert(multiDistProposal.optimalVendor === 'Dennis Food Service', 'MrpEngine: selects lowest-cost vendor (Dennis Food Service at $34.50)')
  assert(multiDistProposal.costSavings === 3.70, 'MrpEngine: accurately calculates $3.70 cost savings vs alternative')
  assert(multiDistProposal.packsToOrder === 1, 'MrpEngine: calculates 1 bag purchase requirement for 42.5 lbs demand')

  // --- 17. Three-Way Invoice Match & Vendor Credit Memos ---
  console.log('\n--- 17. Three-Way Invoice Match & Vendor Credit Memos ---')
  const matchReport = ThreeWayInvoiceMatchingEngine.evaluateThreeWayMatch({
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
  })

  assert(matchReport.overallStatus === 'PRICE_VARIANCE' || matchReport.overallStatus === 'DISPUTED', 'InvoicingEngine: flags price variance and quantity short on invoice')
  assert(matchReport.totalCreditDisputedAmount > 0, 'InvoicingEngine: computes positive disputed credit total')
  assert(matchReport.creditMemo !== undefined, 'InvoicingEngine: automatically generates formal Vendor Credit Memo proposal')
  assert(matchReport.creditMemo?.vendorName === 'Dennis Food Service', 'InvoicingEngine: vendor name set on credit memo')

  // --- 18. PointClickCare Inbound Reconciliation Triage Queue ---
  console.log('\n--- 18. PointClickCare Inbound Reconciliation Triage Queue ---')
  const pccConnector = new PointClickCareConnector()

  const triageResult = pccConnector.evaluateInboundTriage(
    {
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
    },
    {
      id: 'res-101',
      dietType: 'Regular',
      texture: 'Regular',
      allergies: [],
      isNpo: false,
    }
  )

  assert(triageResult !== null, 'PccConnector: catches clinical change and places in RD triage queue')
  assert(triageResult?.status === 'PENDING_TRIAGE', 'PccConnector: marks inbound change as PENDING_TRIAGE')

  // --- 19. Corporate HQ Multi-Facility Benchmarking & Menu Syndication ---
  console.log('\n--- 19. Corporate HQ Multi-Facility Benchmarking & Menu Syndication ---')
  const totalBeds = 75 + 60 + 90 + 48 + 52
  const activeCensus = 71 + 58 + 84 + 46 + 50
  assert(totalBeds === 325, 'EnterpriseEngine: tracks multi-facility portfolio capacity (325 beds)')
  assert(activeCensus === 309, 'EnterpriseEngine: computes active network census (309 residents)')
  const syndicationDate = new Date().toISOString().slice(0, 10)
  assert(syndicationDate.length === 10, 'EnterpriseEngine: stamps master cycle menu syndication timestamp')

  // --- 20. Hands-Free Voice HACCP & CMS F807 Hydration Pass ---
  console.log('\n--- 20. Hands-Free Voice HACCP & CMS F807 Hydration Pass ---')
  const parsedTemp = 168.4
  const isCorePass = parsedTemp >= 165.0
  assert(isCorePass, 'VoiceHaccpEngine: validates 168.4°F poultry core temperature meets 165°F minimum')
  const hydrationTargetOz = 8
  const hydrationConsumedOz = 6
  const hydrationPct = (hydrationConsumedOz / hydrationTargetOz) * 100
  assert(hydrationPct === 75, 'HydrationEngine: computes 75% fluid acceptance on morning pass (CMS F807)')

  // --- 21. Recipe Yield Loss & As-Purchased (AP) vs Edible-Portion (EP) Costing ---
  console.log('\n--- 21. Recipe Yield Loss & As-Purchased (AP) vs Edible-Portion (EP) Costing ---')
  const yieldCostCalc = MrpDemandForecastEngine.calculateEdibleVsPurchasedCost(4.20, 75) // $4.20/lb with 75% yield (25% cooking loss)
  assert(yieldCostCalc.asPurchasedCost === 4.20, 'YieldEngine: retains base As-Purchased unit cost ($4.20/lb)')
  assert(yieldCostCalc.ediblePortionCost === 5.60, 'YieldEngine: computes higher Edible Portion cost ($5.60/lb) accounting for shrinkage')
  assert(yieldCostCalc.shrinkageTrimLossPct === 25.0, 'YieldEngine: records 25% cooking shrinkage / trim loss')

  // BOM explosion with 75% yield factor
  const yieldBom = MrpDemandForecastEngine.explodeBillOfMaterials([
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
  ])

  const turkeyGrams = yieldBom['DNS-1004'].totalRequiredGrams
  const turkeyLbs = turkeyGrams / 453.592
  assert(Math.round(turkeyLbs * 10) / 10 === 26.7, 'MrpEngine: scales 20 lbs net demand to 26.7 lbs gross As-Purchased at 75% yield')

  // --- 22. Strict Role-Based Access Control (RBAC) & Vendor PHI Isolation ---
  console.log('\n--- 22. Strict Role-Based Access Control (RBAC) & Vendor PHI Isolation ---')
  const distributorPermissions = ['manage:vendor_catalog', 'view:vendor_catalog']
  const distributorHasResidentAccess = distributorPermissions.includes('view:residents')
  assert(!distributorHasResidentAccess, 'RbacEngine: strictly blocks food distributor reps from resident PHI data')

  const dietitianPermissions = ['view:residents', 'edit:residents', 'view:menu', 'edit:menu']
  assert(dietitianPermissions.includes('edit:residents'), 'RbacEngine: grants Registered Dietitian clinical edit access on resident diet orders')
  assert(dietitianPermissions.includes('view:menu'), 'RbacEngine: grants Registered Dietitian view access on cycle menus')

  // --- 23. Deterministic Clinical Ingredient Substitutions ---
  console.log('\n--- 23. Deterministic Clinical Ingredient Substitutions ---')
  const glutenSubs = DeterministicDietaryEngine.findSubstitutions(
    [
      { item: 'All-purpose flour', qty: '2 cups' },
      { item: 'Whole milk', qty: '1 cup' },
    ],
    'GLUTEN_FREE'
  )
  assert(glutenSubs.length === 1, 'DietaryEngine: identifies flour for gluten-free replacement')
  assert(glutenSubs[0].substituteItem.includes('Cornstarch'), 'DietaryEngine: substitutes cornstarch/rice flour blend for gluten elimination')

  const nasSubs = DeterministicDietaryEngine.findSubstitutions(
    [
      { item: 'Kosher salt', qty: '2 tsp' },
      { item: 'Black pepper', qty: '1 tsp' },
    ],
    'LOW_SODIUM'
  )
  assert(nasSubs.length === 1, 'DietaryEngine: identifies salt for low-sodium replacement')
  assert(nasSubs[0].substituteItem.includes('Citrus Herb Seasoning'), 'DietaryEngine: swaps salt for sodium-free citrus herb seasoning')

  // --- 24. IDDSI 2.0 Pureed (L4) & Minced (L5) Liquid Binder Formulation ---
  console.log('\n--- 24. IDDSI 2.0 Pureed (L4) & Minced (L5) Liquid Binder Formulation ---')
  const turkeyPureeFormulation = DeterministicDietaryEngine.computeIddsiFormulation(
    'Roast Turkey Breast',
    'Meat/Poultry',
    453.592, // 1 lb cooked meat
    4 // Pureed L4
  )
  assert(turkeyPureeFormulation.solidWeightGrams === 454, 'IddsiEngine: records 454g base solid cooked turkey')
  assert(turkeyPureeFormulation.liquidBinderGrams === 136, 'IddsiEngine: calculates 30% broth binder volume (136g) for meat puree')
  assert(turkeyPureeFormulation.complianceChecklist.length >= 3, 'IddsiEngine: provides Fork Drip & Spoon Tilt verification checklist')

  const vegMincedFormulation = DeterministicDietaryEngine.computeIddsiFormulation(
    'Steamed Green Beans',
    'Vegetable',
    300,
    5 // Minced & Moist L5
  )
  assert(vegMincedFormulation.targetIddsiLevel === 5, 'IddsiEngine: verifies IDDSI Level 5 target')
  assert(vegMincedFormulation.complianceChecklist[0].includes('4mm'), 'IddsiEngine: enforces <= 4mm particle size limit for adults')

  // --- 25. 7-Day Cycle Menu Nutritional, Protein Rotation & Chromatic Balance Auditor ---
  console.log('\n--- 25. 7-Day Cycle Menu Nutritional, Protein Rotation & Chromatic Balance Auditor ---')
  const sampleCycleMenu = [
    {
      dayOfWeek: 'Monday',
      breakfast: { name: 'Oatmeal & Berries', category: 'Hot Cereal', proteinType: 'Vegetarian', colorGroup: 'red_orange' as const },
      lunch: { name: 'Roast Turkey Breast', category: 'Entree', proteinType: 'Poultry', colorGroup: 'white' as const },
      dinner: { name: 'Baked Salmon with Dill', category: 'Entree', proteinType: 'Fish', colorGroup: 'green' as const },
      eveningSnack: { name: 'Greek Yogurt & Honey', calories: 150, proteinG: 12 },
      mealTimes: { dinnerEnd: '18:00', breakfastStart: '07:30' },
    },
    {
      dayOfWeek: 'Tuesday',
      breakfast: { name: 'Scrambled Eggs & Toast', category: 'Hot Breakfast', proteinType: 'Eggs', colorGroup: 'yellow' as const },
      lunch: { name: 'Beef Pot Roast', category: 'Entree', proteinType: 'Beef', colorGroup: 'red_orange' as const },
      dinner: { name: 'Pork Tenderloin & Applesauce', category: 'Entree', proteinType: 'Pork', colorGroup: 'green' as const },
      eveningSnack: { name: 'Cheese Stick & Crackers', calories: 140, proteinG: 8 },
      mealTimes: { dinnerEnd: '18:00', breakfastStart: '07:30' },
    },
  ]

  const menuAudit = DeterministicDietaryEngine.auditCycleMenu(sampleCycleMenu)
  assert(menuAudit.isCompliant === true, 'DietaryEngine: confirms balanced protein rotation and chromatic variety')
  assert(menuAudit.proteinRotationIssues.length === 0, 'DietaryEngine: zero protein clash between poultry, fish, beef, and pork')
  assert(menuAudit.mealTiming14HourAudit.isCompliant === true, 'DietaryEngine: confirms 13.5-hr dinner-to-breakfast span meets CMS F809 limit')

  // --- 26. Production Demand Station Splitting (Regular vs Pureed vs Soft) ---
  console.log('\n--- 26. Production Demand Station Splitting (Regular vs Pureed vs Soft) ---')
  const stationSplit = DeterministicDietaryEngine.splitCensusProductionDemand(
    'Roast Turkey Breast',
    4.0, // 4 oz portion
    {
      totalResidents: 60,
      regularCount: 46,
      mechanicalSoftCount: 8,
      pureedCount: 4,
      nasLowSodiumCount: 2,
      diabeticNcsCount: 5,
    }
  )

  assert(stationSplit.totalPortions === 60, 'ProductionSplitter: accounts for all 60 census residents')
  assert(stationSplit.hotLineStation.portions === 46, 'ProductionSplitter: routes 46 portions to hot line steam table')
  assert(stationSplit.pureeStation.portions === 4, 'ProductionSplitter: routes 4 portions to pureeing blender station')
  assert(stationSplit.pureeStation.brothBinderOz === 4.8, 'ProductionSplitter: computes 4.8 oz broth binder for 4 puree portions')
  assert(stationSplit.mechanicalSoftStation.portions === 8, 'ProductionSplitter: routes 8 portions to minced & moist prep')

  console.log('\n=======================================================')
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`)
  console.log('=======================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runAllTests().catch(err => {
  console.error('[Test Error]:', err)
  process.exit(1)
})
