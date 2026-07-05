/**
 * ============================================================
 * CHANGE PASSWORD PAGE
 * ============================================================
 * Route: /change-password (AuthedLayout, all authenticated users)
 *
 * Two modes:
 *   1. Voluntary — user navigated here themselves.
 *   2. Forced — forcePasswordReset is true in AuthContext.
 *      In forced mode the cancel button is disabled and an
 *      amber warning explains why the change is required.
 *
 * On success: redirects to / with a brief success message.
 * ============================================================
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../security/AuthContext'
import { validatePassword } from '../../security/passwordPolicy'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { user, changePassword, forcePasswordReset } = useAuth()

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [policyErrors, setPolicyErrors] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function handleNewPwChange(val: string) {
    setNewPw(val)
    setPolicyErrors(val ? validatePassword(val).errors : [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!currentPw) { setError('Current password is required.'); return }

    const pv = validatePassword(newPw)
    setPolicyErrors(pv.errors)
    if (!pv.valid) { setError('New password does not meet requirements.'); return }

    if (newPw !== confirmPw) { setError('Passwords do not match.'); return }
    if (newPw === currentPw) { setError('New password must be different from your current password.'); return }

    setLoading(true)
    try {
      await changePassword(currentPw, newPw)
      setSuccess(true)
      // Brief pause so the success message is visible, then redirect
      setTimeout(() => navigate('/'), 1800)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Password change failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">Change Password</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {user?.name ? `Updating credentials for ${user.name}` : 'Update your password'}
          </p>
        </div>

        <div className="px-6 py-5">

          {/* Forced-reset banner */}
          {forcePasswordReset && !success && (
            <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ Password Reset Required</p>
              <p className="text-xs text-amber-700">
                An administrator has required you to change your password before continuing.
                You cannot access other parts of the application until this is complete.
              </p>
            </div>
          )}

          {/* Success state */}
          {success ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-semibold text-gray-900 mb-1">Password Updated</p>
              <p className="text-sm text-gray-500">Redirecting you home…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none pr-14"
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(s => !s)}
                    className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newPw}
                  onChange={e => handleNewPwChange(e.target.value)}
                />
                {policyErrors.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {policyErrors.map((err, i) => (
                      <li key={i} className="text-xs text-red-600 flex items-center gap-1">
                        <span>✗</span>{err}
                      </li>
                    ))}
                  </ul>
                )}
                {newPw && policyErrors.length === 0 && (
                  <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    <span>✓</span> Password meets all requirements
                  </p>
                )}
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${
                    confirmPw && confirmPw !== newPw ? 'border-red-400' : 'border-gray-300'
                  }`}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                />
                {confirmPw && confirmPw !== newPw && (
                  <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
                )}
              </div>

              {/* Policy reminder */}
              <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
                Requirements: 12+ characters • uppercase • lowercase • number • special character.
                Last 10 passwords cannot be reused. Passwords expire every 90 days.
              </div>

              {/* Error */}
              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  disabled={!!forcePasswordReset}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {loading ? 'Saving…' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
