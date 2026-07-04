import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useResidentsStore } from '@/state/residentsStore'
import { useMenuStore } from '@/state/menuStore'
import { useAuth } from '@/security/AuthContext'
import type { DayOfWeek } from '@/types'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES: DayOfWeek[] = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// Allergies that require separate meal prep / special handling
const KEY_ALLERGIES = ['Gluten-Free', 'Dairy-Free', 'Nut Allergy', 'Egg Allergy', 'Shellfish', 'Soy-Free', 'Vegan', 'Vegetarian', 'Kosher', 'Halal']

// ── CSS ───────────────────────────────────────────────────────────────────────
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
  .dash-two-col {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
    margin-bottom: 14px;
  }
  @media (min-width: 1024px) {
    .dash-two-col { grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  }
  .dash-quick-links-section { display: none; }
  @media (min-width: 768px) {
    .dash-quick-links-section { display: block; }
    .dash-quick-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
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
  /* Today's menu two-col */
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

function MetricCard({ label, value, sub, iconBg, icon, to }: {
  label: string; value: string | number; sub?: string
  iconBg: string; icon: React.ReactNode; to?: string
}) {
  const navigate = useNavigate()
  return (
    <div className="metric-card" onClick={() => to && navigate(to)} role={to ? 'link' : undefined}>
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

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="sl-section-card">
      <div className="sl-section-header">
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', margin: 0 }}>{title}</h3>
        {action}
      </div>
      <div className="sl-section-body">{children}</div>
    </div>
  )
}

function QuickLink({ to, label, desc, iconColor, icon }: { to: string; label: string; desc: string; iconColor: string; icon: React.ReactNode }) {
  return (
    <Link to={to} className="quick-link-card">
      <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'Outfit, sans-serif', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{desc}</div>
      </div>
      <svg width="13" height="13" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
    </Link>
  )
}

// ── Today's Menu section ──────────────────────────────────────────────────────
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

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()
  const { residents, loading, fetch } = useResidentsStore()
  const { weeks, items, fetchWeeks, fetchItems } = useMenuStore()

  useEffect(() => { fetch() }, [])           // eslint-disable-line
  useEffect(() => { fetchWeeks() }, [])      // eslint-disable-line
  useEffect(() => { fetchItems() }, [])      // eslint-disable-line

  const active      = useMemo(() => residents.filter(r => r.status === 'Active'), [residents])
  const hospital    = useMemo(() => residents.filter(r => r.status === 'Hospital').length, [residents])
  const loa         = useMemo(() => residents.filter(r => r.status === 'LOA').length, [residents])
  const totalEnsure = useMemo(() => residents.reduce((s, r) => s + (r.ensurePerDay ?? 0), 0), [residents])

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

  // ── Today's Menu ─────────────────────────────────────────────────────────
  const todayDay = DAY_NAMES[new Date().getDay()]
  const activeWeek = useMemo(() => weeks.find(w => w.active) ?? weeks[0] ?? null, [weeks])
  const todayMenu = useMemo(() => activeWeek?.days?.[todayDay] ?? null, [activeWeek, todayDay])
  const itemMap   = useMemo(() => Object.fromEntries(items.map(i => [i.id, i.name])), [items])

  function resolveNames(ids: string[] = []) {
    return ids.map(id => itemMap[id] ?? id).filter(Boolean)
  }

  const lunchOpt1  = todayMenu ? resolveNames([...(todayMenu.lunchOpt1Meat?.itemIds ?? []), ...(todayMenu.lunchOpt1Veggie?.itemIds ?? []), ...(todayMenu.lunchOpt1Starch?.itemIds ?? [])]) : []
  const lunchOpt2  = todayMenu ? resolveNames([...(todayMenu.lunchOpt2Meat?.itemIds ?? []), ...(todayMenu.lunchOpt2Veggie?.itemIds ?? []), ...(todayMenu.lunchOpt2Starch?.itemIds ?? [])]) : []
  const dinnerOpt1 = todayMenu ? resolveNames([...(todayMenu.dinnerOpt1Meat?.itemIds ?? []), ...(todayMenu.dinnerOpt1Veggie?.itemIds ?? []), ...(todayMenu.dinnerOpt1Starch?.itemIds ?? [])]) : []
  const dinnerOpt2 = todayMenu ? resolveNames([...(todayMenu.dinnerOpt2Meat?.itemIds ?? []), ...(todayMenu.dinnerOpt2Veggie?.itemIds ?? []), ...(todayMenu.dinnerOpt2Starch?.itemIds ?? [])]) : []
  const lunchDessert  = todayMenu ? resolveNames(todayMenu.lunchDessert?.itemIds ?? []).join(', ')  : ''
  const dinnerDessert = todayMenu ? resolveNames(todayMenu.dinnerDessert?.itemIds ?? []).join(', ') : ''

  const todayStr = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const hasAnyPrep = cutUp > 0 || minced > 0 || pureed > 0 || Object.keys(keyAllergyCount).length > 0

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <InjectDashStyles />

      {/* ── Greeting bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.3px', margin: 0 }}>
            {getGreeting()}, {user?.name?.split(' ')[0] ?? 'there'} 👋
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{todayStr}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-success-light)', border: '1px solid var(--color-success)', color: 'var(--color-success-hover)', fontWeight: 700, fontSize: 12, padding: '5px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0 }} />
          {loading ? '…' : active.length} active
        </div>
      </div>

      {/* ── Metric cards ── */}
      <div className="dash-metrics">
        <MetricCard label="Residents" value={loading ? '…' : residents.length} sub={`${active.length} active`} iconBg="var(--color-primary-light)" to="/residents"
          icon={<svg width="18" height="18" fill="none" stroke="var(--color-primary)" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
        <MetricCard label="Hosp / LOA" value={hospital + loa} sub={`${hospital} hosp · ${loa} LOA`} iconBg="var(--color-warning-light)" to="/residents"
          icon={<svg width="18" height="18" fill="none" stroke="var(--color-warning-hover)" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 8v4l3 3"/></svg>} />
        <MetricCard label="Ensure / Day" value={totalEnsure} sub="all active" iconBg="var(--color-success-light)" to="/residents"
          icon={<svg width="18" height="18" fill="none" stroke="var(--color-success)" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>} />
        <MetricCard label="Room Trays" value={active.filter(r => r.servingLocation === 'Room').length} sub={`${active.filter(r => r.servingLocation === 'Dining Room').length} dining room`} iconBg="var(--color-teal-light)" to="/residents"
          icon={<svg width="18" height="18" fill="none" stroke="var(--color-teal)" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>} />
      </div>

      {/* ── Special Prep ── */}
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

      {/* ── Today's Menu ── */}
      <div className="sl-section-card" style={{ marginBottom: 14 }}>
        <div className="sl-section-header">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', margin: 0 }}>🍴 Today’s Menu — {todayDay}</h3>
          <Link to="/menu" style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>Edit menu →</Link>
        </div>
        <div className="sl-section-body">
          {!activeWeek ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No active menu week. <Link to="/menu" style={{ color: 'var(--color-primary)' }}>Set one up →</Link></p>
          ) : !todayMenu ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No menu entries for {todayDay} yet.</p>
          ) : (
            <div className="menu-meal-grid">
              <MealColumn
                mealLabel="🌞 Lunch"
                opt1Names={lunchOpt1}
                opt2Names={lunchOpt2}
              />
              <MealColumn
                mealLabel="🌙 Dinner"
                opt1Names={dinnerOpt1}
                opt2Names={dinnerOpt2}
              />
            </div>
          )}
          {/* Desserts row */}
          {(lunchDessert || dinnerDessert) && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-success-light)', border: '1px solid rgba(74,163,104,.2)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {lunchDessert  && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🍰 <strong>Lunch dessert:</strong> {lunchDessert}</span>}
              {dinnerDessert && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🍰 <strong>Dinner dessert:</strong> {dinnerDessert}</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── Two-col: Birthdays + placeholder ── */}
      <div className="dash-two-col">
        <SectionCard
          title="🎂 Upcoming Birthdays"
          action={
            upcomingBirthdays.length > 3
              ? <Link to="/residents" style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>See all →</Link>
              : undefined
          }
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
              <div className="bday-table" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Room','Resident','Date','In'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '6px 8px', borderBottom: '1px solid var(--border-color)', background: 'var(--color-primary-light)' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {upcomingBirthdays.map((b, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px', fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>{b.room}</td>
                        <td style={{ padding: '8px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</td>
                        <td style={{ padding: '8px', fontSize: 12, color: 'var(--text-secondary)' }}>{b.monthDay}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ background: b.daysUntil === 0 ? 'var(--color-success)' : b.daysUntil <= 7 ? 'var(--color-warning-light)' : 'var(--bg-app)', color: b.daysUntil === 0 ? '#fff' : b.daysUntil <= 7 ? 'var(--color-warning-hover)' : 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '2px 7px', fontWeight: 600, fontSize: 11 }}>
                            {b.daysUntil === 0 ? '🎉 Today!' : `${b.daysUntil}d`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </SectionCard>

        {/* Dietary breakdown — desktop second col */}
        <SectionCard title="🥑 Active Dietary Breakdown">
          {loading ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Regular',         count: active.filter(r => r.dietType === 'Regular').length,         color: 'var(--color-primary)' },
                { label: 'Diabetic',         count: active.filter(r => r.dietType === 'Diabetic').length,         color: 'var(--color-warning-hover)' },
                { label: 'Cardiac',          count: active.filter(r => r.dietType === 'Cardiac').length,          color: 'var(--color-danger-hover)' },
                { label: 'Low Sodium',       count: active.filter(r => r.dietType === 'Low Sodium').length,       color: 'var(--color-teal-hover)' },
                { label: 'Renal',            count: active.filter(r => r.dietType === 'Renal').length,            color: 'var(--color-purple)' },
                { label: 'Mechanical Soft',  count: active.filter(r => r.dietType === 'Mechanical Soft').length,  color: 'var(--color-success)' },
              ].filter(d => d.count > 0).map(d => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 6, background: 'var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round((d.count / (active.length || 1)) * 100)}%`, background: d.color, borderRadius: 6, transition: 'width 0.5s ease' }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', minWidth: 90 }}>{d.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', minWidth: 18, textAlign: 'right' }}>{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Quick Access ── */}
      <div className="dash-quick-links-section">
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Quick Access</h3>
        <div className="dash-quick-links">
          <QuickLink to="/residents" label="Residents & Diet Orders" desc="View and manage all resident profiles" iconColor="var(--color-primary-light)" icon={<svg width="16" height="16" fill="none" stroke="var(--color-primary)" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>} />
          <QuickLink to="/menu" label="Weekly Menu Planner" desc="Plan daily meals and cycle menus" iconColor="var(--color-teal-light)" icon={<svg width="16" height="16" fill="none" stroke="var(--color-teal)" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>} />
          <QuickLink to="/production" label="Production & Service" desc="Worksheets, tray tickets, checklists" iconColor="var(--color-success-light)" icon={<svg width="16" height="16" fill="none" stroke="var(--color-success)" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>} />
          <QuickLink to="/recipes" label="Recipe Book" desc="Browse, scale, and manage recipes" iconColor="var(--color-warning-light)" icon={<svg width="16" height="16" fill="none" stroke="var(--color-warning-hover)" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>} />
          <QuickLink to="/admin" label="Administration" desc="Scheduling, users, data management" iconColor="var(--color-purple-light)" icon={<svg width="16" height="16" fill="none" stroke="var(--color-purple)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>} />
        </div>
      </div>

    </div>
  )
}
