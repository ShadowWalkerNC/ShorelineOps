import { useState } from 'react'
import { RequireRole } from '../../security/AuthContext'
import StaffScheduling     from './components/StaffScheduling'
import UserManager         from './components/UserManager'
import CallOuts            from './components/CallOuts'
import SystemSettingsPanel from './components/SystemSettings'
import AuditLogViewer      from './components/AuditLogViewer'
import LicenseManagerPanel from './components/LicenseManagerPanel'

// B13 scope cuts: removed panels — HealerBot, BottleDrive, CouncilNotes,
// TaskAssigner, MaintenanceWorkOrders, DocumentsTemplates, BudgetPettyCash.
// Kept: User Accounts, Audit Log, Data Management, Licensing, Call-Outs.
// Staff Scheduling is parked for Phase 5.
type AdminTab =
  | 'license' | 'scheduling' | 'users' | 'callouts' | 'data' | 'audit'

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'license',     label: 'SaaS Licensing & Entitlements' },
  { id: 'scheduling',  label: 'Staff Scheduling (Parked)' },
  { id: 'users',       label: 'User Accounts' },
  { id: 'callouts',    label: 'Call-Outs' },
  { id: 'data',        label: 'Data Management' },
  { id: 'audit',       label: 'Audit Log' },
]

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('scheduling')

  return (
    <RequireRole role="admin">
      <div className="sl-page fade-in">

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px', marginBottom: 4 }}>
            Administration &amp; Kitchen Console
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Manage user accounts, review audit logs, import/export databases, and manage licensing.
          </p>
        </div>

        {/* Tab buttons — pill style matching original */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? 'var(--color-primary)' : 'var(--bg-card)',
                color: tab === t.id ? 'white' : 'var(--text-primary)',
                border: `1px solid ${tab === t.id ? 'var(--color-primary)' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: '9px 18px',
                fontWeight: tab === t.id ? 700 : 500,
                fontSize: 13, cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                boxShadow: tab === t.id ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          boxShadow: 'var(--shadow-sm)',
        }}>
          {tab === 'license'     && <LicenseManagerPanel />}
          {tab === 'scheduling'  && <StaffScheduling />}
          {tab === 'users'       && <UserManager />}
          {tab === 'callouts'    && <CallOuts />}
          {tab === 'data'        && <SystemSettingsPanel />}
          {tab === 'audit'       && <AuditLogViewer />}
        </div>
      </div>
    </RequireRole>
  )
}
