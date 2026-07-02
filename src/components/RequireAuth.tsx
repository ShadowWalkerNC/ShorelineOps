/**
 * Route guard — redirects unauthenticated users to /login.
 * Preserves the original destination so after login they return to it.
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../security/AuthContext'

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
