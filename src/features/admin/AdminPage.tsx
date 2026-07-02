import React, { useState } from 'react'
import { RequireRole } from '../../security/AuthContext'
import UserManager from './components/UserManager'
import AuditLogViewer from './components/AuditLogViewer'
import SystemSettingsPanel from './components/SystemSettings'

type AdminTab = 'users' | 'audit' | 'settings'

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'users',    label: 'Users' },
  { id: 'audit',    label: 'Audit Log' },
  { id: 'settings', label: 'Settings' },
]

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('users')

  return (
    <RequireRole role="admin">
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage users, review audit logs, and configure system settings.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b mb-6">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        {tab === 'users'    && <UserManager />}
        {tab === 'audit'    && <AuditLogViewer />}
        {tab === 'settings' && <SystemSettingsPanel />}
      </div>
    </RequireRole>
  )
}
