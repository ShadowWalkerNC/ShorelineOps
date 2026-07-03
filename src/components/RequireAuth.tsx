/**
 * Route guard — redirects unauthenticated users to /login.
 * Preserves the original destination so after login they return to it.
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../security/AuthContext'

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  // Wait for session restore before making any auth decision
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
    // Pass current location so LoginPage can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
