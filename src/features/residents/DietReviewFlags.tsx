import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../security/AuthContext'

export interface DietReviewFlag {
  id: string
  residentId: string
  residentName: string
  residentRoom: string
  message: string
  flaggedBy: string | null
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED'
  createdAt: string
}

/**
 * B04 (Owner Decision 3): the RD worklist. Aides are read-only on clinical
 * diet fields, so their "Flag for RD review" actions land here for a
 * dietitian/manager to triage. Follows the EhrReconciliationQueue pattern —
 * the server (strict dietitian/manager gate) is the real authority; this
 * just hides the list and resolve buttons from other roles.
 */
export default function DietReviewFlags() {
  const [flags, setFlags] = useState<DietReviewFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const { user } = useAuth()

  const canTriage = user?.role === 'dietitian' || user?.role === 'manager'

  const fetchFlags = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('shoreline_auth_token')
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch('/api/residents/flags', { headers })
      if (res.ok) {
        setFlags(await res.json())
      } else {
        setFlags([])
      }
    } catch {
      setFlags([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canTriage) void fetchFlags()
    else setLoading(false)
  }, [canTriage, fetchFlags])

  if (!canTriage) return null

  const resolveFlag = async (id: string, action: 'RESOLVED' | 'DISMISSED') => {
    try {
      const token = localStorage.getItem('shoreline_auth_token')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/residents/flags/${id}/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setFlags((prev) => prev.filter((f) => f.id !== id))
        setToast(action === 'RESOLVED' ? 'Flag resolved.' : 'Flag dismissed.')
      } else {
        setToast('Could not update the flag — please try again.')
      }
    } catch {
      setToast('Could not reach the server — please try again.')
    } finally {
      setTimeout(() => setToast(null), 3500)
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: 20,
        marginBottom: 24,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            🚩 Diet Review Flags
            {flags.length > 0 && (
              <span
                style={{
                  marginLeft: 10,
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: 6,
                  background: '#fef3c7',
                  color: '#92400e',
                  verticalAlign: 'middle',
                }}
              >
                {flags.length} OPEN
              </span>
            )}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Staff flags requesting dietitian review of a resident&apos;s diet order, texture, or allergies.
          </p>
        </div>
        <button
          onClick={fetchFlags}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-app)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {toast && (
        <div style={{ fontSize: 13, marginBottom: 12, color: 'var(--text-primary)' }}>{toast}</div>
      )}

      {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading flags…</div>}

      {!loading && flags.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          No open flags — the review worklist is clear.
        </div>
      )}

      {!loading &&
        flags.map((f) => (
          <div
            key={f.id}
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              marginBottom: 10,
              background: 'var(--bg-app)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {f.residentName || 'Unknown resident'}
                  {f.residentRoom && (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · Room {f.residentRoom}</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4 }}>{f.message}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Flagged {new Date(f.createdAt).toLocaleString()}
                  {f.flaggedBy ? ` · by ${f.flaggedBy}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => resolveFlag(f.id, 'RESOLVED')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: '#15803d',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  ✓ Resolve
                </button>
                <button
                  onClick={() => resolveFlag(f.id, 'DISMISSED')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
    </div>
  )
}
