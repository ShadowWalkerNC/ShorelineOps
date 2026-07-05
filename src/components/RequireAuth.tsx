/**
 * ============================================================
 * REQUIRE AUTH — Route Guard
 * ============================================================
 * 1. Waits for session restore (isLoading).
 * 2. Redirects unauthenticated users to /login,
 *    preserving the original destination via location state.
 * 3. If the user is authenticated but has forcePasswordReset set,
 *    redirects to /change-password (except when already there).
 *    This makes the forced-reset gate airtight — no other route
 *    can be reached until the password is changed.
 * ============================================================
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../security/AuthContext'

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, forcePasswordReset } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: 14,
        background: 'var(--bg-app)',
      }}>
        Loading…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Force password change before any other route is accessible
  if (forcePasswordReset && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return <>{children}</>
}
