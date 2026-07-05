/**
 * ============================================================
 * AUDIT LOG VIEWER
 * ============================================================
 * HIPAA Security Rule §164.312(b) — Audit Controls
 *
 * Reads live from readAuditLog() — no adminStore dependency.
 *
 * Features:
 *   • Free-text search (action, user, resource type)
 *   • Outcome filter (All / Success / Failure)
 *   • HMAC integrity verification on mount
 *     — tampered entries highlighted in red
 *   • Integrity status banner (VERIFIED / COMPROMISED)
 *   • JSON export via exportAuditLog()
 *   • Expandable details column
 *   • Refresh button
 * ============================================================
 */
import { useCallback, useEffect, useState } from 'react'
import {
  readAuditLog,
  verifyAuditLog,
  exportAuditLog,
} from '../../../security/auditLog'
import type { AuditEntry } from '../../../security/auditLog'

const OUTCOME_BADGE: Record<'success' | 'failure', string> = {
  success: 'bg-green-100 text-green-700',
  failure: 'bg-red-100 text-red-700',
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function AuditLogViewer() {
  const [all, setAll]             = useState<AuditEntry[]>([])
  const [tampered, setTampered]   = useState<Set<string>>(new Set())
  const [verifying, setVerifying] = useState(true)
  const [search, setSearch]       = useState('')
  const [outcome, setOutcome]     = useState<'all' | 'success' | 'failure'>('all')
  const [expanded, setExpanded]   = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setVerifying(true)
    const entries = readAuditLog()
    setAll(entries)
    const ids = await verifyAuditLog()
    setTampered(new Set(ids))
    setVerifying(false)
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Filter ─────────────────────────────────────────────────────────

  const q = search.toLowerCase()
  const visible = all.filter(e => {
    if (outcome !== 'all' && e.outcome !== outcome) return false
    if (!q) return true
    return (
      e.action.toLowerCase().includes(q) ||
      (e.userName ?? '').toLowerCase().includes(q) ||
      (e.resourceType ?? '').toLowerCase().includes(q) ||
      (e.userId ?? '').toLowerCase().includes(q)
    )
  })

  // ── Export ─────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true)
    try {
      const json = await exportAuditLog()
      const blob = new Blob([json], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  // ── Toggle details ───────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const integrity = verifying
    ? null
    : tampered.size === 0
      ? 'verified'
      : 'compromised'

  return (
    <div>
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Audit Log</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {all.length} entr{all.length === 1 ? 'y' : 'ies'}
            {all.length > 0 && ` • newest: ${formatTs(all[0].timestamp)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={verifying}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
          >
            {verifying ? 'Verifying…' : '↺ Refresh'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || all.length === 0}
            className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition"
          >
            {exporting ? 'Exporting…' : '↓ Export JSON'}
          </button>
        </div>
      </div>

      {/* Integrity banner */}
      {integrity === 'verified' && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
          <span className="text-green-600 font-bold text-sm">✅ VERIFIED</span>
          <span className="text-xs text-green-700">All {all.length} entries passed HMAC integrity check.</span>
        </div>
      )}
      {integrity === 'compromised' && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-300 rounded-xl px-4 py-2.5">
          <span className="text-red-700 font-bold text-sm">⚠️ COMPROMISED</span>
          <span className="text-xs text-red-700">
            {tampered.size} entr{tampered.size === 1 ? 'y' : 'ies'} failed HMAC verification.
            Possible tampering detected. Export immediately and investigate.
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search action, user, resource…"
          className="flex-1 min-w-[200px] border rounded-lg px-3 py-1.5 text-sm"
        />
        <select
          value={outcome}
          onChange={e => setOutcome(e.target.value as typeof outcome)}
          className="border rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="all">All outcomes</option>
          <option value="success">Success only</option>
          <option value="failure">Failures only</option>
        </select>
        {(search || outcome !== 'all') && (
          <button
            onClick={() => { setSearch(''); setOutcome('all') }}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-700"
          >
            Clear
          </button>
        )}
        <span className="self-center text-xs text-gray-400">
          {visible.length} of {all.length} shown
        </span>
      </div>

      {/* Table */}
      <div className="overflow-y-auto max-h-[58vh] rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2.5 text-left w-36">Timestamp</th>
              <th className="px-4 py-2.5 text-left">Action</th>
              <th className="px-4 py-2.5 text-left">User</th>
              <th className="px-4 py-2.5 text-left">Resource</th>
              <th className="px-4 py-2.5 text-left">Outcome</th>
              <th className="px-4 py-2.5 text-left">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map(entry => {
              const isTampered = tampered.has(entry.id)
              const isExpanded = expanded.has(entry.id)
              const hasDetails = !!entry.details && Object.keys(entry.details).length > 0
              return (
                <tr
                  key={entry.id}
                  className={isTampered ? 'bg-red-50' : 'hover:bg-gray-50'}
                >
                  <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                    {formatTs(entry.timestamp)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-gray-800">{entry.action}</span>
                    {isTampered && (
                      <span className="ml-1.5 text-xs text-red-600 font-bold" title="HMAC mismatch — possible tampering">
                        ⚠️
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">
                    {entry.userName ?? entry.userId ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {entry.resourceType && entry.resourceId
                      ? `${entry.resourceType}:${entry.resourceId.slice(0, 8)}…`
                      : entry.resourceType ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${OUTCOME_BADGE[entry.outcome]}`}>
                      {entry.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {hasDetails ? (
                      <div>
                        <button
                          onClick={() => toggleExpand(entry.id)}
                          className="text-xs text-blue-500 hover:text-blue-700 underline"
                        >
                          {isExpanded ? 'hide' : 'show'}
                        </button>
                        {isExpanded && (
                          <pre className="mt-1 text-xs bg-gray-100 rounded p-2 max-w-xs overflow-x-auto text-gray-700">
                            {JSON.stringify(entry.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {all.length === 0 ? 'No audit entries yet.' : 'No entries match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        Entries are HMAC-signed and retained for 6 years per HIPAA §164.312(b).
      </p>
    </div>
  )
}
