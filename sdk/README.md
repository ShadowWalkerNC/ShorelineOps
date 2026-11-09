# @shoreline/sdk 0.3

Repository TypeScript client for the implemented ShorelineOps REST routes. It is separate from Muse tooling in `tools/muse`, the paperwork companion and the central SaaS account service. Requires Node.js 18+ or browser `fetch`; the facility server has a higher Node requirement.

## Build and consume

Run `npm run build` in `sdk`, then install the local folder or run `npm pack`. `prepack` builds CommonJS JavaScript and declarations. ESM and CommonJS consumers share the same client. Registry publication has not been verified.

```typescript
import { ShorelineClient } from '@shoreline/sdk'

const client = new ShorelineClient({
  baseUrl: 'https://your-facility.example.com',
  apiKey: process.env.SHORELINE_ACCESS_TOKEN,
})
const residents = await client.getResidents()
const census = await client.getCensus()
// census.source === 'resident-list': counts are derived from the authorized list.
// Protect returned records; never log patient data in public output.
```

`apiKey` is a compatibility property name for an access JWT obtained through authorized facility login. The SDK does not issue API keys or automatically refresh sessions. Create a new client after credential refresh. Roles, license gates, patient privacy and deterministic tray safety remain server-enforced.

## Supported operations

| Method | Server contract |
|---|---|
| `getResidents` | GET `/api/residents`, role-appropriate projection |
| `getCensus` | Derived from `getResidents`; no invented facility identity or census endpoint |
| `importCensusCsv` | POST `/api/residents/import-csv` |
| `getRecipe` | GET `/api/recipes/:id` |
| `analyzeRecipeNutrition` | POST `/api/recipes/analyze-nutrition`, nullable totals and explicit provenance |
| `verifyRecipeClinical` | POST `/api/recipes/:id/verify-clinical`, authorized clinician only |
| `evaluateInvoiceMatch` | POST `/api/purchasing/invoices/evaluate`, enterprise and capability gates |
| `getReconciliationQueue` / `resolveReconciliationItem` | Authenticated EHR review queue and decision routes |
| `logHaccpTemperature` / `getHaccpSchedule` | Persisted HACCP logs and equipment schedule |
| `getTrayRuns` / `recordTrayEvent` | Tray runs and append-only events; signed QR payload required for events |
| `runHealthCheck` | GET `/api/health`, process health rather than database readiness |

Nutrition calculations use a small local reference library. Unsupported ingredients or unmeasured count/density quantities return `null`, with reasons in `nutritionProvenance`; they never receive generic substitute values. A clinician can submit a complete `nutritionReview.perServing` plus `sourceReference` at the clinical-review endpoint. Approval does not override NPO, allergen, fluid, texture or current signed-tray checks. Live USDA/PCC nutrient endpoints remain unavailable.

Meal slots are `breakfast`, `morningSnack`, `lunch`, `afternoonSnack`, `dinner`. Tray events are `assembled`, `dispatched`, `delivered`, `missed`, `remade`; a cancellation operation is not implemented. Equipment schedule fields use the server's snake_case names. Raw PostgreSQL numeric fields may be strings, reflected in the declarations.

## Corrected contracts in 0.3

Resident fields are `dietType`, `liquidConsistency`, `isNpo`, `profileVersion` and the actual status vocabulary. Recipe steps are structured objects, and nutrition can be unavailable. Review callers when moving from 0.2 declarations.

Historical `validateRecipe`, `getMrpSplitPo`, `getCmsSurveyBinder` and `getCostPerResidentDay` helpers had no matching server contract. They remain callable for compatibility but reject locally with status 501 and `SDK_OPERATION_UNAVAILABLE`. They send no request. The server's scheduled MRP, survey export and CPD breakdown routes have different contracts and are not falsely mapped to these helpers.

Tests validate module loading, HTTP authorization/envelopes/errors, census derivation and unavailable-operation behavior. Actual facility API contract tests live in the server suite. Passing local tests does not establish provider connectivity, physical hardware operation or regulatory compliance.

License: MIT, as declared by this package.
