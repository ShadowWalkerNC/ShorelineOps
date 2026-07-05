import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { DayMenu, DayOfWeek, MenuWeek as CanonicalMenuWeek } from '@/types/menu'

// Re-export the canonical types so consumers can import from here if needed
export type { DayMenu, DayOfWeek }

export interface MenuItem {
  id: string
  name: string
  category?: string | null
}

// Use the canonical MenuWeek shape — 'name' field, days typed as Record<DayOfWeek, DayMenu>
export type MenuWeek = CanonicalMenuWeek

type MenuState = {
  weeks: MenuWeek[]
  items: MenuItem[]
  loading: boolean
  error: string | null
  fetchWeeks: () => Promise<void>
  fetchItems: () => Promise<void>
  addWeek: (label: string) => Promise<void>
  updateWeek: (id: string, patch: Partial<Pick<MenuWeek, 'name' | 'active' | 'days'>>) => Promise<void>
  setActiveWeek: (id: string) => Promise<void>
  removeWeek: (id: string) => Promise<void>
  addItem: (name: string, category?: string) => Promise<void>
  updateItem: (id: string, patch: Partial<MenuItem>) => Promise<void>
  removeItem: (id: string) => Promise<void>
}

function rowToWeek(row: Record<string, unknown>): MenuWeek {
  return {
    id:          row.id as string,
    name:        (row.label ?? row.name ?? '') as string,
    active:      Boolean(row.active),
    days:        ((row.days ?? {}) as Record<DayOfWeek, DayMenu>),
    createdAt:   row.created_at as string,
    updatedAt:   row.updated_at as string,
  }
}

export const useMenuStore = create<MenuState>((set, get) => ({
  weeks: [],
  items: [],
  loading: false,
  error: null,

  fetchWeeks: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase.from('menu_weeks').select('*').order('created_at')
    if (error) { set({ error: error.message, loading: false }); return }
    set({ weeks: (data ?? []).map(w => rowToWeek(w as Record<string, unknown>)), loading: false })
  },

  fetchItems: async () => {
    const { data, error } = await supabase.from('menu_items').select('*').order('name')
    if (error) { set({ error: error.message }); return }
    set({ items: (data ?? []) as MenuItem[] })
  },

  addWeek: async (label) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('menu_weeks') as any)
      .insert({ label, active: false, days: {} })
      .select().single()
    if (error) throw new Error(error.message)
    set(s => ({ weeks: [...s.weeks, rowToWeek(data as Record<string, unknown>)] }))
  },

  updateWeek: async (id, patch) => {
    const update: Record<string, unknown> = {}
    if (patch.name   !== undefined) update.label  = patch.name
    if (patch.active !== undefined) update.active = patch.active
    if (patch.days   !== undefined) update.days   = patch.days
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('menu_weeks') as any)
      .update(update).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ weeks: s.weeks.map(w => w.id === id ? rowToWeek(data as Record<string, unknown>) : w) }))
  },

  setActiveWeek: async (id) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('menu_weeks') as any).update({ active: false }).neq('id', id)
    await get().updateWeek(id, { active: true })
    set(s => ({ weeks: s.weeks.map(w => ({ ...w, active: w.id === id })) }))
  },

  removeWeek: async (id) => {
    const { error } = await supabase.from('menu_weeks').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ weeks: s.weeks.filter(w => w.id !== id) }))
  },

  addItem: async (name, category) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('menu_items') as any)
      .insert({ name, ...(category && { category }) })
      .select().single()
    if (error) throw new Error(error.message)
    set(s => ({ items: [...s.items, data as MenuItem].sort((a, b) => a.name.localeCompare(b.name)) }))
  },

  updateItem: async (id, patch) => {
    const update: Record<string, unknown> = {}
    if (patch.name     !== undefined) update.name     = patch.name
    if (patch.category !== undefined) update.category = patch.category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('menu_items') as any)
      .update(update).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ items: s.items.map(i => i.id === id ? data as MenuItem : i) }))
  },

  removeItem: async (id) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ items: s.items.filter(i => i.id !== id) }))
  },
}))
