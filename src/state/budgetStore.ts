import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BudgetPeriod {
  id: string
  label: string
  month: number
  year: number
  totalBudget: number
  residentCount: number
  budgetPerResidentPerDay: number
  // computed helpers used by BudgetPage / NotificationBell
  startDate: string        // e.g. "2026-07-01"
  endDate: string          // e.g. "2026-07-31"
  totalDays: number        // days in the month
}

export interface BudgetEntry {
  id: string
  periodId: string
  date: string
  vendor?: string | null
  description: string
  amount: number
  category?: string | null
}

// BudgetPage also imports SpendCategory / SpendEntry — provide them
export type SpendCategory = string
export interface SpendEntry extends BudgetEntry {}

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}
function pad2(n: number) { return String(n).padStart(2, '0') }

function toPeriod(row: Record<string, unknown>): BudgetPeriod {
  const month = row.month as number
  const year  = row.year  as number
  const days  = daysInMonth(month, year)
  return {
    id:                      row.id as string,
    label:                   row.label as string,
    month,
    year,
    totalBudget:             Number(row.total_budget ?? 0),
    residentCount:           Number(row.resident_count ?? 0),
    budgetPerResidentPerDay: Number(row.budget_per_resident_per_day ?? 0),
    startDate:               `${year}-${pad2(month)}-01`,
    endDate:                 `${year}-${pad2(month)}-${pad2(days)}`,
    totalDays:               days,
  }
}

function toEntry(row: Record<string, unknown>): BudgetEntry {
  return {
    id:          row.id as string,
    periodId:    row.period_id as string,
    date:        row.date as string,
    vendor:      (row.vendor as string | null) ?? null,
    description: row.description as string,
    amount:      Number(row.amount ?? 0),
    category:    (row.category as string | null) ?? null,
  }
}

// ── State ─────────────────────────────────────────────────────────────────────
export interface BudgetState {
  period:      BudgetPeriod | null
  prevPeriod:  BudgetPeriod | null
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
  period: null, prevPeriod: null, periods: [], entries: [], prevEntries: [],
  loading: false, error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const now = new Date()
      const thisMonth = now.getMonth() + 1
      const thisYear  = now.getFullYear()
      // current period
      const { data: pr, error: pe } = await supabase
        .from('budget_periods').select('*')
        .eq('month', thisMonth).eq('year', thisYear)
        .maybeSingle()
      if (pe) throw new Error(pe.message)
      // previous period
      const prevMonth = thisMonth === 1 ? 12 : thisMonth - 1
      const prevYear  = thisMonth === 1 ? thisYear - 1 : thisYear
      const { data: pp } = await supabase
        .from('budget_periods').select('*')
        .eq('month', prevMonth).eq('year', prevYear)
        .maybeSingle()

      if (!pr) { set({ loading: false }); return }
      const period = toPeriod(pr as Record<string, unknown>)
      const { data: er, error: ee } = await supabase
        .from('budget_entries').select('*').eq('period_id', period.id).order('date')
      if (ee) throw new Error(ee.message)

      let prevPeriod: BudgetPeriod | null = null
      let prevEntries: BudgetEntry[] = []
      if (pp) {
        prevPeriod = toPeriod(pp as Record<string, unknown>)
        const { data: pe2 } = await supabase
          .from('budget_entries').select('*').eq('period_id', prevPeriod.id).order('date')
        prevEntries = (pe2 ?? []).map(r => toEntry(r as Record<string, unknown>))
      }

      set({ period, prevPeriod, entries: (er ?? []).map(r => toEntry(r as Record<string, unknown>)), prevEntries, loading: false })
    } catch (e: unknown) { set({ error: (e as Error).message, loading: false }) }
  },

  fetchPeriods: async () => {
    const { data, error } = await supabase
      .from('budget_periods').select('*').order('year', { ascending: false }).order('month', { ascending: false })
    if (error) { set({ error: error.message }); return }
    set({ periods: (data ?? []).map(r => toPeriod(r as Record<string, unknown>)) })
  },

  fetchEntries: async (periodId) => {
    const { data, error } = await supabase
      .from('budget_entries').select('*').eq('period_id', periodId).order('date')
    if (error) { set({ error: error.message }); return }
    set({ entries: (data ?? []).map(r => toEntry(r as Record<string, unknown>)) })
  },

  setPeriod: (p) => set({ period: p }),

  upsertPeriod: async (data) => {
    const row = {
      label: data.label, month: data.month, year: data.year,
      total_budget: data.totalBudget,
      resident_count: data.residentCount,
      budget_per_resident_per_day: data.budgetPerResidentPerDay,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = supabase.from('budget_periods') as any
    const { data: saved, error } = data.id
      ? await q.update(row).eq('id', data.id).select().single()
      : await q.insert(row).select().single()
    if (error) throw new Error(error.message)
    const period = toPeriod(saved as Record<string, unknown>)
    set(s => ({
      period,
      periods: data.id
        ? s.periods.map(p => p.id === data.id ? period : p)
        : [period, ...s.periods],
    }))
  },

  addEntry: async (data) => {
    const row = {
      period_id: data.periodId, date: data.date,
      description: data.description, amount: data.amount,
      ...(data.vendor   && { vendor:   data.vendor }),
      ...(data.category && { category: data.category }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('budget_entries') as any).insert(row).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ entries: [...s.entries, toEntry(r as Record<string, unknown>)] }))
  },

  updateEntry: async (id, data) => {
    const patch: Record<string, unknown> = {}
    if (data.date        !== undefined) patch.date        = data.date
    if (data.vendor      !== undefined) patch.vendor      = data.vendor
    if (data.description !== undefined) patch.description = data.description
    if (data.amount      !== undefined) patch.amount      = data.amount
    if (data.category    !== undefined) patch.category    = data.category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('budget_entries') as any).update(patch).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ entries: s.entries.map(e => e.id === id ? toEntry(r as Record<string, unknown>) : e) }))
  },

  removeEntry: async (id) => {
    const { error } = await supabase.from('budget_entries').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ entries: s.entries.filter(e => e.id !== id) }))
  },

  getTotalBudget: () => get().period?.totalBudget ?? 0,
  getTotalSpent:  () => get().entries.reduce((s, e) => s + e.amount, 0),
  getProjected: () => {
    const spent = get().entries.reduce((s, e) => s + e.amount, 0)
    const now   = new Date()
    const day   = now.getDate()
    const days  = get().period?.totalDays ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return day > 0 ? (spent / day) * days : 0
  },
  getDailyPerRes: () => get().period?.budgetPerResidentPerDay ?? 0,
}))
