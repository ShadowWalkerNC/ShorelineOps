// ============================================================
// NOTIFICATION BELL — HEADER DROPDOWN
// ============================================================
// Two categories:
//   1. SYSTEM ALERTS — derived live from ops stores
//      (inventory below par, pending comms approvals, budget warn)
//   2. PERSONAL NOTIFICATIONS — from notificationsStore for
//      the logged-in staff member
//
// Inventory alerts now read from useInventoryStore() so that
// edits made in InventoryPage are instantly reflected here.
// Budget alerts read from useBudgetStore() so they stay in sync
// with BudgetPage entries.
// ============================================================
import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../security/AuthContext'
import { useNotificationsStore } from '../state/notificationsStore'
import { useStaffStore } from '../state/staffStore'
import { useCommunicationsStore } from '../state/communicationsStore'
import { useInventoryStore } from '../state/inventoryStore'
import { useBudgetStore } from '../state/budgetStore'
import { useClickOutside } from '../hooks/useClickOutside'

// ── System alert type ─────────────────────────────────────────────────────────
type SystemAlert = {
  id: string
  type: 'inventory' | 'approval' | 'budget' | 'info'
  severity: 'critical' | 'warning' | 'info'
  subject: string
  body: string
  link: string
  createdAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

const TYPE_LABELS: Record<string, string> = {
  memo: 'Memo', schedule_change: 'Schedule', approval_request: 'Approval',
  diet_change: 'Diet Change', alert: 'Alert', general: 'General',
}

function TypeIcon({ type, color }: { type: string; color: string }) {
  const s = { width: 14, height: 14, flexShrink: 0 as const }
  if (type === 'inventory')
    return <svg {...s} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
  if (type === 'approval' || type === 'approval_request')
    return <svg {...s} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
  if (type === 'budget')
    return <svg {...s} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  if (type === 'schedule_change')
    return <svg {...s} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
  if (type === 'memo')
    return <svg {...s} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
  return <svg {...s} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
}

const SEV_COLORS = {
  critical: { bg: '#fef2f2', border: '#fecaca', dot: '#dc2626', text: '#991b1b' },
  warning:  { bg: '#fffbeb', border: '#fde68a', dot: '#d97706', text: '#92400e' },
  info:     { bg: 'var(--color-primary-light)', border: 'var(--color-primary)', dot: 'var(--color-primary)', text: 'var(--color-primary)' },
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NotificationBell() {
  const { user, atLeast } = useAuth()
  const navigate = useNavigate()
  const { notifications, fetch: fetchNotifs, markRead, markAllRead } = useNotificationsStore()
  const { profiles, fetch: fetchStaff } = useStaffStore()
  const { threads, fetchThreads } = useCommunicationsStore()
  const { fetch: fetchInventory, getLowParItems, getZeroItems } = useInventoryStore()

  const budgetFetch      = useBudgetStore(s => s.fetch)
  const period           = useBudgetStore(s => s.period)
  const getTotalBudget   = useBudgetStore(s => s.getTotalBudget)
  const getTotalSpent    = useBudgetStore(s => s.getTotalSpent)
  const getProjected     = useBudgetStore(s => s.getProjected)
  const getDaysElapsed   = useBudgetStore(s => s.getDaysElapsed)

  const [open, setOpen]           = useState(false)
  const [tab, setTab]             = useState<'all' | 'system' | 'personal'>('all')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, () => setOpen(false))

  useEffect(() => {
    fetchStaff()
    fetchNotifs()
    fetchThreads()
    fetchInventory()
    budgetFetch()
    const id = setInterval(() => { fetchNotifs(); fetchThreads() }, 30_000)
    return () => clearInterval(id)
  }, [fetchStaff, fetchNotifs, fetchThreads, fetchInventory, budgetFetch])

  if (!user) return null

  const myProfile = profiles.find(p =>
    (p as any).authUserId === user.id || (p as any).userId === user.id
  )

  // ── Personal notifications ──────────────────────────────────────────────────
  const personal = myProfile
    ? [...notifications]
        .filter(n => n.toStaffId === myProfile.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : []
  const personalUnread = personal.filter(n => !n.isRead).length

  // ── System alerts (live derived from real stores) ───────────────────────────
  const systemAlerts = useMemo<SystemAlert[]>(() => {
    const now      = new Date().toISOString()
    const alerts: SystemAlert[] = []
    const zeroItems = getZeroItems()
    const lowPar    = getLowParItems()

    // Inventory — zero stock takes priority over low par
    if (zeroItems.length > 0) {
      alerts.push({
        id: 'sys-inv-zero', type: 'inventory', severity: 'critical',
        subject: `${zeroItems.length} item${zeroItems.length > 1 ? 's' : ''} completely out of stock`,
        body: zeroItems.map(i => `${i.item} (0 ${i.unit})`).join(', '),
        link: '/inventory', createdAt: now,
      })
    }
    // Show low-par alert separately even if some are zero
    const belowParOnly = lowPar.filter(i => i.qty > 0)
    if (belowParOnly.length > 0) {
      alerts.push({
        id: 'sys-inv-low', type: 'inventory', severity: 'warning',
        subject: `${belowParOnly.length} item${belowParOnly.length > 1 ? 's' : ''} below par level`,
        body: belowParOnly.slice(0, 4).map(i => `${i.item} (${i.qty}/${i.min} ${i.unit})`).join(', ') +
              (belowParOnly.length > 4 ? ` +${belowParOnly.length - 4} more` : ''),
        link: '/inventory', createdAt: now,
      })
    }

    // Pending approvals
    const pending = threads.filter(t =>
      t.status === 'Pending Approval' || t.category === 'Approval Request'
    )
    if (pending.length > 0) {
      alerts.push({
        id: 'sys-approvals', type: 'approval', severity: 'warning',
        subject: `${pending.length} pending approval request${pending.length > 1 ? 's' : ''}`,
        body: pending.slice(0, 3).map(t => t.subject ?? t.category).join(' · '),
        link: '/communications', createdAt: now,
      })
    }

    // Budget (manager+) — reads live from store
    if (atLeast('manager')) {
      const totalBudget = getTotalBudget()
      const totalSpent  = getTotalSpent()
      const projected   = getProjected()
      const daysElapsed = getDaysElapsed()
      const pct         = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

      if (projected > totalBudget) {
        alerts.push({
          id: 'sys-budget-over', type: 'budget', severity: 'warning',
          subject: `Budget on track to exceed by $${(projected - totalBudget).toFixed(2)}`,
          body: `${period.label}: spent $${totalSpent.toFixed(2)} of $${totalBudget.toFixed(2)} (${pct.toFixed(1)}% used, day ${daysElapsed} of ${period.totalDays}).`,
          link: '/budget', createdAt: now,
        })
      } else if (pct > 75) {
        alerts.push({
          id: 'sys-budget-warn', type: 'budget', severity: 'info',
          subject: `Budget ${pct.toFixed(0)}% used — ${period.label}`,
          body: `$${totalSpent.toFixed(2)} spent of $${totalBudget.toFixed(2)} with ${period.totalDays - daysElapsed} days remaining.`,
          link: '/budget', createdAt: now,
        })
      }
    }

    return alerts.filter(a => !dismissed.has(a.id))
  }, [getLowParItems, getZeroItems, threads, dismissed, atLeast,
      getTotalBudget, getTotalSpent, getProjected, getDaysElapsed, period])

  const totalUnread = personalUnread + systemAlerts.length
  const hasCritical = systemAlerts.some(a => a.severity === 'critical')

  function dismiss(id: string) {
    setDismissed(prev => new Set([...prev, id]))
  }

  function handlePersonalClick(n: typeof personal[number]) {
    if (!n.isRead) markRead(n.id)
    setOpen(false)
    if (myProfile) navigate(`/staff/${myProfile.id}`)
  }

  const showSystem   = tab === 'all' || tab === 'system'
  const showPersonal = tab === 'all' || tab === 'personal'
  const isEmpty      = (showSystem   ? systemAlerts.length : 0) +
                       (showPersonal ? personal.length     : 0) === 0

  const bellBtn: React.CSSProperties = {
    position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 40, height: 40,
    background: open ? 'var(--color-primary-light)' : 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    color: open ? 'var(--color-primary)' : 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.15s ease', flexShrink: 0,
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>

      {/* ── Bell button ── */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={`Notifications${totalUnread > 0 ? `, ${totalUnread} unread` : ''}`}
        aria-expanded={open}
        style={bellBtn}
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {totalUnread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9,
            background: hasCritical ? '#dc2626' : '#d97706',
            color: '#fff', fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, border: '2px solid var(--bg-card)',
            fontFamily: 'Outfit, sans-serif', pointerEvents: 'none',
          }}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 400, maxWidth: 'calc(100vw - 24px)',
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 40px rgba(13,27,42,0.22)',
          zIndex: 500, overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-app)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Notifications
              {totalUnread > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: hasCritical ? '#dc2626' : '#d97706', fontWeight: 700 }}>{totalUnread} new</span>}
            </div>
            {myProfile && personalUnread > 0 && (
              <button onClick={() => markAllRead(myProfile.id)}
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Mark all read
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-app)' }}>
            {(['all', 'system', 'personal'] as const).map(t => {
              const badge = t === 'system' ? systemAlerts.length : t === 'personal' ? personalUnread : 0
              return (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: '8px 4px', border: 'none',
                  borderBottom: `2px solid ${tab === t ? 'var(--color-primary)' : 'transparent'}`,
                  background: 'none', fontSize: 12,
                  fontWeight: tab === t ? 700 : 500,
                  color: tab === t ? 'var(--color-primary)' : 'var(--text-muted)',
                  cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
                }}>
                  {t}{badge > 0 ? ` (${badge})` : ''}
                </button>
              )
            })}
          </div>

          {/* List */}
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>

            {/* System alerts */}
            {showSystem && systemAlerts.map(a => {
              const c = SEV_COLORS[a.severity]
              return (
                <div key={a.id} style={{ display: 'flex', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border-color)', background: c.bg, alignItems: 'flex-start' }}>
                  <div style={{ width: 8, paddingTop: 4, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <TypeIcon type={a.type} color={c.dot} />
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: c.text }}>
                        {a.severity === 'critical' ? '🚨 Critical' : a.severity === 'warning' ? '⚠️ Warning' : 'ℹ️ Info'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{a.subject}</div>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.body}</p>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, alignItems: 'center' }}>
                      <Link to={a.link} onClick={() => setOpen(false)}
                        style={{ fontSize: 11, fontWeight: 700, color: c.dot, textDecoration: 'none' }}>View →</Link>
                      <button onClick={() => dismiss(a.id)}
                        style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Dismiss</button>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Personal notifications */}
            {showPersonal && personal.map(n => (
              <PersonalRow key={n.id} n={n} onClick={() => handlePersonalClick(n)} />
            ))}

            {/* Empty state */}
            {isEmpty && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"
                  style={{ display: 'block', margin: '0 auto 10px', opacity: 0.35 }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                All clear — no notifications
              </div>
            )}
          </div>

          {/* Footer */}
          {!isEmpty && myProfile && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-app)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{systemAlerts.length} system · {personal.length} personal</span>
              <button onClick={() => { navigate(`/staff/${myProfile.id}`); setOpen(false) }}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                View profile →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Personal notification row ─────────────────────────────────────────────────
function PersonalRow({ n, onClick }: { n: any; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const typeColor = n.isRead ? 'var(--text-muted)' : 'var(--color-primary)'
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', gap: 10, padding: '12px 14px',
        borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
        background: !n.isRead ? 'var(--color-primary-light)' : hovered ? 'var(--bg-app)' : 'transparent',
        transition: 'background 0.15s', alignItems: 'flex-start',
      }}
    >
      <div style={{ width: 8, paddingTop: 5, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {!n.isRead && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1 }}>
            <TypeIcon type={n.type} color={typeColor} />
            <span style={{ fontSize: 13, fontWeight: n.isRead ? 500 : 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {n.subject}
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {timeAgo(n.createdAt)}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {n.body}
        </p>
        <div style={{ marginTop: 4, fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {TYPE_LABELS[n.type] ?? String(n.type).replace(/_/g, ' ')}
        </div>
      </div>
    </div>
  )
}
