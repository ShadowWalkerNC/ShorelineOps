import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Resident } from '@/types'

function toResident(row: Record<string, unknown>): Resident {
  return {
    id:                  row.id as string,
    name:                row.name as string,
    room:                row.room as string,
    status:              ((row.status as string) ?? 'Active') as Resident['status'],
    dietType:            ((row.diet_type as string) ?? 'Regular') as Resident['dietType'],
    texture:             ((row.texture as string) ?? 'Regular') as Resident['texture'],
    portionSize:         ((row.portion_size as string) ?? 'Regular') as Resident['portionSize'],
    ensurePerDay:        Number(row.ensure_per_day ?? 0),
    allergies:           (row.allergies as string[] | null) ?? [],
    beverages:           (row.beverages as string[] | null) ?? [],
    birthdayMonth:       (row.birthday_month as string) ?? '',
    birthdayDay:         (row.birthday_day as number | null) ?? null,
    servingLocation:     ((row.serving_location as string) ?? 'Dining Room') as Resident['servingLocation'],
    tableAssignment:     (row.table_assignment as string) ?? '',
    likes:               (row.likes as string) ?? '',
    dislikes:            (row.dislikes as string) ?? '',
    specialInstructions: (row.special_instructions as string) ?? '',
  }
}

function toRow(data: Partial<Resident>): Record<string, unknown> {
  const r: Record<string, unknown> = {}
  if (data.name                !== undefined) r.name                 = data.name
  if (data.room                !== undefined) r.room                 = data.room
  if (data.status              !== undefined) r.status               = data.status
  if (data.dietType            !== undefined) r.diet_type            = data.dietType
  if (data.texture             !== undefined) r.texture              = data.texture
  if (data.portionSize         !== undefined) r.portion_size         = data.portionSize
  if (data.ensurePerDay        !== undefined) r.ensure_per_day       = data.ensurePerDay
  if (data.allergies           !== undefined) r.allergies            = data.allergies
  if (data.beverages           !== undefined) r.beverages            = data.beverages
  if (data.birthdayMonth       !== undefined) r.birthday_month       = data.birthdayMonth
  if (data.birthdayDay         !== undefined) r.birthday_day         = data.birthdayDay
  if (data.servingLocation     !== undefined) r.serving_location     = data.servingLocation
  if (data.tableAssignment     !== undefined) r.table_assignment     = data.tableAssignment
  if (data.likes               !== undefined) r.likes                = data.likes
  if (data.dislikes            !== undefined) r.dislikes             = data.dislikes
  if (data.specialInstructions !== undefined) r.special_instructions = data.specialInstructions
  return r
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
      set({ residents: (data ?? []).map((r: any) => toResident(r as Record<string, unknown>)), loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  add: async (data) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase.from('residents') as any)
      .insert(toRow(data as Partial<Resident>)).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ residents: [...s.residents, toResident(row as Record<string, unknown>)] }))
  },

  update: async (id, data) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase.from('residents') as any)
      .update(toRow(data)).eq('id', id).select().single()
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
