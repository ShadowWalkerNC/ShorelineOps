# @shoreline/sdk — TypeScript SDK Reference

> **Package:** `@shoreline/sdk`
> **Version:** 0.1.0
> **Language:** TypeScript / JavaScript (ESM + CJS)
> **Repository:** https://github.com/ShadowWalkerNC/ShorelineOps/tree/main/sdk

---

## Installation

```bash
npm install @shoreline/sdk
```

---

## Quick Start

```ts
import { ShorelineClient } from '@shoreline/sdk'

const client = new ShorelineClient({
  baseUrl: 'https://your-facility.shorelineops.com',
  apiKey: process.env.SHORELINE_API_KEY, // optional
})

// Get all active residents
const residents = await client.getResidents()

// Run a MRP split PO comparison
const po = await client.getMrpSplitPo('Turkey Breast', 45)
console.log(po.recommendedVendor, po.savingsVsAlternate)

// System health check
const health = await client.runHealthCheck()
console.log(health.status, health.version)
```

---

## Method Reference

### `getResidents(): Promise<Resident[]>`
Retrieve all active residents in the facility census, including diet orders, textures, fluid consistencies, and NPO status.

### `getCensus(): Promise<CensusEntry>`
Pull the live census snapshot including total resident count, active count, and NPO count.

### `validateRecipe(recipeId: string): Promise<RecipeValidationResult>`
Validate a recipe against NAS (No Added Salt), NCS (No Concentrated Sweets), Renal, and Big-9 allergen safety rules. Returns `compliant: boolean`, nutrient breakdown, warnings, and blockers.

### `getMrpSplitPo(item: string, demandLbs: number): Promise<MrpSplitPo>`
Run the deterministic lowest-cost vendor comparison (Dennis Food Service vs Sysco vs US Foods) for an item at a given demand in pounds. Returns `recommendedVendor`, `savingsVsAlternate`, and full line-item breakdown.

### `getCmsSurveyBinder(): Promise<CmsSurveyBinder>`
Retrieve the CMS F800-F814 federal dietary survey compliance binder.
> **Requires Enterprise license tier.** Returns HTTP 402 on Community/Pro plans.

### `getCostPerResidentDay(): Promise<CostPerResidentDay>`
Get cost-per-resident-day analytics for the current reporting period including target CPD, actual CPD, variance dollars/percent, and category breakdown.

### `runHealthCheck(): Promise<HealthCheckResult>`
Run a live health check against the API server. Returns `status`, `version`, and `uptimeSeconds`.

---

## TypeScript Types

All types are exported from `@shoreline/sdk`:

```ts
import type {
  Resident,
  CensusEntry,
  RecipeValidationResult,
  MrpSplitPo,
  MrpSplitPoLine,
  CmsSurveyBinder,
  CmsSurveySection,
  CostPerResidentDay,
  CpdCategoryBreakdown,
  HealthCheckResult,
  ShorelineApiError,
} from '@shoreline/sdk'
```

See [`sdk/src/types.ts`](../sdk/src/types.ts) for all interface definitions.

---

## Error Handling

All methods throw an enriched `Error` with `status` and `apiError` properties on non-2xx responses:

```ts
try {
  const binder = await client.getCmsSurveyBinder()
} catch (err: any) {
  if (err.status === 402) {
    console.error('Enterprise license required — upgrade at shorelineops.com/pricing')
  } else if (err.status === 401) {
    console.error('Authentication required — provide apiKey in ShorelineClientConfig')
  } else {
    console.error(err.message)
  }
}
```

---

## Roadmap

| Version | Features |
|---|---|
| **v0.1.0** | Core CRUD — residents, census, recipes, MRP, CPD, health |
| **v0.2.0** | Webhook subscription management |
| **v0.3.0** | Hardware API — printer & probe management |
| **v1.0.0** | Full REST API coverage, streaming HACCP log events |