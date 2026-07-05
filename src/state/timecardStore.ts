// ============================================================
// TIMECARD STORE
// ============================================================
// Wraps src/api/timecard.ts (Supabase) with Zustand state.
//
// Responsibilities:
//   - Cache punches fetched from Supabase
//   - Derive "current status" (clocked in / out) per badge
//   - Calculate shift hours and overtime per badge
//   - Expose insertPunch action that writes to Supabase and
//     updates local state optimistically
// ============================================================

import { create } from 'zustand'
import {
  fetchPunches,
  insertPunch,
  getLastPunch,
  type TimecardPunch,
} from '@/api/timecard'

export type { TimecardPunch }

export interface ShiftSummary {
  badgeId: string
  totalMinutes: number
  shiftCount: number
  overtimeMinutes: number // minutes beyond 8 h per shift
  currentlyIn: boolean
  lastPunchAt: string | null
}

interface TimecardState {
  punches: TimecardPunch[]
  isLoading: boolean
  isPunching: boolean
  error: string | null
  punchError: string | null
  punchSuccess: string | null

  // Actions
  fetchAll: (badgeId?: string) => Promise<void>
  punch: (badgeId: string, kioskId?: string) => Promise<void>
  clearMessages: () => void

  // Derived selectors
  getStatusForBadge: (badgeId: string) => 'in' | 'out' | 'unknown'
  getShiftSummaries: () => ShiftSummary[]
  getPunchesForBadge: (badgeId: string) => TimecardPunch[]
}

function calcShiftSummaries(punches: TimecardPunch[]): ShiftSummary[] {
  // Group by badge_id
  const byBadge: Record<string, TimecardPunch[]> = {}
  for (const p of punches) {
    if (!byBadge[p.badge_id]) byBadge[p.badge_id] = []
    byBadge[p.badge_id].push(p)
  }

  const summaries: ShiftSummary[] = []

  for (const [badgeId, bPunches] of Object.entries(byBadge)) {
    // Sort ascending to pair in→out
    const sorted = [...bPunches].sort(
      (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime()
    )

    let totalMinutes = 0
    let overtimeMinutes = 0
    let shiftCount = 0
    let pendingIn: Date | null = null

    for (const p of sorted) {
      if (p.operation === 'In') {
        pendingIn = new Date(p.punched_at)
      } else if (p.operation === 'Out' && pendingIn) {
        const outTime = new Date(p.punched_at)
        const mins = Math.round((outTime.getTime() - pendingIn.getTime()) / 60000)
        if (mins > 0) {
          totalMinutes += mins
          overtimeMinutes += Math.max(0, mins - 480) // >8 h = overtime
          shiftCount += 1
        }
        pendingIn = null
      }
    }

    const last = sorted[sorted.length - 1]
    const currentlyIn = last?.operation === 'In'
    const lastPunchAt = last?.punched_at ?? null

    summaries.push({
      badgeId,
      totalMinutes,
      shiftCount,
      overtimeMinutes,
      currentlyIn,
      lastPunchAt,
    })
  }

  // Sort: currently-in first, then by last punch desc
  summaries.sort((a, b) => {
    if (a.currentlyIn !== b.currentlyIn) return a.currentlyIn ? -1 : 1
    return (b.lastPunchAt ?? '').localeCompare(a.lastPunchAt ?? '')
  })

  return summaries
}

export const useTimecardStore = create<TimecardState>((set, get) => ({
  punches: [],
  isLoading: false,
  isPunching: false,
  error: null,
  punchError: null,
  punchSuccess: null,

  fetchAll: async (badgeId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const data = await fetchPunches(badgeId, 500)
      set({ punches: data, isLoading: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load punches'
      set({ error: msg, isLoading: false })
    }
  },

  punch: async (badgeId: string, kioskId = 'Main Terminal') => {
    if (!badgeId.trim()) {
      set({ punchError: 'Please enter a Badge ID.', punchSuccess: null })
      return
    }
    set({ isPunching: true, punchError: null, punchSuccess: null })
    try {
      // Determine correct operation from last punch
      const last = await getLastPunch(badgeId)
      const operation: 'In' | 'Out' = last?.operation === 'In' ? 'Out' : 'In'

      const newPunch = await insertPunch(badgeId, operation, kioskId)

      // Optimistic prepend to local cache
      set(s => ({
        punches: [newPunch, ...s.punches],
        isPunching: false,
        punchSuccess: `Badge #${badgeId} clocked ${operation.toUpperCase()} at ${new Date(newPunch.punched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        punchError: null,
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Punch failed'
      set({ punchError: msg, isPunching: false, punchSuccess: null })
    }
  },

  clearMessages: () => set({ punchError: null, punchSuccess: null }),

  getStatusForBadge: (badgeId: string) => {
    const { punches } = get()
    const badge = punches
      .filter(p => p.badge_id === badgeId)
      .sort((a, b) => new Date(b.punched_at).getTime() - new Date(a.punched_at).getTime())
    if (!badge.length) return 'unknown'
    return badge[0].operation === 'In' ? 'in' : 'out'
  },

  getShiftSummaries: () => calcShiftSummaries(get().punches),

  getPunchesForBadge: (badgeId: string) =>
    get().punches.filter(p => p.badge_id === badgeId),
}))
