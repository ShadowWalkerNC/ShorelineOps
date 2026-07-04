// ============================================================
// STAFF ROSTER PAGE
// ============================================================
// /staff  — visible to: manager, admin
// Lists all staff profiles with search, filter by department
// and status, and navigates to full-page detail on row click.
// ============================================================
import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStaffStore } from '../../state/staffStore'
import { useAuth } from '../../security/AuthContext'
import { DEPARTMENTS, ROLE_LABEL } from '../../types/roles'
import type { Department, UserRole } from '../../types/roles'
import type { StaffProfile, StaffStatus } from '../../types/staff'

const STATUSES: StaffStatus[] = ['Active', 'Inactive', 'On Leave', 'Terminated']

const STATUS_BADGE: Record<StaffStatus, { bg: string; color: string }> = {
  Active:     { bg: '#d1fae5', color: '#065f46' },
  Inactive:   { bg: '#f3f4f6', color: '#6b7280' },
  'On Leave': { bg: '#fef3c7', color: '#92400e' },
  Terminated: { bg: '#fee2e2', color: '#991b1b' },
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const letters = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : parts[0].slice(0, 2)
  return (
    <div style={{
      width: 38, height: 38, borderRadius: '50%',
      background: 'var(--color-primary)', color: '#fff',
      fontWeight: 700, fontSize: 14, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Outfit, sans-serif', flexShrink: 0,
      textTransform: 'uppercase', letterSpacing: '0.5px',
    }}>
      {letters.toUpperCase()}
    </div>
  )
}

export default function StaffPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profiles, fetch, isLoading } = useStaffStore()

  const [search, setSearch]   = useState('')
  const [dept, setDept]       = useState<Department | 'All'>('All')
  const [status, setStatus]   = useState<StaffStatus | 'All'>('Active')
  const [roleFilter, setRole] = useState<UserRole | 'All'>('All')

  useEffect(() => { fetch() }, [fetch])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return profiles.filter(p => {
      if (dept   !== 'All' && p.department !== dept)   return false
      if (status !== 'All' && p.status     !== status) return false
      if (roleFilter !== 'All' && p.role   !== roleFilter) return false
      if (q && ![
        p.firstName, p.lastName, p.position,
        p.employeeNumber, p.email ?? '',
      ].join(' ').toLowerCase().includes(q)) return false
      return true
    })
  }, [profiles, search, dept, status, roleFilter])

  const isPrivileged = user?.role === 'admin' || user?.role === 'manager'

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)', background: 'var(--bg-card)',
    fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer',
    minHeight: 38,
  }

  if (!isPrivileged) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 12 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Access restricted</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Manager or Admin role required to view staff records.</div>
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', margin: 0, letterSpacing: '-0.4px' }}>Staff</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {filtered.length} of {profiles.length} employee{profiles.length !== 1 ? 's' : ''}
          </p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => navigate('/staff/new')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 40 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            Add Employee
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <input
          placeholder="Search name, position, ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...selectStyle, flex: 1, minWidth: 200 }}
        />
        <select value={dept} onChange={e => setDept(e.target.value as Department | 'All')} style={selectStyle}>
          <option value="All">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value as StaffStatus | 'All')} style={selectStyle}>
          <option value="All">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={roleFilter} onChange={e => setRole(e.target.value as UserRole | 'All')} style={selectStyle}>
          <option value="All">All Roles</option>
          {(['admin','manager','dietary','activities','server','staff','readonly'] as UserRole[]).map(r => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading staff records…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No staff match the current filters.</div>
      ) : (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          {/* Column headers — desktop only */}
          <div style={{ display: 'grid', gridTemplateColumns: '38px 1fr 160px 140px 100px 80px', gap: 16, padding: '10px 20px', background: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            <span />
            <span>Name / Position</span>
            <span>Department</span>
            <span>Role</span>
            <span>Full Time</span>
            <span>Status</span>
          </div>

          {filtered.map((p, i) => (
            <StaffRow key={p.id} profile={p} index={i} total={filtered.length} onClick={() => navigate(`/staff/${p.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function StaffRow({ profile: p, index, total, onClick }: { profile: StaffProfile; index: number; total: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const badge = STATUS_BADGE[p.status]
  const isLast = index === total - 1

  return (
    <div
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid', gridTemplateColumns: '38px 1fr 160px 140px 100px 80px',
        gap: 16, padding: '14px 20px', alignItems: 'center',
        cursor: 'pointer', transition: 'background 0.15s ease',
        background: hovered ? 'var(--color-primary-light)' : 'transparent',
        borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
      }}
    >
      <Initials name={`${p.firstName} ${p.lastName}`} />
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
          {p.firstName} {p.lastName}
          {p.preferredName && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>“{p.preferredName}”</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.position} · {p.employeeNumber}</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.department}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{ROLE_LABEL[p.role]}</div>
      <div style={{ fontSize: 12, color: p.fullTime ? 'var(--color-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
        {p.fullTime ? 'Full-Time' : 'Part-Time'}
      </div>
      <div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: badge.bg, color: badge.color }}>
          {p.status}
        </span>
      </div>
    </div>
  )
}
