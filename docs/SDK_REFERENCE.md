# @shoreline/sdk — TypeScript SDK Reference

> **Package:** `@shoreline/sdk`  
> **Version:** 0.2.0  
> **Language:** TypeScript / JavaScript (ESM + CJS)  
> **Repository:** https://github.com/ShadowWalkerNC/ShorelineOps/tree/main/sdk  

---

## Installation

```bash
npm install @shoreline/sdk
```

---

## Quick Start

```typescript
import { ShorelineClient } from '@shoreline/sdk'

const client = new ShorelineClient({
  baseUrl: 'https://facility.shorelineops.com',
  apiKey: process.env.SHORELINE_API_KEY, // optional
})

// 1. Get all active residents
const residents = await client.getResidents()

// 2. Run a lowest-cost MRP split PO comparison
const po = await client.getMrpSplitPo('Turkey Breast', 45)
console.log(po.recommendedVendor, po.savingsVsAlternate)

// 3. Evaluate 3-way invoice match with distributor
const match = await client.evaluateInvoiceMatch({
  invoiceNumber: 'INV-44102',
  vendorName: 'Dennis Food Service',
  lines: [
    {
      itemSku: 'TURK-001',
      description: 'Raw Turkey Breast Roast',
      poQty: 4,
      receivedQty: 4,
      invoicedQty: 4,
      poContractUnitPrice: 42.50,
      invoicedUnitPrice: 48.00,
    },
  ],
})

// 4. System health check
const health = await client.runHealthCheck()
console.log(health.status, health.version)
```

---

## Method Reference

### Residents & Census

#### `getResidents(): Promise<Resident[]>`
Retrieve all active residents in the facility census, including diet orders, textures, fluid consistencies, and NPO status.

#### `getCensus(): Promise<CensusEntry>`
Pull the live census snapshot including total resident count, active count, and NPO count.

#### `importCensusCsv(csv: string): Promise<CensusImportResult>`
Bulk import census rosters and clinical diet orders via CSV data. Parses therapeutic diets, IDDSI textures, and allergen flags, incrementing profile versions and logging to immutable audit trails.

---

### Recipes & Clinical Nutrition

#### `getRecipe(recipeId: string): Promise<RecipeDetail>`
Retrieve full master recipe record, including bill-of-materials ingredient lines, preparation instructions, HACCP target temperatures, and comprehensive macro/micronutrient breakdown.

#### `validateRecipe(recipeId: string): Promise<RecipeValidationResult>`
Validate a recipe against NAS (No Added Salt), NCS (No Concentrated Sweets), Renal, and Big 9 allergen safety rules. Returns compliance status, warnings, and non-overridable clinical blockers.

#### `analyzeRecipeNutrition(input: AnalyzeNutritionInput): Promise<RecipeNutritionAnalysis>`
Calculate instant nutritional breakdown (calories, protein, carbohydrates, fats, sodium, potassium, phosphorus) for any raw ingredient list.

---

### Purchasing & Invoicing

#### `getMrpSplitPo(item: string, demandLbs: number): Promise<MrpSplitPo>`
Run the deterministic lowest-cost vendor comparison (Dennis Food Service vs. Sysco vs. US Foods) for an item at a given demand in pounds. Returns `recommendedVendor`, `savingsVsAlternate`, and full line-item breakdown.

#### `evaluateInvoiceMatch(input: EvaluateInvoiceInput): Promise<ThreeWayMatchResponse>`
Evaluates 3-way match across PO contract rates, receiving dock counts, and distributor invoice. Flags line-by-line price variances, quantity shortages, and creates vendor credit memo proposals.
> **Requires Enterprise license tier.**

---

### Clinical EHR Reconciliation

#### `getReconciliationQueue(status?: string): Promise<ReconciliationQueueResult>`
Fetch the inbound EHR triage queue for Registered Dietitians, containing pending changes from PointClickCare (diet orders, texture downgrades, NPO orders).

#### `resolveReconciliationItem(id: string, action: ReconciliationAction): Promise<ReconciliationResolveResult>`
Approve (`APPROVED_BY_RD`) or reject (`REJECTED_BY_RD`) an inbound EHR change. Approved changes atomically update resident records with incremented profile versions.

---

### Kitchen Hardware & HACCP

#### `logHaccpTemperature(input: LogHaccpInput): Promise<HaccpLogResult>`
Record a critical control point temperature check. Readings outside food safety boundaries require a documented corrective action before the entry can be closed.

#### `getHaccpSchedule(): Promise<HaccpScheduleResult>`
Retrieve facility equipment temperature check schedules with real-time due and overdue counts.

---

### Tray Line Execution

#### `getTrayRuns(serviceDate?: string, mealSlot?: string): Promise<TrayRun[]>`
Query tray dispatch runs filtered by service date and meal slot (Breakfast, Lunch, Dinner).

#### `recordTrayEvent(runId: string, event: RecordTrayEventInput): Promise<TrayEventRecord>`
Log tray lifecycle events (`assembled`, `dispatched`, `delivered`, `remade`, `canceled`) with timestamps and ticket identifiers.

---

### Reporting & Compliance

#### `getCmsSurveyBinder(): Promise<CmsSurveyBinder>`
Retrieve the CMS F800–F814 federal dietary survey compliance binder.
> **Requires Enterprise license tier.**

#### `getCostPerResidentDay(): Promise<CostPerResidentDay>`
Get cost-per-resident-day analytics for the current reporting period including target CPD, actual CPD, variance dollars/percent, and category breakdown.

#### `runHealthCheck(): Promise<HealthCheckResult>`
Run a live health check against the API server. Returns `status`, `version`, and `uptimeSeconds`.

---

## TypeScript Types

All operational types are exported directly from `@shoreline/sdk`:

```typescript
import type {
  Resident,
  CensusEntry,
  CensusImportResult,
  RecipeNutrients,
  RecipeValidationResult,
  AnalyzeNutritionInput,
  RecipeNutritionAnalysis,
  RecipeDetail,
  MrpSplitPo,
  MrpSplitPoLine,
  InvoiceLineInput,
  EvaluateInvoiceInput,
  ThreeWayMatchReport,
  ThreeWayMatchResponse,
  TriageItem,
  ReconciliationQueueResult,
  ReconciliationAction,
  ReconciliationResolveResult,
  LogHaccpInput,
  HaccpLogResult,
  HaccpScheduleResult,
  TrayRun,
  TrayEventRecord,
  RecordTrayEventInput,
  CmsSurveyBinder,
  CmsSurveySection,
  CostPerResidentDay,
  CpdCategoryBreakdown,
  HealthCheckResult,
  ShorelineApiError,
} from '@shoreline/sdk'
```

---

## Error Handling

All methods throw an enriched `Error` with `status` and `apiError` properties on non-2xx responses:

```typescript
try {
  const binder = await client.getCmsSurveyBinder()
} catch (err: any) {
  if (err.status === 402) {
    console.error('Enterprise tier required for CMS Survey Binder')
  } else if (err.status === 401) {
    console.error('Authentication credentials required')
  } else {
    console.error(`API Error (${err.status}): ${err.message}`)
  }
}
```