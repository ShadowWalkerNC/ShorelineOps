import { api } from './client'

export interface TimecardPunch {
  id: string;
  badge_id: string;
  operation: string;
  kiosk_id: string;
  punched_at: string;
  created_at: string;
}

export async function fetchPunches(): Promise<TimecardPunch[]> {
  const { data } = await api.get<TimecardPunch[]>('/timecard')
  return data
}
