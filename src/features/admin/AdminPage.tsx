import { useState } from 'react'
import { RequireRole, useAuth } from '../../security/AuthContext'
import StaffScheduling     from './components/StaffScheduling'
import UserManager         from './components/UserManager'
import CallOuts            from './components/CallOuts'
import SystemSettingsPanel from './components/SystemSettings'
import AuditLogViewer      from './components/AuditLogViewer'
import LicenseManagerPanel from './components/LicenseManagerPanel'

import SystemHealthDiagnostics from './components/SystemHealthDiagnostics'
import BackupRecoveryPanel   from './components/BackupRecoveryPanel'
import OnboardingStatusPanel from './components/OnboardingStatusPanel'
import PlatformControlPanel from './components/PlatformControlPanel'

type AdminTab =
  | 'platform' | 'readiness' | 'diagnostics' | 'backup' | 'license' | 'scheduling' | 'users' | 'callouts' | 'data' | 'audit'

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'readiness',   label: 'Facility Readiness' },
  { id: 'diagnostics', label: 'System Health & Self-Repair' },
  { id: 'backup',      label: 'Backup & Recovery' },
  { id: 'license',     label: 'SaaS Licensing & Entitlements' },
  { id: 'scheduling',  label: 'Staff Scheduling (Parked)' },
  { id: 'users',       label: 'User Accounts' },
  { id: 'callouts',    label: 'Call-Outs' },
  { id: 'data',        label: 'Data Management' },
  { id: 'audit',       label: 'Audit Log' },
]

export default function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<AdminTab>(user?.platformAdmin ? 'platform' : 'readiness')
  const tabs = user?.platformAdmin ? [{ id: 'platform' as const, label: 'ShorelineOps Control Plane' }, ...TABS] : TABS

  return (
    <RequireRole role="admin">
      <div className="sl-page fade-in">

        <header className="clinical-admin-header">
          <h1>Administration &amp; Kitchen Console</h1>
          <p>Facility readiness, staff access and operational safeguards in one workspace.</p>
        </header>
        <nav className="clinical-admin-navigation" aria-label="Administration sections">
          {[
            { label: 'Operations', ids: ['platform', 'readiness', 'license'] },
            { label: 'Staffing & governance', ids: ['scheduling', 'users', 'callouts', 'audit'] },
            { label: 'System infrastructure', ids: ['diagnostics', 'backup', 'data'] },
          ].map(group => (
            <section className="clinical-admin-group" key={group.label}>
              <h2>{group.label}</h2>
              <div>{tabs.filter(t => group.ids.includes(t.id)).map(t => (
                <button type="button" key={t.id} onClick={() => setTab(t.id)}
                  className="clinical-admin-tab" aria-pressed={tab === t.id}>
                  {t.label}
                </button>
              ))}</div>
            </section>
          ))}
        </nav>

        {/* Content card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          boxShadow: 'var(--shadow-sm)',
        }}>
          {tab === 'diagnostics' && <SystemHealthDiagnostics />}
          {tab === 'platform'    && user?.platformAdmin && <PlatformControlPanel />}
          {tab === 'readiness'   && <OnboardingStatusPanel />}
          {tab === 'backup'      && <BackupRecoveryPanel />}
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
