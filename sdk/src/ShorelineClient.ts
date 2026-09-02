/**
 * ShorelineClient — @shoreline/sdk v0.1.0
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
  RecipeValidationResult,
  MrpSplitPo,
  CmsSurveyBinder,
  CostPerResidentDay,
  HealthCheckResult,
  ShorelineApiError,
} from './types'

export interface ShorelineClientConfig {
  /** Base URL of your ShorelineOps API (no trailing slash) */
  baseUrl: string
  /** Optional API key for machine-to-machine authentication */
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

  // ── Recipe Validation ────────────────────────────────────────────────────

  /**
   * Validate a recipe against NAS, NCS, Renal, and allergen safety rules.
   * @param recipeId - Internal recipe UUID or slug
   */
  async validateRecipe(recipeId: string): Promise<RecipeValidationResult> {
    return this.request<RecipeValidationResult>(`/api/recipes/${encodeURIComponent(recipeId)}/validate`)
  }

  // ── MRP / Purchasing ─────────────────────────────────────────────────────

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
