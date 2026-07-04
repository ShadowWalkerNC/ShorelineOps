// ============================================================
// COMMUNICATIONS PAGE
// ============================================================
// Route: /communications
// Roles: all authenticated staff
//
// Tab 1 — Threads
//   List of CommunicationThreads (council notes, meeting notes,
//   memos, policy changes). Filterable by type + status.
//   Click → full thread detail panel (inline expansion).
//   Manager/Admin can add entries, change status, distribute.
//   Internal entries hidden from non-managers.
//
// Tab 2 — Approvals
//   ApprovalRequests queue. Pending items at top.
//   Manager/Admin can approve or reject with a note.
//   Requester can withdraw their own pending request.
//   Payload details expandable per row.
// ============================================================
import React, { useEffect, useState, useMemo } from 'react'
import { useCommunicationsStore } from '../../state/communicationsStore'
import { useStaffStore } from '../../state/staffStore'
import { useAuth } from '../../security/AuthContext'
import type {
  CommunicationThread, ThreadType, ThreadStatus,
  ApprovalRequest, ApprovalStatus, ApprovalType,
} from '../../types/communications'

// ── Helpers ────────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10) }

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  if (days < 7)  return `${days} days ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const THREAD_TYPE_LABEL: Record<ThreadType, string> = {
  resident_council: 'Resident Council',
  staff_meeting:    'Staff Meeting',
  memo:             'Memo',
  policy_change:    'Policy Change',
  general:          'General',
}

const THREAD_TYPE_COLOR: Record<ThreadType, string> = {
  resident_council: '#7c3aed',
  staff_meeting:    '#0284c7',
  memo:             '#d97706',
  policy_change:    '#dc2626',
  general:          '#6b7280',
}

const STATUS_COLOR: Record<ThreadStatus, { bg: string; text: string }> = {
  'Draft':          { bg: '#f3f4f6', text: '#6b7280' },
  'Pending Review': { bg: '#fef3c7', text: '#92400e' },
  'Approved':       { bg: '#d1fae5', text: '#065f46' },
  'Distributed':    { bg: '#dbeafe', text: '#1e40af' },
  'Archived':       { bg: '#f3f4f6', text: '#9ca3af' },
}

const APPROVAL_STATUS_COLOR: Record<ApprovalStatus, { bg: string; text: string }> = {
  'Pending':   { bg: '#fef3c7', text: '#92400e' },
  'Approved':  { bg: '#d1fae5', text: '#065f46' },
  'Rejected':  { bg: '#fee2e2', text: '#991b1b' },
  'Withdrawn': { bg: '#f3f4f6', text: '#6b7280' },
}

const APPROVAL_TYPE_LABEL: Record<ApprovalType, string> = {
  menu_change:           'Menu Change',
  inventory_adjustment:  'Inventory Adjustment',
  truck_order:           'Truck Order',
  staff_record_change:   'Staff Record',
  budget_override:       'Budget Override',
  checklist_change:      'Checklist Change',
}

// ── Small reusable pieces ───────────────────────────────────────────────────
function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: bg, color: text, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function TypePill({ type }: { type: ThreadType }) {
  const color = THREAD_TYPE_COLOR[type]
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: `${color}18`, color, border: `1px solid ${color}44`, whiteSpace: 'nowrap' }}>
      {THREAD_TYPE_LABEL[type]}
    </span>
  )
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', ...style }}>
      {children}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: '52px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>{message}</div>
  )
}

// ── Staff name resolver ────────────────────────────────────────────────────
function useStaffName() {
  const { profiles } = useStaffStore()
  return (id: string) => {
    const p = profiles.find(x => x.id === id)
    return p ? `${p.firstName} ${p.lastName}` : 'Unknown'
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// THREADS TAB
// ══════════════════════════════════════════════════════════════════════════════
const THREAD_STATUSES: ThreadStatus[] = ['Draft', 'Pending Review', 'Approved', 'Distributed', 'Archived']
const THREAD_TYPES: ThreadType[]  = ['resident_council', 'staff_meeting', 'memo', 'policy_change', 'general']

function ThreadsTab({ isPrivileged, myStaffId }: { isPrivileged: boolean; myStaffId: string }) {
  const { threads, addThread, addEntry, setStatus, distribute, isLoading } = useCommunicationsStore()
  const getName = useStaffName()
  const { profiles } = useStaffStore()

  const [typeFilter,   setTypeFilter]   = useState<ThreadType | 'All'>('All')
  const [statusFilter, setStatusFilter] = useState<ThreadStatus | 'All'>('All')
  const [search,       setSearch]       = useState('')
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [showNew,      setShowNew]      = useState(false)
  const [replyBody,    setReplyBody]    = useState('')
  const [replyInternal, setReplyInternal] = useState(false)

  // New thread form state
  const [newSubject, setNewSubject] = useState('')
  const [newType,    setNewType]    = useState<ThreadType>('memo')
  const [newBody,    setNewBody]    = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return threads
      .filter(t =>
        (typeFilter   === 'All' || t.type   === typeFilter) &&
        (statusFilter === 'All' || t.status === statusFilter) &&
        (!q || t.subject.toLowerCase().includes(q))
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [threads, typeFilter, statusFilter, search])

  function handleCreateThread() {
    if (!newSubject.trim() || !newBody.trim()) return
    const id = addThread({ type: newType, subject: newSubject, status: 'Draft', createdById: myStaffId })
    addEntry(id, { authorId: myStaffId, authorRole: 'manager', body: newBody, isInternal: false })
    setNewSubject(''); setNewType('memo'); setNewBody('')
    setShowNew(false)
    setExpanded(id)
  }

  function handleReply(threadId: string) {
    if (!replyBody.trim()) return
    addEntry(threadId, { authorId: myStaffId, authorRole: 'manager', body: replyBody, isInternal: replyInternal })
    setReplyBody('')
    setReplyInternal(false)
  }

  function handleDistribute(threadId: string) {
    const allIds = profiles.map(p => p.id)
    distribute(threadId, allIds, myStaffId)
  }

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)', background: 'var(--bg-card)',
    fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', minHeight: 38,
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search threads…"
          style={{ ...selectStyle, flex: 1, minWidth: 200 }}
        />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} style={selectStyle}>
          <option value="All">All Types</option>
          {THREAD_TYPES.map(t => <option key={t} value={t}>{THREAD_TYPE_LABEL[t]}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={selectStyle}>
          <option value="All">All Statuses</option>
          {THREAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {isPrivileged && (
          <button
            onClick={() => setShowNew(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 38 }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            New Thread
          </button>
        )}
      </div>

      {/* New thread form */}
      {showNew && (
        <SectionCard style={{ marginBottom: 20 }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>New Thread</div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Subject</label>
                <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Thread subject…" style={{ ...selectStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Type</label>
                <select value={newType} onChange={e => setNewType(e.target.value as ThreadType)} style={{ ...selectStyle, width: '100%' }}>
                  {THREAD_TYPES.map(t => <option key={t} value={t}>{THREAD_TYPE_LABEL[t]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Opening Entry</label>
              <textarea
                value={newBody} onChange={e => setNewBody(e.target.value)}
                rows={5} placeholder="Write the first entry…"
                style={{ ...selectStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleCreateThread} style={{ padding: '9px 20px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create Thread</button>
              <button onClick={() => setShowNew(false)} style={{ padding: '9px 16px', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Thread list */}
      {isLoading ? (
        <EmptyState message="Loading threads…" />
      ) : filtered.length === 0 ? (
        <EmptyState message="No threads match the current filters." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(thread => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              isExpanded={expanded === thread.id}
              onToggle={() => setExpanded(v => v === thread.id ? null : thread.id)}
              isPrivileged={isPrivileged}
              myStaffId={myStaffId}
              getName={getName}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              replyInternal={replyInternal}
              setReplyInternal={setReplyInternal}
              onReply={() => handleReply(thread.id)}
              onStatusChange={(s) => setStatus(thread.id, s)}
              onDistribute={() => handleDistribute(thread.id)}
              selectStyle={selectStyle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ThreadRow({
  thread, isExpanded, onToggle,
  isPrivileged, myStaffId, getName,
  replyBody, setReplyBody, replyInternal, setReplyInternal,
  onReply, onStatusChange, onDistribute, selectStyle,
}: {
  thread: CommunicationThread
  isExpanded: boolean
  onToggle: () => void
  isPrivileged: boolean
  myStaffId: string
  getName: (id: string) => string
  replyBody: string
  setReplyBody: (v: string) => void
  replyInternal: boolean
  setReplyInternal: (v: boolean) => void
  onReply: () => void
  onStatusChange: (s: ThreadStatus) => void
  onDistribute: () => void
  selectStyle: React.CSSProperties
}) {
  const sc = STATUS_COLOR[thread.status]
  const visibleEntries = isPrivileged
    ? thread.entries
    : thread.entries.filter(e => !e.isInternal)

  return (
    <SectionCard>
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <TypePill type={thread.type} />
            <Badge label={thread.status} bg={sc.bg} text={sc.text} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{thread.subject}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {getName(thread.createdById)} · {relTime(thread.updatedAt)} · {thread.entries.length} entr{thread.entries.length === 1 ? 'y' : 'ies'}
            {thread.distributedTo.length > 0 && ` · distributed to ${thread.distributedTo.length}`}
          </div>
        </div>
        <svg width="16" height="16" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid var(--border-color)' }}>

          {/* Entries */}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {visibleEntries.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No visible entries.</div>
            ) : (
              visibleEntries.map(entry => (
                <div key={entry.id} style={{
                  padding: '14px 16px',
                  background: entry.isInternal ? '#fefce8' : 'var(--bg-app)',
                  border: `1px solid ${entry.isInternal ? '#fde68a' : 'var(--border-color)'}`,
                  borderLeft: `3px solid ${entry.isInternal ? '#f59e0b' : 'var(--color-primary)'}`,
                  borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {getName(entry.authorId)}
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6, fontSize: 12 }}>{entry.authorRole}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {entry.isInternal && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#92400e' }}>INTERNAL</span>}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{relTime(entry.createdAt)}</span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{entry.body}</p>
                </div>
              ))
            )}
          </div>

          {/* Manager actions */}
          {isPrivileged && (
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--bg-app)' }}>

              {/* Reply box */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Add Entry</label>
                <textarea
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  rows={3}
                  placeholder="Write a response or note…"
                  style={{ ...selectStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={replyInternal} onChange={e => setReplyInternal(e.target.checked)} style={{ width: 14, height: 14 }} />
                    Mark as internal (manager-only)
                  </label>
                  <button
                    onClick={onReply}
                    disabled={!replyBody.trim()}
                    style={{ padding: '8px 18px', background: replyBody.trim() ? 'var(--color-primary)' : 'var(--bg-app)', color: replyBody.trim() ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: replyBody.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
                  >
                    Post Entry
                  </button>
                </div>
              </div>

              {/* Status + distribution */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <select
                  value={thread.status}
                  onChange={e => onStatusChange(e.target.value as ThreadStatus)}
                  style={{ ...selectStyle, minWidth: 160 }}
                >
                  {THREAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {thread.status === 'Approved' && thread.distributedTo.length === 0 && (
                  <button
                    onClick={onDistribute}
                    style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Distribute to All Staff
                  </button>
                )}
                {thread.distributedTo.length > 0 && (
                  <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ Distributed to {thread.distributedTo.length} staff</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// APPROVALS TAB
// ══════════════════════════════════════════════════════════════════════════════
function ApprovalsTab({ isPrivileged, myStaffId }: { isPrivileged: boolean; myStaffId: string }) {
  const { approvals, reviewApproval, withdrawApproval, isLoading } = useCommunicationsStore()
  const getName = useStaffName()

  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'All'>('All')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({})

  const sorted = useMemo(() => {
    const order: Record<ApprovalStatus, number> = { Pending: 0, Approved: 1, Rejected: 2, Withdrawn: 3 }
    return [...approvals]
      .filter(a => statusFilter === 'All' || a.status === statusFilter)
      .sort((a, b) => (order[a.status] - order[b.status]) || b.createdAt.localeCompare(a.createdAt))
  }, [approvals, statusFilter])

  const pendingCount = approvals.filter(a => a.status === 'Pending').length

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)', background: 'var(--bg-card)',
    fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', minHeight: 38,
  }

  return (
    <div>
      {/* Stats strip */}
      {pendingCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', marginBottom: 20, fontSize: 13, fontWeight: 600, color: '#92400e' }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          {pendingCount} approval{pendingCount > 1 ? 's' : ''} awaiting review
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['All', 'Pending', 'Approved', 'Rejected', 'Withdrawn'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '7px 16px', borderRadius: 20, border: '1px solid var(--border-color)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: statusFilter === s ? 'var(--color-primary)' : 'var(--bg-card)',
              color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            {s}{s !== 'All' && (
              <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 800 }}>
                ({approvals.filter(a => a.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <EmptyState message="Loading approvals…" />
      ) : sorted.length === 0 ? (
        <EmptyState message="No approval requests match the current filter." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(req => {
            const sc = APPROVAL_STATUS_COLOR[req.status]
            const isOpen = expanded === req.id
            const canReview = isPrivileged && req.status === 'Pending'
            const canWithdraw = req.requestedById === myStaffId && req.status === 'Pending'

            return (
              <SectionCard key={req.id}>
                {/* Header */}
                <div
                  onClick={() => setExpanded(v => v === req.id ? null : req.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)44' }}>
                        {APPROVAL_TYPE_LABEL[req.type]}
                      </span>
                      <Badge label={req.status} bg={sc.bg} text={sc.text} />
                      {req.status === 'Pending' && (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: '#dc2626', color: '#fff' }}>ACTION NEEDED</span>
                      )}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{req.subject}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Requested by {getName(req.requestedById)} · {relTime(req.createdAt)}
                      {req.reviewedAt && ` · Reviewed ${relTime(req.reviewedAt)}`}
                    </div>
                  </div>
                  <svg width="16" height="16" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border-color)' }}>
                    {/* Description */}
                    <div style={{ padding: '16px 20px', background: 'var(--bg-app)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Description</div>
                      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{req.description}</p>
                    </div>

                    {/* Payload */}
                    <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Request Details</div>
                      <PayloadView type={req.type} payload={req.payload} />
                    </div>

                    {/* Review note if resolved */}
                    {req.reviewNote && (
                      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', background: req.status === 'Approved' ? '#f0fdf4' : '#fef2f2' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Review Note</div>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', fontStyle: 'italic' }}>{req.reviewNote}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    {(canReview || canWithdraw) && (
                      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-app)' }}>
                        {canReview && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <textarea
                              value={reviewNote[req.id] ?? ''}
                              onChange={e => setReviewNote(p => ({ ...p, [req.id]: e.target.value }))}
                              rows={2}
                              placeholder="Optional review note…"
                              style={{ padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-card)', resize: 'vertical', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                            />
                            <div style={{ display: 'flex', gap: 10 }}>
                              <button
                                onClick={() => { reviewApproval(req.id, 'Approved', reviewNote[req.id]); setExpanded(null) }}
                                style={{ padding: '9px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => { reviewApproval(req.id, 'Rejected', reviewNote[req.id]); setExpanded(null) }}
                                style={{ padding: '9px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                              >
                                ✕ Reject
                              </button>
                            </div>
                          </div>
                        )}
                        {canWithdraw && !canReview && (
                          <button
                            onClick={() => { withdrawApproval(req.id); setExpanded(null) }}
                            style={{ padding: '8px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}
                          >
                            Withdraw Request
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Renders the payload of an approval request in a readable format
function PayloadView({ type, payload }: { type: ApprovalType; payload: Record<string, unknown> }) {
  const rows = Object.entries(payload).filter(([k]) => k !== 'items')
  const items = payload.items as Array<Record<string, unknown>> | undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 16, fontSize: 13 }}>
          <dt style={{ width: 160, flexShrink: 0, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
            {k.replace(/_/g, ' ')}
          </dt>
          <dd style={{ margin: 0, color: 'var(--text-primary)' }}>
            {typeof v === 'number' && (k.includes('cost') || k.includes('total') || k.includes('loss') || k.includes('overage'))
              ? `$${Number(v).toFixed(2)}`
              : String(v)}
          </dd>
        </div>
      ))}
      {items && items.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Line Items</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                <span style={{ flex: 1, fontWeight: 600, color: 'var(--text-primary)' }}>{String(item.name)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{String(item.qty)} {String(item.unit)}</span>
                {item.estimatedCost != null && (
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>${Number(item.estimatedCost).toFixed(2)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
type CommsTab = 'threads' | 'approvals'

export default function CommunicationsPage() {
  const { user } = useAuth()
  const { fetch, approvals } = useCommunicationsStore()
  const { profiles, fetch: fetchStaff } = useStaffStore()

  const [activeTab, setActiveTab] = useState<CommsTab>('threads')

  useEffect(() => {
    fetch()
    fetchStaff()
  }, [fetch, fetchStaff])

  const isPrivileged = user?.role === 'admin' || user?.role === 'manager'

  // Resolve current user's staff profile
  const myProfile = profiles.find(p =>
    (p as any).authUserId === user?.id || (p as any).userId === user?.id
  )
  const myStaffId = myProfile?.id ?? 'staff-2'

  const pendingApprovals = approvals.filter(a => a.status === 'Pending').length

  const TABS = [
    { id: 'threads'   as CommsTab, label: 'Threads' },
    { id: 'approvals' as CommsTab, label: 'Approvals', badge: pendingApprovals > 0 ? pendingApprovals : undefined },
  ]

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', margin: 0, letterSpacing: '-0.4px' }}>Communications</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Threads, meeting notes, memos, and approval requests</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 6, width: 'fit-content' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', border: 'none', cursor: 'pointer',
              borderRadius: 'var(--radius-md)', fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              background: activeTab === tab.id ? 'var(--color-primary)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
              minWidth: 110,
              justifyContent: 'center',
            }}
          >
            {tab.label}
            {tab.badge != null && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 20, background: activeTab === tab.id ? 'rgba(255,255,255,0.3)' : '#dc2626', color: '#fff', lineHeight: 1.6 }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'threads'   && <ThreadsTab   isPrivileged={isPrivileged} myStaffId={myStaffId} />}
      {activeTab === 'approvals' && <ApprovalsTab isPrivileged={isPrivileged} myStaffId={myStaffId} />}
    </div>
  )
}
