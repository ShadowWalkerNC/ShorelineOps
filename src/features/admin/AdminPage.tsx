/**
 * ============================================================
 * ADMIN PAGE — Compliance, Users, Sessions, Audit, Backup
 * ============================================================
 * Route: /admin (admin role only via RoleGate in App.tsx)
 * ============================================================
 */
import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../security/AuthContext'
import { useComplianceStore } from '../../state/complianceStore'
import { useUserStore } from '../../state/userStore'
import { sessionStore } from '../../security/sessionStore'
import { readAuditLog, exportAuditLog } from '../../security/auditLog'
import { exportBackup, importBackup, getBackupHistory } from '../../lib/backupManager'
import { validatePassword } from '../../security/passwordPolicy'
import type { UserRole } from '../../types/roles'
import { ROLE_LABEL, USER_ROLES } from '../../types/roles'

type Tab = 'compliance' | 'users' | 'sessions' | 'audit' | 'backup'

const STATUS_COLOR: Record<string, string> = {
  green: 'bg-green-50 border-green-200 text-green-800',
  amber: 'bg-amber-50 border-amber-200 text-amber-800',
  red: 'bg-red-50 border-red-200 text-red-800',
}
const STATUS_ICON: Record<string, string> = { green: '✓', amber: '⚠️', red: '✗' }

// Roles available in the Create User dropdown — excludes 'admin' (only admins
// can exist, and self-creation is prevented) and 'readonly' (rarely needed).
const CREATABLE_ROLES: UserRole[] = USER_ROLES.filter(
  r => r !== 'admin' && r !== 'readonly'
) as UserRole[]

export default function AdminPage() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState<Tab>('compliance')

  const { record, load: loadCompliance, getComplianceStatus } = useComplianceStore()
  const { users, load: loadUsers, lockUser, unlockUser, forcePasswordReset, deleteUser, createUser } = useUserStore()
  const [sessions, setSessions] = useState(sessionStore.getActiveSessions())
  const [auditEntries, setAuditEntries] = useState<ReturnType<typeof readAuditLog>>(() => readAuditLog(200))
  const [auditFilter, setAuditFilter] = useState('')
  const [backupHistory, setBackupHistory] = useState(getBackupHistory())
  const [confirm, setConfirm] = useState<{ action: () => void; message: string } | null>(null)

  // Create user form
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('staff')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordErrors, setNewPasswordErrors] = useState<string[]>([])
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  // Backup
  const [backupWorking, setBackupWorking] = useState(false)
  const [backupError, setBackupError] = useState('')
  const [backupSuccess, setBackupSuccess] = useState('')
  const [importPassphrase, setImportPassphrase] = useState('')
  const importFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadCompliance(); loadUsers() }, [])

  const complianceItems = getComplianceStatus()
  const overallStatus = complianceItems.some(i => i.status === 'red') ? 'red'
    : complianceItems.some(i => i.status === 'amber') ? 'amber' : 'green'

  const filteredAudit = auditFilter
    ? auditEntries.filter(e =>
        e.action?.toLowerCase().includes(auditFilter.toLowerCase()) ||
        e.userName?.toLowerCase().includes(auditFilter.toLowerCase())
      )
    : auditEntries

  async function handleCreateUser() {
    setCreateError('')
    setCreateSuccess('')
    const pv = validatePassword(newPassword)
    setNewPasswordErrors(pv.errors)
    if (!pv.valid) { setCreateError('Password does not meet requirements.'); return }
    if (!newName || !newEmail) { setCreateError('Name and email are required.'); return }
    try {
      await createUser({ name: newName, email: newEmail, role: newRole, password: newPassword }, user!.id, user!.name)
      setCreateSuccess(`User "${newName}" created successfully.`)
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('staff'); setNewPasswordErrors([])
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create user.')
    }
  }

  async function handleExportBackup() {
    setBackupWorking(true); setBackupError(''); setBackupSuccess('')
    try {
      const facilityName = record.facilityInfo?.name ?? 'Shoreline'
      const data = await exportBackup(facilityName, user!.id, user!.name)
      const blob = new Blob([data], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shoreline-backup-${new Date().toISOString().slice(0, 10)}.shorelinebackup`
      a.click()
      URL.revokeObjectURL(url)
      setBackupSuccess('Backup exported successfully.')
      setBackupHistory(getBackupHistory())
    } catch (e: unknown) {
      setBackupError(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setBackupWorking(false)
    }
  }

  async function handleImportBackup(file: File) {
    if (!importPassphrase) { setBackupError('Passphrase is required to decrypt the backup.'); return }
    setBackupWorking(true); setBackupError(''); setBackupSuccess('')
    try {
      const text = await file.text()
      const manifest = await importBackup(text, importPassphrase, user!.id, user!.name)
      setBackupSuccess(`Backup restored: ${manifest.facilityName} — exported ${manifest.exportedAt.slice(0, 10)}. Reload the app to apply.`)
    } catch (e: unknown) {
      setBackupError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setBackupWorking(false)
      setImportPassphrase('')
      if (importFileRef.current) importFileRef.current.value = ''
    }
  }

  function handleExportAuditCsv() {
    const csv = exportAuditLog()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shoreline-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'compliance', label: 'Compliance' },
    { id: 'users', label: 'Users' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'audit', label: 'Audit Log' },
    { id: 'backup', label: 'Backup' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500">HIPAA Compliance • User Management • Audit • Backup</p>
        </div>
        <div className={`ml-auto px-3 py-1.5 rounded-full text-xs font-semibold border ${
          overallStatus === 'green' ? 'bg-green-50 border-green-300 text-green-700'
          : overallStatus === 'amber' ? 'bg-amber-50 border-amber-300 text-amber-700'
          : 'bg-red-50 border-red-300 text-red-700'
        }`}>
          {overallStatus === 'green' ? '✓ Compliant' : overallStatus === 'amber' ? '⚠️ Review Needed' : '✗ Action Required'}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.id
                ? 'bg-white border border-b-white border-gray-200 -mb-px text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── COMPLIANCE TAB ── */}
      {tab === 'compliance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {complianceItems.map(item => (
              <div key={item.category} className={`border rounded-xl px-4 py-3 flex items-start gap-3 ${STATUS_COLOR[item.status]}`}>
                <span className="text-lg mt-0.5">{STATUS_ICON[item.status]}</span>
                <div>
                  <p className="text-sm font-semibold">{item.category}</p>
                  <p className="text-xs mt-0.5 opacity-80">{item.message}</p>
                </div>
              </div>
            ))}
          </div>

          {record.facilityInfo && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Facility Details</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-gray-500">Name</dt><dd className="font-medium">{record.facilityInfo.name}</dd>
                <dt className="text-gray-500">Address</dt><dd>{record.facilityInfo.address}, {record.facilityInfo.city}, {record.facilityInfo.state} {record.facilityInfo.zip}</dd>
                <dt className="text-gray-500">Phone</dt><dd>{record.facilityInfo.phone}</dd>
                <dt className="text-gray-500">Type</dt><dd>{record.facilityInfo.facilityType.replace('_', ' ').toUpperCase()}</dd>
                <dt className="text-gray-500">Beds</dt><dd>{record.facilityInfo.bedCount}</dd>
                {record.facilityInfo.npiNumber && <><dt className="text-gray-500">NPI</dt><dd>{record.facilityInfo.npiNumber}</dd></>}
              </dl>
            </div>
          )}

          {record.hipaaOfficer && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">HIPAA Security Officer</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-gray-500">Name</dt><dd className="font-medium">{record.hipaaOfficer.name}</dd>
                <dt className="text-gray-500">Title</dt><dd>{record.hipaaOfficer.title}</dd>
                <dt className="text-gray-500">Email</dt><dd>{record.hipaaOfficer.email}</dd>
                <dt className="text-gray-500">Designated</dt><dd>{record.hipaaOfficer.designatedAt?.slice(0, 10)}</dd>
              </dl>
            </div>
          )}

          {record.breachIncidents.filter(b => b.status !== 'closed').length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-red-800 mb-3">Open Breach Incidents</h3>
              {record.breachIncidents.filter(b => b.status !== 'closed').map(b => (
                <div key={b.id} className="text-xs text-red-700 mb-2 pb-2 border-b border-red-200 last:border-0">
                  <p className="font-medium">{b.severity.toUpperCase()} — {b.status} — {b.affectedRecords} records</p>
                  <p className="text-red-600">HHS notification due: {b.hhsNotificationDue.slice(0, 10)}</p>
                  <p className="mt-0.5">{b.description.slice(0, 120)}{b.description.length > 120 ? '…' : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div className="space-y-6">
          {/* User list */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{u.name}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{u.email}</td>
                    <td className="py-2.5 pr-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      {u.lockedAt
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">Locked</span>
                        : u.forcePasswordReset
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Reset Required</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">Active</span>
                      }
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-2">
                        {u.lockedAt ? (
                          <button
                            onClick={() => setConfirm({ message: `Unlock ${u.name}?`, action: () => unlockUser(u.id, user!.id, user!.name) })}
                            className="text-xs text-green-700 hover:underline"
                          >Unlock</button>
                        ) : u.id !== user?.id ? (
                          <button
                            onClick={() => setConfirm({ message: `Lock ${u.name}'s account?`, action: () => lockUser(u.id, user!.id, user!.name) })}
                            className="text-xs text-amber-700 hover:underline"
                          >Lock</button>
                        ) : null}
                        {u.id !== user?.id && (
                          <>
                            <button
                              onClick={() => setConfirm({ message: `Force password reset for ${u.name}?`, action: () => forcePasswordReset(u.id, user!.id, user!.name) })}
                              className="text-xs text-blue-700 hover:underline"
                            >Force Reset</button>
                            <button
                              onClick={() => setConfirm({ message: `Permanently delete ${u.name}? This cannot be undone.`, action: () => deleteUser(u.id, user!.id, user!.name) })}
                              className="text-xs text-red-700 hover:underline"
                            >Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Create user form */}
          <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Create New User</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as UserRole)}
                >
                  {CREATABLE_ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newPassword}
                  onChange={e => {
                    setNewPassword(e.target.value)
                    setNewPasswordErrors(e.target.value ? validatePassword(e.target.value).errors : [])
                  }} />
                {newPasswordErrors.map((err, i) => <p key={i} className="text-xs text-red-600 mt-0.5">{err}</p>)}
              </div>
            </div>
            {createError && <p className="text-xs text-red-700 mt-3">{createError}</p>}
            {createSuccess && <p className="text-xs text-green-700 mt-3">{createSuccess}</p>}
            <button
              onClick={handleCreateUser}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              Create User
            </button>
          </div>
        </div>
      )}

      {/* ── SESSIONS TAB ── */}
      {tab === 'sessions' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">{sessions.length} active session(s)</p>
            <button
              onClick={() => setSessions(sessionStore.getActiveSessions())}
              className="text-xs text-blue-600 hover:underline"
            >Refresh</button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No active sessions.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map(s => (
                <div key={s.id} className="border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4">
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">{s.userName} <span className="text-xs font-normal text-gray-500">({ROLE_LABEL[s.role as UserRole] ?? s.role})</span></p>
                    <p className="text-xs text-gray-500 mt-0.5">Started: {new Date(s.startedAt).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Last activity: {new Date(s.lastActivity).toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{s.userAgent}</p>
                  </div>
                  {s.userId !== user?.id && (
                    <button
                      onClick={() => setConfirm({
                        message: `Terminate ${s.userName}'s session?`,
                        action: () => {
                          sessionStore.terminateSession(s.id)
                          setSessions(sessionStore.getActiveSessions())
                        }
                      })}
                      className="text-xs text-red-700 hover:underline whitespace-nowrap"
                    >Terminate</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AUDIT LOG TAB ── */}
      {tab === 'audit' && (
        <div>
          <div className="flex gap-3 mb-4">
            <input
              placeholder="Filter by action or user…"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={auditFilter}
              onChange={e => setAuditFilter(e.target.value)}
            />
            <button
              onClick={handleExportAuditCsv}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 pr-3 font-medium">Timestamp</th>
                  <th className="pb-2 pr-3 font-medium">Action</th>
                  <th className="pb-2 pr-3 font-medium">User</th>
                  <th className="pb-2 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudit.slice(0, 200).map((e, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                    <td className="py-1.5 pr-3 font-medium text-gray-800">{e.action}</td>
                    <td className="py-1.5 pr-3 text-gray-600">{e.userName ?? e.userId ?? '—'}</td>
                    <td className={`py-1.5 font-medium ${
                      e.outcome === 'success' ? 'text-green-700' :
                      e.outcome === 'failure' ? 'text-red-700' : 'text-gray-500'
                    }`}>{e.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredAudit.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No matching entries.</p>
          )}
        </div>
      )}

      {/* ── BACKUP TAB ── */}
      {tab === 'backup' && (
        <div className="space-y-6">
          {/* Export */}
          <div className="border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Export Backup</h3>
            <p className="text-xs text-gray-500 mb-4">
              Downloads an AES-256-GCM encrypted backup of all facility data as a
              <code className="bg-gray-100 px-1 rounded text-xs">.shorelinebackup</code> file.
              Store securely off-device.
            </p>
            {backupError && <p className="text-xs text-red-700 mb-3">{backupError}</p>}
            {backupSuccess && <p className="text-xs text-green-700 mb-3">{backupSuccess}</p>}
            <button
              onClick={handleExportBackup}
              disabled={backupWorking}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              {backupWorking ? 'Working…' : 'Export Backup'}
            </button>
          </div>

          {/* Import */}
          <div className="border border-amber-200 rounded-xl p-5 bg-amber-50">
            <h3 className="text-sm font-semibold text-amber-900 mb-1">⚠️ Restore from Backup</h3>
            <p className="text-xs text-amber-800 mb-4">
              Restores all data from a backup file. <strong>This will replace all current data.</strong> Reload the app after restore.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-amber-900 mb-1">Backup File</label>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".shorelinebackup"
                  className="text-sm text-gray-700"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleImportBackup(f)
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-amber-900 mb-1">Decryption Passphrase</label>
                <input
                  type="password"
                  className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                  value={importPassphrase}
                  onChange={e => setImportPassphrase(e.target.value)}
                  placeholder="Enter admin passphrase used at backup time"
                />
              </div>
            </div>
          </div>

          {/* History */}
          {backupHistory.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Backup History</h3>
              <div className="space-y-2">
                {[...backupHistory].reverse().map(b => (
                  <div key={b.id} className="border border-gray-200 rounded-lg px-4 py-2.5 text-xs flex justify-between items-center">
                    <span className="text-gray-700 font-medium">{new Date(b.exportedAt).toLocaleString()}</span>
                    <span className="text-gray-500">{b.facilityName} • {b.keyCount} keys • {Math.round(b.sizeBytes / 1024)}KB</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>

    {/* Confirm Dialog */}
    {confirm && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
          <p className="text-sm font-medium text-gray-900 mb-4">{confirm.message}</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button
              onClick={() => { confirm.action(); setConfirm(null) }}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
            >Confirm</button>
          </div>
        </div>
      </div>
    )}
  )
}
