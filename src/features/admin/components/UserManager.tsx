import React, { useEffect, useState } from 'react'
import { useAdminStore } from '../../../state/adminStore'
import type { UserRole } from '../../../security/AuthContext'

// Must cover all 10 values of UserRole
const ROLE_LABELS: Record<UserRole, string> = {
  admin:       'Admin',
  manager:     'Manager',
  dietitian:   'Registered Dietitian (RD)',
  frontdesk:   'Office Assistant',
  dietary:     'Dietary',
  distributor: 'Distributor Partner',
  activities:  'Activities',
  server:      'Server',
  staff:       'Staff',
  readonly:    'Read-only',
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin:       'bg-red-100 text-red-700',
  manager:     'bg-orange-100 text-orange-700',
  dietitian:   'bg-emerald-100 text-emerald-700',
  frontdesk:   'bg-teal-100 text-teal-700',
  dietary:     'bg-green-100 text-green-700',
  distributor: 'bg-indigo-100 text-indigo-700',
  activities:  'bg-purple-100 text-purple-700',
  server:      'bg-yellow-100 text-yellow-700',
  staff:       'bg-blue-100 text-blue-700',
  readonly:    'bg-gray-100 text-gray-600',
}

export default function UserManager() {
  const { users, loading, fetchUsers, createUser, updateUserRole, toggleUserActive } = useAdminStore()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'staff' as UserRole })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchUsers() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await createUser(form)
      setForm({ name: '', email: '', role: 'staff' })
      setShowAdd(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Staff Accounts</h2>
        <button
          onClick={() => setShowAdd(s => !s)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          {showAdd ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleCreate} className="mb-6 p-4 border rounded-xl bg-gray-50 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
              placeholder="Full name"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 transition"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Last Login</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(u => (
                <tr key={u.id} className={`${!u.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{u.name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={u.role}
                      onChange={e => updateUserRole(u.id, e.target.value as UserRole)}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer ${ROLE_COLORS[u.role]}`}
                    >
                      {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggleUserActive(u.id, !u.active)}
                      className="text-xs text-gray-500 hover:text-gray-800 underline"
                    >
                      {u.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
