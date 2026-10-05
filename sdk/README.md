# @shoreline/sdk

Repository TypeScript client for the **ShorelineOps Care OS** REST API. This package is separate from the Muse Spark and Gadget tooling in `tools/muse`.

---

## Capabilities

- **Resident Census & Diets**: Facility census queries, recorded diet and texture orders, and CSV ingestion. Recorded texture orders do not verify physical IDDSI preparation.
- **EHR Triage & Clinical Reconciliation**: PointClickCare inbound webhook triage queue, audit logging, and RD approval/rejection workflows.
- **Recipe & Nutritional Analysis**: Master recipe details, automated USDA nutrient calculation, and Big 9 allergen scanning.
- **Purchasing & 3-Way Match**: Dennis vs. Sysco lowest-cost split MRP, 3-way invoice matching, price variance detection, and vendor credit memo proposals.
- **HACCP Monitoring**: Submitted temperature readings and equipment check schedules. The client does not connect to Bluetooth probes.
- **Tray Line Execution**: Real-time meal slot tracking, assembly timestamps, delivery SLAs, and remake event logging.
- **Survey Preparation**: Survey binder retrieval and Cost per Resident Day ($/CPD) reporting. Reports require facility review and do not certify compliance.

---

## Installation from source

```bash
npm install ./sdk
```

---

## Quick Start

```typescript
import { ShorelineClient } from '@shoreline/sdk'

const client = new ShorelineClient({
  baseUrl: 'https://shoreline-api-production.up.railway.app',
  apiKey: process.env.SHORELINE_ACCESS_TOKEN, // Access JWT from an authorized login
})

// 1. Fetch active facility census
const census = await client.getCensus()
console.log(`Active residents: ${census.activeCount}, NPO: ${census.npoCount}`)

// 2. Run lowest-cost split MRP comparison
const mrp = await client.getMrpSplitPo('Turkey Breast', 50)
console.log(`Best vendor: ${mrp.recommendedVendor}, Savings: $${mrp.savingsVsAlternate.toFixed(2)}`)

// 3. Evaluate 3-way invoice match
const match = await client.evaluateInvoiceMatch({
  invoiceNumber: 'INV-2026-9812',
  vendorName: 'Dennis Food Service',
  lines: [
    {
      itemSku: 'TURK-001',
      description: 'Raw Turkey Breast',
      poQty: 10,
      receivedQty: 9,
      invoicedQty: 10,
      poContractUnitPrice: 4.25,
      invoicedUnitPrice: 4.85,
    },
  ],
})

console.log(`Status: ${match.report.overallStatus}`)
console.log(`Disputed: $${match.report.totalCreditDisputedAmount}`)
```

---

## Client Configuration

```typescript
export interface ShorelineClientConfig {
  /** Base URL of your ShorelineOps API (no trailing slash) */
  baseUrl: string
  /** Access JWT; property name retained for compatibility. No API-key issuance is implemented. */
  apiKey?: string
}
```

---

## API Reference

The capability descriptions below describe API operations, not verified physical device connections, live vendor integrations, or regulatory certification. Role, facility, license, and deterministic clinical checks still apply. The client does not acquire or refresh credentials: create a new client with the current access JWT after login/refresh. Logout and account security changes revoke sessions. Never embed credentials in public bundles or log resident data. Registry publication of this package has not been verified; build the repository SDK before installing it from source.

### Residents & Census
- `getResidents(): Promise<Resident[]>` — Pull all resident records.
- `getCensus(): Promise<CensusEntry>` — Live census overview with active/NPO counts.
- `importCensusCsv(csv: string): Promise<CensusImportResult>` — Bulk import resident rosters and clinical diet orders.

### Recipes & Clinical Nutrition
- `getRecipe(recipeId: string): Promise<RecipeDetail>` — Retrieve full recipe bill-of-materials and nutrition.
- `validateRecipe(recipeId: string): Promise<RecipeValidationResult>` — Clinical safety audit (NAS, NCS, Renal, allergens).
- `analyzeRecipeNutrition(input: AnalyzeNutritionInput): Promise<RecipeNutritionAnalysis>` — On-the-fly macro/micronutrient breakdown.

### Purchasing & Invoicing
- `getMrpSplitPo(item: string, demandLbs: number): Promise<MrpSplitPo>` — Split MRP price comparison across Dennis, Sysco, and US Foods.
- `evaluateInvoiceMatch(input: EvaluateInvoiceInput): Promise<ThreeWayMatchResponse>` — 3-way invoice reconciliation and vendor credit memo proposals.

### Clinical EHR Reconciliation
- `getReconciliationQueue(status?: string): Promise<ReconciliationQueueResult>` — List pending triage queue items.
- `resolveReconciliationItem(id: string, action: ReconciliationAction): Promise<ReconciliationResolveResult>` — RD approval or rejection of EHR modifications.

### Kitchen Hardware & HACCP
- `logHaccpTemperature(input: LogHaccpInput): Promise<HaccpLogResult>` — Record food or equipment temperatures.
- `getHaccpSchedule(): Promise<HaccpScheduleResult>` — Equipment check schedule with due/overdue counts.

### Tray Line Execution
- `getTrayRuns(serviceDate?: string, mealSlot?: string): Promise<TrayRun[]>` — Tray runs by date and meal.
- `recordTrayEvent(runId: string, event: RecordTrayEventInput): Promise<TrayEventRecord>` — Log tray assembly, dispatch, delivery, or cancellation.

### Reporting & Health
- `getCmsSurveyBinder(): Promise<CmsSurveyBinder>` — CMS F-Tag survey binder (Enterprise tier).
- `getCostPerResidentDay(): Promise<CostPerResidentDay>` — Cost-per-resident-day budget variances.
- `runHealthCheck(): Promise<HealthCheckResult>` — Server uptime and database connectivity.

---

## License

MIT © Shoreline Operations LLC. Open-Source Healthcare Technology.
