import { create } from 'zustand'
import { ls, LS_KEYS } from '@/lib/localStorage'

export interface BudgetPeriod {
  id: string
  label: string
  month: number
  year: number
  totalBudget: number
  residentCount: number
  budgetPerResidentPerDay: number
  startDate: string
  endDate: string
  totalDays: number
}

export interface BudgetEntry {
  id: string
  periodId: string
  date: string
  vendor?: string | null
  description: string
  amount: number
  category?: string | null
  invoiceRef?: string | null
  loggedBy?: string | null
}

export type SpendCategory = string
export interface SpendEntry extends BudgetEntry {}

function uid() { return crypto.randomUUID() }
function pad2(n: number) { return String(n).padStart(2, '0') }
function daysInMonth(m: number, y: number) { return new Date(y, m, 0).getDate() }

function makePeriod(raw: Omit<BudgetPeriod, 'startDate' | 'endDate' | 'totalDays'>): BudgetPeriod {
  const days = daysInMonth(raw.month, raw.year)
  return {
    ...raw,
    startDate: `${raw.year}-${pad2(raw.month)}-01`,
    endDate:   `${raw.year}-${pad2(raw.month)}-${pad2(days)}`,
    totalDays: days,
  }
}

const now0 = new Date()
const DEFAULT_PERIOD: BudgetPeriod = makePeriod({
  id: '', label: '—',
  month: now0.getMonth() + 1, year: now0.getFullYear(),
  totalBudget: 0, residentCount: 1, budgetPerResidentPerDay: 0,
})

export interface BudgetState {
  period:      BudgetPeriod
  prevPeriod:  BudgetPeriod
  periods:     BudgetPeriod[]
  entries:     BudgetEntry[]
  prevEntries: BudgetEntry[]
  loading: boolean
  error: string | null
  fetch:         () => Promise<void>
  fetchPeriods:  () => Promise<void>
  fetchEntries:  (periodId: string) => Promise<void>
  setPeriod:     (p: BudgetPeriod) => void
  upsertPeriod:  (data: Omit<BudgetPeriod, 'startDate' | 'endDate' | 'totalDays'> & { id?: string }) => Promise<void>
  addEntry:      (data: Omit<BudgetEntry, 'id'>) => Promise<void>
  updateEntry:   (id: string, data: Partial<BudgetEntry>) => Promise<void>
  removeEntry:   (id: string) => Promise<void>
  getTotalBudget:  () => number
  getTotalSpent:   () => number
  getProjected:    () => number
  getDailyPerRes:  () => number
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  period:      DEFAULT_PERIOD,
  prevPeriod:  DEFAULT_PERIOD,
  periods:     [],
  entries:     [],
  prevEntries: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    const allPeriods = ls.get<BudgetPeriod[]>(LS_KEYS.budgetPeriods, [])
    const allEntries = ls.get<BudgetEntry[]>(LS_KEYS.budgetEntries, [])
    const now = new Date()
    const thisMonth = now.getMonth() + 1
    const thisYear  = now.getFullYear()
    const prevMonth = thisMonth === 1 ? 12 : thisMonth - 1
    const prevYear  = thisMonth === 1 ? thisYear - 1 : thisYear
    const period     = allPeriods.find(p => p.month === thisMonth && p.year === thisYear)
    const prevPeriod = allPeriods.find(p => p.month === prevMonth && p.year === prevYear)
    const entries     = period     ? allEntries.filter(e => e.periodId === period.id)     : []
    const prevEntries = prevPeriod ? allEntries.filter(e => e.periodId === prevPeriod.id) : []
    set({
      period:      period     ?? DEFAULT_PERIOD,
      prevPeriod:  prevPeriod ?? DEFAULT_PERIOD,
      entries, prevEntries, loading: false,
    })
  },

  fetchPeriods: async () => {
    const periods = [...ls.get<BudgetPeriod[]>(LS_KEYS.budgetPeriods, [])]
      .sort((a, b) => b.year - a.year || b.month - a.month)
    set({ periods })
  },

  fetchEntries: async (periodId) => {
    const entries = ls.get<BudgetEntry[]>(LS_KEYS.budgetEntries, [])
      .filter(e => e.periodId === periodId)
      .sort((a, b) => a.date.localeCompare(b.date))
    set({ entries })
  },

  setPeriod: (p) => set({ period: p }),

  upsertPeriod: async (data) => {
    const all = ls.get<BudgetPeriod[]>(LS_KEYS.budgetPeriods, [])
    const existing = data.id ? all.find(p => p.id === data.id) : null
    const period = makePeriod({ ...data, id: data.id ?? uid() })
    const updated = existing
      ? all.map(p => p.id === period.id ? period : p)
      : [period, ...all]
    ls.set(LS_KEYS.budgetPeriods, updated)
    set(s => ({
      period,
      periods: existing
        ? s.periods.map(p => p.id === period.id ? period : p)
        : [period, ...s.periods],
    }))
  },

  addEntry: async (data) => {
    const entry: BudgetEntry = { ...data, id: uid() }
    const all = [...ls.get<BudgetEntry[]>(LS_KEYS.budgetEntries, []), entry]
    ls.set(LS_KEYS.budgetEntries, all)
    set(s => ({ entries: [...s.entries, entry] }))
  },

  updateEntry: async (id, data) => {
    const all = ls.get<BudgetEntry[]>(LS_KEYS.budgetEntries, []).map(e =>
      e.id === id ? { ...e, ...data } : e
    )
    ls.set(LS_KEYS.budgetEntries, all)
    set(s => ({ entries: s.entries.map(e => e.id === id ? { ...e, ...data } : e) }))
  },

  removeEntry: async (id) => {
    const all = ls.get<BudgetEntry[]>(LS_KEYS.budgetEntries, []).filter(e => e.id !== id)
    ls.set(LS_KEYS.budgetEntries, all)
    set(s => ({ entries: s.entries.filter(e => e.id !== id) }))
  },

  getTotalBudget: () => get().period.totalBudget,
  getTotalSpent:  () => get().entries.reduce((s, e) => s + e.amount, 0),
  getProjected: () => {
    const spent = get().entries.reduce((s, e) => s + e.amount, 0)
    const day   = new Date().getDate()
    const days  = get().period.totalDays
    return day > 0 ? (spent / day) * days : 0
  },
  getDailyPerRes: () => get().period.budgetPerResidentPerDay,
}))
