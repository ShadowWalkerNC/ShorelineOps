import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../security/AuthContext'

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
    label: 'Dashboard',
    to: '/',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    label: 'Residents & Diet Orders',
    to: '/residents',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    label: 'Weekly Menu Planner',
    to: '/menu',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
  },
  {
    label: 'Recipe Book',
    to: '/recipes',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    label: 'Production & Service',
    to: '/production',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <path d="M9 12h6M9 16h4"/>
      </svg>
    ),
  },
]

const NAV_ADMIN = {
  label: 'Administration',
  to: '/admin',
  icon: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
    </svg>
  ),
}

function NavItem({ to, icon, label, onClick }: { to: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: isActive ? 600 : 500,
        color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
        background: isActive ? 'var(--color-primary-light)' : 'transparent',
        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
        transition: 'all 0.2s ease',
        minHeight: 44,
      })}
    >
      {icon}
      <span style={{ flex: 1, lineHeight: 1.3 }}>{label}</span>
    </NavLink>
  )
}

const LAYOUT_CSS = `
  :root { --sidebar-width: 260px; }

  @media (max-width: 767px) {
    .sidebar-aside {
      position: fixed !important;
      top: 0; left: 0; bottom: 0;
      transform: translateX(-100%);
      transition: transform 0.28s cubic-bezier(0.4,0,0.2,1) !important;
      z-index: 200 !important;
      box-shadow: none;
    }
    .sidebar-aside.open {
      transform: translateX(0) !important;
      box-shadow: 6px 0 40px rgba(0,0,0,0.28) !important;
    }
    .mobile-menu-btn  { display: flex !important; }
    .header-search    { display: none !important; }
    .header-logo-mobile { display: block !important; }
    .main-content     { padding: 20px 16px !important; }
  }

  @media (min-width: 768px) and (max-width: 1023px) {
    :root { --sidebar-width: 220px; }
    .main-content { padding: 28px 20px !important; }
    .header-logo-mobile { display: none !important; }
  }

  @media (min-width: 1024px) {
    .mobile-menu-btn    { display: none !important; }
    .header-logo-mobile { display: none !important; }
  }

  @keyframes dot-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.35; }
  }
  .status-dot-pulse { animation: dot-pulse 2.2s ease-in-out infinite; }

  body.drawer-open { overflow: hidden !important; }
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
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const now = useClock()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    document.body.classList.toggle('drawer-open', mobileOpen)
    return () => document.body.classList.remove('drawer-open')
  }, [mobileOpen])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div style={{
      display: 'flex',
      height: '100dvh',
      width: '100%',
      background: 'var(--bg-app)',
      overflow: 'hidden',
    }}>
      <InjectLayoutStyles />

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 199,
          }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`sidebar-aside${mobileOpen ? ' open' : ''}`}
        style={{
          width: 'var(--sidebar-width)',
          flexShrink: 0,
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          height: '100dvh',
          zIndex: 200,
          overflowY: 'auto',
          overflowX: 'hidden',
          transition: 'width 0.2s ease',
        }}
      >
        {/* Logo block — square S icon */}
        <div style={{
          padding: '20px 20px 18px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', gap: 12,
          flexShrink: 0,
        }}>
          <img
            src="/icon-192.png"
            alt="Shoreline"
            style={{
              width: 36, height: 36,
              objectFit: 'contain',
              borderRadius: 8,
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{
              fontSize: 18, fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.4px', lineHeight: 1.15,
              fontFamily: 'Outfit, sans-serif',
            }}>Shoreline</div>
            <div style={{
              fontSize: 9, color: 'var(--text-muted)',
              fontWeight: 700, letterSpacing: '0.6px',
              textTransform: 'uppercase',
            }}>iMPAC Operations</div>
          </div>
        </div>

        {/* LAN status bar */}
        <div style={{
          padding: '7px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, fontWeight: 500,
          color: 'var(--color-primary)',
          background: 'var(--color-primary-light)',
          flexShrink: 0,
        }}>
          <div
            className="status-dot-pulse"
            style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0 }}
          />
          LAN Server Mode — data synced across all devices
        </div>

        {/* Nav links */}
        <nav style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '8px 16px 4px' }}>Operations</div>
          {NAV_OPERATIONS.map(item => (
            <NavItem key={item.to} {...item} onClick={() => setMobileOpen(false)} />
          ))}
          {isAdmin && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '14px 16px 4px' }}>Administration</div>
              <NavItem {...NAV_ADMIN} onClick={() => setMobileOpen(false)} />
            </>
          )}
        </nav>

        {/* Sidebar footer */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', flexDirection: 'column', gap: 10,
          flexShrink: 0,
        }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 0',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              minHeight: 44,
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Current Time</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', marginTop: 2 }}>{timeStr}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{dateStr}</div>
          </div>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100dvh', overflowY: 'auto' }}>

        {/* Sticky header */}
        <header style={{
          height: 58,
          padding: '0 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--bg-card)',
          position: 'sticky',
          top: 0,
          zIndex: 90,
          boxShadow: 'var(--shadow-sm)',
          flexShrink: 0,
        }}>

          {/* Hamburger */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            style={{
              display: 'none',
              alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40,
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 12h18M3 6h18M3 18h18"/>
            </svg>
          </button>

          {/* Square S icon — shown in mobile header when sidebar is hidden */}
          <img
            src="/icon-192.png"
            alt="Shoreline"
            className="header-logo-mobile"
            style={{
              display: 'none',
              width: 28, height: 28,
              objectFit: 'contain',
              borderRadius: 6,
              flexShrink: 0,
            }}
          />

          {/* User pill */}
          {user && (
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: 'var(--color-primary)',
              background: 'var(--color-primary-light)',
              border: '1px solid var(--color-primary)',
              padding: '3px 10px', borderRadius: 20,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {user.name.toUpperCase()}
              {isAdmin && <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>(Admin)</span>}
            </div>
          )}

          {/* Search bar */}
          <div
            className="header-search"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '7px 14px', flex: 1, maxWidth: 400,
            }}
          >
            <svg width="13" height="13" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Search residents...</span>
          </div>

          {/* Role pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'var(--text-secondary)',
            flexShrink: 0, marginLeft: 'auto',
          }}>
            <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Role:</span>
            <div style={{
              background: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '3px 8px', fontSize: 12, fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              {isAdmin ? 'Supervisor' : 'Staff'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="main-content" style={{ padding: '32px 24px', flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
