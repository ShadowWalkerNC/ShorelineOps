import { create } from 'zustand'
import { api } from '@/api/client'
import { supabase } from '@/lib/supabase'

// ─ Types ───────────────────────────────────────────────────────────────────
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

// ─ Default / empty period ──────────────────────────────────────────────────
const now0 = new Date()
const DEFAULT_PERIOD: BudgetPeriod = {
  id:                      '',
  label:                   '—',
  month:                   now0.getMonth() + 1,
  year:                    now0.getFullYear(),
  totalBudget:             0,
  residentCount:           1,
  budgetPerResidentPerDay: 0,
  startDate:               `${now0.getFullYear()}-${String(now0.getMonth()+1).padStart(2,'0')}-01`,
  endDate:                 `${now0.getFullYear()}-${String(now0.getMonth()+1).padStart(2,'0')}-01`,
  totalDays:               new Date(now0.getFullYear(), now0.getMonth()+1, 0).getDate(),
}

// ─ Helpers ───────────────────────────────────────────────────────────────────
function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}
function pad2(n: number) { return String(n).padStart(2, '0') }

function toPeriod(row: Record<string, unknown>): BudgetPeriod {
  const month = Number(row.month)
  const year  = Number(row.year)
  const days  = daysInMonth(month, year)
  return {
    id:                      (row.id as string) ?? '',
    label:                   (row.label as string) ?? '',
    month,
    year,
    totalBudget:             Number(row.total_budget ?? row.totalBudget ?? 0),
    residentCount:           Number(row.resident_count ?? row.residentCount ?? 1),
    budgetPerResidentPerDay: Number(row.budget_per_resident_per_day ?? row.budgetPerResidentPerDay ?? 0),
    startDate:               (row.start_date ?? row.startDate ?? `${year}-${pad2(month)}-01`) as string,
    endDate:                 (row.end_date ?? row.endDate ?? `${year}-${pad2(month)}-${pad2(days)}`) as string,
    totalDays:               days,
  }
}

function toEntry(row: Record<string, unknown>): BudgetEntry {
  return {
    id:          (row.id as string) ?? '',
    periodId:    ((row.period_id ?? row.periodId) as string) ?? '',
    date:        (row.date as string) ?? '',
    vendor:      (row.vendor as string | null) ?? null,
    description: (row.description as string) ?? '',
    amount:      Number(row.amount ?? 0),
    category:    (row.category as string | null) ?? null,
    invoiceRef:  ((row.invoice_ref ?? row.invoiceRef) as string | null) ?? null,
    loggedBy:    ((row.logged_by ?? row.loggedBy) as string | null) ?? null,
  }
}

// ─ State ────────────────────────────────────────────────────────────────────
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
  getTotalBudget: () => number
  getTotalSpent:  () => number
  getProjected:   () => number
  getDailyPerRes: () => number
}

const isDemo = import.meta.env.VITE_DEMO_MODE === 'true'

export const useBudgetStore = create<BudgetState>((set, get) => ({
  period: DEFAULT_PERIOD,
  prevPeriod: DEFAULT_PERIOD,
  periods: [], entries: [], prevEntries: [],
  loading: false, error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    if (!isDemo) {
      try {
        const [periodsRes, entriesRes] = await Promise.all([
          api.get('/reporting/budget-periods'),
          api.get('/reporting/budget-entries'),
        ])
        if (Array.isArray(periodsRes.data)) {
          const allPeriods = periodsRes.data.map(toPeriod)
          const allEntries = Array.isArray(entriesRes.data) ? entriesRes.data.map(toEntry) : []
          const now = new Date()
          const thisMonth = now.getMonth() + 1
          const thisYear = now.getFullYear()
          const currentPeriod = allPeriods.find(p => p.month === thisMonth && p.year === thisYear) || allPeriods[0] || DEFAULT_PERIOD
          const currentEntries = allEntries.filter(e => e.periodId === currentPeriod.id)
          set({
            periods: allPeriods,
            period: currentPeriod,
            entries: currentEntries,
            loading: false,
          })
          return
        }
      } catch (err: any) {
        console.warn('[budgetStore] Live API fetch failed, falling back to local adapter:', err?.message)
      }
    }
    try {
      const now = new Date()
      const thisMonth = now.getMonth() + 1
      const thisYear  = now.getFullYear()
      const { data: pr, error: pe } = await supabase
        .from('budget_periods').select('*')
        .eq('month', thisMonth).eq('year', thisYear)
        .maybeSingle()
      if (pe) throw new Error(pe.message)

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

      const prevPeriod: BudgetPeriod = pp ? toPeriod(pp as Record<string, unknown>) : DEFAULT_PERIOD
      let prevEntries: BudgetEntry[] = []
      if (pp) {
        const { data: pe2 } = await supabase
          .from('budget_entries').select('*').eq('period_id', prevPeriod.id).order('date')
        prevEntries = (pe2 ?? []).map((r: any) => toEntry(r as Record<string, unknown>))
      }

      set({ period, prevPeriod, entries: (er ?? []).map((r: any) => toEntry(r as Record<string, unknown>)), prevEntries, loading: false })
    } catch (e: unknown) { set({ error: (e as Error).message, loading: false }) }
  },

  fetchPeriods: async () => {
    if (!isDemo) {
      try {
        const res = await api.get('/reporting/budget-periods')
        if (Array.isArray(res.data)) {
          set({ periods: res.data.map(toPeriod) })
          return
        }
      } catch (err: any) {
        console.warn('[budgetStore] Live API fetchPeriods failed, falling back to local adapter:', err?.message)
      }
    }
    const { data, error } = await supabase
      .from('budget_periods').select('*').order('year', { ascending: false }).order('month', { ascending: false })
    if (error) { set({ error: error.message }); return }
    set({ periods: (data ?? []).map((r: any) => toPeriod(r as Record<string, unknown>)) })
  },

  fetchEntries: async (periodId) => {
    if (!isDemo) {
      try {
        const res = await api.get(`/reporting/budget-entries?periodId=${encodeURIComponent(periodId)}`)
        if (Array.isArray(res.data)) {
          set({ entries: res.data.map(toEntry) })
          return
        }
      } catch (err: any) {
        console.warn('[budgetStore] Live API fetchEntries failed, falling back to local adapter:', err?.message)
      }
    }
    const { data, error } = await supabase
      .from('budget_entries').select('*').eq('period_id', periodId).order('date')
    if (error) { set({ error: error.message }); return }
    set({ entries: (data ?? []).map((r: any) => toEntry(r as Record<string, unknown>)) })
  },

  setPeriod: (p) => set({ period: p }),

  upsertPeriod: async (data) => {
    if (!isDemo) {
      try {
        const res = await api.post('/reporting/budget-periods', {
          id: data.id,
          label: data.label,
          month: data.month,
          year: data.year,
          totalBudget: data.totalBudget,
          residentCount: data.residentCount,
          budgetPerResidentPerDay: data.budgetPerResidentPerDay,
        })
        if (res.data?.id) {
          const period = toPeriod(res.data)
          set(s => ({
            period,
            periods: data.id
              ? s.periods.map(p => p.id === data.id ? period : p)
              : [period, ...s.periods],
          }))
          return
        }
      } catch (err: any) {
        console.warn('[budgetStore] Live API upsertPeriod failed, falling back to local adapter:', err?.message)
      }
    }
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
    if (!isDemo) {
      try {
        const res = await api.post('/reporting/budget-entries', data)
        if (res.data?.id) {
          set(s => ({ entries: [...s.entries, toEntry(res.data)] }))
          return
        }
      } catch (err: any) {
        console.warn('[budgetStore] Live API addEntry failed, falling back to local adapter:', err?.message)
      }
    }
    const row: Record<string, unknown> = {
      period_id:   data.periodId,
      date:        data.date,
      description: data.description,
      amount:      data.amount,
      ...(data.vendor     != null && { vendor:      data.vendor }),
      ...(data.category   != null && { category:    data.category }),
      ...(data.invoiceRef != null && { invoice_ref: data.invoiceRef }),
      ...(data.loggedBy   != null && { logged_by:   data.loggedBy }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('budget_entries') as any).insert(row).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ entries: [...s.entries, toEntry(r as Record<string, unknown>)] }))
  },

  updateEntry: async (id, data) => {
    if (!isDemo) {
      try {
        const res = await api.put(`/reporting/budget-entries/${id}`, data)
        if (res.data?.id) {
          set(s => ({ entries: s.entries.map(e => e.id === id ? toEntry(res.data) : e) }))
          return
        }
      } catch (err: any) {
        console.warn('[budgetStore] Live API updateEntry failed, falling back to local adapter:', err?.message)
      }
    }
    const patch: Record<string, unknown> = {}
    if (data.date        !== undefined) patch.date        = data.date
    if (data.vendor      !== undefined) patch.vendor      = data.vendor
    if (data.description !== undefined) patch.description = data.description
    if (data.amount      !== undefined) patch.amount      = data.amount
    if (data.category    !== undefined) patch.category    = data.category
    if (data.invoiceRef  !== undefined) patch.invoice_ref = data.invoiceRef
    if (data.loggedBy    !== undefined) patch.logged_by   = data.loggedBy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('budget_entries') as any).update(patch).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ entries: s.entries.map(e => e.id === id ? toEntry(r as Record<string, unknown>) : e) }))
  },

  removeEntry: async (id) => {
    if (!isDemo) {
      try {
        await api.delete(`/reporting/budget-entries/${id}`)
        set(s => ({ entries: s.entries.filter(e => e.id !== id) }))
        return
      } catch (err: any) {
        console.warn('[budgetStore] Live API removeEntry failed, falling back to local adapter:', err?.message)
      }
    }
    const { error } = await supabase.from('budget_entries').delete().eq('id', id)
    if (error) throw new Error(error.message)
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
