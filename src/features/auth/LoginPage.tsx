/**
 * ============================================================
 * LOGIN PAGE
 * ============================================================
 * Handles: normal login, locked-account errors,
 * password-expiry warnings, and forced-reset redirects.
 * ============================================================
 */
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../security/AuthContext'

export default function LoginPage() {
  const { login, isAuthenticated, forcePasswordReset, passwordExpiry } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showExpiry, setShowExpiry] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  // After successful login: route based on forcePasswordReset flag
  useEffect(() => {
    if (!isAuthenticated) return
    if (forcePasswordReset) {
      navigate('/change-password', { replace: true })
    } else {
      if (passwordExpiry?.shouldWarn) setShowExpiry(true)
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, forcePasswordReset])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      // Navigation is handled by the useEffect above
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed. Please try again.'
      setError(msg)
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: 'var(--bg-app)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    fontSize: 16, color: 'var(--text-primary)',
    outline: 'none', minHeight: 44,
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(30,35,38,0.97)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, zIndex: 10000,
    }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Password expiry warning (shown briefly after redirect if shouldWarn) */}
        {showExpiry && passwordExpiry && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            color: '#92400e',
            fontSize: 13,
            fontWeight: 500,
          }}>
            ⚠️ Your password expires in {passwordExpiry.daysUntilExpiry} day{passwordExpiry.daysUntilExpiry !== 1 ? 's' : ''}.
            {' '}
            <button
              onClick={() => navigate('/change-password')}
              style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: 13 }}
            >
              Change it now
            </button>
            {' or '}
            <button
              onClick={() => setShowExpiry(false)}
              style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: 13 }}
            >
              dismiss
            </button>.
          </div>
        )}

        {/* Login card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: 32,
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <img
              src="/logo.png"
              alt="Shoreline"
              style={{
                width: '100%', maxWidth: 280, height: 'auto',
                objectFit: 'contain', display: 'block',
                margin: '0 auto 14px',
              }}
            />
            <div style={{
              fontSize: 11, color: 'var(--text-muted)',
              fontWeight: 600, letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}>Dietary Operations Platform</div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                style={inp}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={inp}
              />
            </div>

            {error && (
              <div style={{
                background: '#faf1ef',
                border: '1px solid rgba(189,110,92,0.25)',
                color: '#a35a49',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 16,
                lineHeight: 1.5,
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px',
                background: loading ? 'var(--text-muted)' : 'var(--color-primary)',
                color: 'white', border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                minHeight: 44, transition: 'background 0.2s ease',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
