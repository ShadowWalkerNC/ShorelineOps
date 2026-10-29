import { api } from './client'

export interface PairRequestResponse {
  code: string
  claimToken: string
  expiresInSeconds: number
}

export type PairStatusResponse =
  | { status: 'pending'; expiresInSeconds: number }
  | { status: 'approved'; accessToken: string; refreshToken: string; facilityId: string }

export interface OpsToday {
  date: string
  facilityName: string
  production: { total: number; signedOff: number; pending: number }
  trays: { runs: number; assembled: number; dispatched: number; delivered: number; missed: number; remade: number }
  generatedAt: string
}

export interface CrewMember {
  name: string
  position: string
  department: string
}

export interface CrewToday {
  date: string
  crew: CrewMember[]
  generatedAt: string
}

export interface ShiftEntry {
  name: string
  position: string
  shift: string
  station: string
}

export interface ScheduleCoverage {
  callOuts: number
  uncovered: number
  byShift: Record<string, number>
}

export interface ScheduleToday {
  date: string
  shifts: ShiftEntry[]
  coverage: ScheduleCoverage
  generatedAt: string
}

export interface MealsToday {
  date: string
  census: number
  diets: Record<string, number>
  textures: Record<string, number>
  generatedAt: string
}

export const tvApi = {
  /** Ask for a pairing code to show on the TV. Unauthenticated; rate-limited server-side. */
  requestPair: (label: string): Promise<PairRequestResponse> =>
    api.post<PairRequestResponse>('/tv/pair/request', { label }).then(r => r.data),

  /** Poll until a manager approves. The claim secret binds the poll to this TV. */
  pairStatus: (code: string, claim: string): Promise<PairStatusResponse> =>
    api.get<PairStatusResponse>('/tv/pair/status', { params: { code, claim } }).then(r => r.data),

  /** Manager approves a code shown on a facility TV. Requires manager+ staff session. */
  approvePair: (code: string): Promise<{ status: string; label: string }> =>
    api.post<{ status: string; label: string }>('/tv/pair/approve', { code }).then(r => r.data),

  /** Counts-only ops feed. No resident-level fields by server construction. */
  opsToday: (): Promise<OpsToday> =>
    api.get<OpsToday>('/tv/ops-today').then(r => r.data),

  /** Active dietary crew (names + roles only; server strips private columns). */
  crewToday: (): Promise<CrewToday> =>
    api.get<CrewToday>('/tv/crew-today').then(r => r.data),

  /** Today's shifts + call-out coverage counts (no reasons or replacements). */
  scheduleToday: (): Promise<ScheduleToday> =>
    api.get<ScheduleToday>('/tv/schedule-today').then(r => r.data),

  /** Counts-only meal aggregates: census + diet/texture breakdowns. */
  mealsToday: (): Promise<MealsToday> =>
    api.get<MealsToday>('/tv/meals-today').then(r => r.data),
}
