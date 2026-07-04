import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useResidentsStore } from '@/state/residentsStore'
import { useMenuStore } from '@/state/menuStore'
import { useCommunicationsStore } from '@/state/communicationsStore'
import { useProductionStore } from '@/state/productionStore'
import { useInventoryStore } from '@/state/inventoryStore'
import { useAuth } from '@/security/AuthContext'
import type { DayOfWeek } from '@/types'

// ── Budget seed (static until a shared budget store exists) ──────────────────
const BUDGET_PERIOD = { residentCount: 42, budgetPerResidentPerDay: 9.50, totalDays: 31, label: 'July 2026', startDate: '2026-07-01' }
const BUDGET_SPENT  = 1097.85

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES: DayOfWeek[] = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const KEY_ALLERGIES = ['Gluten-Free','Dairy-Free','Nut Allergy','Egg Allergy','Shellfish','Soy-Free','Vegan','Vegetarian','Kosher','Halal']

// ── CSS ─────────────────────────────────────────────────────────────────────────────
const DASH_CSS = `
  .dash-metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 14px;
  }
  @media (min-width: 1024px) {
    .dash-metrics { grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
  }
  .dash-metrics-wide {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 14px;
  }
  @media (min-width: 768px) {
    .dash-metrics-wide { grid-template-columns: repeat(3, 1fr); }
  }
  @media (min-width: 1200px) {
    .dash-metrics-wide { grid-template-columns: repeat(6, 1fr); }
  }
  .dash-two-col {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
    margin-bottom: 14px;
  }
  @media (min-width: 1024px) {
    .dash-two-col { grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  }
  .dash-three-col {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
    margin-bottom: 14px;
  }
  @media (min-width: 900px) {
    .dash-three-col { grid-template-columns: 1fr 1fr; }
  }
  @media (min-width: 1200px) {
    .dash-three-col { grid-template-columns: 1fr 1fr 1fr; gap: 18px; margin-bottom: 20px; }
  }
  .dash-quick-links-section { display: none; }
  @media (min-width: 768px) {
    .dash-quick-links-section { display: block; }
    .dash-quick-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  }
  .metric-card {
    background: var(--bg-card); border: 1px solid var(--border-color);
    border-radius: var(--radius-lg); padding: 14px 12px;
    display: flex; align-items: center; gap: 10px;
    box-shadow: var(--shadow-sm); cursor: pointer;
    transition: all 0.18s ease; text-decoration: none; color: inherit;
  }
  .metric-card:active { transform: scale(0.97); }
  @media (min-width: 1024px) {
    .metric-card { padding: 20px 18px; gap: 14px; }
    .metric-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--color-primary); }
  }
  .metric-card.alert-card { border-color: #fca5a5; background: #fff5f5; }
  .metric-card.warn-card  { border-color: #fde68a; background: #fffbeb; }
  .metric-icon {
    width: 36px; height: 36px; border-radius: var(--radius-md);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  @media (min-width: 1024px) { .metric-icon { width: 44px; height: 44px; } }
  .metric-label { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .metric-value { font-size: 22px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif; line-height: 1; }
  @media (min-width: 1024px) { .metric-value { font-size: 28px; } }
  .metric-sub { font-size: 10px; color: var(--text-muted); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prep-pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .prep-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;
    border: 1px solid transparent; cursor: pointer; transition: all 0.15s ease;
    text-decoration: none; white-space: nowrap;
  }
  .prep-pill:active { transform: scale(0.95); }
  .bday-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: var(--radius-md); background: var(--bg-app); border: 1px solid var(--border-color); gap: 10px; }
  .bday-table { display: none; }
  @media (min-width: 768px) {
    .bday-row { display: none; }
    .bday-table { display: block; }
  }
  .sl-section-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: hidden; }
  .sl-section-header { padding: 12px 16px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; background: var(--color-primary-light); }
  .sl-section-body { padding: 14px 16px; }
  .quick-link-card {
    background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg);
    padding: 16px 18px; display: flex; align-items: center; gap: 14px;
    box-shadow: var(--shadow-sm); transition: all 0.18s ease; cursor: pointer;
    text-decoration: none; color: inherit; min-height: 52px;
  }
  .quick-link-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--color-primary); }
  .menu-meal-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  @media (min-width: 600px) {
    .menu-meal-grid { grid-template-columns: 1fr 1fr; }
  }
`

function InjectDashStyles() {
  useEffect(() => {
    const id = 'sl-dash-css'
    if (document.getElementById(id)) return
    const el = document.createElement('style')
    el.id = id
    el.textContent = DASH_CSS
    document.head.appendChild(el)
  }, [])
  return null
}

function MetricCard({ label, value, sub, iconBg, icon, to, alertClass }: {
  label: string; value: string | number; sub?: string
  iconBg: string; icon: React.ReactNode; to?: string; alertClass?: string
}) {
  const navigate = useNavigate()
  return (
    <div className={`metric-card${alertClass ? ' ' + alertClass : ''}`} onClick={() => to && navigate(to)} role={to ? 'link' : undefined}>
      <div className="metric-icon" style={{ background: iconBg }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        {sub && <div className="metric-sub">{sub}</div>}
      </div>
    </div>
  )
}

function PrepPill({ label, count, bg, color, border }: { label: string; count: number; bg: string; color: string; border: string }) {
  if (count === 0) return null
  return (
    <Link to="/residents" className="prep-pill" style={{ background: bg, color, borderColor: border }}>
      <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>{count}</span>
      <span>{label}</span>
    </Link>
  )
}

function SectionCard({ title, children, action, headerBg }: { title: string; children: React.ReactNode; action?: React.ReactNode; headerBg?: string }) {
  return (
    <div className="sl-section-card">
      <div className="sl-section-header" style={headerBg ? { background: headerBg } : undefined}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', margin: 0 }}>{title}</h3>
        {action}
      </div>
      <div className="sl-section-body">{children}</div>
    </div>
  )
}

function QuickLink({ to, label, desc, iconColor, icon, badge }: { to: string; label: string; desc: string; iconColor: string; icon: React.ReactNode; badge?: number }) {
  return (
    <Link to={to} className="quick-link-card">
      <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
        {icon}
        {badge != null && badge > 0 && (
          <span style={{ position: 'absolute', top: -5, right: -5, background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 10, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{badge}</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'Outfit, sans-serif', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{desc}</div>
      </div>
      <svg width="13" height="13" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
    </Link>
  )
}

function MealColumn({ mealLabel, opt1Names, opt2Names }: { mealLabel: string; opt1Names: string[]; opt2Names: string[] }) {
  return (
    <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{mealLabel}</div>
      {[{ label: 'Option 1', names: opt1Names }, { label: 'Option 2', names: opt2Names }].map(({ label, names }) => (
        <div key={label} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{label}</div>
          {names.length ? (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {names.map(n => (
                <li key={n} style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, opacity: 0.5 }} />
                  {n}
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Budget progress bar (inline, no store yet) ─────────────────────────────────
function BudgetStrip() {
  const start = new Date(BUDGET_PERIOD.startDate)
  const today = new Date()
  const daysElapsed = Math.max(1, Math.min(BUDGET_PERIOD.totalDays, Math.ceil((today.getTime() - start.getTime()) / 86400000) + 1))
  const totalBudget = BUDGET_PERIOD.residentCount * BUDGET_PERIOD.budgetPerResidentPerDay * BUDGET_PERIOD.totalDays
  const projected = (BUDGET_SPENT / daysElapsed) * BUDGET_PERIOD.totalDays
  const pct = Math.min(100, (BUDGET_SPENT / totalBudget) * 100)
  const color = pct > 90 ? '#dc2626' : pct > 75 ? '#d97706' : '#059669'
  const fmt = (n: number) => `$${n.toFixed(2)}`
  return (
    <Link to="/budget" style={{ display: 'block', textDecoration: 'none' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', boxShadow: 'var(--shadow-sm)', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>💰 {BUDGET_PERIOD.label} Budget</span>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Spent: <b style={{ color: 'var(--text-primary)' }}>{fmt(BUDGET_SPENT)}</b></span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Budget: <b style={{ color: 'var(--text-primary)' }}>{fmt(totalBudget)}</b></span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Projected: <b style={{ color }}>{fmt(projected)}</b></span>
            <span style={{ fontSize: 12, fontWeight: 800, color }}>{pct.toFixed(1)}% used</span>
          </div>
        </div>
        <div style={{ height: 10, background: 'var(--bg-app)', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 5, transition: 'width 0.5s ease' }} />
        </div>
      </div>
    </Link>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, atLeast } = useAuth()
  const { residents, loading, fetch } = useResidentsStore()
  const { weeks, items, fetchWeeks, fetchItems } = useMenuStore()
  const { threads, fetchThreads } = useCommunicationsStore()
  const { tasks, fetch: fetchProduction } = useProductionStore()
  const { fetch: fetchInventory, getLowParItems, getZeroItems } = useInventoryStore()

  useEffect(() => { fetch() },           []) // eslint-disable-line
  useEffect(() => { fetchWeeks() },      []) // eslint-disable-line
  useEffect(() => { fetchItems() },      []) // eslint-disable-line
  useEffect(() => { fetchThreads() },    []) // eslint-disable-line
  useEffect(() => { fetchProduction() }, []) // eslint-disable-line
  useEffect(() => { fetchInventory() },  []) // eslint-disable-line

  // ── Live inventory ─────────────────────────────────────────────────────────────
  const lowParItems = getLowParItems()
  const zeroItems   = getZeroItems()

  // ── Residents ──────────────────────────────────────────────────────────────────
  const active      = useMemo(() => residents.filter(r => r.status === 'Active'), [residents])
  const hospital    = useMemo(() => residents.filter(r => r.status === 'Hospital').length, [residents])
  const loa         = useMemo(() => residents.filter(r => r.status === 'LOA').length, [residents])
  const totalEnsure = useMemo(() => residents.reduce((s, r) => s + (r.ensurePerDay ?? 0), 0), [residents])
  const roomTrays   = useMemo(() => active.filter(r => r.servingLocation === 'Room').length, [active])
  const diningRoom  = useMemo(() => active.filter(r => r.servingLocation === 'Dining Room').length, [active])

  const cutUp  = useMemo(() => active.filter(r => r.texture === 'Cut-Up').length, [active])
  const minced = useMemo(() => active.filter(r => r.texture === 'Minced' || r.texture === 'Minced & Moist').length, [active])
  const pureed = useMemo(() => active.filter(r => r.texture === 'Pureed').length, [active])

  const keyAllergyCount = useMemo(() => {
    const map: Record<string, number> = {}
    active.forEach(r => r.allergies?.forEach(a => {
      if (KEY_ALLERGIES.includes(a)) map[a] = (map[a] ?? 0) + 1
    }))
    return map
  }, [active])

  // ── Birthdays ─────────────────────────────────────────────────────────────────
  const upcomingBirthdays = useMemo(() => {
    const today = new Date()
    const results: { name: string; room: string; monthDay: string; daysUntil: number }[] = []
    residents.forEach(r => {
      if (!r.birthdayMonth || !r.birthdayDay) return
      const monthIdx = MONTH_NAMES.indexOf(r.birthdayMonth)
      if (monthIdx === -1) return
      const bday = new Date(today.getFullYear(), monthIdx, r.birthdayDay)
      if (bday < new Date(today.getFullYear(), today.getMonth(), today.getDate())) bday.setFullYear(today.getFullYear() + 1)
      const diff = Math.round((bday.getTime() - today.getTime()) / 86400000)
      if (diff <= 30) results.push({ name: r.name, room: r.room, monthDay: `${r.birthdayMonth.slice(0,3)} ${r.birthdayDay}`, daysUntil: diff })
    })
    return results.sort((a, b) => a.daysUntil - b.daysUntil)
  }, [residents])

  // ── Menu ────────────────────────────────────────────────────────────────────────
  const todayDay   = DAY_NAMES[new Date().getDay()]
  const activeWeek = useMemo(() => weeks.find(w => w.active) ?? weeks[0] ?? null, [weeks])
  const todayMenu  = useMemo(() => activeWeek?.days?.[todayDay] ?? null, [activeWeek, todayDay])
  const itemMap    = useMemo(() => Object.fromEntries(items.map(i => [i.id, i.name])), [items])

  function resolveNames(ids: string[] = []) {
    return ids.map(id => itemMap[id] ?? id).filter(Boolean)
  }

  const lunchOpt1   = todayMenu ? resolveNames([...(todayMenu.lunchOpt1Meat?.itemIds ?? []), ...(todayMenu.lunchOpt1Veggie?.itemIds ?? []), ...(todayMenu.lunchOpt1Starch?.itemIds ?? [])]) : []
  const lunchOpt2   = todayMenu ? resolveNames([...(todayMenu.lunchOpt2Meat?.itemIds ?? []), ...(todayMenu.lunchOpt2Veggie?.itemIds ?? []), ...(todayMenu.lunchOpt2Starch?.itemIds ?? [])]) : []
  const dinnerOpt1  = todayMenu ? resolveNames([...(todayMenu.dinnerOpt1Meat?.itemIds ?? []), ...(todayMenu.dinnerOpt1Veggie?.itemIds ?? []), ...(todayMenu.dinnerOpt1Starch?.itemIds ?? [])]) : []
  const dinnerOpt2  = todayMenu ? resolveNames([...(todayMenu.dinnerOpt2Meat?.itemIds ?? []), ...(todayMenu.dinnerOpt2Veggie?.itemIds ?? []), ...(todayMenu.dinnerOpt2Starch?.itemIds ?? [])]) : []
  const lunchDessert  = todayMenu ? resolveNames(todayMenu.lunchDessert?.itemIds ?? []).join(', ')  : ''
  const dinnerDessert = todayMenu ? resolveNames(todayMenu.dinnerDessert?.itemIds ?? []).join(', ') : ''

  // ── Communications ─────────────────────────────────────────────────────────
  const pendingApprovals = useMemo(() => threads.filter(t =>
    t.status === 'Pending Approval' || t.category === 'Approval Request'
  ).length, [threads])
  const unreadThreads = useMemo(() => threads.filter(t => t.status === 'Open').length, [threads])

  // ── Production ────────────────────────────────────────────────────────────────
  const completedTasks = useMemo(() => tasks.filter(t => t.completed).length, [tasks])
  const totalTasks     = tasks.length
  const prodPct        = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // ── Derived flags ────────────────────────────────────────────────────────────
  const hasAnyPrep = cutUp > 0 || minced > 0 || pureed > 0 || Object.keys(keyAllergyCount).length > 0
  const todayStr   = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const isManager  = atLeast('manager')

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <InjectDashStyles />

      {/* ── Greeting ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.3px', margin: 0 }}>
            {getGreeting()}, {user?.name?.split(' ')[0] ?? 'there'} 👋
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{todayStr}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-success-light)', border: '1px solid var(--color-success)', color: 'var(--color-success-hover)', fontWeight: 700, fontSize: 12, padding: '5px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0 }} />
          {loading ? '…' : active.length} active residents
        </div>
      </div>

      {/* ── Row 1: Resident metrics ── */}
      <div className="dash-metrics">
        <MetricCard label="Total Residents" value={loading ? '…' : residents.length} sub={`${active.length} active · ${hospital + loa} away`} iconBg="var(--color-primary-light)" to="/residents"
          icon={<svg width="18" height="18" fill="none" stroke="var(--color-primary)" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
        <MetricCard label="Hosp / LOA" value={hospital + loa} sub={`${hospital} hosp · ${loa} LOA`} iconBg="var(--color-warning-light)" to="/residents"
          alertClass={hospital > 0 ? 'warn-card' : undefined}
          icon={<svg width="18" height="18" fill="none" stroke="var(--color-warning-hover)" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 8v4l3 3"/></svg>} />
        <MetricCard label="Ensure / Day" value={totalEnsure} sub="supplement cans" iconBg="var(--color-success-light)" to="/residents"
          icon={<svg width="18" height="18" fill="none" stroke="var(--color-success)" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>} />
        <MetricCard label="Room Trays" value={roomTrays} sub={`${diningRoom} dining room`} iconBg="var(--color-teal-light)" to="/residents"
          icon={<svg width="18" height="18" fill="none" stroke="var(--color-teal)" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>} />
      </div>

      {/* ── Row 2: Operations metrics ── */}
      <div className="dash-metrics-wide">
        <MetricCard
          label="Inventory Alerts"
          value={lowParItems.length}
          sub={zeroItems.length > 0 ? `${zeroItems.length} at zero!` : 'items below par'}
          iconBg={lowParItems.length > 0 ? '#fee2e2' : 'var(--color-success-light)'}
          to="/inventory"
          alertClass={zeroItems.length > 0 ? 'alert-card' : lowParItems.length > 3 ? 'warn-card' : undefined}
          icon={<svg width="18" height="18" fill="none" stroke={lowParItems.length > 0 ? '#dc2626' : 'var(--color-success)'} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>}
        />
        <MetricCard
          label="Pending Approvals"
          value={pendingApprovals}
          sub="comms requests"
          iconBg={pendingApprovals > 0 ? '#fffbeb' : 'var(--color-success-light)'}
          to="/communications"
          alertClass={pendingApprovals > 0 ? 'warn-card' : undefined}
          icon={<svg width="18" height="18" fill="none" stroke={pendingApprovals > 0 ? '#d97706' : 'var(--color-success)'} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
        />
        <MetricCard
          label="Open Threads"
          value={unreadThreads}
          sub="communications"
          iconBg="var(--color-primary-light)"
          to="/communications"
          icon={<svg width="18" height="18" fill="none" stroke="var(--color-primary)" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>}
        />
        <MetricCard
          label="Production Today"
          value={totalTasks > 0 ? `${prodPct}%` : '—'}
          sub={totalTasks > 0 ? `${completedTasks}/${totalTasks} tasks done` : 'No tasks loaded'}
          iconBg={prodPct === 100 ? 'var(--color-success-light)' : 'var(--color-primary-light)'}
          to="/production"
          icon={<svg width="18" height="18" fill="none" stroke={prodPct === 100 ? 'var(--color-success)' : 'var(--color-primary)'} strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>}
        />
        {isManager && (
          <>
            <MetricCard
              label="Budget (MTD)"
              value={`${((BUDGET_SPENT / (BUDGET_PERIOD.residentCount * BUDGET_PERIOD.budgetPerResidentPerDay * BUDGET_PERIOD.totalDays)) * 100).toFixed(0)}%`}
              sub={`$${BUDGET_SPENT.toFixed(0)} of $${(BUDGET_PERIOD.residentCount * BUDGET_PERIOD.budgetPerResidentPerDay * BUDGET_PERIOD.totalDays).toFixed(0)}`}
              iconBg="var(--color-teal-light)"
              to="/budget"
              icon={<svg width="18" height="18" fill="none" stroke="var(--color-teal)" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
            />
            <MetricCard
              label="$/Resident/Day"
              value={`$${(BUDGET_SPENT / Math.max(1, Math.min(BUDGET_PERIOD.totalDays, Math.ceil((new Date().getTime() - new Date(BUDGET_PERIOD.startDate).getTime()) / 86400000) + 1)) / BUDGET_PERIOD.residentCount).toFixed(2)}`}
              sub={`Target $${BUDGET_PERIOD.budgetPerResidentPerDay.toFixed(2)}`}
              iconBg="var(--color-purple-light)"
              to="/budget"
              icon={<svg width="18" height="18" fill="none" stroke="var(--color-purple)" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            />
          </>
        )}
      </div>

      {/* ── Budget strip (managers only) ── */}
      {isManager && <BudgetStrip />}

      {/* ── Inventory alerts banner ── */}
      {lowParItems.length > 0 && (
        <Link to="/inventory" style={{ textDecoration: 'none', display: 'block', marginBottom: 14 }}>
          <div style={{ padding: '10px 16px', background: zeroItems.length > 0 ? '#fef2f2' : '#fffbeb', border: `1px solid ${zeroItems.length > 0 ? '#fecaca' : '#fde68a'}`, borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15 }}>{zeroItems.length > 0 ? '🚨' : '⚠️'}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: zeroItems.length > 0 ? '#991b1b' : '#92400e', flex: 1 }}>
              {zeroItems.length > 0 ? `${zeroItems.length} item(s) completely out of stock — ` : ''}
              {lowParItems.length} item(s) below par level:
              {' '}{lowParItems.slice(0,4).map(i => i.item).join(', ')}{lowParItems.length > 4 ? ` +${lowParItems.length - 4} more` : ''}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>View Inventory →</span>
          </div>
        </Link>
      )}

      {/* ── Special prep ── */}
      {hasAnyPrep && (
        <div className="sl-section-card" style={{ marginBottom: 14 }}>
          <div className="sl-section-header">
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', margin: 0 }}>⚠️ Special Prep Today</h3>
            <Link to="/residents" style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>View residents →</Link>
          </div>
          <div className="sl-section-body">
            <div className="prep-pills">
              <PrepPill label="Cut-Up"  count={cutUp}  bg="var(--color-warning-light)" color="var(--color-warning-hover)" border="rgba(201,146,88,.35)" />
              <PrepPill label="Minced"  count={minced} bg="var(--color-purple-light)"  color="var(--color-purple)"       border="rgba(137,120,164,.35)" />
              <PrepPill label="Puréed"  count={pureed} bg="var(--color-teal-light)"    color="var(--color-teal-hover)"   border="rgba(58,157,168,.35)" />
              {Object.entries(keyAllergyCount).sort((a,b) => b[1]-a[1]).map(([allergy, count]) => (
                <PrepPill key={allergy} label={allergy} count={count} bg="var(--color-danger-light)" color="var(--color-danger-hover)" border="rgba(188,106,88,.35)" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Today's menu ── */}
      <div className="sl-section-card" style={{ marginBottom: 14 }}>
        <div className="sl-section-header">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', margin: 0 }}>🍴 Today's Menu — {todayDay}</h3>
          <Link to="/menu" style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>Edit menu →</Link>
        </div>
        <div className="sl-section-body">
          {!activeWeek ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No active menu week. <Link to="/menu" style={{ color: 'var(--color-primary)' }}>Set one up →</Link></p>
          ) : !todayMenu ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No menu entries for {todayDay} yet.</p>
          ) : (
            <div className="menu-meal-grid">
              <MealColumn mealLabel="🌞 Lunch"  opt1Names={lunchOpt1}  opt2Names={lunchOpt2} />
              <MealColumn mealLabel="🌙 Dinner" opt1Names={dinnerOpt1} opt2Names={dinnerOpt2} />
            </div>
          )}
          {(lunchDessert || dinnerDessert) && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-success-light)', border: '1px solid rgba(74,163,104,.2)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {lunchDessert  && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🍰 <strong>Lunch dessert:</strong> {lunchDessert}</span>}
              {dinnerDessert && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🍰 <strong>Dinner dessert:</strong> {dinnerDessert}</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── Three-col: Birthdays + Dietary + Production status ── */}
      <div className="dash-three-col">
        <SectionCard
          title="🎂 Upcoming Birthdays"
          action={upcomingBirthdays.length > 3 ? <Link to="/residents" style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>See all →</Link> : undefined}
        >
          {upcomingBirthdays.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{loading ? 'Loading…' : 'None in the next 30 days.'}</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcomingBirthdays.slice(0, 3).map((b, i) => (
                  <div key={i} className="bday-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>🎂</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Room {b.room} · {b.monthDay}</div>
                      </div>
                    </div>
                    <span style={{ background: b.daysUntil === 0 ? 'var(--color-success)' : b.daysUntil <= 7 ? 'var(--color-warning-light)' : 'var(--bg-app)', color: b.daysUntil === 0 ? '#fff' : b.daysUntil <= 7 ? 'var(--color-warning-hover)' : 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '3px 9px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {b.daysUntil === 0 ? '🎉 Today' : `${b.daysUntil}d`}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bday-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Room','Resident','Date','In'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '6px 8px', borderBottom: '1px solid var(--border-color)', background: 'var(--color-primary-light)' }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>
                    {upcomingBirthdays.map((b, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px', fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>{b.room}</td>
                        <td style={{ padding: '8px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</td>
                        <td style={{ padding: '8px', fontSize: 12, color: 'var(--text-secondary)' }}>{b.monthDay}</td>
                        <td style={{ padding: '8px' }}><span style={{ background: b.daysUntil === 0 ? 'var(--color-success)' : b.daysUntil <= 7 ? 'var(--color-warning-light)' : 'var(--bg-app)', color: b.daysUntil === 0 ? '#fff' : b.daysUntil <= 7 ? 'var(--color-warning-hover)' : 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '2px 7px', fontWeight: 600, fontSize: 11 }}>{b.daysUntil === 0 ? '🎉 Today!' : `${b.daysUntil}d`}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="🥑 Active Dietary Breakdown">
          {loading ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Regular',        count: active.filter(r => r.dietType === 'Regular').length,        color: 'var(--color-primary)' },
                { label: 'Diabetic',        count: active.filter(r => r.dietType === 'Diabetic').length,        color: 'var(--color-warning-hover)' },
                { label: 'Cardiac',         count: active.filter(r => r.dietType === 'Cardiac').length,         color: 'var(--color-danger-hover)' },
                { label: 'Low Sodium',      count: active.filter(r => r.dietType === 'Low Sodium').length,      color: 'var(--color-teal-hover)' },
                { label: 'Renal',           count: active.filter(r => r.dietType === 'Renal').length,           color: 'var(--color-purple)' },
                { label: 'Mechanical Soft', count: active.filter(r => r.dietType === 'Mechanical Soft').length, color: 'var(--color-success)' },
              ].filter(d => d.count > 0).map(d => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 6, background: 'var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round((d.count / (active.length || 1)) * 100)}%`, background: d.color, borderRadius: 6, transition: 'width 0.5s ease' }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', minWidth: 96 }}>{d.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', minWidth: 18, textAlign: 'right' }}>{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="📋 Production Status"
          action={<Link to="/production" style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>Open →</Link>}
        >
          {totalTasks === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No production tasks loaded for today. <Link to="/production" style={{ color: 'var(--color-primary)' }}>Go to Production →</Link></p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 14, background: 'var(--bg-app)', borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <div style={{ height: '100%', width: `${prodPct}%`, background: prodPct === 100 ? '#059669' : 'var(--color-primary)', borderRadius: 7, transition: 'width 0.5s ease' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: prodPct === 100 ? '#059669' : 'var(--color-primary)', minWidth: 40, textAlign: 'right' }}>{prodPct}%</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{completedTasks} of {totalTasks} tasks complete</div>
              {prodPct === 100 && <div style={{ padding: '6px 12px', background: 'var(--color-success-light)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700, color: 'var(--color-success-hover)' }}>✅ All tasks complete!</div>}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Quick Access ── */}
      <div className="dash-quick-links-section">
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Quick Access</h3>
        <div className="dash-quick-links">
          <QuickLink to="/residents"      label="Residents"        desc="Diet orders & resident profiles"  iconColor="var(--color-primary-light)"  icon={<svg width="16" height="16" fill="none" stroke="var(--color-primary)"       strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>} />
          <QuickLink to="/menu"           label="Menu Planner"     desc="Plan daily meals & cycle menus"   iconColor="var(--color-teal-light)"     icon={<svg width="16" height="16" fill="none" stroke="var(--color-teal)"         strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>} />
          <QuickLink to="/production"     label="Production"       desc="Worksheets, tray tickets"         iconColor="var(--color-success-light)"  icon={<svg width="16" height="16" fill="none" stroke="var(--color-success)"       strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>} />
          <QuickLink to="/inventory"      label="Inventory"        desc="Stock levels & truck orders"      iconColor="var(--color-warning-light)"  icon={<svg width="16" height="16" fill="none" stroke="var(--color-warning-hover)" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>} badge={lowParItems.length} />
          <QuickLink to="/recipes"        label="Recipe Book"      desc="Browse & scale recipes"           iconColor="var(--color-purple-light)"   icon={<svg width="16" height="16" fill="none" stroke="var(--color-purple)"        strokeWidth="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>} />
          <QuickLink to="/communications" label="Communications"   desc="Threads & approvals"               iconColor="var(--color-teal-light)"     icon={<svg width="16" height="16" fill="none" stroke="var(--color-teal)"         strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>} badge={pendingApprovals} />
          {isManager && <QuickLink to="/budget" label="Budget" desc="Spending log & per-resident cost" iconColor="var(--color-success-light)" icon={<svg width="16" height="16" fill="none" stroke="var(--color-success)" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />}
          {isManager && <QuickLink to="/staff"  label="Staff"  desc="Schedules & staff management"    iconColor="var(--color-purple-light)"   icon={<svg width="16" height="16" fill="none" stroke="var(--color-purple)"  strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} />}
        </div>
      </div>
    </div>
  )
}
