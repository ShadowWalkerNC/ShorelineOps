# @shoreline/sdk

Official TypeScript client for the **ShorelineOps Care OS** healthcare dietary and clinical nutrition operations platform.

---

## Capabilities

- **Resident Census & Diets**: Live census queries, therapeutic diet orders (NAS, NCS, Renal), IDDSI dysphagia texture verification, and bulk CSV ingestion.
- **EHR Triage & Clinical Reconciliation**: PointClickCare inbound webhook triage queue, audit logging, and RD approval/rejection workflows.
- **Recipe & Nutritional Analysis**: Master recipe details, automated USDA nutrient calculation, and Big 9 allergen scanning.
- **Purchasing & 3-Way Match**: Dennis vs. Sysco lowest-cost split MRP, 3-way invoice matching, price variance detection, and vendor credit memo proposals.
- **Hardware & HACCP Monitoring**: Bluetooth temperature probe readings, refrigerator/hot-line HACCP logging, corrective action enforcement, and due/overdue check schedules.
- **Tray Line Execution**: Real-time meal slot tracking, assembly timestamps, delivery SLAs, and remake event logging.
- **Regulatory Survey Compliance**: CMS-2567 F-Tag F800-F814 dietary survey binder retrieval and Cost per Resident Day ($/CPD) reporting.

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
  apiKey: process.env.SHORELINE_API_KEY, // Optional: JWT token or API key
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
  /** Optional API key or JWT token for authenticated operations */
  apiKey?: string
}
```

---

## API Reference

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
