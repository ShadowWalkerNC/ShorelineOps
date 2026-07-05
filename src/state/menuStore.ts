import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { DayMenu, DayOfWeek, MenuWeek as CanonicalMenuWeek } from '@/types/menu'

export type { DayMenu, DayOfWeek }

// MenuItem must include textureModified to match src/types/menu.ts MenuItem
export interface MenuItem {
  id: string
  name: string
  category?: string | null
  textureModified: boolean
  mealCategory?: string
  dietaryTags?: string[]
  recipeId?: string
  notes?: string
}

export type MenuWeek = CanonicalMenuWeek

export interface MenuState {
  weeks:          MenuWeek[]
  items:          MenuItem[]
  selectedWeekId: string | null
  loading:  boolean
  error:    string | null
  // week actions
  fetchWeeks:       () => Promise<void>
  addWeek:          (label: string) => Promise<MenuWeek>
  updateWeek:       (id: string, patch: Partial<Pick<MenuWeek, 'name' | 'active' | 'days'>>) => Promise<void>
  updateMealEntry:  (weekId: string, day: DayOfWeek, slot: string, itemIds: string[]) => Promise<void>
  setActiveWeek:    (id: string) => Promise<void>
  selectWeek:       (id: string | null) => void
  removeWeek:       (id: string) => Promise<void>
  deleteWeek:       (id: string) => Promise<void>
  // item actions
  fetchItems:  () => Promise<void>
  addItem:     (data: Omit<MenuItem, 'id'> | string) => Promise<MenuItem>
  updateItem:  (id: string, patch: Partial<MenuItem>) => Promise<void>
  removeItem:  (id: string) => Promise<void>
  deleteItem:  (id: string) => Promise<void>
}

function rowToWeek(row: Record<string, unknown>): MenuWeek {
  return {
    id:        row.id        as string,
    name:      ((row.label ?? row.name ?? '') as string),
    active:    Boolean(row.active),
    days:      ((row.days ?? {}) as Record<DayOfWeek, DayMenu>),
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
  }
}

function rowToItem(row: Record<string, unknown>): MenuItem {
  return {
    id:              row.id   as string,
    name:            row.name as string,
    category:        (row.category as string | null) ?? null,
    textureModified: Boolean(row.texture_modified ?? false),
    mealCategory:    (row.meal_category as string | undefined) ?? undefined,
    dietaryTags:     (row.dietary_tags  as string[] | undefined) ?? undefined,
    recipeId:        (row.recipe_id     as string | undefined) ?? undefined,
    notes:           (row.notes         as string | undefined) ?? undefined,
  }
}

export const useMenuStore = create<MenuState>((set, get) => ({
  weeks: [], items: [], selectedWeekId: null, loading: false, error: null,

  fetchWeeks: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase.from('menu_weeks').select('*').order('created_at')
    if (error) { set({ error: error.message, loading: false }); return }
    set({ weeks: (data ?? []).map(w => rowToWeek(w as Record<string, unknown>)), loading: false })
  },

  addWeek: async (label) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('menu_weeks') as any)
      .insert({ label, active: false, days: {} })
      .select().single()
    if (error) throw new Error(error.message)
    const week = rowToWeek(data as Record<string, unknown>)
    set(s => ({ weeks: [...s.weeks, week] }))
    return week
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

  updateMealEntry: async (weekId, day, slot, itemIds) => {
    const week = get().weeks.find(w => w.id === weekId)
    if (!week) return
    const days = {
      ...week.days,
      [day]: { ...(week.days[day] ?? {}), [slot]: { itemIds } },
    }
    await get().updateWeek(weekId, { days: days as Record<DayOfWeek, DayMenu> })
  },

  setActiveWeek: async (id) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('menu_weeks') as any).update({ active: false }).neq('id', id)
    await get().updateWeek(id, { active: true })
    set(s => ({ weeks: s.weeks.map(w => ({ ...w, active: w.id === id })) }))
  },

  selectWeek: (id) => set({ selectedWeekId: id }),

  removeWeek: async (id) => {
    const { error } = await supabase.from('menu_weeks').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ weeks: s.weeks.filter(w => w.id !== id) }))
  },
  deleteWeek: async (id) => get().removeWeek(id),

  fetchItems: async () => {
    const { data, error } = await supabase.from('menu_items').select('*').order('name')
    if (error) { set({ error: error.message }); return }
    set({ items: (data ?? []).map(r => rowToItem(r as Record<string, unknown>)) })
  },

  addItem: async (data) => {
    const isString = typeof data === 'string'
    const name     = isString ? data : data.name
    const row: Record<string, unknown> = {
      name,
      texture_modified: isString ? false : (data.textureModified ?? false),
      ...((!isString && data.category)    && { category:     data.category }),
      ...((!isString && data.mealCategory) && { meal_category: data.mealCategory }),
      ...((!isString && data.dietaryTags)  && { dietary_tags:  data.dietaryTags }),
      ...((!isString && data.recipeId)     && { recipe_id:     data.recipeId }),
      ...((!isString && data.notes)        && { notes:         data.notes }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('menu_items') as any).insert(row).select().single()
    if (error) throw new Error(error.message)
    const item = rowToItem(r as Record<string, unknown>)
    set(s => ({ items: [...s.items, item].sort((a, b) => a.name.localeCompare(b.name)) }))
    return item
  },

  updateItem: async (id, patch) => {
    const update: Record<string, unknown> = {}
    if (patch.name            !== undefined) update.name             = patch.name
    if (patch.category        !== undefined) update.category         = patch.category
    if (patch.textureModified !== undefined) update.texture_modified = patch.textureModified
    if (patch.mealCategory    !== undefined) update.meal_category    = patch.mealCategory
    if (patch.dietaryTags     !== undefined) update.dietary_tags     = patch.dietaryTags
    if (patch.recipeId        !== undefined) update.recipe_id        = patch.recipeId
    if (patch.notes           !== undefined) update.notes            = patch.notes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('menu_items') as any)
      .update(update).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ items: s.items.map(i => i.id === id ? rowToItem(data as Record<string, unknown>) : i) }))
  },

  removeItem: async (id) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ items: s.items.filter(i => i.id !== id) }))
  },
  deleteItem: async (id) => get().removeItem(id),
}))
