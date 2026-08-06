/**
 * Login page — JWT auth by default, with MFA challenge / enrollment steps.
 * Demo credential panel only when VITE_DEMO_MODE=true.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../security/AuthContext'
import { safeRedirectPath } from '@/lib/safeRedirect'

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'
type Step = 'credentials' | 'mfa' | 'enroll'

export default function LoginPage() {
  const {
    login,
    completeMfaLogin,
    completeMfaEnrollment,
    beginMfaEnrollment,
    isAuthenticated,
  } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaToken, setMfaToken] = useState('')
  const [otpauthUrl, setOtpauthUrl] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [step, setStep] = useState<Step>('credentials')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoAccounts, setDemoAccounts] = useState<Array<{ role: string; email: string; password: string }>>([])

  const from = safeRedirectPath(
    (location.state as { from?: { pathname: string } })?.from?.pathname
  )
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true })
  }, [isAuthenticated, navigate, from])

  useEffect(() => {
    if (!DEMO_MODE) return
    void import('../../security/demoCredentials').then((m) => setDemoAccounts(m.DEMO_ACCOUNTS))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (step === 'credentials') {
        const result = await login(email, password)
        if (result.status === 'mfa_required') {
          setMfaToken(result.mfaToken)
          setStep('mfa')
        } else if (result.status === 'mfa_enrollment_required') {
          setMfaToken(result.mfaToken)
          const setup = await beginMfaEnrollment(result.mfaToken)
          setOtpauthUrl(setup.otpauthUrl)
          setMfaSecret(setup.secret)
          setStep('enroll')
        }
      } else if (step === 'mfa') {
        await completeMfaLogin(mfaToken, mfaCode.trim())
      } else if (step === 'enroll') {
        await completeMfaEnrollment(mfaToken, mfaCode.trim())
      }
    } catch {
      setError(
        step === 'credentials'
          ? (DEMO_MODE
            ? 'Invalid email or password. Use the demo credentials below.'
            : 'Invalid email or password.')
          : 'Invalid authentication code.'
      )
      setLoading(false)
    }
  }

  function fillDemo(acct: { email: string; password: string }) {
    setEmail(acct.email)
    setPassword(acct.password)
    setError('')
    setStep('credentials')
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
            }}>
              {step === 'credentials' && 'Operations Platform'}
              {step === 'mfa' && 'Multi-Factor Authentication'}
              {step === 'enroll' && 'Set Up Authenticator'}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {step === 'credentials' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required autoComplete="email" style={inp} />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    required autoComplete="current-password" style={inp} />
                </div>
              </>
            )}

            {step === 'mfa' && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Enter the 6-digit code from your authenticator app.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoComplete="one-time-code"
                  placeholder="000000"
                  style={{ ...inp, letterSpacing: '0.3em', fontFamily: 'monospace', textAlign: 'center' }}
                />
                <button type="button" onClick={() => { setStep('credentials'); setMfaCode(''); setError('') }}
                  style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 12 }}>
                  ← Back to sign in
                </button>
              </div>
            )}

            {step === 'enroll' && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  MFA is required for this facility. Add this account in your authenticator app, then enter a code to confirm.
                </p>
                {otpauthUrl && (
                  <div style={{
                    marginBottom: 12, padding: 12, borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-app)', border: '1px solid var(--border-color)',
                    fontSize: 11, wordBreak: 'break-all', color: 'var(--text-muted)',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>otpauth URI</div>
                    {otpauthUrl}
                  </div>
                )}
                {mfaSecret && (
                  <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Manual key: <code style={{ fontFamily: 'monospace' }}>{mfaSecret}</code>
                  </div>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoComplete="one-time-code"
                  placeholder="000000"
                  style={{ ...inp, letterSpacing: '0.3em', fontFamily: 'monospace', textAlign: 'center' }}
                />
              </div>
            )}

            {error && (
              <div style={{
                background: '#faf1ef', border: '1px solid rgba(189,110,92,0.25)',
                color: '#a35a49', padding: '10px 12px',
                borderRadius: 'var(--radius-md)', fontSize: 13,
                fontWeight: 500, marginBottom: 16,
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px',
              background: loading ? 'var(--text-muted)' : 'var(--color-primary)',
              color: 'white', border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              minHeight: 44, transition: 'background 0.2s ease',
            }}>
              {loading
                ? 'Please wait...'
                : step === 'credentials'
                  ? 'Sign in'
                  : step === 'mfa'
                    ? 'Verify code'
                    : 'Enable MFA & continue'}
            </button>
          </form>
        </div>

        {DEMO_MODE && demoAccounts.length > 0 && step === 'credentials' && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,255,255,0.15)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
              Demo Accounts — click to fill
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {demoAccounts.map(acct => (
                <button key={acct.email} onClick={() => fillDemo(acct)} type="button" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px', cursor: 'pointer',
                  textAlign: 'left', gap: 12,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', minWidth: 72 }}>{acct.role}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', flex: 1 }}>{acct.email}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{acct.password}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 10, lineHeight: 1.5 }}>
              Demo mode only — never enable VITE_DEMO_MODE with real PHI.
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
