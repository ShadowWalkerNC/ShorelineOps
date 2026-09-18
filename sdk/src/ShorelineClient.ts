/**
 * ShorelineClient — @shoreline/sdk v0.2.0
 *
 * TypeScript client for the ShorelineOps Care OS REST API.
 * All methods are fully typed and return Promise-based results.
 *
 * Usage:
 *   const client = new ShorelineClient({ baseUrl: 'https://your-facility.shorelineops.com' })
 *   const residents = await client.getResidents()
 */

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
} from './types'

export interface ShorelineClientConfig {
  /** Base URL of your ShorelineOps API (no trailing slash) */
  baseUrl: string
  /** Optional API key or JWT token for authenticated operations */
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
        status: err.status ?? res.status,
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
    const data = await this.request<{ residents: Resident[] }>('/api/residents')
    return data.residents ?? (data as unknown as Resident[])
  }

  /**
   * Pull the live census snapshot including NPO counts and status breakdown.
   */
  async getCensus(): Promise<CensusEntry> {
    return this.request<CensusEntry>('/api/residents/census')
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
   * Validate a recipe against NAS, NCS, Renal, and allergen safety rules.
   * @param recipeId - Internal recipe UUID or slug
   */
  async validateRecipe(recipeId: string): Promise<RecipeValidationResult> {
    return this.request<RecipeValidationResult>(`/api/recipes/${encodeURIComponent(recipeId)}/validate`)
  }

  /**
   * Instant nutrition calculation for any ingredient list.
   */
  async analyzeRecipeNutrition(input: AnalyzeNutritionInput): Promise<RecipeNutritionAnalysis> {
    return this.request<RecipeNutritionAnalysis>('/api/recipes/analyze-nutrition', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  // ── MRP & Purchasing ─────────────────────────────────────────────────────

  /**
   * Run the lowest-cost Dennis vs Sysco split MRP for a given item and demand.
   * @param item - Item name or description (e.g. "Turkey Breast")
   * @param demandLbs - Total demand in pounds
   */
  async getMrpSplitPo(item: string, demandLbs: number): Promise<MrpSplitPo> {
    return this.request<MrpSplitPo>(
      `/api/purchasing/mrp-split?item=${encodeURIComponent(item)}&demand=${demandLbs}`
    )
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
  async getTrayRuns(serviceDate?: string, mealSlot?: 'Breakfast' | 'Lunch' | 'Dinner'): Promise<TrayRun[]> {
    const params = new URLSearchParams()
    if (serviceDate) params.append('serviceDate', serviceDate)
    if (mealSlot) params.append('mealSlot', mealSlot)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return this.request<TrayRun[]>(`/api/trayruns${qs}`)
  }

  /**
   * Record a tray tracking lifecycle event (assembled, dispatched, delivered, remade, canceled).
   */
  async recordTrayEvent(runId: string, event: RecordTrayEventInput): Promise<TrayEventRecord> {
    return this.request<TrayEventRecord>(`/api/trayruns/${encodeURIComponent(runId)}/events`, {
      method: 'POST',
      body: JSON.stringify(event),
    })
  }

  // ── Reporting & Compliance ───────────────────────────────────────────────

  /**
   * Retrieve the CMS F800–F814 federal dietary survey binder.
   * Requires enterprise license tier.
   */
  async getCmsSurveyBinder(): Promise<CmsSurveyBinder> {
    return this.request<CmsSurveyBinder>('/api/reporting/cms-survey-binder')
  }

  /**
   * Get cost-per-resident-day ($/CPD) analytics for the current reporting period.
   */
  async getCostPerResidentDay(): Promise<CostPerResidentDay> {
    return this.request<CostPerResidentDay>('/api/reporting/cpd')
  }

  // ── System Health ────────────────────────────────────────────────────────

  /**
   * Run a live health check against the API server.
   */
  async runHealthCheck(): Promise<HealthCheckResult> {
    return this.request<HealthCheckResult>('/api/health')
  }
}
