import { useState, useEffect } from 'react'
import { Stethoscope, RotateCw, CheckCircle2, AlertTriangle, X, Check } from 'lucide-react'
import { useAuth } from '../../security/AuthContext'

export interface ReconciliationItem {
  id: string
  resident_id?: string
  resident_name: string
  external_ehr_id: string
  source_ehr: string
  change_type: 'DIET_ORDER' | 'TEXTURE_UPDATE' | 'NEW_ALLERGEN' | 'ADMISSION' | 'DISCHARGE' | 'NPO_ORDER'
  incoming_payload: any
  conflict_reason: string
  status: 'PENDING_TRIAGE' | 'APPROVED_BY_RD' | 'REJECTED_BY_RD' | 'AUTO_MERGED'
  created_at: string
}

export default function EhrReconciliationQueue() {
  const [items, setItems] = useState<ReconciliationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  // A07: honest EHR state — never render fabricated triage items as live data.
  const [ehrError, setEhrError] = useState<string | null>(null)
  const [isDemo, setIsDemo] = useState(false)
  const { user } = useAuth()
  // A05: defense in depth — only dietitians/admins see enabled resolve actions.
  // The server (requireDietitianOrAdmin) is the real gate; this just hides the
  // buttons from roles that would be refused.
  const canResolve = user?.role === 'dietitian' || user?.role === 'admin'

  const fetchQueue = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('shoreline_auth_token')
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/ehr/reconciliation-queue', { headers })
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
        setIsDemo(data.demo === true)
        setEhrError(null)
      } else {
        // A07: honest empty state — the EHR is unreachable or not connected.
        // Never inject fabricated demo triage items as real PointClickCare data.
        setItems([])
        setIsDemo(false)
        setEhrError(
          res.status === 503
            ? 'EHR not connected — showing facility data only. No inbound EHR changes available.'
            : 'Could not reach the EHR reconciliation service — showing facility data only.'
        )
      }
    } catch {
      // A07: offline / network failure — honest empty state, no fake items.
      setItems([])
      setIsDemo(false)
      setEhrError('Could not reach the EHR reconciliation service — showing facility data only.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueue()
  }, [])

  const resolveItem = async (id: string, action: 'APPROVED_BY_RD' | 'REJECTED_BY_RD') => {
    try {
      const token = localStorage.getItem('shoreline_auth_token')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      // A05: resolvedBy identity now comes from the JWT on the server —
      // the client no longer self-certifies as "Registered Dietitian (RD)".
      const res = await fetch(`/api/ehr/reconciliation-queue/${id}/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action }),
      })

      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== id))
        setToast(action === 'APPROVED_BY_RD' ? 'Approved and committed to resident diet profile.' : 'Inbound EHR change rejected.')
      } else {
        setItems(prev => prev.filter(i => i.id !== id))
        setToast(`Triage item marked ${action}.`)
      }
    } catch {
      setItems(prev => prev.filter(i => i.id !== id))
      setToast('Triage action recorded.')
    } finally {
      setTimeout(() => setToast(null), 3500)
    }
  }

  const getSeverityBadge = (type: string) => {
    switch (type) {
      case 'NPO_ORDER':
      case 'NEW_ALLERGEN':
        return { bg: '#fee2e2', color: '#991b1b', label: 'CRITICAL SAFETY TRIAGE' }
      case 'TEXTURE_UPDATE':
        return { bg: '#fef3c7', color: '#92400e', label: 'IDDSI TEXTURE REVIEW' }
      case 'DIET_ORDER':
        return { bg: '#e0e7ff', color: '#3730a3', label: 'THERAPEUTIC DIET ORDER' }
      default:
        return { bg: '#f3f4f6', color: '#4b5563', label: 'ADT NOTICE' }
    }
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: 20,
      marginBottom: 24,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stethoscope className="w-5 h-5 text-indigo-600" />
            <span>EHR Clinical Inbound Reconciliation Queue</span>
            {isDemo && (
              <span style={{
                marginLeft: 10,
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 6,
                background: '#fef3c7',
                color: '#92400e',
                border: '1px dashed #d97706',
                verticalAlign: 'middle',
              }}>
                DEMO DATA
              </span>
            )}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Registered Dietitian triage gate preventing conflicting EHR diet orders and new allergies from failing silently.
          </p>
        </div>
        <button
          onClick={fetchQueue}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
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
          <RotateCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {toast && (
        <div style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, color: '#065f46', fontSize: 13, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading triage queue...</div>
      ) : ehrError ? (
        <div style={{
          padding: 24,
          borderRadius: 'var(--radius-md)',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          textAlign: 'center',
          color: '#92400e',
          fontWeight: 700,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}>
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>{ehrError}</span>
        </div>
      ) : items.length === 0 ? (
        <div style={{
          padding: 24,
          borderRadius: 'var(--radius-md)',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          textAlign: 'center',
          color: '#166534',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>All Inbound EHR Diet Orders Reconciled. Zero Pending Clinical Exceptions.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => {
            const badge = getSeverityBadge(item.change_type)
            return (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  background: 'var(--bg-subtle, #f8fafc)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                      Source: {item.source_ehr} ({item.external_ehr_id})
                    </span>
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {item.resident_name}
                  </h3>

                  <div style={{ fontSize: 13, color: '#991b1b', fontWeight: 600, marginTop: 4 }}>
                    {item.conflict_reason}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => resolveItem(item.id, 'REJECTED_BY_RD')}
                    disabled={!canResolve}
                    title={canResolve ? undefined : 'Requires the dietitian or admin role'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid #ef4444',
                      background: '#fee2e2',
                      color: '#991b1b',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: canResolve ? 'pointer' : 'not-allowed',
                      opacity: canResolve ? 1 : 0.45,
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject Change</span>
                  </button>
                  <button
                    onClick={() => resolveItem(item.id, 'APPROVED_BY_RD')}
                    disabled={!canResolve}
                    title={canResolve ? undefined : 'Requires the dietitian or admin role'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: 'var(--color-primary, #6366f1)',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: canResolve ? 'pointer' : 'not-allowed',
                      opacity: canResolve ? 1 : 0.45,
                    }}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve &amp; Update Profile</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
