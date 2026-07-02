import React, { useEffect, useState } from 'react'
import { useAdminStore } from '../../../state/adminStore'

const OUTCOME_COLORS = {
  success: 'bg-green-100 text-green-700',
  failure: 'bg-red-100 text-red-700',
}

export default function AuditLogViewer() {
  const { auditEntries, loading, fetchAuditLog } = useAdminStore()
  const [filterUser, setFilterUser] = useState('')

  useEffect(() => { fetchAuditLog({ limit: 100 }) }, [])

  function handleFilter(e: React.FormEvent) {
    e.preventDefault()
    fetchAuditLog({ limit: 100, userId: filterUser || undefined })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Audit Log</h2>
        <form onSubmit={handleFilter} className="flex gap-2">
          <input
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            placeholder="Filter by user ID…"
            className="border rounded-lg px-3 py-1.5 text-sm w-48"
          />
          <button type="submit" className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition">
            Filter
          </button>
          {filterUser && (
            <button
              type="button"
              onClick={() => { setFilterUser(''); fetchAuditLog({ limit: 100 }) }}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && (
        <div className="overflow-y-auto max-h-[60vh] rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">Timestamp</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">User</th>
                <th className="px-4 py-2 text-left">Resource</th>
                <th className="px-4 py-2 text-left">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {auditEntries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{entry.action}</td>
                  <td className="px-4 py-2.5 text-gray-600">{entry.userName ?? entry.userId ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {entry.resourceType && entry.resourceId
                      ? `${entry.resourceType}:${entry.resourceId}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${OUTCOME_COLORS[entry.outcome]}`}>
                      {entry.outcome}
                    </span>
                  </td>
                </tr>
              ))}
              {auditEntries.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No audit entries found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
