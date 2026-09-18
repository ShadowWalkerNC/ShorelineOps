import { useEffect, useState } from 'react'
import { AlertTriangle, Droplet } from 'lucide-react'
import { api } from '../../../api/client'

// ────────────────────────────────────────────────────────────────────────────
// HYDRATION PASS TAB (B05) — real per-pass fluid intake logging (CMS F807)
// Active-census roster joined to today's persisted hydration_records.
// No fabricated numbers: unlogged residents show as NOT_RECORDED.
// NPO residents are excluded server-side (hard block) and counted separately.
// ────────────────────────────────────────────────────────────────────────────

type Pass = 'morning' | 'afternoon' | 'evening'
const PASSES: { id: Pass; label: string; time: string }[] = [
  { id: 'morning',   label: 'Morning',   time: '10 AM pass' },
  { id: 'afternoon', label: 'Afternoon', time: '2 PM pass' },
  { id: 'evening',   label: 'Evening',   time: '7 PM pass' },
]

interface RosterRow {
  residentId: string
  residentName: string
  room: string
  liquidTexture: string
  targetOz: number
  offeredOz: number | null
  consumedOz: number | null
  refused: boolean
  supplement: string
  ensurePerDay: number
  fluidRestrictionMl: number | null
  recordedBy: string | null
  recordedAt: string | null
  status: 'NOT_RECORDED' | 'REFUSED' | 'RECORDED'
}

interface Totals { targetOz: number; offeredOz: number; consumedOz: number; refusedCount: number; recordedCount: number }

interface HydrationData {
  pass: Pass
  date: string
  hydrationRoster: RosterRow[]
  passTotals: Totals
  dayTotals: Totals
  npoExcluded: number
  totalResidents: number
}

interface Draft { offered: string; consumed: string; refused: boolean; supplement: string }

const blankDraft = (row: RosterRow): Draft => ({
  offered: row.offeredOz != null ? String(row.offeredOz) : String(row.targetOz),
  consumed: row.consumedOz != null ? String(row.consumedOz) : '',
  refused: row.refused,
  supplement: row.supplement,
})

const ML_PER_OZ = 29.5735

function StatPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'var(--space-2) var(--space-3)', minWidth:104 }}>
      <div className="sl-eyebrow">{label}</div>
      <div style={{ fontSize:'var(--text-xl)', fontWeight:'var(--weight-bold)', color: color ?? 'var(--color-primary)' }}>{value}</div>
    </div>
  )
}

function statusBadge(status: RosterRow['status']) {
  if (status === 'RECORDED') return <span className="sl-badge sl-badge-success">✓ Logged</span>
  if (status === 'REFUSED')  return <span className="sl-badge sl-badge-danger">✕ Refused</span>
  return <span className="sl-badge sl-badge-muted">Not recorded</span>
}

function ResidentRow({ row, pass, onSaved }: { row: RosterRow; pass: Pass; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => blankDraft(row))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-seed the draft whenever the underlying record changes (pass switch, refetch after save).
  useEffect(() => { setDraft(blankDraft(row)); setError(null) }, [row.residentId, row.recordedAt]) // eslint-disable-line

  const restricted = row.fluidRestrictionMl != null
  const restrictedOz = restricted ? (row.fluidRestrictionMl as number) / ML_PER_OZ : 0
  const offered = parseFloat(draft.offered)
  const consumed = draft.consumed.trim() === '' ? 0 : parseFloat(draft.consumed)
  const numbersOk =
    Number.isFinite(offered) && offered >= 0 &&
    Number.isFinite(consumed) && consumed >= 0 &&
    consumed <= offered
  const refusalOk = !(draft.refused && consumed > 0)
  const valid = !saving && numbersOk && refusalOk

  async function save() {
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      await api.post('/kitchen/hydration', {
        residentId: row.residentId,
        pass,
        offeredOz: offered,
        consumedOz: consumed,
        refused: draft.refused,
        supplement: draft.supplement.trim(),
      })
      onSaved()
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)', display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'var(--space-2)' }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontWeight:'var(--weight-bold)', fontSize:'var(--text-base)' }}>{row.residentName}</div>
          <div style={{ fontSize:'var(--text-base)', color:'var(--text-muted)' }}>Room {row.room} · {row.liquidTexture} · target {row.targetOz} oz</div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:'var(--space-2)', alignItems:'center' }}>{statusBadge(row.status)}</div>
      </div>

      {restricted && (
        <div className="sl-alert sl-alert-warning flex items-center gap-2" style={{ margin:0 }}>
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 inline" />
          <span><b>Fluid restriction: {row.fluidRestrictionMl} ml/day</b> (≈{restrictedOz.toFixed(0)} oz). Restriction is display-only — it is never overridden here.</span>
        </div>
      )}
      {row.ensurePerDay > 0 && (
        <div className="sl-alert sl-alert-info flex items-center gap-2" style={{ margin:0 }}>
          <Droplet className="w-4 h-4 text-sky-600 shrink-0 inline" />
          <span><b>Supplement ordered: Ensure ×{row.ensurePerDay}/day.</b> Log cans in the supplement field below.</span>
        </div>
      )}

      <div style={{ display:'flex', flexWrap:'wrap', gap:'var(--space-3)', alignItems:'flex-end' }}>
        <div style={{ flex:'1 1 110px', maxWidth:150 }}>
          <label>Offered (oz)</label>
          <input className="sl-input" inputMode="decimal" value={draft.offered}
            onChange={e => setDraft(d => ({ ...d, offered: e.target.value }))} style={{ minHeight:44 }} />
        </div>
        <div style={{ flex:'1 1 110px', maxWidth:150 }}>
          <label>Consumed (oz)</label>
          <input className="sl-input" inputMode="decimal" value={draft.consumed} placeholder="0"
            onChange={e => setDraft(d => ({ ...d, consumed: e.target.value, refused: e.target.value.trim() !== '' && parseFloat(e.target.value) > 0 ? false : d.refused }))} style={{ minHeight:44 }} />
        </div>
        <div style={{ flex:'1 1 140px', maxWidth:190 }}>
          <label>Supplement</label>
          <input className="sl-input" value={draft.supplement} placeholder="e.g. Ensure ×1"
            onChange={e => setDraft(d => ({ ...d, supplement: e.target.value }))} style={{ minHeight:44 }} autoComplete="off" />
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:8, minHeight:44, cursor:'pointer', fontSize:'var(--text-sm)', fontWeight:'var(--weight-medium)' }}>
          <input type="checkbox" checked={draft.refused} style={{ width:22, height:22 }}
            onChange={e => setDraft(d => ({ ...d, refused: e.target.checked, consumed: e.target.checked ? '0' : d.consumed }))} />
          Refused
        </label>
        <button className="btn btn-primary" onClick={save} disabled={!valid} style={{ minHeight:44 }}>
          {saving ? 'Saving…' : row.status === 'NOT_RECORDED' ? 'Log Pass' : 'Update'}
        </button>
      </div>

      {!numbersOk && <div className="sl-alert sl-alert-danger" style={{ margin:0 }}>Offered and consumed must be numbers ≥ 0, and consumed can&apos;t exceed offered.</div>}
      {!refusalOk && <div className="sl-alert sl-alert-danger" style={{ margin:0 }}>A refusal can&apos;t have consumed oz &gt; 0 — refusals are recorded distinctly from intake.</div>}
      {error && <div className="sl-alert sl-alert-danger" style={{ margin:0 }}>{error}</div>}
      {row.recordedAt && (
        <div style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>
          Last logged {new Date(row.recordedAt).toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}
          {row.recordedBy ? ` by ${row.recordedBy}` : ''} · consumed {row.consumedOz ?? 0} / offered {row.offeredOz ?? 0} oz
          {row.supplement ? ` · ${row.supplement}` : ''}
        </div>
      )}
    </div>
  )
}

export default function HydrationPassTab() {
  const [pass, setPass] = useState<Pass>('morning')
  const [data, setData] = useState<HydrationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(p: Pass) {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<HydrationData>('/kitchen/hydration', { params: { pass: p } })
      setData(res.data)
    } catch (e: any) {
      setData(null)
      setError(e?.response?.data?.error ?? e?.message ?? 'Could not load the hydration roster.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(pass) }, [pass]) // eslint-disable-line

  const recorded = data?.hydrationRoster.filter(r => r.status !== 'NOT_RECORDED').length ?? 0

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
      <div>
        <div className="sl-eyebrow">Hydration pass</div>
        <div className="sl-pills">
          {PASSES.map(p => (
            <button key={p.id} onClick={() => setPass(p.id)} className={pass===p.id?'sl-pill active':'sl-pill'} style={{ minHeight:44 }}>
              {p.label} <span style={{ opacity:0.65, fontSize:'var(--text-sm)' }}>{p.time}</span>
            </button>
          ))}
        </div>
      </div>

      {data && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:'var(--space-3)' }}>
          <StatPill label="Consumed (pass)" value={`${data.passTotals.consumedOz} oz`} />
          <StatPill label="Offered (pass)" value={`${data.passTotals.offeredOz} oz`} />
          <StatPill label="Logged" value={`${recorded}/${data.totalResidents}`} />
          <StatPill label="Refused (pass)" value={data.passTotals.refusedCount} color="#dc2626" />
          <StatPill label="Consumed (day)" value={`${data.dayTotals.consumedOz} oz`} color="#059669" />
          <StatPill label="Refused (day)" value={data.dayTotals.refusedCount} color="#dc2626" />
        </div>
      )}

      {data?.npoExcluded ? (
        <div className="sl-alert sl-alert-warning" style={{ margin:0 }}>
          {data.npoExcluded} resident{data.npoExcluded === 1 ? '' : 's'} excluded from this roster — NPO (oral fluids prohibited).
        </div>
      ) : null}

      {loading && <div className="sl-empty"><div className="sl-empty-title">Loading roster…</div></div>}
      {error && !loading && <div className="sl-alert sl-alert-danger"><b>Couldn&apos;t load the hydration roster.</b> {error}</div>}

      {!loading && !error && data && data.hydrationRoster.length === 0 && (
        <div className="sl-empty">
          <div className="sl-empty-title">No residents on the active census</div>
          <div className="sl-empty-subtitle">The hydration pass roster comes from the live census — there is nothing hardcoded here.</div>
        </div>
      )}

      {!loading && !error && data && (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
          {data.hydrationRoster.map(row => (
            <ResidentRow key={row.residentId} row={row} pass={pass} onSaved={() => load(pass)} />
          ))}
        </div>
      )}
    </div>
  )
}
