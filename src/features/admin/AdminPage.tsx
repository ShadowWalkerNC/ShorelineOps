import React, { useState } from 'react'
import { RequireRole } from '../../security/AuthContext'
import UserManager from './components/UserManager'
import AuditLogViewer from './components/AuditLogViewer'
import SystemSettingsPanel from './components/SystemSettings'

type AdminTab = 'scheduling' | 'council' | 'bottle' | 'users' | 'callouts' | 'budget' | 'tasks' | 'data' | 'docs' | 'audit'

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'scheduling', label: 'Staff Scheduling' },
  { id: 'council',    label: 'Council Notes' },
  { id: 'bottle',     label: 'Bottle Drive' },
  { id: 'users',      label: 'User Accounts' },
  { id: 'callouts',   label: 'Call-Outs' },
  { id: 'budget',     label: 'Budget & Petty Cash' },
  { id: 'tasks',      label: 'Task Assigner' },
  { id: 'data',       label: 'Data Management' },
  { id: 'docs',       label: 'Documents & Templates' },
  { id: 'audit',      label: 'Audit Log' },
]

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('scheduling')

  return (
    <RequireRole role="admin">
      <div style={{ maxWidth: 1100, margin: '0 auto' }} className="fade-in">
        {/* Section header */}
        <div className="section-header">
          <h2>Administration &amp; Kitchen Console</h2>
          <p>Manage staff scheduling, view resident council notes, track bottle drive funds, import/export databases, and print logs.</p>
        </div>

        {/* Subtab pill buttons — matching original layout */}
        <div className="admin-subtabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`admin-subtab-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="sl-card">
          {tab === 'scheduling' && (
            <div>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>Staff Scheduling</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Staff scheduling features coming soon.</p>
            </div>
          )}
          {tab === 'users' && <UserManager />}
          {tab === 'audit' && <AuditLogViewer />}
          {tab === 'data'  && <SystemSettingsPanel />}
          {!['scheduling','users','audit','data'].includes(tab) && (
            <div>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
                {TABS.find(t => t.id === tab)?.label}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>This module is under construction.</p>
            </div>
          )}
        </div>
      </div>
    </RequireRole>
  )
}
