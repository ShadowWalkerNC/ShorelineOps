/**
 * Menu store — DEMO MODE
 */
import { create } from 'zustand'
import type { MenuWeek, MenuItem, DayOfWeek, MealSlot, MealEntry } from '@/types'
import { MEAL_SLOTS } from '@/types/menu'
import { SEED_MENU_WEEKS, SEED_MENU_ITEMS, uid, now } from '@/demo/seed'

let _weeks: MenuWeek[] = JSON.parse(JSON.stringify(SEED_MENU_WEEKS))
let _items: MenuItem[] = JSON.parse(JSON.stringify(SEED_MENU_ITEMS))

type MenuState = {
  weeks: MenuWeek[]
  items: MenuItem[]
  selectedWeekId: string | null
  loading: boolean
  error: string | null
  fetchWeeks: () => Promise<void>
  fetchItems: () => Promise<void>
  addWeek: (name: string) => Promise<MenuWeek>
  updateWeek: (id: string, payload: Partial<MenuWeek>) => Promise<void>
  deleteWeek: (id: string) => Promise<void>
  setActiveWeek: (id: string) => Promise<void>
  selectWeek: (id: string | null) => void
  updateMealEntry: (weekId: string, day: DayOfWeek, slot: MealSlot, entry: Partial<MealEntry>) => Promise<void>
  addItem: (payload: Omit<MenuItem, 'id'>) => Promise<MenuItem>
  updateItem: (id: string, payload: Partial<MenuItem>) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

export const useMenuStore = create<MenuState>((set, get) => ({
  weeks: [],
  items: [],
  selectedWeekId: null,
  loading: false,
  error: null,

  fetchWeeks: async () => {
    set({ loading: true, error: null })
    await new Promise(r => setTimeout(r, 150))
    const active = _weeks.find(w => w.active)
    set({
      weeks: [..._weeks],
      loading: false,
      selectedWeekId: get().selectedWeekId ?? active?.id ?? _weeks[0]?.id ?? null,
    })
  },

  fetchItems: async () => {
    await new Promise(r => setTimeout(r, 100))
    set({ items: [..._items] })
  },

  addWeek: async (name) => {
    const week: MenuWeek = {
      id: uid(), name, active: false,
      createdAt: now(), updatedAt: now(),
      days: Object.fromEntries(
        ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(day => [
          day,
          Object.fromEntries(MEAL_SLOTS.map(slot => [slot, { itemIds: [] }]))
        ])
      ) as MenuWeek['days'],
    }
    _weeks = [..._weeks, week]
    set({ weeks: [..._weeks], selectedWeekId: week.id })
    return week
  },

  updateWeek: async (id, payload) => {
    _weeks = _weeks.map(w => w.id === id ? { ...w, ...payload, updatedAt: now() } : w)
    set({ weeks: [..._weeks] })
  },

  deleteWeek: async (id) => {
    _weeks = _weeks.filter(w => w.id !== id)
    const sel = get().selectedWeekId === id ? (_weeks[0]?.id ?? null) : get().selectedWeekId
    set({ weeks: [..._weeks], selectedWeekId: sel })
  },

  setActiveWeek: async (id) => {
    _weeks = _weeks.map(w => ({ ...w, active: w.id === id }))
    set({ weeks: [..._weeks] })
  },

  selectWeek: (id) => set({ selectedWeekId: id }),

  updateMealEntry: async (weekId, day, slot, entry) => {
    _weeks = _weeks.map(w => {
      if (w.id !== weekId) return w
      return {
        ...w, updatedAt: now(),
        days: { ...w.days, [day]: { ...w.days[day], [slot]: { ...w.days[day][slot], ...entry } } },
      }
    })
    set({ weeks: [..._weeks] })
  },

  addItem: async (payload) => {
    const item: MenuItem = { ...payload, id: uid() }
    _items = [..._items, item]
    set({ items: [..._items] })
    return item
  },

  updateItem: async (id, payload) => {
    _items = _items.map(i => i.id === id ? { ...i, ...payload } : i)
    set({ items: [..._items] })
  },

  deleteItem: async (id) => {
    _items = _items.filter(i => i.id !== id)
    set({ items: [..._items] })
  },
}))
