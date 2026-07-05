/**
 * ============================================================
 * SESSION WARNING MODAL
 * ============================================================
 * Shown when the session is about to expire (2 minutes remaining).
 * Rendered via React portal to always appear above other UI.
 * User must explicitly choose to stay or log out.
 * Non-dismissable by clicking backdrop.
 * ============================================================
 */
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../security/AuthContext'

const WARN_SECONDS = 120 // must match SESSION_TIMEOUT_MS - WARN_BEFORE_MS in AuthContext

export default function SessionWarningModal() {
  const { sessionWarning, dismissSessionWarning, logout } = useAuth()
  const [secondsLeft, setSecondsLeft] = useState(WARN_SECONDS)

  useEffect(() => {
    if (!sessionWarning) {
      setSecondsLeft(WARN_SECONDS)
      return
    }
    setSecondsLeft(WARN_SECONDS)
    const interval = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(interval); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [sessionWarning])

  if (!sessionWarning) return null

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const countDisplay = `${minutes}:${String(seconds).padStart(2, '0')}`
  const isUrgent = secondsLeft <= 30

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header stripe */}
        <div className={`h-1.5 ${isUrgent ? 'bg-red-500' : 'bg-amber-400'}`} />

        <div className="p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
              isUrgent ? 'bg-red-100' : 'bg-amber-100'
            }`}>
              ⏰
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Session Expiring Soon</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                For security, your session will end due to inactivity.
              </p>
            </div>
          </div>

          {/* Countdown */}
          <div className={`text-center py-4 rounded-xl mb-5 ${
            isUrgent ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <p className={`text-4xl font-mono font-bold ${
              isUrgent ? 'text-red-600' : 'text-amber-700'
            }`}>{countDisplay}</p>
            <p className="text-xs text-gray-500 mt-1">remaining</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => void logout('user_initiated')}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Log Out Now
            </button>
            <button
              onClick={dismissSessionWarning}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Stay Logged In
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
