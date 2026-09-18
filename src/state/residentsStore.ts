import { create } from 'zustand'
import { api } from '@/api/client'
import { supabase } from '@/lib/supabase'
import type { Resident } from '@/types'

function toResident(row: Record<string, unknown>): Resident {
  return {
    id:                  row.id as string,
    name:                row.name as string,
    room:                row.room as string,
    status:              ((row.status as string) ?? 'Active') as Resident['status'],
    dietType:            ((row.diet_type ?? row.dietType ?? 'Regular') as string) as Resident['dietType'],
    texture:             ((row.texture as string) ?? 'Regular') as Resident['texture'],
    portionSize:         ((row.portion_size ?? row.portionSize ?? 'Regular') as string) as Resident['portionSize'],
    ensurePerDay:        Number(row.ensure_per_day ?? row.ensurePerDay ?? 0),
    allergies:           (row.allergies as string[] | null) ?? [],
    beverages:           (row.beverages as string[] | null) ?? [],
    birthdayMonth:       ((row.birthday_month ?? row.birthdayMonth ?? '') as string),
    birthdayDay:         (row.birthday_day ?? row.birthdayDay ?? null) as number | null,
    servingLocation:     (((row.serving_location ?? row.servingLocation ?? 'Dining Room') as string) as Resident['servingLocation']),
    tableAssignment:     ((row.table_assignment ?? row.tableAssignment ?? '') as string),
    likes:               (row.likes as string) ?? '',
    dislikes:            (row.dislikes as string) ?? '',
    specialInstructions: ((row.special_instructions ?? row.specialInstructions ?? '') as string),
    // B02: clinical fields — accept both the DB snake_case rows and the
    // /api/residents camelCase payload so every client gets typed values.
    is_npo:              Boolean(row.is_npo ?? row.isNpo ?? false),
    npo_reason:          (row.npo_reason ?? row.npoReason ?? '') as string,
    fluid_restriction_ml:(row.fluid_restriction_ml ?? row.fluidRestrictionMl ?? null) as number | null,
    fluidConsistency:    (row.fluid_consistency ?? row.fluidConsistency ?? '') as string,
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
  // B04: NPO fields are dietitian/manager-settable through the profile.
  if (data.is_npo              !== undefined) r.is_npo               = data.is_npo
  if (data.npo_reason          !== undefined) r.npo_reason           = data.npo_reason
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

const isDemo = import.meta.env.VITE_DEMO_MODE === 'true'

export const useResidentsStore = create<ResidentsState>((set, get) => ({
  residents: [],
  loading: false,
  error: null,

  fetch: async (search) => {
    set({ loading: true, error: null })
    if (!isDemo) {
      try {
        const query = search ? `?q=${encodeURIComponent(search)}` : ''
        const res = await api.get('/residents' + query)
        if (Array.isArray(res.data)) {
          set({ residents: res.data.map((r: any) => toResident(r)), loading: false })
          return
        }
      } catch (err: any) {
        console.warn('[residentsStore] Live API fetch failed, falling back to local adapter:', err?.message)
      }
    }
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
    if (!isDemo) {
      try {
        const res = await api.post('/residents', {
          name: data.name,
          room: data.room,
          status: data.status,
          dietType: data.dietType,
          texture: data.texture,
          portionSize: data.portionSize,
          ensurePerDay: data.ensurePerDay,
          allergies: data.allergies,
          beverages: data.beverages,
          birthdayMonth: data.birthdayMonth,
          birthdayDay: data.birthdayDay,
          servingLocation: data.servingLocation,
          tableAssignment: data.tableAssignment,
          likes: data.likes,
          dislikes: data.dislikes,
          specialInstructions: data.specialInstructions,
          isNpo: data.is_npo,
          npoReason: data.npo_reason,
        })
        if (res.data?.id) {
          const newResident = toResident(res.data)
          set(s => ({ residents: [...s.residents, newResident] }))
          return
        }
      } catch (err: any) {
        console.warn('[residentsStore] Live API add failed, falling back to local adapter:', err?.message)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase.from('residents') as any)
      .insert(toRow(data as Partial<Resident>)).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ residents: [...s.residents, toResident(row as Record<string, unknown>)] }))
  },

  update: async (id, data) => {
    if (!isDemo) {
      try {
        const res = await api.put(`/residents/${id}`, {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.room !== undefined && { room: data.room }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.dietType !== undefined && { dietType: data.dietType }),
          ...(data.texture !== undefined && { texture: data.texture }),
          ...(data.portionSize !== undefined && { portionSize: data.portionSize }),
          ...(data.ensurePerDay !== undefined && { ensurePerDay: data.ensurePerDay }),
          ...(data.allergies !== undefined && { allergies: data.allergies }),
          ...(data.beverages !== undefined && { beverages: data.beverages }),
          ...(data.birthdayMonth !== undefined && { birthdayMonth: data.birthdayMonth }),
          ...(data.birthdayDay !== undefined && { birthdayDay: data.birthdayDay }),
          ...(data.servingLocation !== undefined && { servingLocation: data.servingLocation }),
          ...(data.tableAssignment !== undefined && { tableAssignment: data.tableAssignment }),
          ...(data.likes !== undefined && { likes: data.likes }),
          ...(data.dislikes !== undefined && { dislikes: data.dislikes }),
          ...(data.specialInstructions !== undefined && { specialInstructions: data.specialInstructions }),
          ...(data.is_npo !== undefined && { isNpo: data.is_npo }),
          ...(data.npo_reason !== undefined && { npoReason: data.npo_reason }),
        })
        if (res.data?.id) {
          const updated = toResident(res.data)
          set(s => ({ residents: s.residents.map(r => r.id === id ? updated : r) }))
          return
        }
      } catch (err: any) {
        console.warn('[residentsStore] Live API update failed, falling back to local adapter:', err?.message)
      }
    }
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
    if (!isDemo) {
      try {
        await api.delete(`/residents/${id}`)
        set(s => ({ residents: s.residents.filter(r => r.id !== id) }))
        return
      } catch (err: any) {
        console.warn('[residentsStore] Live API remove failed, falling back to local adapter:', err?.message)
      }
    }
    const { error } = await supabase.from('residents').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ residents: s.residents.filter(r => r.id !== id) }))
  },
}))

