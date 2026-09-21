import { useEffect, useState } from 'react'
import { adminApi } from '../../../api/admin'
import type { FacilityAccount } from '../../../types/admin'

const EMPTY_FORM = {
  name: '',
  primaryContactEmail: '',
  facilityType: 'Skilled Nursing',
  address: '',
  npiLicense: '',
}

export default function PlatformControlPanel() {
  const [facilities, setFacilities] = useState<FacilityAccount[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setFacilities(await adminApi.listFacilities())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load facilities.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      setSaving(true)
      await adminApi.registerFacility(form)
      setForm(EMPTY_FORM)
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register facility.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">ShorelineOps facilities</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Register beta facilities and control access. New facilities remain in onboarding until required setup and account provisioning are complete.</p>
        </div>
        <button type="button" onClick={() => setShowForm(value => !value)} className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white">
          {showForm ? 'Cancel' : 'Register beta facility'}
        </button>
      </div>

      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={submit} className="mb-6 grid gap-4 rounded-xl border bg-gray-50 p-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">Facility name
            <input required minLength={2} value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border px-3" />
          </label>
          <label className="text-sm font-medium text-gray-700">Primary contact email
            <input required type="email" inputMode="email" value={form.primaryContactEmail} onChange={e => setForm(v => ({ ...v, primaryContactEmail: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border px-3" />
          </label>
          <label className="text-sm font-medium text-gray-700">Facility type
            <select value={form.facilityType} onChange={e => setForm(v => ({ ...v, facilityType: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border px-3">
              {['Assisted Living', 'Skilled Nursing', 'Memory Care', 'Continuing Care'].map(type => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">NPI or license
            <input value={form.npiLicense} onChange={e => setForm(v => ({ ...v, npiLicense: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border px-3" />
          </label>
          <label className="text-sm font-medium text-gray-700 md:col-span-2">Address
            <input value={form.address} onChange={e => setForm(v => ({ ...v, address: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border px-3" />
          </label>
          <button disabled={saving} className="min-h-11 rounded-lg bg-green-700 px-4 font-semibold text-white disabled:opacity-50 md:col-span-2">{saving ? 'Registering…' : 'Register for onboarding'}</button>
        </form>
      )}

      {loading ? <p className="text-sm text-gray-500">Loading facilities…</p> : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="p-3">Facility</th><th className="p-3">Beta status</th><th className="p-3">Setup</th><th className="p-3">Users</th><th className="p-3">Access</th></tr></thead>
            <tbody className="divide-y">
              {facilities.map(facility => (
                <tr key={facility.id}>
                  <td className="p-3"><div className="font-semibold text-gray-900">{facility.name}</div><div className="text-xs text-gray-500">{facility.primaryContactEmail}</div></td>
                  <td className="p-3 capitalize">{facility.betaStatus}</td>
                  <td className="p-3">{facility.initialized ? 'Initialized' : 'Onboarding'}</td>
                  <td className="p-3">{facility.userCount}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${facility.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{facility.active ? 'Enabled' : 'Paused'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
