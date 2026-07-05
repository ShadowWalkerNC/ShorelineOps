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

// Maps status → the CSS class suffix defined in index.css under .sl-badge-status-*
const STATUS_CLASS: Record<StaffStatus, string> = {
  Active:     'sl-badge sl-badge-status-active',
  Inactive:   'sl-badge sl-badge-status-inactive',
  'On Leave': 'sl-badge sl-badge-status-leave',
  Terminated: 'sl-badge sl-badge-status-terminated',
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
      if (dept      !== 'All' && p.department !== dept)      return false
      if (status    !== 'All' && p.status     !== status)    return false
      if (roleFilter !== 'All' && p.role      !== roleFilter) return false
      if (q && ![
        p.firstName, p.lastName, p.position,
        p.employeeNumber, p.email ?? '',
      ].join(' ').toLowerCase().includes(q)) return false
      return true
    })
  }, [profiles, search, dept, status, roleFilter])

  const isPrivileged = user?.role === 'admin' || user?.role === 'manager'

  if (!isPrivileged) {
    return (
      <div className="sl-empty">
        <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 12 }}>
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        <div className="sl-empty-title">Access restricted</div>
        <div className="sl-empty-subtitle">Manager or Admin role required to view staff records.</div>
      </div>
    )
  }

  return (
    <div className="sl-page">

      {/* Page header */}
      <div className="sl-page-header flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="sl-page-title">Staff</h1>
          <p className="sl-page-subtitle">
            {filtered.length} of {profiles.length} employee{profiles.length !== 1 ? 's' : ''}
          </p>
        </div>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => navigate('/staff/new')}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            Add Employee
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2" style={{ marginBottom: 'var(--space-5)' }}>
        <input
          className="sl-input sl-search"
          placeholder="Search name, position, ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select className="sl-select" value={dept} onChange={e => setDept(e.target.value as Department | 'All')} style={{ minWidth: 160 }}>
          <option value="All">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="sl-select" value={status} onChange={e => setStatus(e.target.value as StaffStatus | 'All')} style={{ minWidth: 140 }}>
          <option value="All">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="sl-select" value={roleFilter} onChange={e => setRole(e.target.value as UserRole | 'All')} style={{ minWidth: 130 }}>
          <option value="All">All Roles</option>
          {(['admin','manager','dietary','activities','server','staff','readonly'] as UserRole[]).map(r => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="sl-empty">
          <div className="sl-empty-subtitle">Loading staff records…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="sl-empty">
          <div className="sl-empty-subtitle">No staff match the current filters.</div>
        </div>
      ) : (
        <div className="sl-table-wrap">
          <table className="sl-table">
            <thead>
              <tr>
                <th style={{ width: 52 }} />
                <th>Name / Position</th>
                <th>Department</th>
                <th>Role</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <StaffRow
                  key={p.id}
                  profile={p}
                  onClick={() => navigate(`/staff/${p.id}`)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StaffRow({ profile: p, onClick }: { profile: StaffProfile; onClick: () => void }) {
  return (
    <tr
      className="sl-table-row"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {/* Avatar */}
      <td className="sl-table-td-avatar">
        <div className="sl-avatar">
          {getInitials(p.firstName, p.lastName)}
        </div>
      </td>

      {/* Name */}
      <td data-label="Name">
        <div className="sl-table-cell-primary">
          {p.firstName} {p.lastName}
          {p.preferredName && (
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginLeft: 6 }}>
              "{p.preferredName}"
            </span>
          )}
        </div>
        <div className="sl-table-cell-sub">{p.position} · {p.employeeNumber}</div>
      </td>

      {/* Department */}
      <td data-label="Department">{p.department}</td>

      {/* Role */}
      <td data-label="Role">{ROLE_LABEL[p.role]}</td>

      {/* Employment type */}
      <td data-label="Type">
        <span className={p.fullTime ? 'sl-badge sl-badge-primary' : 'sl-badge sl-badge-muted'}>
          {p.fullTime ? 'Full-Time' : 'Part-Time'}
        </span>
      </td>

      {/* Status */}
      <td data-label="Status">
        <span className={STATUS_CLASS[p.status]}>{p.status}</span>
      </td>
    </tr>
  )
}

function getInitials(first: string, last: string): string {
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase()
}
