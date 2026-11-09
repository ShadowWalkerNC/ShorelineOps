/**
 * ShorelineClient — @shoreline/sdk v0.3.0
 *
 * TypeScript client for the ShorelineOps Care OS REST API.
 * All methods are fully typed and return Promise-based results.
 *
 * Usage:
 *   const client = new ShorelineClient({ baseUrl: 'http://127.0.0.1:3001', apiKey: accessToken })
 *   const residents = await client.getResidents()
 */

import type {
  Resident,
  CensusEntry,
  CensusImportResult,
  RecipeValidationResult,
  AnalyzeNutritionInput,
  RecipeNutritionAnalysis,
  RecipeDetail,
  MrpSplitPo,
  EvaluateInvoiceInput,
  ThreeWayMatchResponse,
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
  CostPerResidentDay,
  HealthCheckResult,
  ShorelineApiError,
  ClinicalRecipeReview,
  TrayMealSlot,
} from './types'

export interface ShorelineClientConfig {
  /** Base URL of your ShorelineOps API (no trailing slash) */
  baseUrl: string
  /** Access JWT from login/refresh. Property name retained for compatibility; no API-key issuance. */
  apiKey?: string
}

export class ShorelineClient {
  private readonly baseUrl: string
  private readonly apiKey?: string

  constructor(config: ShorelineClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
  }

  // ── Private HTTP helper ──────────────────────────────────────────────────

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    }
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const res = await fetch(url, { ...options, headers })

    if (!res.ok) {
      const err: ShorelineApiError = await res.json().catch(() => ({
        status: res.status,
        error: res.statusText,
      }))
      throw Object.assign(new Error(err.error ?? `HTTP ${res.status}`), {
        status: res.status,
        apiError: err,
      })
    }

    return res.json() as Promise<T>
  }

  // ── Residents & Census ───────────────────────────────────────────────────

  /**
   * Retrieve all active residents in the facility census.
   */
  async getResidents(): Promise<Resident[]> {
    const data = await this.request<Resident[] | { residents: Resident[] }>('/api/residents')
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.residents)) return data.residents
    throw new Error('Invalid resident-list response')
  }

  /**
   * Derive counts from the authorized resident list. No server census route exists.
   */
  async getCensus(): Promise<CensusEntry> {
    const residents = await this.getResidents()
    const active = residents.filter(resident => resident.status === 'Active')
    return { source: 'resident-list', residentCount: residents.length, activeCount: active.length,
      npoCount: active.filter(resident => resident.isNpo).length, residents, pulledAt: new Date().toISOString() }
  }

  /**
   * Bulk import census rosters and clinical diet orders via CSV data.
   * Increments resident profile version and creates immutable audit log entries.
   */
  async importCensusCsv(csv: string): Promise<CensusImportResult> {
    return this.request<CensusImportResult>('/api/residents/import-csv', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    })
  }

  // ── Recipe & Nutritional Analysis ────────────────────────────────────────

  /**
   * Retrieve full master recipe detail by ID including nutrition and cost breakdown.
   */
  async getRecipe(recipeId: string): Promise<RecipeDetail> {
    return this.request<RecipeDetail>(`/api/recipes/${encodeURIComponent(recipeId)}`)
  }

  /**
   * @deprecated No recipe-validation route exists. Use clinical review and signed tray verification.
   * @param recipeId - Internal recipe UUID or slug
   */
  async validateRecipe(recipeId: string): Promise<RecipeValidationResult> {
    return this.unavailable('validateRecipe')
  }

  /** Submit an authorized clinician's review. This never overrides tray safety. */
  async verifyRecipeClinical(recipeId: string, review: ClinicalRecipeReview): Promise<Pick<RecipeDetail, 'id' | 'name' | 'clinicalVerified' | 'verifiedBy' | 'verifiedAt' | 'approvedDiets'> & { fluidMlPerServing: number | null; allergens: string[] }> {
    return this.request(`/api/recipes/${encodeURIComponent(recipeId)}/verify-clinical`, { method: 'POST', body: JSON.stringify(review) })
  }

  /**
   * Local-reference estimates for supported weighed ingredients. Unavailable totals are null.
   */
  async analyzeRecipeNutrition(input: AnalyzeNutritionInput): Promise<RecipeNutritionAnalysis> {
    return this.request<RecipeNutritionAnalysis>('/api/recipes/analyze-nutrition', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  // ── MRP & Purchasing ─────────────────────────────────────────────────────

  /**
   * @deprecated No matching item/demand split-MRP route exists.
   * @param item - Item name or description (e.g. "Turkey Breast")
   * @param demandLbs - Total demand in pounds
   */
  async getMrpSplitPo(item: string, demandLbs: number): Promise<MrpSplitPo> {
    return this.unavailable('getMrpSplitPo')
  }

  /**
   * Evaluate 3-way invoice match across PO contract pricing, receiving counts, and billed lines.
   * Detects price creep, short-ships, and generates vendor credit memo proposals.
   */
  async evaluateInvoiceMatch(input: EvaluateInvoiceInput): Promise<ThreeWayMatchResponse> {
    return this.request<ThreeWayMatchResponse>('/api/purchasing/invoices/evaluate', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  // ── EHR Triage Queue & Clinical Reconciliation ───────────────────────────

  /**
   * Retrieve inbound EHR triage queue items (diet orders, texture updates, NPO orders).
   */
  async getReconciliationQueue(status: string = 'PENDING_TRIAGE'): Promise<ReconciliationQueueResult> {
    return this.request<ReconciliationQueueResult>(
      `/api/ehr/reconciliation-queue?status=${encodeURIComponent(status)}`
    )
  }

  /**
   * Resolve an inbound EHR triage item (APPROVE or REJECT by Registered Dietitian).
   */
  async resolveReconciliationItem(id: string, action: ReconciliationAction): Promise<ReconciliationResolveResult> {
    return this.request<ReconciliationResolveResult>(
      `/api/ehr/reconciliation-queue/${encodeURIComponent(id)}/resolve`,
      {
        method: 'POST',
        body: JSON.stringify({ action }),
      }
    )
  }

  // ── Kitchen Hardware & HACCP Logging ─────────────────────────────────────

  /**
   * Record a HACCP temperature reading for food or equipment.
   * Violations require a corrective action before the log is closed.
   */
  async logHaccpTemperature(input: LogHaccpInput): Promise<HaccpLogResult> {
    return this.request<HaccpLogResult>('/api/hardware/haccp/log-temp', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  /**
   * Fetch current equipment temperature check schedule with due and overdue counts.
   */
  async getHaccpSchedule(): Promise<HaccpScheduleResult> {
    return this.request<HaccpScheduleResult>('/api/hardware/haccp/schedule')
  }

  // ── Tray Line Execution & Tracking ───────────────────────────────────────

  /**
   * List tray runs by service date and meal slot.
   */
  async getTrayRuns(serviceDate?: string, mealSlot?: TrayMealSlot): Promise<TrayRun[]> {
    const params = new URLSearchParams()
    if (serviceDate) params.append('serviceDate', serviceDate)
    if (mealSlot) params.append('mealSlot', mealSlot)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return this.request<TrayRun[]>(`/api/trayruns${qs}`)
  }

  /**
     * Record a tray tracking lifecycle event (assembled, dispatched, delivered, remade, missed).
   */
  async recordTrayEvent(runId: string, event: RecordTrayEventInput): Promise<TrayEventRecord> {
    return this.request<TrayEventRecord>(`/api/trayruns/${encodeURIComponent(runId)}/events`, {
      method: 'POST',
      body: JSON.stringify(event),
    })
  }

  // ── Reporting & Compliance ───────────────────────────────────────────────

  /**
   * @deprecated The server survey-export contract differs from this historical helper.
   */
  async getCmsSurveyBinder(): Promise<CmsSurveyBinder> {
    return this.unavailable('getCmsSurveyBinder')
  }

  /**
   * @deprecated The server CPD-breakdown contract differs from this historical helper.
   */
  async getCostPerResidentDay(): Promise<CostPerResidentDay> {
    return this.unavailable('getCostPerResidentDay')
  }

  // ── System Health ────────────────────────────────────────────────────────

  /**
   * Run a live health check against the API server.
   */
  async runHealthCheck(): Promise<HealthCheckResult> {
    return this.request<HealthCheckResult>('/api/health')
  }

  private unavailable(operation: string): never {
    const apiError = { status: 501, error: 'SDK_OPERATION_UNAVAILABLE', message: `${operation} has no matching server contract. See the SDK supported-operations guide.` }
    throw Object.assign(new Error(apiError.message), { status: 501, apiError })
  }
}
