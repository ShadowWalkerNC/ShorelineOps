import { create } from 'zustand'
import { ls, LS_KEYS } from '@/lib/localStorage'
import type { DayMenu, DayOfWeek, MenuWeek as CanonicalMenuWeek } from '@/types/menu'

export type { DayMenu, DayOfWeek }

export type ItemMealCategory = 'All' | 'Breakfast' | 'Lunch' | 'Dinner' | 'Dessert'
export type DietaryTag =
  | 'Gluten-Free' | 'Dairy-Free' | 'Nut-Free' | 'Egg-Free'
  | 'Vegan' | 'Vegetarian' | 'Low-Sodium' | 'Diabetic-Friendly'

export interface MenuItem {
  id: string
  name: string
  category?: string | null
  textureModified: boolean
  mealCategory?: ItemMealCategory
  dietaryTags?: DietaryTag[]
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
  fetchWeeks:       () => Promise<void>
  addWeek:          (label: string) => Promise<MenuWeek>
  updateWeek:       (id: string, patch: Partial<Pick<MenuWeek, 'name' | 'active' | 'days'>>) => Promise<void>
  updateMealEntry:  (weekId: string, day: DayOfWeek, slot: string, itemIds: string[]) => Promise<void>
  setActiveWeek:    (id: string) => Promise<void>
  selectWeek:       (id: string | null) => void
  removeWeek:       (id: string) => Promise<void>
  deleteWeek:       (id: string) => Promise<void>
  fetchItems:  () => Promise<void>
  addItem:     (data: Omit<MenuItem, 'id'> | string) => Promise<MenuItem>
  updateItem:  (id: string, patch: Partial<MenuItem>) => Promise<void>
  removeItem:  (id: string) => Promise<void>
  deleteItem:  (id: string) => Promise<void>
}

function uid() { return crypto.randomUUID() }
function now() { return new Date().toISOString() }

export const useMenuStore = create<MenuState>((set, get) => ({
  weeks:          ls.get<MenuWeek[]>(LS_KEYS.menuWeeks, []),
  items:          ls.get<MenuItem[]>(LS_KEYS.menuItems, []),
  selectedWeekId: null,
  loading: false,
  error: null,

  fetchWeeks: async () => {
    set({ loading: true, error: null })
    const weeks = [...ls.get<MenuWeek[]>(LS_KEYS.menuWeeks, [])]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    set({ weeks, loading: false })
  },

  addWeek: async (label) => {
    const week: MenuWeek = {
      id: uid(), name: label, active: false,
      days: {} as Record<DayOfWeek, DayMenu>,
      createdAt: now(), updatedAt: now(),
    }
    const all = [...ls.get<MenuWeek[]>(LS_KEYS.menuWeeks, []), week]
    ls.set(LS_KEYS.menuWeeks, all)
    set(s => ({ weeks: [...s.weeks, week] }))
    return week
  },

  updateWeek: async (id, patch) => {
    const all = ls.get<MenuWeek[]>(LS_KEYS.menuWeeks, []).map(w =>
      w.id === id ? {
        ...w,
        ...(patch.name   !== undefined && { name:   patch.name }),
        ...(patch.active !== undefined && { active: patch.active }),
        ...(patch.days   !== undefined && { days:   patch.days }),
        updatedAt: now(),
      } : w
    )
    ls.set(LS_KEYS.menuWeeks, all)
    set({ weeks: all })
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
    const all = ls.get<MenuWeek[]>(LS_KEYS.menuWeeks, []).map(w => ({
      ...w, active: w.id === id, updatedAt: now(),
    }))
    ls.set(LS_KEYS.menuWeeks, all)
    set({ weeks: all })
  },

  selectWeek: (id) => set({ selectedWeekId: id }),

  removeWeek: async (id) => {
    const all = ls.get<MenuWeek[]>(LS_KEYS.menuWeeks, []).filter(w => w.id !== id)
    ls.set(LS_KEYS.menuWeeks, all)
    set(s => ({ weeks: s.weeks.filter(w => w.id !== id) }))
  },
  deleteWeek: async (id) => get().removeWeek(id),

  fetchItems: async () => {
    const items = [...ls.get<MenuItem[]>(LS_KEYS.menuItems, [])]
      .sort((a, b) => a.name.localeCompare(b.name))
    set({ items })
  },

  addItem: async (data) => {
    const isString = typeof data === 'string'
    const item: MenuItem = {
      id: uid(),
      name:            isString ? data : data.name,
      textureModified: isString ? false : (data.textureModified ?? false),
      category:        isString ? null : (data.category ?? null),
      mealCategory:    isString ? undefined : data.mealCategory,
      dietaryTags:     isString ? undefined : data.dietaryTags,
      recipeId:        isString ? undefined : data.recipeId,
      notes:           isString ? undefined : data.notes,
    }
    const all = [...ls.get<MenuItem[]>(LS_KEYS.menuItems, []), item]
      .sort((a, b) => a.name.localeCompare(b.name))
    ls.set(LS_KEYS.menuItems, all)
    set({ items: all })
    return item
  },

  updateItem: async (id, patch) => {
    const all = ls.get<MenuItem[]>(LS_KEYS.menuItems, []).map(i =>
      i.id === id ? { ...i, ...patch } : i
    )
    ls.set(LS_KEYS.menuItems, all)
    set({ items: all })
  },

  removeItem: async (id) => {
    const all = ls.get<MenuItem[]>(LS_KEYS.menuItems, []).filter(i => i.id !== id)
    ls.set(LS_KEYS.menuItems, all)
    set(s => ({ items: s.items.filter(i => i.id !== id) }))
  },
  deleteItem: async (id) => get().removeItem(id),
}))
