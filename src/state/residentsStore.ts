import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Resident } from '@/types'

// Map Supabase snake_case row → app camelCase Resident
function toResident(row: Record<string, unknown>): Resident {
  return {
    id:              row.id as string,
    name:            row.name as string,
    room:            row.room as string,
    status:          (row.status as string) ?? 'Active',
    dietType:        (row.diet_type as string | undefined) ?? undefined,
    texture:         (row.texture as string | undefined) ?? undefined,
    allergies:       (row.allergies as string[] | undefined) ?? [],
    servingLocation: (row.serving_location as string | undefined) ?? undefined,
    ensurePerDay:    (row.ensure_per_day as number | undefined) ?? 0,
    birthdayMonth:   (row.birthday_month as string | undefined) ?? undefined,
    birthdayDay:     (row.birthday_day as number | undefined) ?? undefined,
    notes:           (row.notes as string | undefined) ?? undefined,
  } as Resident
}

// Map app camelCase → Supabase snake_case for inserts/updates
function toRow(data: Partial<Resident>) {
  return {
    ...(data.name            !== undefined && { name:             data.name }),
    ...(data.room            !== undefined && { room:             data.room }),
    ...(data.status          !== undefined && { status:           data.status }),
    ...(data.dietType        !== undefined && { diet_type:        data.dietType }),
    ...(data.texture         !== undefined && { texture:          data.texture }),
    ...(data.allergies       !== undefined && { allergies:        data.allergies }),
    ...(data.servingLocation !== undefined && { serving_location: data.servingLocation }),
    ...(data.ensurePerDay    !== undefined && { ensure_per_day:   data.ensurePerDay }),
    ...(data.birthdayMonth   !== undefined && { birthday_month:   data.birthdayMonth }),
    ...(data.birthdayDay     !== undefined && { birthday_day:     data.birthdayDay }),
    ...(data.notes           !== undefined && { notes:            data.notes }),
  }
}

type ResidentsState = {
  residents: Resident[]
  loading: boolean
  error: string | null
  fetch: (search?: string) => Promise<void>
  add: (data: Omit<Resident, 'id'>) => Promise<void>
  update: (id: string, data: Partial<Resident>) => Promise<void>
  upsert: (id: string | null, data: Omit<Resident, 'id'>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useResidentsStore = create<ResidentsState>((set, get) => ({
  residents: [],
  loading: false,
  error: null,

  fetch: async (search) => {
    set({ loading: true, error: null })
    try {
      let q = supabase.from('residents').select('*').order('name')
      if (search) q = q.or(`name.ilike.%${search}%,room.ilike.%${search}%`)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      set({ residents: (data ?? []).map(toResident), loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  add: async (data) => {
    const { data: row, error } = await supabase
      .from('residents').insert(toRow(data as Partial<Resident>)).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ residents: [...s.residents, toResident(row as Record<string, unknown>)] }))
  },

  update: async (id, data) => {
    const { data: row, error } = await supabase
      .from('residents').update(toRow(data)).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ residents: s.residents.map(r => r.id === id ? toResident(row as Record<string, unknown>) : r) }))
  },

  upsert: async (id, data) => {
    if (id) await get().update(id, data)
    else    await get().add(data)
  },

  remove: async (id) => {
    const { error } = await supabase.from('residents').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ residents: s.residents.filter(r => r.id !== id) }))
  },
}))
