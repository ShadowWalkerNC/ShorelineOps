import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export interface MenuItem {
  id: string
  name: string
  category?: string | null
}

export interface MenuWeek {
  id: string
  label: string
  active: boolean
  days: Record<string, unknown>
}

type MenuInsert = Database['public']['Tables']['menu_weeks']['Insert']
type MenuItemInsert = Database['public']['Tables']['menu_items']['Insert']

type MenuState = {
  weeks: MenuWeek[]
  items: MenuItem[]
  loading: boolean
  error: string | null
  fetchWeeks: () => Promise<void>
  fetchItems: () => Promise<void>
  addWeek: (label: string) => Promise<void>
  updateWeek: (id: string, patch: Partial<MenuWeek>) => Promise<void>
  setActiveWeek: (id: string) => Promise<void>
  removeWeek: (id: string) => Promise<void>
  addItem: (name: string, category?: string) => Promise<void>
  updateItem: (id: string, patch: Partial<MenuItem>) => Promise<void>
  removeItem: (id: string) => Promise<void>
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
    set({ weeks: (data ?? []).map(w => ({ ...w, days: (w.days ?? {}) as Record<string, unknown> })) as MenuWeek[], loading: false })
  },

  fetchItems: async () => {
    const { data, error } = await supabase.from('menu_items').select('*').order('name')
    if (error) { set({ error: error.message }); return }
    set({ items: (data ?? []) as MenuItem[] })
  },

  addWeek: async (label) => {
    const insert: MenuInsert = { label, active: false, days: {} }
    const { data, error } = await supabase.from('menu_weeks').insert(insert).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ weeks: [...s.weeks, { ...data, days: (data.days ?? {}) as Record<string, unknown> } as MenuWeek] }))
  },

  updateWeek: async (id, patch) => {
    const update: Database['public']['Tables']['menu_weeks']['Update'] = {
      ...(patch.label  !== undefined && { label:  patch.label }),
      ...(patch.active !== undefined && { active: patch.active }),
      ...(patch.days   !== undefined && { days:   patch.days as import('@/lib/database.types').Json }),
    }
    const { data, error } = await supabase.from('menu_weeks').update(update).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ weeks: s.weeks.map(w => w.id === id ? { ...data, days: (data.days ?? {}) as Record<string, unknown> } as MenuWeek : w) }))
  },

  setActiveWeek: async (id) => {
    await supabase.from('menu_weeks').update({ active: false } as Database['public']['Tables']['menu_weeks']['Update']).neq('id', id)
    await get().updateWeek(id, { active: true })
    set(s => ({ weeks: s.weeks.map(w => ({ ...w, active: w.id === id })) }))
  },

  removeWeek: async (id) => {
    const { error } = await supabase.from('menu_weeks').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ weeks: s.weeks.filter(w => w.id !== id) }))
  },

  addItem: async (name, category) => {
    const insert: MenuItemInsert = { name, ...(category && { category }) }
    const { data, error } = await supabase.from('menu_items').insert(insert).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ items: [...s.items, data as MenuItem].sort((a, b) => a.name.localeCompare(b.name)) }))
  },

  updateItem: async (id, patch) => {
    const update: Database['public']['Tables']['menu_items']['Update'] = {
      ...(patch.name     !== undefined && { name:     patch.name }),
      ...(patch.category !== undefined && { category: patch.category }),
    }
    const { data, error } = await supabase.from('menu_items').update(update).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ items: s.items.map(i => i.id === id ? data as MenuItem : i) }))
  },

  removeItem: async (id) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ items: s.items.filter(i => i.id !== id) }))
  },
}))
