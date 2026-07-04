// ============================================================
// COMMUNICATIONS PAGE
// ============================================================
// Route: /communications
// Tabs:
//   Threads    — staff meeting notes, council notes, memos,
//                policy changes. Full editorial workflow.
//   Approvals  — change requests awaiting manager sign-off.
//
// Role gating:
//   All roles can VIEW threads + their own notifications.
//   Internal thread entries hidden from non-manager/admin.
//   Approval REVIEW actions gated to manager/admin.
//   Draft new thread — any role; must pass review to distribute.
// ============================================================
import React, { useEffect, useState, useMemo } from 'react'
import { useCommunicationsStore } from '../../state/communicationsStore'
import { useStaffStore } from '../../state/staffStore'
import { useAuth } from '../../security/AuthContext'
import { ROLE_LABEL } from '../../types/roles'
import type {
  CommunicationThread, ThreadType, ThreadStatus, ThreadEntry,
  ApprovalRequest, ApprovalStatus, ApprovalType,
} from '../../types/communications'

// ── Shared helpers ────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10) }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const THREAD_TYPE_LABEL: Record<ThreadType, string> = {
  resident_council: 'Resident Council',
  staff_meeting:    'Staff Meeting',
  memo:             'Memo',
  policy_change:    'Policy Change',
  general:          'General',
}

const THREAD_STATUS_COLOR: Record<ThreadStatus, { bg: string; color: string }> = {
  'Draft':          { bg: '#f3f4f6', color: '#374151' },
  'Pending Review': { bg: '#fef3c7', color: '#92400e' },
  'Approved':       { bg: '#d1fae5', color: '#065f46' },
  'Distributed':    { bg: '#dbeafe', color: '#1e40af' },
  'Archived':       { bg: '#f1f5f9', color: '#64748b' },
}

const APPROVAL_STATUS_COLOR: Record<ApprovalStatus, { bg: string; color: string }> = {
  'Pending':   { bg: '#fef3c7', color: '#92400e' },
  'Approved':  { bg: '#d1fae5', color: '#065f46' },
  'Rejected':  { bg: '#fee2e2', color: '#991b1b' },
  'Withdrawn': { bg: '#f3f4f6', color: '#6b7280' },
}

const APPROVAL_TYPE_LABEL: Record<ApprovalType, string> = {
  menu_change:           'Menu Change',
  inventory_adjustment:  'Inventory Adjustment',
  truck_order:           'Truck Order',
  staff_record_change:   'Staff Record Change',
  budget_override:       'Budget Override',
  checklist_change:      'Checklist Change',
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}

function StatusBadge({ label, colors }: { label: string; colors: { bg: string; color: string } }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px',
      borderRadius: 20, background: colors.bg, color: colors.color,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
      {message}
    </div>
  )
}

// ── Staff name resolver hook ──────────────────────────────────
function useStaffName() {
  const { profiles } = useStaffStore()
  return (id: string) => {
    const p = profiles.find(p => p.id === id)
    return p ? `${p.firstName} ${p.lastName}` : 'Unknown'
  }
}

// ╔══════════════════════════════════════════════════════════════
// ║  THREADS TAB
// ╚══════════════════════════════════════════════════════════════
const THREAD_TYPES: ThreadType[] = [
  'resident_council', 'staff_meeting', 'memo', 'policy_change', 'general',
]
const THREAD_STATUSES: ThreadStatus[] = [
  'Draft', 'Pending Review', 'Approved', 'Distributed', 'Archived',
]

function ThreadsTab() {
  const { threads, addThread, addEntry, setStatus, isLoading } = useCommunicationsStore()
  const { user } = useAuth()
  const getName = useStaffName()
  const { profiles } = useStaffStore()

  const [filterType,   setFilterType]   = useState<ThreadType | 'All'>('All')
  const [filterStatus, setFilterStatus] = useState<ThreadStatus | 'All'>('All')
  const [search,       setSearch]       = useState('')
  const [selected,     setSelected]     = useState<string | null>(null)
  const [showNew,      setShowNew]      = useState(false)
  const [replyBody,    setReplyBody]    = useState('')
  const [replyInternal, setReplyInternal] = useState(false)
  const [newDraft, setNewDraft] = useState({ type: 'memo' as ThreadType, subject: '', body: '' })

  const isPrivileged = user?.role === 'admin' || user?.role === 'manager'

  const myProfile = profiles.find((p: any) =>
    (p as any).authUserId === user?.id || (p as any).userId === user?.id
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return threads.filter(t => {
      if (filterType   !== 'All' && t.type   !== filterType)   return false
      if (filterStatus !== 'All' && t.status !== filterStatus) return false
      if (q && !t.subject.toLowerCase().includes(q))           return false
      return true
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [threads, filterType, filterStatus, search])

  const selectedThread = threads.find(t => t.id === selected)

  function submitNew() {
    if (!newDraft.subject.trim() || !newDraft.body.trim() || !myProfile) return
    const id = addThread({ type: newDraft.type, subject: newDraft.subject, status: 'Draft', createdById: myProfile.id })
    addEntry(id, { authorId: myProfile.id, authorRole: user!.role, body: newDraft.body, isInternal: false })
    setNewDraft({ type: 'memo', subject: '', body: '' })
    setShowNew(false)
    setSelected(id)
  }

  function submitReply() {
    if (!replyBody.trim() || !selectedThread || !myProfile) return
    addEntry(selectedThread.id, { authorId: myProfile.id, authorRole: user!.role, body: replyBody, isInternal: replyInternal })
    setReplyBody('')
    setReplyInternal(false)
  }

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)', background: 'var(--bg-card)',
    fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', minHeight: 38,
  }

  if (isLoading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>

  // ── Detail panel ─────────────────────────────────────────
  if (selectedThread) {
    const statusColors = THREAD_STATUS_COLOR[selectedThread.status]
    const visibleEntries = selectedThread.entries.filter(e => isPrivileged || !e.isInternal)

    const NEXT_STATUS: Partial<Record<ThreadStatus, ThreadStatus>> = {
      'Draft':          'Pending Review',
      'Pending Review': 'Approved',
      'Approved':       'Distributed',
      'Distributed':    'Archived',
    }
    const nextStatus = NEXT_STATUS[selectedThread.status]

    return (
      <div>
        {/* Back */}
        <button
          onClick={() => setSelected(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, marginBottom: 20, padding: 0 }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
          Back to Threads
        </button>

        {/* Header card */}
        <SectionCard style={{ marginBottom: 16 }}>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                  <StatusBadge label={THREAD_TYPE_LABEL[selectedThread.type]} colors={{ bg: 'var(--color-primary-light)', color: 'var(--color-primary)' }} />
                  <StatusBadge label={selectedThread.status} colors={statusColors} />
                </div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.3px' }}>
                  {selectedThread.subject}
                </h2>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  Created by {getName(selectedThread.createdById)} · {timeAgo(selectedThread.createdAt)} · {selectedThread.entries.length} entr{selectedThread.entries.length === 1 ? 'y' : 'ies'}
                </div>
                {selectedThread.distributedTo.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#1e40af' }}>
                    Distributed to {selectedThread.distributedTo.length} staff member{selectedThread.distributedTo.length !== 1 ? 's' : ''} · {timeAgo(selectedThread.distributedAt!)}
                  </div>
                )}
              </div>

              {/* Status advance — manager/admin only */}
              {isPrivileged && nextStatus && selectedThread.status !== 'Archived' && (
                <button
                  onClick={() => setStatus(selectedThread.id, nextStatus)}
                  style={{ padding: '9px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Mark as {nextStatus}
                </button>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Entries */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {visibleEntries.map(entry => (
            <ThreadEntryCard key={entry.id} entry={entry} getName={getName} isInternal={entry.isInternal} />
          ))}
          {visibleEntries.length === 0 && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No entries yet.</div>
          )}
        </div>

        {/* Reply box */}
        {selectedThread.status !== 'Archived' && myProfile && (
          <SectionCard>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Add Entry</div>
              <textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder="Write your entry…"
                rows={4}
                style={{ width: '100%', padding: 12, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 14, color: 'var(--text-primary)', background: 'var(--bg-app)', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                {isPrivileged && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={replyInternal} onChange={e => setReplyInternal(e.target.checked)} />
                    Internal only (not distributed)
                  </label>
                )}
                <button
                  onClick={submitReply}
                  disabled={!replyBody.trim()}
                  style={{ padding: '9px 20px', background: replyBody.trim() ? 'var(--color-primary)' : 'var(--border-color)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: replyBody.trim() ? 'pointer' : 'default', marginLeft: 'auto' }}
                >
                  Post Entry
                </button>
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────
  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <input
          placeholder="Search threads…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...selectStyle, flex: 1, minWidth: 180 }}
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)} style={selectStyle}>
          <option value="All">All Types</option>
          {THREAD_TYPES.map(t => <option key={t} value={t}>{THREAD_TYPE_LABEL[t]}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} style={selectStyle}>
          <option value="All">All Statuses</option>
          {THREAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={() => setShowNew(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 38 }}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          New Thread
        </button>
      </div>

      {/* New thread form */}
      {showNew && (
        <SectionCard style={{ marginBottom: 20 }}>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>New Thread</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select value={newDraft.type} onChange={e => setNewDraft(p => ({ ...p, type: e.target.value as ThreadType }))} style={{ ...selectStyle, flex: '0 0 180px' }}>
                {THREAD_TYPES.map(t => <option key={t} value={t}>{THREAD_TYPE_LABEL[t]}</option>)}
              </select>
              <input
                placeholder="Subject…"
                value={newDraft.subject}
                onChange={e => setNewDraft(p => ({ ...p, subject: e.target.value }))}
                style={{ ...selectStyle, flex: 1, minWidth: 200 }}
              />
            </div>
            <textarea
              placeholder="First entry body…"
              value={newDraft.body}
              onChange={e => setNewDraft(p => ({ ...p, body: e.target.value }))}
              rows={4}
              style={{ padding: 12, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 14, color: 'var(--text-primary)', background: 'var(--bg-app)', resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={submitNew} disabled={!newDraft.subject.trim() || !newDraft.body.trim()} style={{ padding: '9px 20px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create Draft</button>
              <button onClick={() => setShowNew(false)} style={{ padding: '9px 16px', background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Thread list */}
      {filtered.length === 0
        ? <EmptyState icon="📋" message="No threads match the current filters." />
        : (
          <SectionCard>
            {filtered.map((t, i) => (
              <ThreadRow
                key={t.id}
                thread={t}
                getName={getName}
                isLast={i === filtered.length - 1}
                onClick={() => setSelected(t.id)}
              />
            ))}
          </SectionCard>
        )
      }
    </div>
  )
}

function ThreadRow({ thread: t, getName, isLast, onClick }: {
  thread: CommunicationThread
  getName: (id: string) => string
  isLast: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const statusColors = THREAD_STATUS_COLOR[t.status]

  return (
    <div
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 20px',
        borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
        cursor: 'pointer',
        background: hovered ? 'var(--color-primary-light)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* Type icon */}
      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
        {t.type === 'resident_council' ? '🏠' : t.type === 'staff_meeting' ? '👥' : t.type === 'memo' ? '📝' : t.type === 'policy_change' ? '📋' : '💬'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.subject}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {THREAD_TYPE_LABEL[t.type]} · {getName(t.createdById)} · {timeAgo(t.updatedAt)} · {t.entries.length} entr{t.entries.length === 1 ? 'y' : 'ies'}
        </div>
      </div>

      <StatusBadge label={t.status} colors={statusColors} />
    </div>
  )
}

function ThreadEntryCard({ entry, getName, isInternal }: { entry: ThreadEntry; getName: (id: string) => string; isInternal: boolean }) {
  return (
    <SectionCard style={{ borderLeft: isInternal ? '3px solid #7c3aed' : '3px solid var(--color-primary)' }}>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: isInternal ? '#7c3aed' : 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Outfit, sans-serif' }}>
            {getName(entry.authorId).charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{getName(entry.authorId)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ROLE_LABEL[entry.authorRole]} · {timeAgo(entry.createdAt)}</div>
          </div>
          {isInternal && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f3e8ff', color: '#7c3aed', marginLeft: 'auto' }}>INTERNAL</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{entry.body}</p>
      </div>
    </SectionCard>
  )
}

// ╔══════════════════════════════════════════════════════════════
// ║  APPROVALS TAB
// ╚══════════════════════════════════════════════════════════════
function ApprovalsTab() {
  const { approvals, reviewApproval, withdrawApproval, isLoading } = useCommunicationsStore()
  const { user } = useAuth()
  const getName = useStaffName()
  const { profiles } = useStaffStore()

  const [filterStatus, setFilterStatus] = useState<ApprovalStatus | 'All'>('Pending')
  const [filterType,   setFilterType]   = useState<ApprovalType | 'All'>('All')
  const [selected,     setSelected]     = useState<string | null>(null)
  const [reviewNote,   setReviewNote]   = useState('')

  const isPrivileged = user?.role === 'admin' || user?.role === 'manager'

  const myProfile = profiles.find((p: any) =>
    (p as any).authUserId === user?.id || (p as any).userId === user?.id
  )

  const filtered = useMemo(() => {
    return approvals.filter(a => {
      if (filterStatus !== 'All' && a.status !== filterStatus) return false
      if (filterType   !== 'All' && a.type   !== filterType)   return false
      return true
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [approvals, filterStatus, filterType])

  const pending  = approvals.filter(a => a.status === 'Pending').length
  const selected_ = approvals.find(a => a.id === selected)

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)', background: 'var(--bg-card)',
    fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', minHeight: 38,
  }

  if (isLoading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>

  // ── Detail panel ─────────────────────────────────────────
  if (selected_) {
    const statusColors = APPROVAL_STATUS_COLOR[selected_.status]
    const payload = selected_.payload as any

    return (
      <div>
        <button
          onClick={() => { setSelected(null); setReviewNote('') }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, marginBottom: 20, padding: 0 }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
          Back to Approvals
        </button>

        <SectionCard style={{ marginBottom: 16 }}>
          <div style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <StatusBadge label={APPROVAL_TYPE_LABEL[selected_.type]} colors={{ bg: 'var(--color-primary-light)', color: 'var(--color-primary)' }} />
                  <StatusBadge label={selected_.status} colors={statusColors} />
                </div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.3px', marginBottom: 6 }}>
                  {selected_.subject}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Requested by {getName(selected_.requestedById)} · {timeAgo(selected_.createdAt)}
                  {selected_.assignedToId && ` · Assigned to ${getName(selected_.assignedToId)}`}
                </div>
              </div>
            </div>

            <p style={{ margin: '16px 0 0', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.65, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
              {selected_.description}
            </p>
          </div>
        </SectionCard>

        {/* Payload detail */}
        <SectionCard style={{ marginBottom: 16 }}>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>Change Details</div>
            <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(payload).filter(([k]) => k !== 'items').map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 16 }}>
                  <dt style={{ width: 160, flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</dt>
                  <dd style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>
                    {typeof v === 'number' && k.toLowerCase().includes('cost') ? `$${(v as number).toFixed(2)}` : String(v)}
                  </dd>
                </div>
              ))}
              {payload.items && (
                <div style={{ marginTop: 8 }}>
                  <dt style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Line Items</dt>
                  {payload.items.map((item: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--bg-app)', borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
                      <span>{item.name} — {item.qty} {item.unit}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>${item.estimatedCost?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </dl>
          </div>
        </SectionCard>

        {/* Review result */}
        {selected_.reviewNote && (
          <SectionCard style={{ marginBottom: 16, borderLeft: `3px solid ${selected_.status === 'Approved' ? '#059669' : '#dc2626'}` }}>
            <div style={{ padding: '14px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Review Note · {getName(selected_.assignedToId)} · {timeAgo(selected_.reviewedAt!)}
              </div>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{selected_.reviewNote}</p>
            </div>
          </SectionCard>
        )}

        {/* Action panel — manager/admin only for Pending requests */}
        {isPrivileged && selected_.status === 'Pending' && (
          <SectionCard>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Review Decision</div>
              <textarea
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder="Optional review note…"
                rows={3}
                style={{ width: '100%', padding: 12, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 14, color: 'var(--text-primary)', background: 'var(--bg-app)', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { reviewApproval(selected_.id, 'Approved', reviewNote || undefined); setSelected(null) }}
                  style={{ padding: '10px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => { reviewApproval(selected_.id, 'Rejected', reviewNote || undefined); setSelected(null) }}
                  style={{ padding: '10px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  ✗ Reject
                </button>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Withdraw — only requestor + pending */}
        {myProfile?.id === selected_.requestedById && selected_.status === 'Pending' && (
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button
              onClick={() => { withdrawApproval(selected_.id); setSelected(null) }}
              style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Withdraw request
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────
  return (
    <div>
      {/* Alert for pending */}
      {pending > 0 && isPrivileged && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 'var(--radius-md)', marginBottom: 20, fontSize: 13 }}>
          <svg width="16" height="16" fill="none" stroke="#d97706" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <strong>{pending} approval{pending !== 1 ? 's' : ''} pending your review.</strong>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} style={selectStyle}>
          <option value="All">All Statuses</option>
          {(['Pending','Approved','Rejected','Withdrawn'] as ApprovalStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)} style={selectStyle}>
          <option value="All">All Types</option>
          {(Object.keys(APPROVAL_TYPE_LABEL) as ApprovalType[]).map(t => <option key={t} value={t}>{APPROVAL_TYPE_LABEL[t]}</option>)}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0
        ? <EmptyState icon="✅" message="No approval requests match the current filters." />
        : (
          <SectionCard>
            {filtered.map((a, i) => (
              <ApprovalRow
                key={a.id}
                approval={a}
                getName={getName}
                isLast={i === filtered.length - 1}
                onClick={() => setSelected(a.id)}
              />
            ))}
          </SectionCard>
        )
      }
    </div>
  )
}

function ApprovalRow({ approval: a, getName, isLast, onClick }: {
  approval: ApprovalRequest
  getName: (id: string) => string
  isLast: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const statusColors = APPROVAL_STATUS_COLOR[a.status]

  return (
    <div
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 20px',
        borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
        cursor: 'pointer',
        background: hovered ? 'var(--color-primary-light)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* Status dot */}
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColors.color, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {a.subject}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {APPROVAL_TYPE_LABEL[a.type]} · by {getName(a.requestedById)} · {timeAgo(a.createdAt)}
        </div>
      </div>

      <StatusBadge label={a.status} colors={statusColors} />
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════
// ║  MAIN PAGE
// ╚══════════════════════════════════════════════════════════════
type CommsTab = 'threads' | 'approvals'

export default function CommunicationsPage() {
  const { fetch, approvals } = useCommunicationsStore()
  const { fetch: fetchStaff } = useStaffStore()
  const [activeTab, setActiveTab] = useState<CommsTab>('threads')

  useEffect(() => {
    fetchStaff()
    fetch()
  }, [fetch, fetchStaff])

  const pendingApprovals = approvals.filter(a => a.status === 'Pending').length

  const TABS: { id: CommsTab; label: string; count?: number }[] = [
    { id: 'threads',   label: 'Threads' },
    { id: 'approvals', label: 'Approvals', count: pendingApprovals || undefined },
  ]

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', margin: 0, letterSpacing: '-0.4px' }}>Communications</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Meeting notes, memos, council records, and change approvals.</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 6 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '9px 16px', border: 'none', cursor: 'pointer',
              borderRadius: 'var(--radius-md)', fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              background: activeTab === tab.id ? 'var(--color-primary)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 20, background: activeTab === tab.id ? 'rgba(255,255,255,0.3)' : '#dc2626', color: '#fff', lineHeight: 1.6 }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'threads'   && <ThreadsTab />}
      {activeTab === 'approvals' && <ApprovalsTab />}
    </div>
  )
}
