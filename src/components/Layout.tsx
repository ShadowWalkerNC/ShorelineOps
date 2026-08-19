import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../security/AuthContext'
import NotificationBell from './NotificationBell'

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

interface NavItemDef {
  label: string
  to: string
  color: string
  end?: boolean
  minRole?: 'dietary' | 'manager'
}

interface NavSection {
  title: string
  items: NavItemDef[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Core Operations',
    items: [
      { label: 'Dashboard', to: '/', color: '#3B82F6', end: true },
      { label: 'Residents & Diets', to: '/residents', color: '#10B981' },
      { label: 'Communications', to: '/communications', color: '#8B5CF6' },
    ],
  },
  {
    title: 'Dietary & Kitchen',
    items: [
      { label: 'Kitchen Tablet Mode', to: '/kitchen/tablet', color: '#EF4444', minRole: 'dietary' },
      { label: 'Menu Planner', to: '/menu', color: '#F59E0B', minRole: 'dietary', end: true },
      { label: 'Daily Cook Sheet', to: '/kitchen/sheet', color: '#F97316', minRole: 'dietary' },
      { label: 'Tray Cards', to: '/kitchen/traycards', color: '#EC4899', minRole: 'dietary' },
      { label: 'Recipe Book', to: '/recipes', color: '#6366F1' },
      { label: 'Production Sheets', to: '/production', color: '#06B6D4' },
      { label: 'Meal Tally Entry', to: '/kitchen/orders', color: '#14B8A6', minRole: 'dietary' },
    ],
  },
  {
    title: 'Purchasing & Cost',
    items: [
      { label: 'Purchasing & Orders', to: '/purchasing', color: '#2563EB', minRole: 'dietary' },
      { label: 'Distributor Portal', to: '/distributor', color: '#7C3AED' },
      { label: 'Cost & Compliance', to: '/reporting', color: '#059669', minRole: 'dietary' },
      { label: 'Inventory & Stock', to: '/inventory', color: '#D97706' },
      { label: 'Budget & Spend', to: '/budget', color: '#4F46E5', minRole: 'manager' },
    ],
  },
  {
    title: 'Facility & Team',
    items: [
      { label: 'Staff Roster', to: '/staff', color: '#0284C7', minRole: 'manager' },
      { label: 'Timecard Clock', to: '/timecards', color: '#64748B' },
    ],
  },
]

const NAV_ADMIN: NavItemDef = {
  label: 'Administration',
  to: '/admin',
  color: '#DC2626',
}

const NAV_LEGAL: NavItemDef = {
  label: 'Legal & BAA',
  to: '/legal',
  color: '#6B7280',
}

function NavItem({ to, color, label, end: endProp, onClick }: { to: string; color: string; label: string; end?: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={endProp !== undefined ? endProp : to === '/'}
      onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '9px 14px',
        borderRadius: 'var(--radius-md)',
        textDecoration: 'none',
        fontSize: 13.5,
        fontWeight: isActive ? 700 : 500,
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: isActive ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
        borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent',
        transition: 'all 0.15s ease',
        minHeight: 38,
      })}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1, lineHeight: 1.25 }}>{label}</span>
    </NavLink>
  )
}

// Mobile header height = 56px content + iOS safe-area-inset-top
const LAYOUT_CSS = `
  :root {
    --sidebar-width: 260px;
    --mobile-header-content: 56px;
    --mobile-header: calc(var(--mobile-header-content) + env(safe-area-inset-top, 0px));
  }

  @media (max-width: 767px) {
    .sidebar-aside { display: none !important; }
    .mobile-header { display: flex !important; }
    .desktop-header { display: none !important; }
    .main-scroll { padding-top: var(--mobile-header) !important; }
    .main-content { padding: 16px 14px calc(24px + env(safe-area-inset-bottom, 0px)) !important; }
    .mobile-nav-sheet {
      position: fixed;
      top: var(--mobile-header);
      left: 0; right: 0;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border-color);
      box-shadow: 0 8px 32px rgba(13,27,42,0.18);
      z-index: 300;
      max-height: calc(100dvh - var(--mobile-header));
      overflow-y: auto;
      transform: translateY(-110%);
      opacity: 0;
      transition: transform 0.26s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease;
      pointer-events: none;
    }
    .mobile-nav-sheet.open {
      transform: translateY(0);
      opacity: 1;
      pointer-events: all;
    }
  }

  @media (min-width: 768px) and (max-width: 1023px) {
    :root { --sidebar-width: 220px; }
    .main-content { padding: 24px 20px !important; }
    .mobile-header { display: none !important; }
    .mobile-nav-sheet { display: none !important; }
  }

  @media (min-width: 1024px) {
    .mobile-header { display: none !important; }
    .mobile-nav-sheet { display: none !important; }
  }

  @keyframes dot-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
  .status-dot-pulse { animation: dot-pulse 2.2s ease-in-out infinite; }
  body.nav-open { overflow: hidden !important; }
  * { -webkit-tap-highlight-color: transparent; }
`

function InjectLayoutStyles() {
  useEffect(() => {
    const id = 'shoreline-layout-css'
    if (!document.getElementById(id)) {
      const el = document.createElement('style')
      el.id = id
      el.textContent = LAYOUT_CSS
      document.head.appendChild(el)
    }
  }, [])
  return null
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, atLeast } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const now       = useClock()
  const [navOpen, setNavOpen] = useState(false)

  const isAdmin = user?.role === 'admin'

  useEffect(() => { setNavOpen(false) }, [location.pathname])
  useEffect(() => {
    document.body.classList.toggle('nav-open', navOpen)
    return () => document.body.classList.remove('nav-open')
  }, [navOpen])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  const roleDisplay =
    user?.role === 'admin'       ? 'Administrator' :
    user?.role === 'manager'     ? 'Manager' :
    user?.role === 'dietitian'   ? 'Registered Dietitian (RD)' :
    user?.role === 'frontdesk'   ? 'Office Assistant' :
    user?.role === 'dietary'     ? 'Dietary Staff' :
    user?.role === 'distributor' ? 'Distributor Partner' :
    user?.role === 'activities'  ? 'Activities Dir.' :
    user?.role === 'server'      ? 'Server' :
    user?.role === 'staff'       ? 'Staff' : 'Read-Only'

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100%', background: 'var(--bg-app)', overflow: 'hidden' }}>
      <InjectLayoutStyles />

      {navOpen && (
        <div onClick={() => setNavOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(13,27,42,0.4)', backdropFilter: 'blur(2px)' }} />
      )}

      {/* MOBILE HEADER */}
      <header
        className="mobile-header"
        style={{
          display: 'none',
          position: 'fixed', top: 0, left: 0, right: 0,
          height: 'var(--mobile-header)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: 'max(14px, env(safe-area-inset-left, 14px))',
          paddingRight: 'max(14px, env(safe-area-inset-right, 14px))',
          paddingBottom: 0,
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-color)',
          alignItems: 'center',
          gap: 10,
          zIndex: 310,
          boxShadow: 'var(--shadow-sm)',
          boxSizing: 'border-box',
        }}
      >
        <button
          onClick={() => setNavOpen(v => !v)}
          aria-label="Toggle navigation"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44,
            background: navOpen ? 'var(--color-primary-light)' : 'transparent',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            color: navOpen ? 'var(--color-primary)' : 'var(--text-secondary)',
            cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s ease',
          }}
        >
          {navOpen
            ? <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            : <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>}
        </button>
        <img src="/icon-192.png" alt="Shoreline" style={{ width: 30, height: 30, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.3px', lineHeight: 1.1 }}>Shoreline</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Operations Platform</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <NotificationBell />
          {user && (
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Outfit, sans-serif' }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </header>

      {/* MOBILE NAV SHEET */}
      <div className={`mobile-nav-sheet${navOpen ? ' open' : ''}`}>
        {user && (
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Outfit, sans-serif' }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{roleDisplay}</div>
            </div>
          </div>
        )}
        <div style={{ padding: '8px 10px' }}>
          {NAV_SECTIONS.map((section, sIdx) => {
            const items = section.items.filter(item => !item.minRole || atLeast(item.minRole))
            if (items.length === 0) return null
            return (
              <div key={sIdx} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '6px 14px 4px' }}>
                  {section.title}
                </div>
                {items.map(item => (
                  <NavItem key={item.to} {...item} onClick={() => setNavOpen(false)} />
                ))}
              </div>
            )
          })}
          {isAdmin && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '6px 14px 4px' }}>
                Administration
              </div>
              <NavItem {...NAV_ADMIN} onClick={() => setNavOpen(false)} />
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '6px 14px 4px' }}>
              Compliance
            </div>
            <NavItem {...NAV_LEGAL} onClick={() => setNavOpen(false)} />
          </div>
        </div>
        <div style={{ padding: '12px 16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-app)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, minHeight: 44 }}>
            Logout
          </button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>{timeStr}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dateStr}</div>
          </div>
        </div>
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside className="sidebar-aside" style={{ width: 'var(--sidebar-width)', flexShrink: 0, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '100dvh', zIndex: 200, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <img src="/icon-192.png" alt="Shoreline" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px', lineHeight: 1.15, fontFamily: 'Outfit, sans-serif' }}>Shoreline</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Operations Platform</div>
          </div>
        </div>
        <nav style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
          {NAV_SECTIONS.map((section, sIdx) => {
            const items = section.items.filter(item => !item.minRole || atLeast(item.minRole))
            if (items.length === 0) return null
            return (
              <div key={sIdx} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '4px 14px 4px' }}>
                  {section.title}
                </div>
                {items.map(item => <NavItem key={item.to} {...item} />)}
              </div>
            )
          })}
          {isAdmin && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '4px 14px 4px' }}>Administration</div>
              <NavItem {...NAV_ADMIN} />
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '4px 14px 4px' }}>Compliance</div>
            <NavItem {...NAV_LEGAL} />
          </div>
        </nav>
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Outfit, sans-serif' }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{roleDisplay}</div>
              </div>
            </div>
          )}
          <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600, minHeight: 44 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Current Time</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', marginTop: 2 }}>{timeStr}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{dateStr}</div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="main-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100dvh', overflowY: 'auto', overflowX: 'hidden' }}>
        <header className="desktop-header" style={{ height: 58, padding: '0 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 90, boxShadow: 'var(--shadow-sm)', flexShrink: 0 }}>
          {user && (
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)', padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {user.name.toUpperCase()}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>({roleDisplay})</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '7px 14px', flex: 1, maxWidth: 400 }}>
            <svg width="13" height="13" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Search residents...</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexShrink: 0 }}>
            <NotificationBell />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Role:</span>
              <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{roleDisplay}</div>
            </div>
          </div>
        </header>
        <main className="main-content" style={{ padding: '32px 24px', flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
