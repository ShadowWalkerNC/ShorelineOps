import { useState } from 'react'
import { RequireRole } from '../../security/AuthContext'
import StaffScheduling     from './components/StaffScheduling'
import CouncilNotes        from './components/CouncilNotes'
import BottleDrive         from './components/BottleDrive'
import UserManager         from './components/UserManager'
import CallOuts            from './components/CallOuts'
import BudgetPettyCash     from './components/BudgetPettyCash'
import TaskAssigner        from './components/TaskAssigner'
import SystemSettingsPanel from './components/SystemSettings'
import DocumentsTemplates  from './components/DocumentsTemplates'
import AuditLogViewer      from './components/AuditLogViewer'
import MaintenanceWorkOrders from './components/MaintenanceWorkOrders'
import HealerBotPanel      from './components/HealerBotPanel'
import LicenseManagerPanel from './components/LicenseManagerPanel'

type AdminTab =
  | 'license' | 'healer' | 'scheduling' | 'council' | 'bottle' | 'users' | 'callouts'
  | 'budget' | 'tasks' | 'data' | 'docs' | 'maintenance' | 'audit'

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'license',     label: '🔑 SaaS Licensing & Entitlements' },
  { id: 'healer',      label: '🤖 Self-Healing & Health' },
  { id: 'scheduling',  label: 'Staff Scheduling' },
  { id: 'council',     label: 'Council Notes' },
  { id: 'bottle',      label: 'Bottle Drive' },
  { id: 'users',       label: 'User Accounts' },
  { id: 'callouts',    label: 'Call-Outs' },
  { id: 'budget',      label: 'Budget & Petty Cash' },
  { id: 'tasks',       label: 'Task Assigner' },
  { id: 'data',        label: 'Data Management' },
  { id: 'docs',        label: 'Documents & Templates' },
  { id: 'maintenance', label: 'Maintenance & Work Orders' },
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
            Manage staff scheduling, view resident council notes, track bottle drive funds, import/export databases, and print logs.
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
          {tab === 'healer'      && <HealerBotPanel />}
          {tab === 'scheduling'  && <StaffScheduling />}
          {tab === 'council'     && <CouncilNotes />}
          {tab === 'bottle'      && <BottleDrive />}
          {tab === 'users'       && <UserManager />}
          {tab === 'callouts'    && <CallOuts />}
          {tab === 'budget'      && <BudgetPettyCash />}
          {tab === 'tasks'       && <TaskAssigner />}
          {tab === 'data'        && <SystemSettingsPanel />}
          {tab === 'docs'        && <DocumentsTemplates />}
          {tab === 'maintenance' && <MaintenanceWorkOrders />}
          {tab === 'audit'       && <AuditLogViewer />}
        </div>
      </div>
    </RequireRole>
  )
}
