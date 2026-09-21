import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../../api/admin'
import type { OnboardingStatus } from '../../../types/admin'

export default function OnboardingStatusPanel() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminApi.getOnboardingStatus()
      .then(setStatus)
      .catch(err => setError(err instanceof Error ? err.message : 'Unable to load onboarding status.'))
  }, [])

  if (error) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  if (!status) return <p className="text-sm text-gray-500">Checking required setup…</p>

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Facility readiness</h2>
          <p className="mt-1 text-sm text-gray-600">Required setup for {status.facilityName || status.facilityId}.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.complete ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
          {status.complete ? 'Required setup complete' : 'Action required'}
        </span>
      </div>
      <div className="space-y-3">
        {status.steps.map(step => (
          <div key={step.id} className="flex min-h-12 items-center gap-3 rounded-lg border p-3">
            <span aria-hidden className={`flex h-7 w-7 items-center justify-center rounded-full font-bold ${step.complete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
              {step.complete ? '✓' : '!'}
            </span>
            <span className="text-sm font-medium text-gray-800">{step.label}</span>
          </div>
        ))}
      </div>
      {!status.complete && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Next required action: {status.nextAction}</div>
          <Link to="/settings" className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-amber-700 px-4 font-semibold text-white">Open facility settings</Link>
        </div>
      )}
    </div>
  )
}
