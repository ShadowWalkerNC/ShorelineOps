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

function toRow(data: Partial<Resident>) {
  return {
    ...(data.name                !== undefined && { name:                 data.name }),
    ...(data.room                !== undefined && { room:                 data.room }),
    ...(data.status              !== undefined && { status:               data.status }),
    ...(data.dietType            !== undefined && { diet_type:            data.dietType }),
    ...(data.texture             !== undefined && { texture:              data.texture }),
    ...(data.portionSize         !== undefined && { portion_size:         data.portionSize }),
    ...(data.ensurePerDay        !== undefined && { ensure_per_day:       data.ensurePerDay }),
    ...(data.allergies           !== undefined && { allergies:            data.allergies }),
    ...(data.beverages           !== undefined && { beverages:            data.beverages }),
    ...(data.birthdayMonth       !== undefined && { birthday_month:       data.birthdayMonth }),
    ...(data.birthdayDay         !== undefined && { birthday_day:         data.birthdayDay }),
    ...(data.servingLocation     !== undefined && { serving_location:     data.servingLocation }),
    ...(data.tableAssignment     !== undefined && { table_assignment:     data.tableAssignment }),
    ...(data.likes               !== undefined && { likes:                data.likes }),
    ...(data.dislikes            !== undefined && { dislikes:             data.dislikes }),
    ...(data.specialInstructions !== undefined && { special_instructions: data.specialInstructions }),
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
      set({ residents: (data ?? []).map(r => toResident(r as Record<string, unknown>)), loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  add: async (data) => {
    const { data: row, error } = await supabase
      .from('residents')
      .insert(toRow(data as Partial<Resident>) as Parameters<typeof supabase.from<'residents', any>>[0])
      .select().single()
    if (error) throw new Error(error.message)
    set(s => ({ residents: [...s.residents, toResident(row as Record<string, unknown>)] }))
  },

  update: async (id, data) => {
    const { data: row, error } = await supabase
      .from('residents')
      .update(toRow(data) as Parameters<typeof supabase.from<'residents', any>>[0])
      .eq('id', id).select().single()
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
