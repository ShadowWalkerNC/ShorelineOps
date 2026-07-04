// ============================================================
// NOTIFICATION BELL — HEADER DROPDOWN
// ============================================================
// Resolves the logged-in user's staff profile via authUserId,
// then shows only that employee's notifications.
// - Unread badge (capped at 9+)
// - Dropdown: subject, body preview, timestamp, type label
// - Unread dot per item + blue highlight row
// - Mark one read on click · Mark all read button
// - "View all" links to the employee's staff profile page
// - Auto-refreshes every 30 s via notificationsStore
// - Closes on click-outside via useClickOutside hook
// ============================================================
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../security/AuthContext'
import { useNotificationsStore } from '../state/notificationsStore'
import { useStaffStore } from '../state/staffStore'
import { useClickOutside } from '../hooks/useClickOutside'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const { notifications, fetch: fetchNotifs, markRead, markAllRead } = useNotificationsStore()
  const { profiles, fetch: fetchStaff } = useStaffStore()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, () => setOpen(false))

  useEffect(() => {
    fetchStaff()
    fetchNotifs()
    const id = setInterval(fetchNotifs, 30_000)
    return () => clearInterval(id)
  }, [fetchStaff, fetchNotifs])

  if (!user) return null

  // Resolve this user's staff profile by authUserId
  const myProfile = profiles.find(p =>
    (p as any).authUserId === user.id || (p as any).userId === user.id
  )

  const mine = myProfile
    ? [...notifications]
        .filter(n => n.toStaffId === myProfile.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : []

  const unread = mine.filter(n => !n.isRead).length

  function handleItemClick(n: typeof mine[number]) {
    if (!n.isRead) markRead(n.id)
    setOpen(false)
    if (myProfile) navigate(`/staff/${myProfile.id}`)
  }

  // ── Bell button ─────────────────────────────────────────────
  const bellBtn: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    background: open ? 'var(--color-primary-light)' : 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    color: open ? 'var(--color-primary)' : 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>

      {/* ── Bell button ── */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        style={bellBtn}
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Unread badge */}
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 18, height: 18, padding: '0 4px',
            borderRadius: 9,
            background: '#dc2626', color: '#fff',
            fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
            border: '2px solid var(--bg-card)',
            fontFamily: 'Outfit, sans-serif',
            pointerEvents: 'none',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 380,
          maxWidth: 'calc(100vw - 24px)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 12px 40px rgba(13,27,42,0.22)',
          zIndex: 500,
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-app)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Notifications
              {unread > 0 && (
                <span style={{ marginLeft: 8, fontSize: 11, color: '#dc2626', fontWeight: 700 }}>
                  {unread} unread
                </span>
              )}
            </div>
            {myProfile && unread > 0 && (
              <button
                onClick={() => markAllRead(myProfile.id)}
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {mine.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ display: 'block', margin: '0 auto 10px', opacity: 0.35 }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                No notifications
              </div>
            ) : (
              mine.map(n => (
                <NotifRow key={n.id} n={n} onClick={() => handleItemClick(n)} />
              ))
            )}
          </div>

          {/* Footer */}
          {mine.length > 0 && myProfile && (
            <div style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-app)',
              textAlign: 'center',
            }}>
              <button
                onClick={() => { navigate(`/staff/${myProfile.id}`); setOpen(false) }}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
              >
                View all in profile →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Individual notification row ──────────────────────────────
function NotifRow({ n, onClick }: { n: any; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: 10,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        cursor: 'pointer',
        background: !n.isRead
          ? 'var(--color-primary-light)'
          : hovered ? 'var(--bg-app)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* Unread dot */}
      <div style={{ width: 8, flexShrink: 0, paddingTop: 5, display: 'flex', justifyContent: 'center' }}>
        {!n.isRead && (
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{
            fontSize: 13,
            fontWeight: n.isRead ? 500 : 700,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {n.subject}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {timeAgo(n.createdAt)}
          </span>
        </div>

        <p style={{
          margin: '4px 0 0',
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {n.body}
        </p>

        <div style={{
          marginTop: 5,
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {String(n.type ?? '').replace(/_/g, ' ')}
        </div>
      </div>
    </div>
  )
}
