/**
 * TV display approval — manager enters the 6-character code shown on a
 * facility wall display to bind it to this facility. The TV polls
 * /pair/status and collects its read-only display session on approval.
 */
import { useState } from 'react'
import { tvApi } from '@/api/tv'

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'
const CODE_RE = /^[A-Z2-9]{6}$/

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: 'var(--bg-app)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  fontSize: 20, color: 'var(--text-primary)',
  minHeight: 56,
  boxSizing: 'border-box',
  fontFamily: 'monospace',
  letterSpacing: '0.3em',
  textAlign: 'center',
  textTransform: 'uppercase',
}

function errorMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error?: unknown }; status?: number } })?.response
  if (data?.status === 404) return 'Invalid or expired code — check the TV and retry.'
  if (data?.status === 409) return 'That code was already used — request a fresh one on the TV.'
  if (typeof data?.data?.error === 'string') return data.data.error
  return 'Could not reach the server — check the connection and retry.'
}

export default function TvApprovePage() {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approvedLabel, setApprovedLabel] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!CODE_RE.test(clean)) {
      setError('Enter the 6-character code exactly as shown on the TV.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await tvApi.approvePair(clean)
      setApprovedLabel(res.label || 'Unnamed display')
      setCode('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stitch-standalone" style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <p className="sl-eyebrow">Wall displays</p>
      <h1 className="sl-page-title">Approve TV display</h1>
      <p className="sl-page-subtitle">
        Enter the pairing code shown on the facility TV. Only approve codes you can
        physically see on a Shoreline wall display.
      </p>

      {DEMO_MODE ? (
        <p className="sl-page-subtitle">Demo preview — display pairing is disabled.</p>
      ) : approvedLabel ? (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: 24, marginTop: 16,
        }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            Display approved: {approvedLabel}
          </p>
          <p className="sl-page-subtitle" style={{ margin: 0 }}>
            The TV picks up its session automatically and loads the boards.
          </p>
          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={() => setApprovedLabel(null)}>
              Approve another display
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: 24, marginTop: 16,
        }}>
          <label htmlFor="tv-approve-code" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Pairing code
          </label>
          <input
            id="tv-approve-code"
            style={inp}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="······"
            maxLength={6}
            autoComplete="off"
            autoFocus
          />
          {error && (
            <div role="alert" style={{
              background: '#faf1ef', border: '1px solid rgba(189,110,92,0.25)',
              color: '#a35a49', padding: '10px 12px',
              borderRadius: 'var(--radius-md)', fontSize: 13,
              fontWeight: 500, marginTop: 12,
            }}>{error}</div>
          )}
          <div style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ minHeight: 48 }}>
              {busy ? 'Approving…' : 'Approve display'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
