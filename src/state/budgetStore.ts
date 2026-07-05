import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export interface BudgetPeriod {
  id: string; label: string; month: number; year: number
  totalBudget: number; residentCount: number; budgetPerResidentPerDay: number
}

export interface BudgetEntry {
  id: string; periodId: string; date: string
  vendor?: string | null; description: string
  amount: number; category?: string | null
}

function toPeriod(row: Record<string, unknown>): BudgetPeriod {
  return {
    id:                      row.id as string,
    label:                   row.label as string,
    month:                   row.month as number,
    year:                    row.year as number,
    totalBudget:             Number(row.total_budget ?? 0),
    residentCount:           Number(row.resident_count ?? 0),
    budgetPerResidentPerDay: Number(row.budget_per_resident_per_day ?? 0),
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

type BudgetState = {
  period: BudgetPeriod | null
  periods: BudgetPeriod[]
  entries: BudgetEntry[]
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  fetchPeriods: () => Promise<void>
  fetchEntries: (periodId: string) => Promise<void>
  setPeriod: (p: BudgetPeriod) => void
  upsertPeriod: (data: Omit<BudgetPeriod, 'id'> & { id?: string }) => Promise<void>
  addEntry: (data: Omit<BudgetEntry, 'id'>) => Promise<void>
  updateEntry: (id: string, data: Partial<BudgetEntry>) => Promise<void>
  removeEntry: (id: string) => Promise<void>
  getTotalBudget: () => number
  getTotalSpent: () => number
  getProjected: () => number
  getDailyPerRes: () => number
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  period: null, periods: [], entries: [], loading: false, error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const now = new Date()
      const { data: pr, error: pe } = await supabase
        .from('budget_periods')
        .select('*')
        .eq('month', now.getMonth() + 1)
        .eq('year', now.getFullYear())
        .maybeSingle()
      if (pe) throw new Error(pe.message)
      if (!pr) { set({ loading: false }); return }
      const period = toPeriod(pr as Record<string, unknown>)
      const { data: er, error: ee } = await supabase
        .from('budget_entries').select('*').eq('period_id', period.id).order('date')
      if (ee) throw new Error(ee.message)
      set({ period, entries: (er ?? []).map(r => toEntry(r as Record<string, unknown>)), loading: false })
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
    const row: Database['public']['Tables']['budget_periods']['Insert'] = {
      label: data.label, month: data.month, year: data.year,
      total_budget: data.totalBudget,
      resident_count: data.residentCount,
      budget_per_resident_per_day: data.budgetPerResidentPerDay,
    }
    const { data: saved, error } = data.id
      ? await supabase.from('budget_periods').update(row as Database['public']['Tables']['budget_periods']['Update']).eq('id', data.id).select().single()
      : await supabase.from('budget_periods').insert(row).select().single()
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
    const row: Database['public']['Tables']['budget_entries']['Insert'] = {
      period_id: data.periodId, date: data.date,
      description: data.description, amount: data.amount,
      ...(data.vendor   && { vendor:   data.vendor }),
      ...(data.category && { category: data.category }),
    }
    const { data: r, error } = await supabase.from('budget_entries').insert(row).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ entries: [...s.entries, toEntry(r as Record<string, unknown>)] }))
  },

  updateEntry: async (id, data) => {
    const patch: Database['public']['Tables']['budget_entries']['Update'] = {
      ...(data.date        !== undefined && { date:        data.date }),
      ...(data.vendor      !== undefined && { vendor:      data.vendor }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.amount      !== undefined && { amount:      data.amount }),
      ...(data.category    !== undefined && { category:    data.category }),
    }
    const { data: r, error } = await supabase.from('budget_entries').update(patch).eq('id', id).select().single()
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
  getProjected:   () => {
    const spent = get().entries.reduce((s, e) => s + e.amount, 0)
    const now = new Date()
    const day = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return day > 0 ? (spent / day) * daysInMonth : 0
  },
  getDailyPerRes: () => get().period?.budgetPerResidentPerDay ?? 0,
}))
