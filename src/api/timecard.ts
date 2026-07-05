// ============================================================
// TIMECARD API — local branch (localStorage only)
// ============================================================
import { ls, LS_KEYS } from '@/lib/localStorage'

export interface TimecardPunch {
  id: string
  badge_id: string
  operation: 'In' | 'Out'
  kiosk_id: string
  punched_at: string
  created_at: string
  notes?: string | null
}

export async function fetchPunches(badgeId?: string, limit = 200): Promise<TimecardPunch[]> {
  let punches = ls.get<TimecardPunch[]>(LS_KEYS.timePunches, [])
  if (badgeId) punches = punches.filter(p => p.badge_id === badgeId)
  return punches
    .sort((a, b) => b.punched_at.localeCompare(a.punched_at))
    .slice(0, limit)
}

export async function insertPunch(
  badgeId: string,
  operation: 'In' | 'Out',
  kioskId = 'Main Terminal',
  notes?: string
): Promise<TimecardPunch> {
  const punch: TimecardPunch = {
    id:         crypto.randomUUID(),
    badge_id:   badgeId,
    operation,
    kiosk_id:   kioskId,
    punched_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    notes:      notes ?? null,
  }
  const all = [punch, ...ls.get<TimecardPunch[]>(LS_KEYS.timePunches, [])]
  ls.set(LS_KEYS.timePunches, all)
  return punch
}

export async function getLastPunch(badgeId: string): Promise<TimecardPunch | null> {
  const punches = ls.get<TimecardPunch[]>(LS_KEYS.timePunches, [])
    .filter(p => p.badge_id === badgeId)
    .sort((a, b) => b.punched_at.localeCompare(a.punched_at))
  return punches[0] ?? null
}
