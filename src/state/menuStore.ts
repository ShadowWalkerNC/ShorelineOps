import { create } from 'zustand'
import type { MenuWeek, MenuItem, DayOfWeek, MealSlot, MealEntry } from '@/types'
import { menuApi } from '@/api/menu'

type MenuState = {
  weeks: MenuWeek[]
  items: MenuItem[]
  /** ID of whichever week is currently selected in the UI */
  selectedWeekId: string | null
  loading: boolean
  error: string | null

  // ── Fetches ──────────────────────────────────────────────────────────────
  fetchWeeks: () => Promise<void>
  fetchItems: () => Promise<void>

  // ── Week actions ─────────────────────────────────────────────────────────
  addWeek: (name: string) => Promise<MenuWeek>
  updateWeek: (id: string, payload: Partial<MenuWeek>) => Promise<void>
  deleteWeek: (id: string) => Promise<void>
  setActiveWeek: (id: string) => Promise<void>
  selectWeek: (id: string | null) => void

  // ── Day / slot editing ───────────────────────────────────────────────────
  updateMealEntry: (
    weekId: string,
    day: DayOfWeek,
    slot: MealSlot,
    entry: Partial<MealEntry>
  ) => Promise<void>

  // ── Item actions ─────────────────────────────────────────────────────────
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
    try {
      const weeks = await menuApi.getWeeks()
      const active = weeks.find((w) => w.active)
      set({
        weeks,
        loading: false,
        selectedWeekId: get().selectedWeekId ?? active?.id ?? weeks[0]?.id ?? null,
      })
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to load menu.', loading: false })
    }
  },

  fetchItems: async () => {
    try {
      const items = await menuApi.getItems()
      set({ items })
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to load menu items.' })
    }
  },

  addWeek: async (name) => {
    const week = await menuApi.createWeek({
      name,
      active: false,
      days: {} as any, // server fills with empty template
    })
    set({ weeks: [...get().weeks, week], selectedWeekId: week.id })
    return week
  },

  updateWeek: async (id, payload) => {
    const updated = await menuApi.updateWeek(id, payload)
    set({ weeks: get().weeks.map((w) => (w.id === id ? updated : w)) })
  },

  deleteWeek: async (id) => {
    await menuApi.deleteWeek(id)
    const remaining = get().weeks.filter((w) => w.id !== id)
    set({
      weeks: remaining,
      selectedWeekId:
        get().selectedWeekId === id ? (remaining[0]?.id ?? null) : get().selectedWeekId,
    })
  },

  setActiveWeek: async (id) => {
    const updated = await menuApi.setActiveWeek(id)
    // Mark the newly-active week; clear active flag on all others
    set({
      weeks: get().weeks.map((w) =>
        w.id === id ? updated : { ...w, active: false }
      ),
    })
  },

  selectWeek: (id) => set({ selectedWeekId: id }),

  updateMealEntry: async (weekId, day, slot, entry) => {
    const week = get().weeks.find((w) => w.id === weekId)
    if (!week) return
    const updated: MenuWeek = {
      ...week,
      days: {
        ...week.days,
        [day]: {
          ...week.days[day],
          [slot]: { ...week.days[day][slot], ...entry },
        },
      },
    }
    await menuApi.updateWeek(weekId, { days: updated.days })
    set({ weeks: get().weeks.map((w) => (w.id === weekId ? updated : w)) })
  },

  addItem: async (payload) => {
    const item = await menuApi.createItem(payload)
    set({ items: [...get().items, item] })
    return item
  },

  updateItem: async (id, payload) => {
    const updated = await menuApi.updateItem(id, payload)
    set({ items: get().items.map((i) => (i.id === id ? updated : i)) })
  },

  deleteItem: async (id) => {
    await menuApi.deleteItem(id)
    set({ items: get().items.filter((i) => i.id !== id) })
  },
}))
