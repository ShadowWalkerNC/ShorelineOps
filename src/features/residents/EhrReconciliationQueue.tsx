import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { AlertTriangle, CheckCircle2, RotateCw, Stethoscope } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/security/AuthContext'

export interface ReconciliationItem {
  id: string
  resident_id?: string
  resident_name: string
  external_ehr_id: string
  source_ehr: string
  change_type: 'DIET_ORDER' | 'TEXTURE_UPDATE' | 'NEW_ALLERGEN' | 'ADMISSION' | 'DISCHARGE' | 'NPO_ORDER'
  incoming_payload: unknown
  conflict_reason: string
  status: 'PENDING_TRIAGE' | 'APPROVED_BY_RD' | 'REJECTED_BY_RD' | 'AUTO_MERGED'
  created_at: string
  current_profile?: {
    diet_type: string
    texture: string
    is_npo: boolean
    allergies: unknown
    profile_version: number
  } | null
}

type Notice = { text: string; kind: 'success' | 'warning' }
function displayValue(value: unknown): string {
  if (value == null) return 'Not provided'
  if (typeof value === 'string') {
    try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
  }
  return JSON.stringify(value, null, 2)
}

export default function EhrReconciliationQueue() {
  const [items, setItems] = useState<ReconciliationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [ehrError, setEhrError] = useState<string | null>(null)
  const [isDemo, setIsDemo] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [unknownOutcome, setUnknownOutcome] = useState(false)
  const inFlight = useRef(false)
  const { user } = useAuth()
  const canResolve = user?.role === 'dietitian' || user?.role === 'admin'

  const fetchQueue = async (): Promise<boolean> => {
    setLoading(true)
    try {
      const { data } = await api.get<{ items: ReconciliationItem[]; demo?: boolean }>('/ehr/reconciliation-queue', { timeout: 15000 })
      if (!Array.isArray(data.items)) throw new Error('Invalid queue response')
      setItems(data.items)
      setIsDemo(data.demo === true)
      setEhrError(null)
      setUnknownOutcome(false)
      return true
    } catch {
      // Keep the last fetched records visible, but prevent actions on stale data.
      setEhrError('Queue unavailable. Displayed records may be outdated. Refresh before reviewing a change.')
      return false
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchQueue() }, [])

  const resolveItem = async (item: ReconciliationItem, action: 'APPROVED_BY_RD' | 'REJECTED_BY_RD') => {
    if (inFlight.current || !canResolve || unknownOutcome || ehrError || loading) return
    inFlight.current = true
    setResolvingId(item.id)
    setNotice(null)
    try {
      const { data } = await api.post<{ success?: boolean }>(`/ehr/reconciliation-queue/${encodeURIComponent(item.id)}/resolve`, {
        action,
        expectedProfileVersion: item.current_profile?.profile_version,
      }, { timeout: 15000 })
      if (data.success !== true) throw new Error('Unconfirmed decision response')
      setItems(previous => previous.filter(record => record.id !== item.id))
      setNotice({ kind: 'success', text: action === 'APPROVED_BY_RD' ? 'Order applied and recorded.' : 'Incoming change rejected and recorded.' })
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined
      if (status && status >= 400 && status < 500) {
        setNotice({ kind: 'warning', text: status === 409 ? 'The record changed. Refresh and review the current order before deciding again.' : 'Decision not recorded. This change has not been cleared. Check your access and the incoming order.' })
        if (status === 409) await fetchQueue()
      } else {
        setUnknownOutcome(true)
        setNotice({ kind: 'warning', text: 'Outcome unknown. Checking the current queue before another decision…' })
        const refreshed = await fetchQueue()
        setNotice({ kind: 'warning', text: refreshed
          ? 'Queue refreshed after an uncertain response. Review any remaining change before retrying; consult the audit log for decisions no longer pending.'
          : 'Outcome unknown. Refresh the queue before retrying; consult the audit log to confirm the recorded decision.' })
      }
    } finally {
      inFlight.current = false
      setResolvingId(null)
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-labelledby="ehr-queue-title" aria-busy={loading || resolvingId !== null}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="ehr-queue-title" className="flex items-center gap-2 text-lg font-bold"><Stethoscope aria-hidden="true" className="h-5 w-5 shrink-0" />Inbound EHR review</h2>
          <p className="mt-1 text-sm text-slate-500">Review incoming orders against the current resident profile.</p>
          {isDemo && <p className="font-bold text-amber-700">Demo data — review actions disabled</p>}
        </div>
        <button type="button" onClick={() => void fetchQueue()} disabled={loading || resolvingId !== null} className="inline-flex min-h-12 items-center gap-2 rounded-xl border px-3 disabled:opacity-50"><RotateCw aria-hidden="true" size={16} />Refresh queue</button>
      </div>
      {notice && <div role={notice.kind === 'success' ? 'status' : 'alert'} className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${notice.kind === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
        {notice.kind === 'success' ? <CheckCircle2 aria-hidden="true" size={18} className="shrink-0" /> : <AlertTriangle aria-hidden="true" size={18} className="shrink-0" />}{notice.text}
      </div>}
      {ehrError && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{ehrError}</p>}
      {loading && <p role="status" className="p-3">Loading queue…</p>}
      {!loading && !ehrError && items.length === 0 && <p className="p-3">No pending changes returned by the EHR service.</p>}
      {!canResolve && <p className="mb-3 text-sm text-slate-500">The dietitian or admin role is required to record a decision.</p>}
      <div className="space-y-4">
        {items.map(item => {
          const disabled = !canResolve || isDemo || loading || !!ehrError || unknownOutcome || resolvingId !== null
          const profile = item.current_profile
          const hasVersion = !!profile && Number.isInteger(profile.profile_version) && profile.profile_version >= 1
          return <article key={item.id} className="min-w-0 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="font-bold">{item.resident_name || 'Resident identity unavailable'}</h3>
            <p className="break-words text-sm text-slate-500">{item.source_ehr} · {item.external_ehr_id} · {item.change_type}</p>
            <p className="mt-1 text-sm">Received: {new Date(item.created_at).toLocaleString()}</p>
            <p className="mt-2 font-medium text-amber-800 dark:text-amber-300">{item.conflict_reason}</p>
            <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <h4 className="text-sm font-semibold">Current profile {hasVersion ? `(version ${profile.profile_version})` : ''}</h4>
                {profile ? <dl className="mt-2 space-y-1 break-words text-sm"><dt>Diet</dt><dd>{profile.diet_type}</dd><dt>Texture</dt><dd>{profile.texture}</dd><dt>NPO</dt><dd>{profile.is_npo ? 'Yes' : 'No'}</dd><dt>Allergies</dt><dd>{displayValue(profile.allergies)}</dd></dl> : <p className="mt-2 text-sm">Current profile unavailable. Approval is disabled.</p>}
              </div>
              <div className="min-w-0 rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><h4 className="text-sm font-semibold">Incoming change</h4><pre className="mt-2 whitespace-pre-wrap break-words text-sm">{displayValue(item.incoming_payload)}</pre></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={disabled} onClick={() => void resolveItem(item, 'REJECTED_BY_RD')} className="min-h-12 rounded-xl border border-red-400 px-4 font-semibold text-red-700 disabled:opacity-50">Reject incoming change</button>
              <button type="button" disabled={disabled || !hasVersion} onClick={() => void resolveItem(item, 'APPROVED_BY_RD')} className="min-h-12 rounded-xl bg-indigo-600 px-4 font-semibold text-white disabled:opacity-50">{resolvingId === item.id ? 'Recording decision…' : 'Apply reviewed order'}</button>
            </div>
          </article>
        })}
      </div>
    </section>
  )
}
