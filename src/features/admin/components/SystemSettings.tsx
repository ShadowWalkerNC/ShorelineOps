import React, { useEffect, useState } from 'react'
import { useAdminStore } from '../../../state/adminStore'
import type { SystemSettings } from '../../../types/admin'

export default function SystemSettingsPanel() {
  const { settings, loading, fetchSettings, saveSettings } = useAdminStore()
  const [form, setForm] = useState<SystemSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchSettings() }, [])
  useEffect(() => { if (settings) setForm(settings) }, [settings])

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

  if (loading || !form) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <form onSubmit={handleSave} className="max-w-lg space-y-5">
      <h2 className="text-base font-semibold text-gray-800">System Settings</h2>

      <Field label="Facility Name">
        <input
          value={form.facilityName}
          onChange={e => setForm(f => f && ({ ...f, facilityName: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Timezone">
        <input
          value={form.timezone}
          onChange={e => setForm(f => f && ({ ...f, timezone: e.target.value }))}
          placeholder="e.g. America/New_York"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Session Timeout (minutes)">
        <input
          type="number"
          min={5}
          max={480}
          value={form.sessionTimeoutMinutes}
          onChange={e => setForm(f => f && ({ ...f, sessionTimeoutMinutes: Number(e.target.value) }))}
          className="w-32 border rounded-lg px-3 py-2 text-sm"
        />
      </Field>

      <div className="space-y-3">
        {([
          { key: 'mfaRequired',          label: 'Require MFA for all users' },
          { key: 'allowReadonlyExport',  label: 'Allow read-only users to export data' },
          { key: 'maintenanceMode',      label: 'Maintenance mode (locks out non-admins)' },
        ] as { key: keyof SystemSettings; label: string }[]).map(({ key, label }) => (
          <label key={key} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form[key] as boolean}
              onChange={e => setForm(f => f && ({ ...f, [key]: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-700">{label}</span>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-green-600">✓ Saved</span>}
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
