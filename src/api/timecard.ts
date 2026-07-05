import { supabase } from '@/lib/supabase'

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
  let q = supabase
    .from('time_punches')
    .select('*')
    .order('punched_at', { ascending: false })
    .limit(limit)
  if (badgeId) q = q.eq('badge_id', badgeId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as TimecardPunch[]
}

export async function insertPunch(
  badgeId: string,
  operation: 'In' | 'Out',
  kioskId = 'Main Terminal',
  notes?: string
): Promise<TimecardPunch> {
  const { data, error } = await supabase
    .from('time_punches')
    .insert({ badge_id: badgeId, operation, kiosk_id: kioskId, punched_at: new Date().toISOString(), notes })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as TimecardPunch
}

export async function getLastPunch(badgeId: string): Promise<TimecardPunch | null> {
  const { data, error } = await supabase
    .from('time_punches')
    .select('*')
    .eq('badge_id', badgeId)
    .order('punched_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as TimecardPunch | null
}
