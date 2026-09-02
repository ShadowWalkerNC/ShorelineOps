/**
 * @shoreline/sdk — TypeScript Type Definitions
 * ShorelineOps Care OS v6.0 Public SDK
 */

// ── Residents & Census ───────────────────────────────────────────────────────

export interface Resident {
  id: string
  name: string
  room: string
  wing?: string
  diet: string
  texture: string
  fluids: string
  allergies: string[]
  npo: boolean
  status?: 'Active' | 'Hospital' | 'LOA' | 'Discharged'
}

export interface CensusEntry {
  facilityId: string
  residentCount: number
  activeCount: number
  npoCount: number
  residents: Resident[]
  pulledAt: string
}

// ── Recipe Validation ────────────────────────────────────────────────────────

export interface RecipeNutrients {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  sodiumMg: number
  potassiumMg?: number
  phosphorusMg?: number
}

export interface RecipeValidationResult {
  recipeId: string
  recipeName: string
  compliant: boolean
  allergens: string[]
  nutrients: RecipeNutrients
  warnings: string[]
  blockers: string[]
  validatedAt: string
}

// ── MRP / Purchasing ─────────────────────────────────────────────────────────

export interface MrpSplitPoLine {
  vendor: 'Dennis' | 'Sysco' | 'US Foods'
  vendorSku: string
  itemName: string
  demandLbs: number
  casesOrdered: number
  unitCost: number
  totalCost: number
}

export interface MrpSplitPo {
  item: string
  demandLbs: number
  recommendedVendor: string
  savingsVsAlternate: number
  lines: MrpSplitPoLine[]
  generatedAt: string
}

// ── CMS Survey Binder ────────────────────────────────────────────────────────

export interface CmsSurveySection {
  tagCode: string
  title: string
  status: 'compliant' | 'deficiency' | 'not_applicable'
  score: number
  notes: string
}

export interface CmsSurveyBinder {
  facilityName: string
  surveyPeriod: string
  overallScore: number
  sections: CmsSurveySection[]
  generatedAt: string
}

// ── Cost Per Resident Day ────────────────────────────────────────────────────

export interface CpdCategoryBreakdown {
  proteins: number
  produce: number
  dairy: number
  dryGoods: number
  supplements: number
  other?: number
}

export interface CostPerResidentDay {
  facility: string
  reportDate: string
  activeCensus: number
  targetCpd: number
  actualCpd: number
  varianceDollars: number
  variancePct: number
  categoryBreakdown: CpdCategoryBreakdown
}

// ── Health Check ─────────────────────────────────────────────────────────────

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'error'
  service: string
  version: string
  uptimeSeconds: number
  timestamp: string
  components?: Record<string, 'ok' | 'degraded' | 'error'>
}

// ── SDK Error ────────────────────────────────────────────────────────────────

export interface ShorelineApiError {
  status: number
  error: string
  message?: string
}
