import { api } from '@/api/client'
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

const isDemo = import.meta.env.VITE_DEMO_MODE === 'true'

export async function fetchPunches(badgeId?: string, limit = 200): Promise<TimecardPunch[]> {
  if (!isDemo) {
    try {
      const query = `?limit=${limit}${badgeId ? `&badge_id=${encodeURIComponent(badgeId)}` : ''}`
      const res = await api.get('/timecard' + query)
      if (Array.isArray(res.data)) {
        return res.data as TimecardPunch[]
      }
    } catch (err: any) {
      console.warn('[timecard] Live API fetch failed, falling back to local adapter:', err?.message)
    }
  }
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
  if (!isDemo) {
    try {
      const res = await api.post('/timecard/punch', {
        badge_id: badgeId,
        operation,
        kiosk_id: kioskId,
        notes,
      })
      if (res.data?.id) {
        return res.data as TimecardPunch
      }
    } catch (err: any) {
      console.warn('[timecard] Live API punch failed, falling back to local adapter:', err?.message)
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('time_punches') as any)
    .insert({ badge_id: badgeId, operation, kiosk_id: kioskId, punched_at: new Date().toISOString(), notes })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as TimecardPunch
}

export async function getLastPunch(badgeId: string): Promise<TimecardPunch | null> {
  if (!isDemo) {
    try {
      const res = await api.get(`/timecard/last-punch/${encodeURIComponent(badgeId)}`)
      if (res.data) {
        return res.data as TimecardPunch
      }
    } catch (err: any) {
      console.warn('[timecard] Live API getLastPunch failed, falling back to local adapter:', err?.message)
    }
  }
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
