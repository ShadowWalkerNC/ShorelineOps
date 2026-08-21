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
