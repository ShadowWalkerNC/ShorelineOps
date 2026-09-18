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

export interface CensusImportResult {
  success: boolean
  created: number
  updated: number
  totalProcessed: number
  errors: string[]
}

// ── Recipe & Nutritional Analysis ────────────────────────────────────────────

export interface RecipeNutrients {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  sodiumMg: number
  satFatG?: number
  potassiumMg?: number
  phosphorusMg?: number
  fiberG?: number
  sugarG?: number
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

export interface IngredientInput {
  item: string
  qty: string
}

export interface AnalyzeNutritionInput {
  ingredients: IngredientInput[]
  baseServings?: number
}

export interface RecipeNutritionAnalysis {
  perServing: RecipeNutrients
  totalBatch: RecipeNutrients
  allergens: string[]
  ingredientContributions: Array<{
    item: string
    grams: number
    calories: number
    proteinG: number
    sodiumMg: number
  }>
}

export interface RecipeDetail {
  id: string
  name: string
  category: string
  baseServings: number
  prepTimeMins: number
  cookTimeMins: number
  haccpTempF: number
  iddsiLevel: string | number
  allergens: string[]
  ingredients: Array<{ item: string; qty: string }>
  steps: string[]
  notes: string
  costPerServing: number
  nutrition: RecipeNutrients
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

// ── 3-Way Invoice Matching ───────────────────────────────────────────────────

export interface InvoiceLineInput {
  itemSku: string
  description: string
  poQty: number
  receivedQty: number
  invoicedQty: number
  poContractUnitPrice: number
  invoicedUnitPrice: number
  category?: string
}

export interface EvaluateInvoiceInput {
  invoiceNumber: string
  vendorName: string
  invoiceDate?: string
  poReference?: string
  lines: InvoiceLineInput[]
}

export interface LineVariance {
  itemSku: string
  description: string
  varianceType: 'PRICE_OVERCHARGE' | 'QUANTITY_SHORT' | 'UNAUTHORIZED_SUBSTITUTION' | 'MATCHED'
  poQty: number
  receivedQty: number
  invoicedQty: number
  poContractPrice: number
  invoicedPrice: number
  priceDifferencePerUnit: number
  totalDisputedAmount: number
  reason: string
}

export interface VendorCreditMemoProposal {
  memoNumber: string
  vendorName: string
  invoiceNumber: string
  issueDate: string
  totalCreditAmount: number
  lineItemReasons: string[]
  formattedMemoText: string
}

export interface ThreeWayMatchReport {
  invoiceNumber: string
  vendorName: string
  invoiceDate: string
  poReference: string
  totalBilledAmount: number
  totalApprovedAmount: number
  totalCreditDisputedAmount: number
  overallStatus: 'MATCHED' | 'PRICE_VARIANCE' | 'QUANTITY_SHORT' | 'DISPUTED' | 'PENDING'
  lineVariances: LineVariance[]
  creditMemo?: VendorCreditMemoProposal
}

export interface ThreeWayMatchResponse {
  success: boolean
  report: ThreeWayMatchReport
}

// ── EHR Triage Queue & Clinical Reconciliation ───────────────────────────────

export interface TriageItem {
  id: string
  facility_id?: string
  resident_id?: string
  resident_name?: string
  change_type: 'DIET_ORDER' | 'TEXTURE_UPDATE' | 'NPO_ORDER' | 'ALLERGY_ALERT' | string
  current_value?: string
  proposed_value?: string
  incoming_payload: any
  status: 'PENDING_TRIAGE' | 'APPROVED_BY_RD' | 'REJECTED_BY_RD'
  resolved_by?: string | null
  resolved_at?: string | null
  created_at: string
}

export interface ReconciliationQueueResult {
  totalPending: number
  items: TriageItem[]
}

export type ReconciliationAction = 'APPROVED_BY_RD' | 'REJECTED_BY_RD'

export interface ReconciliationResolveResult {
  success: boolean
  resolvedId: string
  action: ReconciliationAction
  resolvedBy: string
  resolvedAt: string
}

// ── Kitchen Hardware & HACCP Logging ─────────────────────────────────────────

export interface LogHaccpInput {
  checkType: 'food' | 'equipment'
  itemName: string
  equipmentId?: string
  tempF: number
  targetTempF?: number
  correctiveAction?: string
  source?: 'manual' | 'probe'
  probeDevice?: string
  recordedBy?: string
}

export interface HaccpLogRecord {
  id: string
  check_type: 'food' | 'equipment'
  item_name: string
  equipment_id?: string | null
  equipment_name?: string | null
  temp_f: number
  target_temp_f: number
  compliant: boolean
  violation_type?: string | null
  corrective_action?: string | null
  source: string
  probe_device?: string | null
  recorded_by?: string | null
  recorded_at: string
}

export interface HaccpLogResult {
  success: boolean
  record: HaccpLogRecord
}

export interface HaccpEquipmentScheduleItem {
  id: string
  name: string
  type: string
  targetTempF: number
  checkFrequency: string
  lastCheckedAt?: string | null
  status: 'compliant' | 'due' | 'overdue' | 'violation'
}

export interface HaccpScheduleResult {
  generatedAt: string
  overdue: number
  due: number
  equipment: HaccpEquipmentScheduleItem[]
}

// ── Tray Line Execution & Tracking ───────────────────────────────────────────

export interface TrayRun {
  id: string
  mealSlot: 'Breakfast' | 'Lunch' | 'Dinner'
  serviceDate: string
  wing: string
  status: 'active' | 'completed' | 'paused'
  notes: string
  createdBy?: string | null
  createdAt: string
}

export interface TrayEventRecord {
  id: string
  run_id: string
  resident_id?: string | null
  ticket_id: string
  event: 'assembled' | 'dispatched' | 'delivered' | 'remade' | 'canceled'
  at: string
  by?: string | null
  note?: string
}

export interface RecordTrayEventInput {
  residentId?: string | null
  ticketId?: string
  event: 'assembled' | 'dispatched' | 'delivered' | 'remade' | 'canceled'
  note?: string
  newTicketId?: string
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
