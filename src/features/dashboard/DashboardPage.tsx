import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useResidentsStore } from '@/state/residentsStore'
import { useAuth } from '@/security/AuthContext'

// ── helpers ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// ── sub-components ───────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, iconBg, icon,
}: {
  label: string
  value: string | number
  sub?: string
  iconBg: string
  icon: React.ReactNode
}) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 'var(--radius-md)',
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  )
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--color-primary-light)',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>{title}</h3>
        {action}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

// ── Quick link card ───────────────────────────────────────────────────────────
function QuickLink({ to, label, desc, iconColor, icon }: { to: string; label: string; desc: string; iconColor: string; icon: React.ReactNode }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-primary)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)' }}
      >
        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'Outfit, sans-serif', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
        </div>
      </div>
    </Link>
  )
}

// ── Dietary stat row ──────────────────────────────────────────────────────────
function DietRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '7px 10px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-app)',
      border: '1px solid var(--border-color)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>{count}</span>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()
  const { residents, loading, fetch } = useResidentsStore()

  useEffect(() => { fetch() }, [])

  // ── derived stats ──────────────────────────────────────────────────────────
  const active       = useMemo(() => residents.filter(r => r.status === 'Active'), [residents])
  const hospital     = useMemo(() => residents.filter(r => r.status === 'Hospital').length, [residents])
  const loa          = useMemo(() => residents.filter(r => r.status === 'LOA').length, [residents])
  const totalEnsure  = useMemo(() => residents.reduce((s, r) => s + (r.ensurePerDay ?? 0), 0), [residents])

  const dietCounts = useMemo(() => {
    const map: Record<string, number> = {}
    active.forEach(r => { map[r.dietType] = (map[r.dietType] ?? 0) + 1 })
    return map
  }, [active])

  const textureCounts = useMemo(() => ({
    'Cut-Up':  active.filter(r => r.texture === 'Cut-Up').length,
    'Minced':  active.filter(r => r.texture === 'Minced' || r.texture === 'Minced & Moist').length,
    'Pureed':  active.filter(r => r.texture === 'Pureed').length,
  }), [active])

  const allergyCounts = useMemo(() => {
    const map: Record<string, number> = {}
    active.forEach(r => r.allergies?.forEach(a => { map[a] = (map[a] ?? 0) + 1 }))
    return map
  }, [active])

  // ── upcoming birthdays (next 30 days) ──────────────────────────────────────
  const upcomingBirthdays = useMemo(() => {
    const today = new Date()
    const results: { name: string; room: string; monthDay: string; daysUntil: number }[] = []
    residents.forEach(r => {
      if (!r.birthdayMonth || !r.birthdayDay) return
      const monthIdx = MONTH_NAMES.indexOf(r.birthdayMonth)
      if (monthIdx === -1) return
      const bday = new Date(today.getFullYear(), monthIdx, r.birthdayDay)
      if (bday < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        bday.setFullYear(today.getFullYear() + 1)
      }
      const diff = Math.round((bday.getTime() - today.getTime()) / 86400000)
      if (diff <= 30) {
        results.push({
          name: r.name,
          room: r.room,
          monthDay: `${r.birthdayMonth.slice(0,3)} ${r.birthdayDay}`,
          daysUntil: diff,
        })
      }
    })
    return results.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 10)
  }, [residents])

  const today = new Date()
  const todayStr = today.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* Welcome banner */}
      <div style={{
        background: 'linear-gradient(135deg, #e4e6e0 0%, #eae8e1 100%)',
        border: '1px solid var(--border-color)',
        padding: '24px 30px',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
        boxShadow: 'var(--shadow-sm)',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.4px' }}>
            {getGreeting()}, {user?.name ?? 'there'} 👋
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{todayStr}</p>
        </div>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          color: 'var(--color-primary)',
          fontWeight: 600,
          fontSize: 12,
          padding: '6px 16px',
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: 'var(--shadow-sm)',
          whiteSpace: 'nowrap',
        }}>
          <div className="status-dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }} />
          {active.length} Residents Active Today
        </div>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 28 }}>
        <MetricCard
          label="Total Residents"
          value={residents.length}
          sub={loading ? 'Loading…' : `${active.length} active`}
          iconBg="var(--color-primary-light)"
          icon={<svg width="22" height="22" fill="none" stroke="var(--color-primary)" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />
        <MetricCard
          label="In Hospital / LOA"
          value={hospital + loa}
          sub={`${hospital} hospital · ${loa} LOA`}
          iconBg="var(--color-warning-light)"
          icon={<svg width="22" height="22" fill="none" stroke="var(--color-warning-hover)" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 8v4l3 3"/></svg>}
        />
        <MetricCard
          label="Ensure Cans / Day"
          value={totalEnsure}
          sub="across all active residents"
          iconBg="var(--color-success-light)"
          icon={<svg width="22" height="22" fill="none" stroke="var(--color-success)" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
        />
        <MetricCard
          label="Dining Room"
          value={active.filter(r => r.servingLocation === 'Dining Room').length}
          sub={`${active.filter(r => r.servingLocation === 'Room').length} room trays`}
          iconBg="var(--color-info-light)"
          icon={<svg width="22" height="22" fill="none" stroke="var(--color-info)" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>}
        />
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* Dietary Summary */}
        <SectionCard title="Dietary Summary" action={
          <Link to="/residents" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '4px 10px', borderRadius: 12 }}>View all →</Link>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4 }}>Diet Types</div>
            {Object.entries(dietCounts).sort((a,b) => b[1]-a[1]).map(([diet, count]) => (
              <DietRow key={diet} label={diet} count={count} color="var(--color-primary)" />
            ))}
            {Object.keys(dietCounts).length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No residents loaded.</p>}

            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginTop: 12, marginBottom: 4 }}>Texture Modifications</div>
            {Object.entries(textureCounts).filter(([,v]) => v > 0).map(([t, count]) => (
              <DietRow key={t} label={t} count={count} color="var(--color-warning)" />
            ))}

            {Object.keys(allergyCounts).length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginTop: 12, marginBottom: 4 }}>Allergy Alerts</div>
                {Object.entries(allergyCounts).sort((a,b) => b[1]-a[1]).map(([a, count]) => (
                  <DietRow key={a} label={a} count={count} color="var(--color-danger)" />
                ))}
              </>
            )}
          </div>
        </SectionCard>

        {/* Upcoming Birthdays */}
        <SectionCard title="🎂 Upcoming Birthdays (Next 30 Days)">
          {upcomingBirthdays.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{loading ? 'Loading…' : 'No birthdays in the next 30 days.'}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Room', 'Resident', 'Birthday', 'In'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '8px 10px', borderBottom: '1px solid var(--border-color)', background: 'var(--color-primary-light)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcomingBirthdays.map((b, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 10px', fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>{b.room}</td>
                      <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</td>
                      <td style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>{b.monthDay}</td>
                      <td style={{ padding: '10px 10px', fontSize: 12 }}>
                        <span style={{
                          background: b.daysUntil === 0 ? 'var(--color-success)' : b.daysUntil <= 7 ? 'var(--color-warning-light)' : 'var(--bg-app)',
                          color: b.daysUntil === 0 ? 'white' : b.daysUntil <= 7 ? 'var(--color-warning-hover)' : 'var(--text-muted)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 12,
                          padding: '2px 8px',
                          fontWeight: 600,
                        }}>
                          {b.daysUntil === 0 ? '🎉 Today!' : `${b.daysUntil}d`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Quick links */}
      <div style={{ marginBottom: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Quick Access</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          <QuickLink to="/residents" label="Residents & Diet Orders" desc="View and manage all resident profiles" iconColor="var(--color-primary-light)" icon={<svg width="18" height="18" fill="none" stroke="var(--color-primary)" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>} />
          <QuickLink to="/menu" label="Weekly Menu Planner" desc="Plan daily meals and cycle menus" iconColor="var(--color-info-light)" icon={<svg width="18" height="18" fill="none" stroke="var(--color-info)" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>} />
          <QuickLink to="/production" label="Production & Service" desc="Worksheets, tray tickets, checklists" iconColor="var(--color-success-light)" icon={<svg width="18" height="18" fill="none" stroke="var(--color-success)" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>} />
          <QuickLink to="/recipes" label="Recipe Book" desc="Browse, scale, and manage recipes" iconColor="var(--color-warning-light)" icon={<svg width="18" height="18" fill="none" stroke="var(--color-warning-hover)" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>} />
          <QuickLink to="/admin" label="Administration" desc="Scheduling, users, data management" iconColor="var(--color-purple-light)" icon={<svg width="18" height="18" fill="none" stroke="var(--color-purple)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>} />
        </div>
      </div>

    </div>
  )
}
