/**
 * AuthGuard — wraps all protected routes.
 * Redirects unauthenticated users to /login, preserving the intended path.
 * Shows a full-screen loader while the session is being restored on reload.
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../security/AuthContext'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
