import React, { useEffect, useState } from 'react'
import { useAdminStore } from '../../../state/adminStore'
import type { SystemSettings, KitchenServiceMode } from '../../../types/admin'

const SERVICE_MODES: { value: KitchenServiceMode; label: string; desc: string }[] = [
  { value: 'dining-room',      label: 'Dining Room',        desc: 'Residents eat in the dining room. Tray tickets are exceptions only.' },
  { value: 'room-service-only',label: 'Room Service Only',  desc: 'All meals are delivered. Every resident gets a tray ticket.' },
  { value: 'hybrid',           label: 'Hybrid',             desc: 'Dining room is primary; room service is a standard secondary option (e.g. Assisted Living / Memory Care units).' },
]

export default function SystemSettingsPanel() {
  const { settings, loading, fetchSettings, saveSettings } = useAdminStore()
  const [form, setForm]     = useState<SystemSettings | null>(null)
  const [saved, setSaved]   = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchSettings() }, [])
  useEffect(() => {
    if (settings) setForm({ ...settings, kitchenServiceMode: settings.kitchenServiceMode ?? 'hybrid' })
  }, [settings])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    try {
      await saveSettings(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) return <p style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>Loading…</p>

  return (
    <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)', maxWidth:560 }}>
      <h2 style={{ fontSize:'var(--text-lg)', fontWeight:'var(--weight-black)', color:'var(--text-primary)', fontFamily:'var(--font-display)', marginBottom:0 }}>System Settings</h2>

      <Field label="Facility Name">
        <input className="sl-input" value={form.facilityName} onChange={e => setForm(f => f && ({ ...f, facilityName: e.target.value }))} />
      </Field>

      <Field label="Timezone">
        <input className="sl-input" value={form.timezone} onChange={e => setForm(f => f && ({ ...f, timezone: e.target.value }))} placeholder="e.g. America/New_York" />
      </Field>

      <Field label="Session Timeout (minutes)">
        <input type="number" min={5} max={480} className="sl-input" style={{ maxWidth:120 }} value={form.sessionTimeoutMinutes} onChange={e => setForm(f => f && ({ ...f, sessionTimeoutMinutes: Number(e.target.value) }))} />
      </Field>

      {/* ── Kitchen Service Mode ── */}
      <div>
        <div className="sl-eyebrow" style={{ marginBottom:'var(--space-2)', color:'var(--color-primary)' }}>Kitchen Service Mode</div>
        <p style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)', marginBottom:'var(--space-3)' }}>
          Controls how Production works — which tabs appear and how tray tickets behave. Set this per kitchen if you manage multiple locations.
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
          {SERVICE_MODES.map(m => {
            const active = form.kitchenServiceMode === m.value
            return (
              <div key={m.value} onClick={() => setForm(f => f && ({ ...f, kitchenServiceMode: m.value }))} style={{ display:'flex', alignItems:'flex-start', gap:'var(--space-3)', border:`2px solid ${active ? 'var(--color-primary)' : 'var(--border-color)'}`, borderRadius:'var(--radius-md)', padding:'12px 16px', cursor:'pointer', background: active ? 'var(--color-primary)08' : 'var(--bg-card)', transition:'all 0.15s' }}>
                <div style={{ width:20, height:20, borderRadius:'50%', flexShrink:0, marginTop:2, border:`2px solid ${active ? 'var(--color-primary)' : 'var(--border-color)'}`, background: active ? 'var(--color-primary)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {active && <div style={{ width:8, height:8, borderRadius:'50%', background:'white' }} />}
                </div>
                <div>
                  <div style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color: active ? 'var(--color-primary)' : 'var(--text-primary)' }}>{m.label}</div>
                  <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:2 }}>{m.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Toggles ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
        {([
          { key: 'mfaRequired',         label: 'Require MFA for all users' },
          { key: 'allowReadonlyExport', label: 'Allow read-only users to export data' },
          { key: 'maintenanceMode',     label: 'Maintenance mode (locks out non-admins)' },
        ] as { key: keyof SystemSettings; label: string }[]).map(({ key, label }) => (
          <label key={key} style={{ display:'flex', alignItems:'center', gap:'var(--space-3)', cursor:'pointer' }}>
            <input type="checkbox" checked={form[key] as boolean} onChange={e => setForm(f => f && ({ ...f, [key]: e.target.checked }))} style={{ width:16, height:16 }} />
            <span style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}>{label}</span>
          </label>
        ))}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)' }}>
        <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save Settings'}</button>
        {saved && <span style={{ fontSize:'var(--text-sm)', color:'#22c55e', fontWeight:'var(--weight-bold)' }}>✓ Saved</span>}
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="sl-eyebrow" style={{ marginBottom:'var(--space-1)' }}>{label}</div>
      {children}
    </div>
  )
}
