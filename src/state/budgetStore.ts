// ============================================================
// BUDGET STORE
// ============================================================
// Single source of truth for:
//   - Current budget period settings
//   - Spend entries (MTD log)
//   - Previous period (read-only comparison)
//
// Consumers:
//   BudgetPage   — reads/writes everything
//   DashboardPage — reads period + totalSpent for metrics
//   NotificationBell — reads period + totalSpent for budget alert
// ============================================================
import { create } from 'zustand'

// ── Types ─────────────────────────────────────────────────────────────────────
export type SpendCategory =
  | 'Food — Proteins'
  | 'Food — Produce'
  | 'Food — Dairy'
  | 'Food — Dry Goods'
  | 'Food — Dietary / Special'
  | 'Food — Beverages'
  | 'Non-Food — Cleaning'
  | 'Non-Food — Paper Goods'
  | 'Labor'
  | 'Equipment / Repair'
  | 'Other'

export type SpendEntry = {
  id: string
  date: string           // YYYY-MM-DD
  vendor: string
  description: string
  category: SpendCategory
  amount: number
  invoiceRef?: string
  loggedBy: string
  truckOrderRef?: string
}

export type BudgetPeriod = {
  id: string
  label: string
  startDate: string
  endDate: string
  residentCount: number
  budgetPerResidentPerDay: number
  totalDays: number
}

// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED_PERIOD: BudgetPeriod = {
  id: 'p1',
  label: 'July 2026',
  startDate: '2026-07-01',
  endDate: '2026-07-31',
  residentCount: 42,
  budgetPerResidentPerDay: 9.50,
  totalDays: 31,
}

const SEED_ENTRIES: SpendEntry[] = [
  { id:'e1',  date:'2026-07-02', vendor:'Sysco',        description:'Weekly truck order #1 — Proteins & Produce',  category:'Food — Proteins',          amount:412.80, invoiceRef:'SYS-88201', loggedBy:'Chef Maria' },
  { id:'e2',  date:'2026-07-02', vendor:'Sysco',        description:'Weekly truck order #1 — Dairy & Dry Goods',   category:'Food — Dairy',             amount:188.40, invoiceRef:'SYS-88201', loggedBy:'Chef Maria' },
  { id:'e3',  date:'2026-07-02', vendor:'Sysco',        description:'Weekly truck order #1 — Dietary specials',    category:'Food — Dietary / Special', amount:214.60, invoiceRef:'SYS-88201', loggedBy:'Chef Maria' },
  { id:'e4',  date:'2026-07-02', vendor:'Sysco',        description:'Weekly truck order #1 — Beverages',           category:'Food — Beverages',         amount: 96.30, invoiceRef:'SYS-88201', loggedBy:'Chef Maria' },
  { id:'e5',  date:'2026-07-02', vendor:'Sysco',        description:'Weekly truck order #1 — Paper & Cleaning',    category:'Non-Food — Paper Goods',   amount: 74.20, invoiceRef:'SYS-88201', loggedBy:'Chef Maria' },
  { id:'e6',  date:'2026-07-09', vendor:'Sysco',        description:'Weekly truck order #2 — Proteins',            category:'Food — Proteins',          amount:388.50, invoiceRef:'SYS-88390', loggedBy:'Chef Maria' },
  { id:'e7',  date:'2026-07-09', vendor:'Sysco',        description:'Weekly truck order #2 — Produce',             category:'Food — Produce',           amount:142.10, invoiceRef:'SYS-88390', loggedBy:'Chef Maria' },
  { id:'e8',  date:'2026-07-09', vendor:'Sysco',        description:'Weekly truck order #2 — Dairy',               category:'Food — Dairy',             amount:162.80, invoiceRef:'SYS-88390', loggedBy:'Chef Maria' },
  { id:'e9',  date:'2026-07-09', vendor:'Sysco',        description:'Weekly truck order #2 — Dry Goods',           category:'Food — Dry Goods',         amount: 88.60, invoiceRef:'SYS-88390', loggedBy:'Chef Maria' },
  { id:'e10', date:'2026-07-09', vendor:'Sysco',        description:'Weekly truck order #2 — Cleaning supplies',   category:'Non-Food — Cleaning',      amount: 52.40, invoiceRef:'SYS-88390', loggedBy:'Chef Maria' },
  { id:'e11', date:'2026-07-04', vendor:'Local Market', description:'Supplemental produce — holiday cookout',      category:'Food — Produce',           amount: 64.75, loggedBy:'Chef Maria' },
  { id:'e12', date:'2026-07-01', vendor:'Sysco',        description:'Ensure Plus restock (supplemental)',           category:'Food — Dietary / Special', amount: 74.40, invoiceRef:'SYS-88100', loggedBy:'Manager Kim' },
  { id:'e13', date:'2026-07-03', vendor:'Home Depot',   description:'Fridge gasket replacement — Walk-in Cooler',  category:'Equipment / Repair',       amount:138.00, invoiceRef:'HD-39821',  loggedBy:'Manager Kim' },
]

const SEED_PREV_PERIOD: BudgetPeriod = {
  id: 'p0',
  label: 'June 2026',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  residentCount: 41,
  budgetPerResidentPerDay: 9.50,
  totalDays: 30,
}

const SEED_PREV_ENTRIES: SpendEntry[] = [
  { id:'p1e1',  date:'2026-06-04', vendor:'Sysco',   description:'Wk1 truck', category:'Food — Proteins',          amount:398.20, loggedBy:'Chef Maria' },
  { id:'p1e2',  date:'2026-06-04', vendor:'Sysco',   description:'Wk1 truck', category:'Food — Produce',           amount:128.40, loggedBy:'Chef Maria' },
  { id:'p1e3',  date:'2026-06-04', vendor:'Sysco',   description:'Wk1 truck', category:'Food — Dairy',             amount:174.60, loggedBy:'Chef Maria' },
  { id:'p1e4',  date:'2026-06-11', vendor:'Sysco',   description:'Wk2 truck', category:'Food — Proteins',          amount:421.80, loggedBy:'Chef Maria' },
  { id:'p1e5',  date:'2026-06-11', vendor:'Sysco',   description:'Wk2 truck', category:'Food — Produce',           amount:136.90, loggedBy:'Chef Maria' },
  { id:'p1e6',  date:'2026-06-18', vendor:'Sysco',   description:'Wk3 truck', category:'Food — Proteins',          amount:387.50, loggedBy:'Chef Maria' },
  { id:'p1e7',  date:'2026-06-18', vendor:'Sysco',   description:'Wk3 truck', category:'Food — Dry Goods',         amount: 91.20, loggedBy:'Chef Maria' },
  { id:'p1e8',  date:'2026-06-25', vendor:'Sysco',   description:'Wk4 truck', category:'Food — Proteins',          amount:410.00, loggedBy:'Chef Maria' },
  { id:'p1e9',  date:'2026-06-25', vendor:'Sysco',   description:'Wk4 truck', category:'Food — Dairy',             amount:182.00, loggedBy:'Chef Maria' },
  { id:'p1e10', date:'2026-06-25', vendor:'Sysco',   description:'Wk4 truck', category:'Food — Beverages',         amount: 88.50, loggedBy:'Chef Maria' },
  { id:'p1e11', date:'2026-06-15', vendor:'Med Sup', description:'Simply Thick restock', category:'Food — Dietary / Special', amount:108.00, loggedBy:'Manager Kim' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10) }

function daysElapsed(period: BudgetPeriod): number {
  const start = new Date(period.startDate)
  const today = new Date()
  return Math.max(1, Math.min(period.totalDays,
    Math.ceil((today.getTime() - start.getTime()) / 86_400_000) + 1
  ))
}

// ── Store ─────────────────────────────────────────────────────────────────────
type BudgetState = {
  // State
  period:      BudgetPeriod
  entries:     SpendEntry[]
  prevPeriod:  BudgetPeriod
  prevEntries: SpendEntry[]
  seeded:      boolean

  // Actions
  fetch:        () => void          // seeds from constants; no-op if already loaded
  setPeriod:    (p: BudgetPeriod) => void
  addEntry:     (e: Omit<SpendEntry, 'id'>) => void
  removeEntry:  (id: string) => void

  // Selectors
  getTotalBudget:  () => number
  getTotalSpent:   () => number
  getRemaining:    () => number
  getPctUsed:      () => number
  getProjected:    () => number
  getDailyPerRes:  () => number
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  period:      SEED_PERIOD,
  entries:     [],
  prevPeriod:  SEED_PREV_PERIOD,
  prevEntries: SEED_PREV_ENTRIES,
  seeded:      false,

  fetch() {
    if (get().seeded) return
    set({ entries: JSON.parse(JSON.stringify(SEED_ENTRIES)), seeded: true })
  },

  setPeriod(p) {
    set({ period: p })
  },

  addEntry(e) {
    set(s => ({ entries: [{ id: uid(), ...e }, ...s.entries] }))
  },

  removeEntry(id) {
    set(s => ({ entries: s.entries.filter(e => e.id !== id) }))
  },

  // ── Selectors ──────────────────────────────────────────────────────────────
  getTotalBudget() {
    const { period } = get()
    return period.residentCount * period.budgetPerResidentPerDay * period.totalDays
  },

  getTotalSpent() {
    return get().entries.reduce((s, e) => s + e.amount, 0)
  },

  getRemaining() {
    return get().getTotalBudget() - get().getTotalSpent()
  },

  getPctUsed() {
    const total = get().getTotalBudget()
    return total > 0 ? (get().getTotalSpent() / total) * 100 : 0
  },

  getProjected() {
    const { period } = get()
    const elapsed = daysElapsed(period)
    return (get().getTotalSpent() / elapsed) * period.totalDays
  },

  getDailyPerRes() {
    const { period } = get()
    const elapsed = daysElapsed(period)
    return get().getTotalSpent() / elapsed / period.residentCount
  },
}))
