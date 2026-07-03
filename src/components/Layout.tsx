import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../security/AuthContext'

// ── Clock ────────────────────────────────────────────────────────────────────
function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

// ── Nav config ───────────────────────────────────────────────────────────────
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
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    label: 'Production & Service',
    to: '/production',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
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

// ── Shoreline logo icon ──────────────────────────────────────────────────────
function ShorelineIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
      <path d="M2 20h20" strokeLinecap="round"/>
      <path d="M5 20 Q8 14 12 14 Q16 14 19 20" strokeLinecap="round" fill="none"/>
      <path d="M8 20 Q10 10 12 10 Q14 10 16 20" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

// ── NavItem ──────────────────────────────────────────────────────────────────
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
        background: isActive ? 'var(--bg-card)' : 'transparent',
        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
        transition: 'all 0.2s ease',
        minHeight: 44,
      })}
    >
      {icon}
      {label}
    </NavLink>
  )
}

// ── Layout ───────────────────────────────────────────────────────────────────
export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const now = useClock()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAdmin = user?.role === 'admin'

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: 'var(--bg-app)', overflow: 'hidden' }}>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.45)',
            backdropFilter: 'blur(2px)',
            zIndex: 99,
          }}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className="sidebar-aside"
        style={{
          width: 'var(--sidebar-width)',
          flexShrink: 0,
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          boxShadow: 'var(--shadow-sm)',
          zIndex: 100,
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '28px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShorelineIcon />
            <div className="logo-text">
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1.1 }}>Shoreline</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>iMPAC OPERATIONS</div>
            </div>
          </div>
        </div>

        {/* Status dot */}
        <div style={{ padding: '8px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'rgba(255,255,255,0.25)' }}>
          <div className="status-dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }} />
          LAN Server Mode — data synced across all devices
        </div>

        {/* Nav */}
        <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '10px 16px 4px' }}>Operations</div>
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

        {/* Footer */}
        <div style={{ padding: 20, borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.15)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: 10,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              minHeight: 44,
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
          {/* Clock */}
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Current Time</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>{timeStr}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{dateStr}</div>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflowY: 'auto' }}>
        {/* Header */}
        <header style={{
          height: 70,
          padding: '0 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--bg-card)',
          position: 'sticky',
          top: 0,
          zIndex: 90,
          boxShadow: 'var(--shadow-sm)',
        }}>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="mobile-menu-btn"
            style={{
              display: 'none',
              alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44,
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 12h18M3 6h18M3 18h18"/>
            </svg>
          </button>

          {/* User pill */}
          {user && (
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)', padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {user.name.toUpperCase()}
              {isAdmin && <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>(Admin)</span>}
            </div>
          )}

          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '8px 16px', flex: 1, maxWidth: 420 }}>
            <svg width="14" height="14" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Search residents...</span>
          </div>

          {/* Active Role pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
            <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Active Role:</span>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {isAdmin ? 'Supervisor' : 'Staff'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ padding: '40px 24px', flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
