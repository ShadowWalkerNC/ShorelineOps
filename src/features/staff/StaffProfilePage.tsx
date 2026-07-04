// ============================================================
// STAFF PROFILE PAGE — FULL PAGE DETAIL
// ============================================================
// Route: /staff/:staffId
//
// Tabs:
//   Profile     — contact info, position, hire date, full-time
//   Certifications — cert list with expiry status
//   Schedule    — upcoming entries (placeholder for now)
//   Call-Outs   — MANAGER/ADMIN ONLY, hidden from subject
//   Notifications — personal inbox for this staff member
//   Notes       — MANAGER/ADMIN ONLY manager notes field
// ============================================================
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStaffStore } from '../../state/staffStore'
import { useNotificationsStore } from '../../state/notificationsStore'
import { useAuth } from '../../security/AuthContext'
import { ROLE_LABEL } from '../../types/roles'
import type { StaffProfile, CallOut, Certification } from '../../types/staff'
import type { Notification } from '../../types/communications'

type Tab = 'profile' | 'certs' | 'schedule' | 'callouts' | 'notifications' | 'notes'

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  Active:      { bg: '#d1fae5', color: '#065f46' },
  Inactive:    { bg: '#f3f4f6', color: '#6b7280' },
  'On Leave':  { bg: '#fef3c7', color: '#92400e' },
  Terminated:  { bg: '#fee2e2', color: '#991b1b' },
}

const CALLOUT_REASON_COLOR: Record<string, string> = {
  'Sick': '#0284c7',
  'Personal': '#7c3aed',
  'Family Emergency': '#d97706',
  'No Call No Show': '#dc2626',
  'Approved Leave': '#059669',
  'Bereavement': '#374151',
  'Medical Appointment': '#0284c7',
  'Other': '#6b7280',
}

function InfoRow({ label, value }: { label: string; value?: string | React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
      <dt style={{ width: 180, flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 2 }}>{label}</dt>
      <dd style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{value ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</dd>
    </div>
  )
}

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 20, boxShadow: 'var(--shadow-sm)' }}>
      {title && <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h3>}
      {children}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>{message}</div>
  )
}

// ── Certification expiry helper ───────────────────────────────────────────────
function certStatus(cert: Certification): { label: string; color: string } {
  if (!cert.expiresDate) return { label: 'No expiry', color: '#6b7280' }
  const days = Math.floor((new Date(cert.expiresDate).getTime() - Date.now()) / 86_400_000)
  if (days < 0)  return { label: 'Expired', color: '#dc2626' }
  if (days < 30) return { label: `Expires in ${days}d`, color: '#d97706' }
  if (days < 90) return { label: `Expires in ${Math.ceil(days/30)}mo`, color: '#0284c7' }
  return { label: `Expires ${new Date(cert.expiresDate).toLocaleDateString()}`, color: '#059669' }
}

// ── Profile tab ───────────────────────────────────────────────────────────────
function ProfileTab({ p }: { p: StaffProfile }) {
  const badge = STATUS_COLOR[p.status]
  return (
    <>
      <SectionCard title="Employment">
        <dl style={{ margin: 0 }}>
          <InfoRow label="Employee #"    value={p.employeeNumber} />
          <InfoRow label="Position"      value={p.position} />
          <InfoRow label="Department"    value={p.department} />
          <InfoRow label="Role"          value={ROLE_LABEL[p.role]} />
          <InfoRow label="Employment"    value={p.fullTime ? 'Full-Time' : 'Part-Time'} />
          <InfoRow label="Hire Date"     value={new Date(p.hireDate + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} />
          <InfoRow label="Status"        value={
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: badge.bg, color: badge.color }}>
              {p.status}
            </span>
          } />
        </dl>
      </SectionCard>
      <SectionCard title="Contact">
        <dl style={{ margin: 0 }}>
          <InfoRow label="Email"         value={p.email} />
          <InfoRow label="Phone"         value={p.phone} />
          <InfoRow label="Preferred Name" value={p.preferredName} />
        </dl>
      </SectionCard>
      {p.emergencyContact && (
        <SectionCard title="Emergency Contact">
          <dl style={{ margin: 0 }}>
            <InfoRow label="Name"         value={p.emergencyContact.name} />
            <InfoRow label="Relationship" value={p.emergencyContact.relationship} />
            <InfoRow label="Phone"        value={p.emergencyContact.phone} />
          </dl>
        </SectionCard>
      )}
    </>
  )
}

// ── Certifications tab ────────────────────────────────────────────────────────
function CertsTab({ p }: { p: StaffProfile }) {
  if (!p.certifications.length) return <EmptyState message="No certifications on file." />
  return (
    <SectionCard title="Certifications & Credentials">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {p.certifications.map(cert => {
          const s = certStatus(cert)
          return (
            <div key={cert.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{cert.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  Issued: {new Date(cert.issuedDate + 'T00:00:00').toLocaleDateString()}
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

// ── Call-Outs tab (manager/admin only) ────────────────────────────────────────
function CallOutsTab({ callOuts, staffName }: { callOuts: CallOut[]; staffName: string }) {
  if (!callOuts.length) return <EmptyState message={`No call-out records for ${staffName}.`} />
  return (
    <SectionCard title={`Call-Out Record — ${callOuts.length} entr${callOuts.length === 1 ? 'y' : 'ies'}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {callOuts
          .sort((a, b) => b.date.localeCompare(a.date))
          .map(co => (
            <div key={co.id} style={{ padding: '14px 16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', borderLeft: `3px solid ${CALLOUT_REASON_COLOR[co.reason] ?? '#6b7280'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                    {new Date(co.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    {co.shift} Shift · {co.reason}
                    {co.wasCovered
                      ? <span style={{ color: '#059669', marginLeft: 8 }}>&#10003; Covered</span>
                      : <span style={{ color: '#dc2626', marginLeft: 8 }}>&#215; Not covered</span>}
                  </div>
                </div>
                {co.followUpRequired && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#fef3c7', color: '#92400e' }}>Follow-up required</span>
                )}
              </div>
              {co.notes && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>{co.notes}</p>
              )}
              {co.followUpNotes && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Follow-up: {co.followUpNotes}</p>
              )}
            </div>
          ))}
      </div>
    </SectionCard>
  )
}

// ── Notifications tab (personal inbox) ───────────────────────────────────────
function NotificationsTab({ notifications, staffId }: { notifications: Notification[]; staffId: string }) {
  const { markRead, markAllRead } = useNotificationsStore()
  const mine = notifications.filter(n => n.toStaffId === staffId)

  if (!mine.length) return <EmptyState message="No notifications." />

  return (
    <SectionCard title={`Notifications — ${mine.filter(n => !n.isRead).length} unread`}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => markAllRead(staffId)} style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '4px 8px' }}>Mark all read</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mine.map(n => (
          <div
            key={n.id}
            onClick={() => markRead(n.id)}
            style={{ padding: '14px 16px', background: n.isRead ? 'var(--bg-app)' : 'var(--color-primary-light)', borderRadius: 'var(--radius-md)', border: `1px solid ${n.isRead ? 'var(--border-color)' : 'var(--color-primary)'}`, cursor: 'pointer', transition: 'background 0.15s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: n.isRead ? 500 : 700, fontSize: 14, color: 'var(--text-primary)' }}>{n.subject}</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(n.createdAt).toLocaleDateString()}</span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.body}</p>
            <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {n.type.replace(/_/g, ' ')}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

// ── Schedule tab (placeholder) ────────────────────────────────────────────────
function ScheduleTab({ p }: { p: StaffProfile }) {
  return (
    <SectionCard title="Upcoming Schedule">
      <EmptyState message="Schedule entries will appear here once the schedule module is built." />
    </SectionCard>
  )
}

// ── Manager Notes tab ─────────────────────────────────────────────────────────
function NotesTab({ p, canEdit }: { p: StaffProfile; canEdit: boolean }) {
  const { updateProfile } = useStaffStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(p.managerNotes ?? '')

  function save() {
    updateProfile(p.id, { managerNotes: draft })
    setEditing(false)
  }

  return (
    <SectionCard title="Manager Notes">
      <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-muted)' }}>
        ⚠️ These notes are visible to managers and administrators only and are never shown to the employee.
      </p>
      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={6}
            style={{ width: '100%', padding: 12, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 14, color: 'var(--text-primary)', background: 'var(--bg-app)', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={save} style={{ padding: '8px 18px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Save</button>
            <button onClick={() => { setDraft(p.managerNotes ?? ''); setEditing(false) }} style={{ padding: '8px 18px', background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 14, color: draft ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: 60 }}>
            {draft || 'No notes on file.'}
          </div>
          {canEdit && (
            <button onClick={() => setEditing(true)} style={{ marginTop: 12, padding: '7px 16px', background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {draft ? 'Edit Notes' : 'Add Notes'}
            </button>
          )}
        </>
      )}
    </SectionCard>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StaffProfilePage() {
  const { staffId } = useParams<{ staffId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profiles, callOuts, fetch: fetchStaff, isLoading } = useStaffStore()
  const { notifications, fetch: fetchNotifs } = useNotificationsStore()

  const [activeTab, setActiveTab] = useState<Tab>('profile')

  useEffect(() => {
    fetchStaff()
    fetchNotifs()
  }, [fetchStaff, fetchNotifs])

  const profile = profiles.find(p => p.id === staffId)

  const isPrivileged = user?.role === 'admin' || user?.role === 'manager'
  const isAdmin = user?.role === 'admin'

  // Call-outs for this specific staff member — only give to privileged viewers
  const staffCallOuts = isPrivileged
    ? callOuts.filter(c => c.staffId === staffId)
    : []

  // Tabs definition — conditionally include manager-only tabs
  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'profile',       label: 'Profile' },
    { id: 'certs',         label: 'Certifications', count: profile?.certifications.length },
    { id: 'schedule',      label: 'Schedule' },
    { id: 'notifications', label: 'Notifications', count: profile ? notifications.filter(n => n.toStaffId === profile.id && !n.isRead).length || undefined : undefined },
    ...(isPrivileged ? [{ id: 'callouts' as Tab, label: 'Call-Outs', count: staffCallOuts.length || undefined }] : []),
    ...(isPrivileged ? [{ id: 'notes'    as Tab, label: 'Notes' }] : []),
  ]

  if (isLoading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
  }

  if (!profile) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Employee not found.</div>
        <button onClick={() => navigate('/staff')} style={{ fontSize: 13, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Back to Staff</button>
      </div>
    )
  }

  const displayName = `${profile.firstName} ${profile.lastName}`
  const badge = STATUS_COLOR[profile.status]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Back button */}
      <button
        onClick={() => navigate('/staff')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, marginBottom: 20, padding: 0 }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        Back to Staff
      </button>

      {/* Hero header */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px 28px', marginBottom: 20, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontWeight: 800, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif', flexShrink: 0 }}>
            {profile.firstName[0]}{profile.lastName[0]}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.4px' }}>{displayName}</h1>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: badge.bg, color: badge.color }}>{profile.status}</span>
            </div>
            <div style={{ marginTop: 5, fontSize: 14, color: 'var(--text-muted)' }}>
              {profile.position} · {profile.department} · {ROLE_LABEL[profile.role]} · {profile.employeeNumber}
            </div>
            {profile.preferredName && (
              <div style={{ marginTop: 3, fontSize: 12, color: 'var(--text-muted)' }}>Goes by: <em>{profile.preferredName}</em></div>
            )}
          </div>

          {/* Actions — admin only */}
          {isAdmin && (
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <button
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                onClick={() => alert('Edit profile — coming in next build')}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Quick stats strip */}
        <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
          <Stat label="Hire Date" value={new Date(profile.hireDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} />
          <Stat label="Employment" value={profile.fullTime ? 'Full-Time' : 'Part-Time'} />
          <Stat label="Certifications" value={String(profile.certifications.length)} />
          {isPrivileged && <Stat label="Call-Outs" value={String(staffCallOuts.length)} accent={staffCallOuts.length > 0} />}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 6, overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, minWidth: 'max-content', padding: '9px 16px', border: 'none', cursor: 'pointer',
              borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
              background: activeTab === tab.id ? 'var(--color-primary)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 20, background: activeTab === tab.id ? 'rgba(255,255,255,0.3)' : 'var(--color-primary)', color: activeTab === tab.id ? '#fff' : '#fff', lineHeight: 1.6 }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'profile'       && <ProfileTab       p={profile} />}
      {activeTab === 'certs'         && <CertsTab         p={profile} />}
      {activeTab === 'schedule'      && <ScheduleTab      p={profile} />}
      {activeTab === 'notifications' && <NotificationsTab notifications={notifications} staffId={profile.id} />}
      {activeTab === 'callouts'      && isPrivileged && <CallOutsTab callOuts={staffCallOuts} staffName={displayName} />}
      {activeTab === 'notes'         && isPrivileged && <NotesTab    p={profile} canEdit={isAdmin} />}
    </div>
  )
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: accent ? '#dc2626' : 'var(--text-primary)', marginTop: 2 }}>{value}</div>
    </div>
  )
}
