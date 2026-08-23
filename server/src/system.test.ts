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
  const { MrpDemandForecastEngine } = await import('./engine/mrp')
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
  const { KitchenProductionEngine } = await import('./engine/production')
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
  const { CmsDietarySurveyEngine } = await import('./engine/cmsSurvey')
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
