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

const NAV_OPERATIONS = [
  {
    label: 'Dashboard', to: '/',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    label: 'Residents & Diet Orders', to: '/residents',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    label: 'Weekly Menu Planner', to: '/menu',
    // end=true so this does NOT stay highlighted when on /menu/weekly
    end: true,
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
    minRole: 'dietary' as const,
  },
  {
    label: 'Weekly Menu View', to: '/menu/weekly',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 12h20M2 6h20M2 18h20"/><circle cx="6" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="6" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>,
    // All roles — no minRole
  },
  {
    label: 'Recipe Book', to: '/recipes',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  },
  {
    label: 'Production & Service', to: '/production',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
  },
  {
    label: 'Inventory & Waste', to: '/inventory',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  },
  {
    label: 'Budget & Spending', to: '/budget',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    minRole: 'manager' as const,
  },
  {
    label: 'Communications', to: '/communications',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
  {
    label: 'Staff', to: '/staff',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    minRole: 'manager' as const,
  },
  {
    label: 'Time Clock Logs', to: '/timecards',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
]

const NAV_ADMIN = {
  label: 'Administration', to: '/admin',
  icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
}

function NavItem({ to, icon, label, end: endProp, onClick }: { to: string; icon: React.ReactNode; label: string; end?: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={endProp !== undefined ? endProp : to === '/'}
      onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderRadius: 'var(--radius-md)',
        textDecoration: 'none', fontSize: 14,
        fontWeight: isActive ? 600 : 500,
        color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
        background: isActive ? 'var(--color-primary-light)' : 'transparent',
        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
        transition: 'all 0.2s ease', minHeight: 44,
      })}
    >
      {icon}
      <span style={{ flex: 1, lineHeight: 1.3 }}>{label}</span>
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

  const visibleOps = NAV_OPERATIONS.filter(item => {
    if (!item.minRole) return true
    return atLeast(item.minRole)
  })

  const allNavItems = [
    ...visibleOps,
    ...(isAdmin ? [NAV_ADMIN] : []),
  ]

  const roleDisplay =
    user?.role === 'admin'      ? 'Administrator' :
    user?.role === 'manager'    ? 'Manager' :
    user?.role === 'frontdesk'  ? 'Office Assistant' :
    user?.role === 'dietary'    ? 'Dietary Staff' :
    user?.role === 'activities' ? 'Activities Dir.' :
    user?.role === 'server'     ? 'Server' :
    user?.role === 'staff'      ? 'Staff' : 'Read-Only'

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100%', background: 'var(--bg-app)', overflow: 'hidden' }}>
      <InjectLayoutStyles />

      {navOpen && (
        <div onClick={() => setNavOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(13,27,42,0.4)', backdropFilter: 'blur(2px)' }} />
      )}

      {/* MOBILE HEADER — height grows with iOS safe area */}
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
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>iMPAC Operations</div>
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
          {allNavItems.map(item => (
            <NavLink key={item.to} to={item.to} end={'end' in item && item.end !== undefined ? item.end : item.to === '/'} onClick={() => setNavOpen(false)}
              style={({ isActive }) => ({ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 'var(--radius-md)', textDecoration: 'none', fontSize: 15, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--color-primary)' : 'var(--text-primary)', background: isActive ? 'var(--color-primary-light)' : 'transparent', marginBottom: 2, minHeight: 52 })}>
              <span style={{ color: 'inherit', opacity: 0.8 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
        <div style={{ padding: '12px 16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-app)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, minHeight: 44 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
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
        <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <img src="/icon-192.png" alt="Shoreline" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1.15, fontFamily: 'Outfit, sans-serif' }}>Shoreline</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase' }}>iMPAC Operations</div>
          </div>
        </div>
        <div style={{ padding: '7px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'var(--color-primary-light)', flexShrink: 0 }}>
          <div className="status-dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0 }} />
          LAN Server Mode — data synced across all devices
        </div>
        <nav style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '8px 16px 4px' }}>Operations</div>
          {visibleOps.map(item => <NavItem key={item.to} {...item} />)}
          {isAdmin && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '14px 16px 4px' }}>Administration</div>
              <NavItem {...NAV_ADMIN} />
            </>
          )}
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
      <div className="main-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100dvh', overflowY: 'auto' }}>
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
