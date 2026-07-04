import { useState, useMemo } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────
type SpendCategory =
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

type SpendEntry = {
  id: string
  date: string          // YYYY-MM-DD
  vendor: string
  description: string
  category: SpendCategory
  amount: number
  invoiceRef?: string
  loggedBy: string
  truckOrderRef?: string  // links back to a truck order if applicable
}

type BudgetPeriod = {
  id: string
  label: string           // e.g. "July 2026"
  startDate: string
  endDate: string
  residentCount: number
  budgetPerResidentPerDay: number
  totalDays: number
}

// ── Seed ─────────────────────────────────────────────────────────────────────
const CATEGORIES: SpendCategory[] = [
  'Food — Proteins', 'Food — Produce', 'Food — Dairy', 'Food — Dry Goods',
  'Food — Dietary / Special', 'Food — Beverages',
  'Non-Food — Cleaning', 'Non-Food — Paper Goods',
  'Labor', 'Equipment / Repair', 'Other',
]

const CURRENT_PERIOD: BudgetPeriod = {
  id: 'p1',
  label: 'July 2026',
  startDate: '2026-07-01',
  endDate: '2026-07-31',
  residentCount: 42,
  budgetPerResidentPerDay: 9.50,
  totalDays: 31,
}

const SEED_ENTRIES: SpendEntry[] = [
  // Week 1 deliveries
  { id:'e1',  date:'2026-07-02', vendor:'Sysco',         description:'Weekly truck order #1 — Proteins & Produce',  category:'Food — Proteins',          amount:412.80, invoiceRef:'SYS-88201', loggedBy:'Chef Maria' },
  { id:'e2',  date:'2026-07-02', vendor:'Sysco',         description:'Weekly truck order #1 — Dairy & Dry Goods',   category:'Food — Dairy',             amount:188.40, invoiceRef:'SYS-88201', loggedBy:'Chef Maria' },
  { id:'e3',  date:'2026-07-02', vendor:'Sysco',         description:'Weekly truck order #1 — Dietary specials',    category:'Food — Dietary / Special', amount:214.60, invoiceRef:'SYS-88201', loggedBy:'Chef Maria' },
  { id:'e4',  date:'2026-07-02', vendor:'Sysco',         description:'Weekly truck order #1 — Beverages',           category:'Food — Beverages',         amount: 96.30, invoiceRef:'SYS-88201', loggedBy:'Chef Maria' },
  { id:'e5',  date:'2026-07-02', vendor:'Sysco',         description:'Weekly truck order #1 — Paper & Cleaning',    category:'Non-Food — Paper Goods',   amount: 74.20, invoiceRef:'SYS-88201', loggedBy:'Chef Maria' },
  // Week 2 deliveries
  { id:'e6',  date:'2026-07-09', vendor:'Sysco',         description:'Weekly truck order #2 — Proteins',            category:'Food — Proteins',          amount:388.50, invoiceRef:'SYS-88390', loggedBy:'Chef Maria' },
  { id:'e7',  date:'2026-07-09', vendor:'Sysco',         description:'Weekly truck order #2 — Produce',             category:'Food — Produce',           amount:142.10, invoiceRef:'SYS-88390', loggedBy:'Chef Maria' },
  { id:'e8',  date:'2026-07-09', vendor:'Sysco',         description:'Weekly truck order #2 — Dairy',               category:'Food — Dairy',             amount:162.80, invoiceRef:'SYS-88390', loggedBy:'Chef Maria' },
  { id:'e9',  date:'2026-07-09', vendor:'Sysco',         description:'Weekly truck order #2 — Dry Goods',           category:'Food — Dry Goods',         amount: 88.60, invoiceRef:'SYS-88390', loggedBy:'Chef Maria' },
  { id:'e10', date:'2026-07-09', vendor:'Sysco',         description:'Weekly truck order #2 — Cleaning supplies',   category:'Non-Food — Cleaning',      amount: 52.40, invoiceRef:'SYS-88390', loggedBy:'Chef Maria' },
  // Misc this week
  { id:'e11', date:'2026-07-04', vendor:'Local Market',  description:'Supplemental produce — holiday cookout',      category:'Food — Produce',           amount: 64.75, loggedBy:'Chef Maria' },
  { id:'e12', date:'2026-07-01', vendor:'Sysco',         description:'Ensure Plus restock (supplemental)',           category:'Food — Dietary / Special', amount: 74.40, invoiceRef:'SYS-88100', loggedBy:'Manager Kim' },
  { id:'e13', date:'2026-07-03', vendor:'Home Depot',    description:'Fridge gasket replacement — Walk-in Cooler',   category:'Equipment / Repair',       amount:138.00, invoiceRef:'HD-39821', loggedBy:'Manager Kim' },
]

const PREV_PERIOD: BudgetPeriod = {
  id: 'p0',
  label: 'June 2026',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  residentCount: 41,
  budgetPerResidentPerDay: 9.50,
  totalDays: 30,
}

const SEED_PREV: SpendEntry[] = [
  { id:'p1e1', date:'2026-06-04', vendor:'Sysco', description:'Wk1 truck', category:'Food — Proteins',   amount:398.20, loggedBy:'Chef Maria' },
  { id:'p1e2', date:'2026-06-04', vendor:'Sysco', description:'Wk1 truck', category:'Food — Produce',    amount:128.40, loggedBy:'Chef Maria' },
  { id:'p1e3', date:'2026-06-04', vendor:'Sysco', description:'Wk1 truck', category:'Food — Dairy',      amount:174.60, loggedBy:'Chef Maria' },
  { id:'p1e4', date:'2026-06-11', vendor:'Sysco', description:'Wk2 truck', category:'Food — Proteins',   amount:421.80, loggedBy:'Chef Maria' },
  { id:'p1e5', date:'2026-06-11', vendor:'Sysco', description:'Wk2 truck', category:'Food — Produce',    amount:136.90, loggedBy:'Chef Maria' },
  { id:'p1e6', date:'2026-06-18', vendor:'Sysco', description:'Wk3 truck', category:'Food — Proteins',   amount:387.50, loggedBy:'Chef Maria' },
  { id:'p1e7', date:'2026-06-18', vendor:'Sysco', description:'Wk3 truck', category:'Food — Dry Goods',  amount: 91.20, loggedBy:'Chef Maria' },
  { id:'p1e8', date:'2026-06-25', vendor:'Sysco', description:'Wk4 truck', category:'Food — Proteins',   amount:410.00, loggedBy:'Chef Maria' },
  { id:'p1e9', date:'2026-06-25', vendor:'Sysco', description:'Wk4 truck', category:'Food — Dairy',      amount:182.00, loggedBy:'Chef Maria' },
  { id:'p1e10',date:'2026-06-25', vendor:'Sysco', description:'Wk4 truck', category:'Food — Beverages',  amount: 88.50, loggedBy:'Chef Maria' },
  { id:'p1e11',date:'2026-06-15', vendor:'Med Sup','description':'Simply Thick restock', category:'Food — Dietary / Special', amount:108.00, loggedBy:'Manager Kim' },
]

function uid() { return Math.random().toString(36).slice(2,10) }
function fmt$(n: number) { return `$${n.toFixed(2)}` }
function fmtPct(v: number, total: number) { return total === 0 ? '0%' : `${((v/total)*100).toFixed(1)}%` }

// ── Sub-components ────────────────────────────────────────────────────────────
function Badge({ children, color = 'var(--color-primary)' }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ display:'inline-block', fontSize:'var(--text-xs)', fontWeight:'var(--weight-bold)', padding:'2px 8px', borderRadius:20, background:`${color}22`, color, border:`1px solid ${color}55` }}>{children}</span>
  )
}

const TH: React.CSSProperties = { padding:'8px 12px', textAlign:'left', fontSize:'var(--text-xs)', fontWeight:'var(--weight-bold)', textTransform:'uppercase', letterSpacing:'0.4px', color:'var(--text-muted)', whiteSpace:'nowrap' }
const TD: React.CSSProperties = { padding:'9px 12px', verticalAlign:'middle', fontSize:'var(--text-sm)' }

const CATEGORY_COLORS: Record<SpendCategory, string> = {
  'Food — Proteins':          '#0ea5e9',
  'Food — Produce':           '#22c55e',
  'Food — Dairy':             '#f59e0b',
  'Food — Dry Goods':         '#a78bfa',
  'Food — Dietary / Special': '#ec4899',
  'Food — Beverages':         '#14b8a6',
  'Non-Food — Cleaning':      '#64748b',
  'Non-Food — Paper Goods':   '#94a3b8',
  'Labor':                    '#f97316',
  'Equipment / Repair':       '#dc2626',
  'Other':                    '#6b7280',
}

// ── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OverviewTab({ entries, period, prevEntries, prevPeriod }: { entries: SpendEntry[]; period: BudgetPeriod; prevEntries: SpendEntry[]; prevPeriod: BudgetPeriod }) {
  const totalBudget = period.residentCount * period.budgetPerResidentPerDay * period.totalDays
  const totalSpent  = entries.reduce((s, e) => s + e.amount, 0)
  const remaining   = totalBudget - totalSpent
  const pctUsed     = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  // Days elapsed in period
  const today = new Date().toISOString().slice(0,10)
  const start = new Date(period.startDate)
  const todayDate = new Date(today)
  const daysElapsed = Math.max(1, Math.min(period.totalDays, Math.ceil((todayDate.getTime() - start.getTime()) / 86400000) + 1))
  const projectedTotal = (totalSpent / daysElapsed) * period.totalDays
  const dailyCostPerRes = totalSpent / daysElapsed / period.residentCount

  const prevTotal = prevEntries.reduce((s, e) => s + e.amount, 0)
  const prevBudget = prevPeriod.residentCount * prevPeriod.budgetPerResidentPerDay * prevPeriod.totalDays
  const prevPctUsed = prevBudget > 0 ? (prevTotal / prevBudget) * 100 : 0

  const overBudget = remaining < 0
  const barColor = pctUsed > 90 ? '#dc2626' : pctUsed > 75 ? '#d97706' : '#059669'

  // Category totals
  const catTotals = CATEGORIES.map(c => ({ cat: c, total: entries.filter(e => e.category === c).reduce((s,e) => s+e.amount, 0) })).filter(x => x.total > 0).sort((a,b) => b.total - a.total)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-6)' }}>

      {/* Period summary stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:'var(--space-3)' }}>
        <div className="sl-stat-card">
          <div className="sl-eyebrow">Period Budget</div>
          <div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'var(--color-primary)' }}>{fmt$(totalBudget)}</div>
          <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:4 }}>{period.residentCount} residents · {fmt$(period.budgetPerResidentPerDay)}/res/day</div>
        </div>
        <div className="sl-stat-card">
          <div className="sl-eyebrow">Total Spent (MTD)</div>
          <div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color: overBudget ? '#dc2626' : 'var(--text-primary)' }}>{fmt$(totalSpent)}</div>
          <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:4 }}>{pctUsed.toFixed(1)}% of period budget</div>
        </div>
        <div className="sl-stat-card">
          <div className="sl-eyebrow">{overBudget ? 'Over Budget' : 'Remaining'}</div>
          <div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color: overBudget ? '#dc2626' : '#059669' }}>{fmt$(Math.abs(remaining))}</div>
          <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:4 }}>{period.totalDays - daysElapsed} days left in period</div>
        </div>
        <div className="sl-stat-card">
          <div className="sl-eyebrow">Daily Cost / Resident</div>
          <div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color: dailyCostPerRes > period.budgetPerResidentPerDay ? '#dc2626' : '#059669' }}>{fmt$(dailyCostPerRes)}</div>
          <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:4 }}>Budget: {fmt$(period.budgetPerResidentPerDay)}/res/day</div>
        </div>
        <div className="sl-stat-card">
          <div className="sl-eyebrow">Projected Month-End</div>
          <div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color: projectedTotal > totalBudget ? '#dc2626' : '#d97706' }}>{fmt$(projectedTotal)}</div>
          <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:4 }}>Based on {daysElapsed}-day spend rate</div>
        </div>
        <div className="sl-stat-card">
          <div className="sl-eyebrow">Prior Period ({prevPeriod.label})</div>
          <div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'var(--text-muted)' }}>{fmt$(prevTotal)}</div>
          <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:4 }}>{prevPctUsed.toFixed(1)}% of budget</div>
        </div>
      </div>

      {/* Budget progress bar */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-5)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{period.label} Budget Utilization</div>
          <div style={{ fontSize:13, fontWeight:700, color: barColor }}>{pctUsed.toFixed(1)}%</div>
        </div>
        <div style={{ height:18, background:'var(--bg-app)', borderRadius:9, overflow:'hidden', border:'1px solid var(--border-color)' }}>
          <div style={{ height:'100%', width:`${Math.min(100,pctUsed)}%`, background:barColor, borderRadius:9, transition:'width 0.5s ease', position:'relative' }}>
            {pctUsed > 20 && <span style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', fontSize:10, fontWeight:700, color:'#fff' }}>{fmt$(totalSpent)}</span>}
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
          <span>$0</span><span>Budget: {fmt$(totalBudget)}</span>
        </div>
        {overBudget && <div style={{ marginTop:10, padding:'8px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'var(--radius-md)', fontSize:13, color:'#991b1b', fontWeight:600 }}>⚠ Over budget by {fmt$(Math.abs(remaining))} — review spending log and contact administrator.</div>}
        {!overBudget && projectedTotal > totalBudget && <div style={{ marginTop:10, padding:'8px 14px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'var(--radius-md)', fontSize:13, color:'#92400e', fontWeight:600 }}>⚠ Projected month-end {fmt$(projectedTotal)} exceeds budget by {fmt$(projectedTotal - totalBudget)} — consider reducing order quantities.</div>}
      </div>

      {/* Category breakdown */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'var(--space-4)' }}>
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)' }}>
          <div className="sl-section-title" style={{ color:'var(--color-primary)', marginBottom:'var(--space-3)' }}>Spend by Category</div>
          {catTotals.map(({ cat, total }) => (
            <div key={cat} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                <span style={{ fontWeight:600, color:'var(--text-primary)' }}>{cat}</span>
                <span style={{ fontWeight:700, color:CATEGORY_COLORS[cat] }}>{fmt$(total)} <span style={{ fontWeight:400, color:'var(--text-muted)' }}>({fmtPct(total,totalSpent)})</span></span>
              </div>
              <div style={{ height:8, background:'var(--bg-app)', borderRadius:4, overflow:'hidden', border:'1px solid var(--border-color)' }}>
                <div style={{ height:'100%', width:`${(total/totalSpent)*100}%`, background:CATEGORY_COLORS[cat], borderRadius:4, transition:'width 0.4s ease' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Period-over-period comparison */}
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)' }}>
          <div className="sl-section-title" style={{ color:'var(--color-primary)', marginBottom:'var(--space-3)' }}>Period Comparison</div>
          {[
            { label: 'Total Spend',          cur: totalSpent,          prev: prevTotal },
            { label: 'Budget',               cur: totalBudget,         prev: prevBudget },
            { label: '% of Budget',          cur: pctUsed,             prev: prevPctUsed, isPct: true },
            { label: 'Daily / Resident',     cur: dailyCostPerRes,     prev: prevTotal / prevPeriod.totalDays / prevPeriod.residentCount },
          ].map(row => {
            const diff = row.cur - row.prev
            const up = diff > 0
            return (
              <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border-color)' }}>
                <span style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:600 }}>{row.label}</span>
                <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>{row.isPct ? `${row.prev.toFixed(1)}%` : fmt$(row.prev)}</span>
                  <span style={{ fontSize:10, color: up ? '#dc2626' : '#059669', fontWeight:700 }}>{up ? '▲' : '▼'} {row.isPct ? `${Math.abs(diff).toFixed(1)}%` : fmt$(Math.abs(diff))}</span>
                  <span style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)', fontFamily:'var(--font-display)', minWidth:70, textAlign:'right' }}>{row.isPct ? `${row.cur.toFixed(1)}%` : fmt$(row.cur)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── SPENDING LOG TAB ──────────────────────────────────────────────────────────
function SpendingLogTab({ entries, setEntries, period }: { entries: SpendEntry[]; setEntries: React.Dispatch<React.SetStateAction<SpendEntry[]>>; period: BudgetPeriod }) {
  const [search, setSearch]   = useState('')
  const [filterCat, setFCat] = useState<SpendCategory | 'All'>('All')
  const [showForm, setShow]   = useState(false)
  const [form, setForm]       = useState<Partial<SpendEntry>>({ date: new Date().toISOString().slice(0,10), category:'Food — Proteins', loggedBy:'', amount:0 })
  const [sortField, setSort]  = useState<'date' | 'amount' | 'category'>('date')
  const [sortDir, setSDir]    = useState<'asc' | 'desc'>('desc')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return entries
      .filter(e =>
        (filterCat === 'All' || e.category === filterCat) &&
        (!q || e.description.toLowerCase().includes(q) || e.vendor.toLowerCase().includes(q) || (e.invoiceRef ?? '').toLowerCase().includes(q))
      )
      .sort((a,b) => {
        let va: any = a[sortField], vb: any = b[sortField]
        if (sortField === 'amount') { va = a.amount; vb = b.amount }
        const cmp = typeof va === 'number' ? va - vb : (va as string).localeCompare(vb as string)
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [entries, search, filterCat, sortField, sortDir])

  function toggleSort(f: typeof sortField) {
    if (sortField === f) setSDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSort(f); setSDir('desc') }
  }

  function addEntry() {
    if (!form.vendor?.trim() || !form.description?.trim() || !form.loggedBy?.trim() || !form.amount) return
    setEntries(p => [{ id:uid(), date:form.date!, vendor:form.vendor!, description:form.description!, category:form.category as SpendCategory, amount:form.amount!, invoiceRef:form.invoiceRef, loggedBy:form.loggedBy! }, ...p])
    setForm({ date:new Date().toISOString().slice(0,10), category:'Food — Proteins', loggedBy:'', amount:0 })
    setShow(false)
  }

  const filteredTotal = filtered.reduce((s,e) => s+e.amount, 0)
  const SortIcon = ({ f }: { f: typeof sortField }) => <span style={{ marginLeft:3, fontSize:9, color:'var(--text-muted)' }}>{sortField===f ? (sortDir==='asc' ? '▲' : '▼') : '⇅'}</span>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
      {/* Controls */}
      <div style={{ display:'flex', gap:'var(--space-3)', flexWrap:'wrap', alignItems:'center' }}>
        <input className="sl-input" style={{ flex:'1 1 180px', maxWidth:280 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendor, description, invoice…" />
        <select className="sl-select" value={filterCat} onChange={e => setFCat(e.target.value as any)} style={{ flex:'1 1 160px', maxWidth:240 }}>
          <option value="All">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--color-primary)', alignSelf:'center' }}>Showing: {fmt$(filteredTotal)}</span>
          <button onClick={() => setShow(v => !v)} className="btn btn-primary">+ Log Expense</button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)', display:'flex', flexWrap:'wrap', gap:'var(--space-3)' }}>
          <div style={{ flex:'1 1 140px' }}><label>Vendor</label><input className="sl-input" value={form.vendor??''} onChange={e => setForm(p => ({...p,vendor:e.target.value}))} placeholder="e.g. Sysco" /></div>
          <div style={{ flex:'2 1 200px' }}><label>Description</label><input className="sl-input" value={form.description??''} onChange={e => setForm(p => ({...p,description:e.target.value}))} placeholder="e.g. Weekly truck order #3" /></div>
          <div style={{ flex:'1 1 160px' }}><label>Category</label><select className="sl-select" value={form.category} onChange={e => setForm(p => ({...p,category:e.target.value as SpendCategory}))}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div style={{ flex:'0 1 100px' }}><label>Amount $</label><input type="number" step="0.01" min={0} className="sl-input" value={form.amount||''} onChange={e => setForm(p => ({...p,amount:+e.target.value}))} /></div>
          <div style={{ flex:'0 1 120px' }}><label>Date</label><input type="date" className="sl-input" value={form.date} onChange={e => setForm(p => ({...p,date:e.target.value}))} /></div>
          <div style={{ flex:'0 1 130px' }}><label>Invoice Ref</label><input className="sl-input" value={form.invoiceRef??''} onChange={e => setForm(p => ({...p,invoiceRef:e.target.value}))} placeholder="optional" /></div>
          <div style={{ flex:'1 1 130px' }}><label>Logged By</label><input className="sl-input" value={form.loggedBy??''} onChange={e => setForm(p => ({...p,loggedBy:e.target.value}))} placeholder="Staff name" /></div>
          <div style={{ display:'flex', gap:8, alignItems:'flex-end', flexShrink:0 }}>
            <button onClick={addEntry} className="btn btn-primary">Save</button>
            <button onClick={() => setShow(false)} className="btn btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'var(--text-sm)' }}>
            <thead><tr style={{ background:'var(--bg-app)' }}>
              <th style={{ ...TH, cursor:'pointer' }} onClick={() => toggleSort('date')}>Date <SortIcon f="date" /></th>
              <th style={TH}>Vendor</th>
              <th style={TH}>Description</th>
              <th style={{ ...TH, cursor:'pointer' }} onClick={() => toggleSort('category')}>Category <SortIcon f="category" /></th>
              <th style={{ ...TH, cursor:'pointer', textAlign:'right' }} onClick={() => toggleSort('amount')}>Amount <SortIcon f="amount" /></th>
              <th style={TH}>Invoice</th>
              <th style={TH}>By</th>
              <th style={TH} />
            </tr></thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={e.id} style={{ background: i%2===0 ? 'var(--bg-card)' : 'var(--bg-app)', borderBottom:'1px solid var(--border-color)' }}>
                  <td style={{ ...TD, color:'var(--text-muted)' }}>{e.date}</td>
                  <td style={{ ...TD, fontWeight:600, color:'var(--text-primary)' }}>{e.vendor}</td>
                  <td style={{ ...TD, color:'var(--text-secondary)', maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.description}</td>
                  <td style={TD}><Badge color={CATEGORY_COLORS[e.category]}>{e.category}</Badge></td>
                  <td style={{ ...TD, fontWeight:700, color:'var(--color-primary)', textAlign:'right', fontFamily:'var(--font-display)', whiteSpace:'nowrap' }}>{fmt$(e.amount)}</td>
                  <td style={{ ...TD, color:'var(--text-muted)', fontSize:'var(--text-xs)' }}>{e.invoiceRef || '—'}</td>
                  <td style={{ ...TD, color:'var(--text-muted)', fontSize:'var(--text-xs)' }}>{e.loggedBy}</td>
                  <td style={TD}><button onClick={() => setEntries(p => p.filter(x => x.id !== e.id))} style={{ background:'none', border:'none', color:'var(--color-danger)', cursor:'pointer', fontSize:12 }}>Remove</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:'var(--bg-app)', borderTop:'2px solid var(--border-color)' }}>
                <td colSpan={4} style={{ ...TD, fontWeight:700, color:'var(--text-primary)' }}>Total ({filtered.length} entries)</td>
                <td style={{ ...TD, fontWeight:800, color:'var(--color-primary)', textAlign:'right', fontFamily:'var(--font-display)', fontSize:15 }}>{fmt$(filteredTotal)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {filtered.length === 0 && <div className="sl-empty"><div style={{ fontSize:36 }}>💸</div><div className="sl-empty-title">No entries match your filter.</div></div>}
    </div>
  )
}

// ── PER-RESIDENT COST TAB ─────────────────────────────────────────────────────
function PerResidentTab({ entries, period }: { entries: SpendEntry[]; period: BudgetPeriod }) {
  const today = new Date().toISOString().slice(0,10)
  const start = new Date(period.startDate)
  const daysElapsed = Math.max(1, Math.min(period.totalDays, Math.ceil((new Date(today).getTime() - start.getTime()) / 86400000) + 1))

  const totalSpent = entries.reduce((s,e) => s+e.amount, 0)
  const foodEntries = entries.filter(e => e.category.startsWith('Food'))
  const nonFoodEntries = entries.filter(e => !e.category.startsWith('Food'))
  const laborEntries = entries.filter(e => e.category === 'Labor')

  const foodSpent = foodEntries.reduce((s,e) => s+e.amount, 0)
  const nonFoodSpent = nonFoodEntries.reduce((s,e) => s+e.amount, 0)

  const dailyPerRes     = totalSpent / daysElapsed / period.residentCount
  const foodPerRes      = foodSpent  / daysElapsed / period.residentCount
  const nonFoodPerRes   = nonFoodSpent / daysElapsed / period.residentCount

  const rows = [
    { label:'Total Cost / Resident / Day',    val:dailyPerRes,   budget:period.budgetPerResidentPerDay, note:'All categories' },
    { label:'Food Only / Resident / Day',     val:foodPerRes,    budget:period.budgetPerResidentPerDay * 0.80, note:'~80% budget target for food' },
    { label:'Non-Food / Resident / Day',      val:nonFoodPerRes, budget:period.budgetPerResidentPerDay * 0.20, note:'~20% budget target for supplies' },
    { label:'Total Cost / Resident / Month',  val:dailyPerRes * period.totalDays, budget:period.budgetPerResidentPerDay * period.totalDays, note:'Projected full month at current rate' },
  ]

  // Daily cost by week
  const weekTotals: { week: string; total: number }[] = []
  for (let w = 0; w < 5; w++) {
    const ws = new Date(start)
    ws.setDate(ws.getDate() + w*7)
    const we = new Date(ws)
    we.setDate(we.getDate() + 6)
    const wsStr = ws.toISOString().slice(0,10)
    const weStr = we.toISOString().slice(0,10)
    const wEntries = entries.filter(e => e.date >= wsStr && e.date <= weStr)
    if (wEntries.length > 0 || w < 4) {
      weekTotals.push({ week:`Wk ${w+1} (${wsStr.slice(5)})`, total: wEntries.reduce((s,e) => s+e.amount,0) })
    }
  }
  const maxWeek = Math.max(...weekTotals.map(w => w.total), 1)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>

      {/* Key metrics */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:'var(--space-3)' }}>
        {rows.map(r => {
          const over = r.val > r.budget
          return (
            <div key={r.label} className="sl-stat-card">
              <div className="sl-eyebrow">{r.label}</div>
              <div style={{ fontSize:'var(--text-2xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color: over ? '#dc2626' : '#059669' }}>{fmt$(r.val)}</div>
              <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:4 }}>Target: {fmt$(r.budget)} · {r.note}</div>
              {over && <div style={{ marginTop:6, fontSize:10, fontWeight:700, color:'#dc2626' }}>▲ {fmt$(r.val - r.budget)} over target</div>}
            </div>
          )
        })}
      </div>

      {/* Weekly spend bars */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)' }}>
        <div className="sl-section-title" style={{ color:'var(--color-primary)', marginBottom:'var(--space-3)' }}>Weekly Spend (all categories)</div>
        {weekTotals.map(w => (
          <div key={w.week} style={{ display:'flex', alignItems:'center', gap:'var(--space-3)', marginBottom:10 }}>
            <span style={{ fontSize:12, color:'var(--text-secondary)', minWidth:110 }}>{w.week}</span>
            <div style={{ flex:1, height:14, background:'var(--bg-app)', borderRadius:7, overflow:'hidden', border:'1px solid var(--border-color)' }}>
              <div style={{ height:'100%', width:`${Math.max(2,(w.total/maxWeek)*100)}%`, background:'var(--color-primary)', borderRadius:7, transition:'width 0.4s ease' }} />
            </div>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', minWidth:70, textAlign:'right' }}>{fmt$(w.total)}</span>
            <span style={{ fontSize:11, color:'var(--text-muted)', minWidth:80, textAlign:'right' }}>{fmt$(w.total / period.residentCount / 7)}/res/day</span>
          </div>
        ))}
      </div>

      {/* Info tip */}
      <div className="sl-alert sl-alert-info" style={{ fontSize:'var(--text-sm)' }}>
        <b>📋 Note:</b> Per-resident cost includes all logged spend categories. Labor, equipment, and repair costs are included in the total but tracked separately. Food-only cost should stay within 75–80% of the daily budget per resident ({fmt$(period.budgetPerResidentPerDay * 0.80)}/res/day).
      </div>
    </div>
  )
}

// ── SETTINGS PANEL ────────────────────────────────────────────────────────────
function SettingsTab({ period, setPeriod }: { period: BudgetPeriod; setPeriod: React.Dispatch<React.SetStateAction<BudgetPeriod>> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<BudgetPeriod>(period)

  function save() { setPeriod(draft); setEditing(false) }

  const row = (label: string, node: React.ReactNode) => (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border-color)' }}>
      <span style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)', minWidth:200 }}>{label}</span>
      <div style={{ flex:1 }}>{node}</div>
    </div>
  )

  const inp = (value: string | number, onChange: (v: string) => void, type = 'text') => (
    editing
      ? <input type={type} step={type==='number'?'0.01':undefined} className="sl-input" style={{ maxWidth:200 }} value={value} onChange={e => onChange(e.target.value)} />
      : <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{value}</span>
  )

  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-5)', maxWidth:560 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-4)' }}>
        <div className="sl-section-title" style={{ color:'var(--color-primary)', margin:0 }}>Budget Period Settings</div>
        {editing
          ? <div style={{ display:'flex', gap:8 }}><button onClick={save} className="btn btn-primary btn-sm">Save</button><button onClick={() => { setDraft(period); setEditing(false) }} className="btn btn-outline btn-sm">Cancel</button></div>
          : <button onClick={() => setEditing(true)} className="btn btn-outline btn-sm">Edit</button>}
      </div>
      {row('Period Label',                inp(draft.label,            v => setDraft(p => ({...p,label:v}))))}
      {row('Start Date',                  inp(draft.startDate,        v => setDraft(p => ({...p,startDate:v})), 'date'))}
      {row('End Date',                    inp(draft.endDate,          v => setDraft(p => ({...p,endDate:v})), 'date'))}
      {row('Total Days',                  inp(draft.totalDays,        v => setDraft(p => ({...p,totalDays:+v})), 'number'))}
      {row('Resident Count',              inp(draft.residentCount,    v => setDraft(p => ({...p,residentCount:+v})), 'number'))}
      {row('Budget / Resident / Day ($)', inp(draft.budgetPerResidentPerDay, v => setDraft(p => ({...p,budgetPerResidentPerDay:+v})), 'number'))}
      <div style={{ marginTop:14, padding:'10px 14px', background:'var(--bg-app)', borderRadius:'var(--radius-md)', border:'1px solid var(--border-color)', fontSize:13 }}>
        Computed total budget: <b style={{ color:'var(--color-primary)' }}>{fmt$(draft.residentCount * draft.budgetPerResidentPerDay * draft.totalDays)}</b>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type BudgetTab = 'overview' | 'log' | 'per-resident' | 'settings'
const BUDGET_TABS: { id: BudgetTab; label: string; icon: string }[] = [
  { id:'overview',      label:'Overview',          icon:'📊' },
  { id:'log',           label:'Spending Log',       icon:'💸' },
  { id:'per-resident',  label:'Per-Resident Cost',  icon:'👤' },
  { id:'settings',      label:'Period Settings',    icon:'⚙️' },
]

export default function BudgetPage() {
  const [tab, setTab]         = useState<BudgetTab>('overview')
  const [period, setPeriod]   = useState<BudgetPeriod>(CURRENT_PERIOD)
  const [entries, setEntries] = useState<SpendEntry[]>(JSON.parse(JSON.stringify(SEED_ENTRIES)))

  const totalBudget = period.residentCount * period.budgetPerResidentPerDay * period.totalDays
  const totalSpent  = entries.reduce((s,e) => s+e.amount, 0)
  const pctUsed     = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
  const overBudget  = totalSpent > totalBudget

  return (
    <div className="sl-page fade-in">
      <div className="sl-page-header">
        <h1 className="sl-page-title">Budget &amp; Spending</h1>
        <p className="sl-page-subtitle">Track food and supply costs against your per-resident daily budget.</p>
      </div>

      {/* Quick status strip */}
      <div style={{ display:'flex', gap:'var(--space-3)', flexWrap:'wrap', marginBottom:'var(--space-5)', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', background:'var(--bg-card)', border:`1px solid ${overBudget ? '#fecaca' : 'var(--border-color)'}`, borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-sm)' }}>
          <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-muted)' }}>{period.label}</span>
          <div style={{ width:1, height:16, background:'var(--border-color)' }} />
          <span style={{ fontSize:13, fontWeight:800, color:'var(--color-primary)', fontFamily:'var(--font-display)' }}>{fmt$(totalSpent)}</span>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>of</span>
          <span style={{ fontSize:13, fontWeight:800, color:'var(--text-secondary)', fontFamily:'var(--font-display)' }}>{fmt$(totalBudget)}</span>
          <div style={{ width:80, height:8, background:'var(--bg-app)', borderRadius:4, overflow:'hidden', border:'1px solid var(--border-color)' }}>
            <div style={{ height:'100%', width:`${Math.min(100,pctUsed)}%`, background: overBudget ? '#dc2626' : pctUsed > 75 ? '#d97706' : '#059669', borderRadius:4 }} />
          </div>
          <span style={{ fontSize:11, fontWeight:700, color: overBudget ? '#dc2626' : pctUsed > 75 ? '#d97706' : '#059669' }}>{pctUsed.toFixed(1)}%</span>
        </div>
        {overBudget && <span style={{ fontSize:12, fontWeight:700, color:'#dc2626' }}>⚠ Over budget</span>}
      </div>

      <div className="sl-pills" style={{ marginBottom:'var(--space-6)', flexWrap:'wrap' }}>
        {BUDGET_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={tab === t.id ? 'sl-pill active' : 'sl-pill'}>
            <span style={{ marginRight:'var(--space-1)' }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-6)', boxShadow:'var(--shadow-sm)' }}>
        {tab === 'overview'     && <OverviewTab entries={entries} period={period} prevEntries={SEED_PREV} prevPeriod={PREV_PERIOD} />}
        {tab === 'log'          && <SpendingLogTab entries={entries} setEntries={setEntries} period={period} />}
        {tab === 'per-resident' && <PerResidentTab entries={entries} period={period} />}
        {tab === 'settings'     && <SettingsTab period={period} setPeriod={setPeriod} />}
      </div>
    </div>
  )
}
