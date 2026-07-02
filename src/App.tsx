import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from './security/AuthContext'
import RequireAuth from './components/RequireAuth'
import LoginPage from './features/auth/LoginPage'
import ResidentsPage from './features/residents/ResidentsPage'
import ResidentProfilePage from './features/residents/ResidentProfilePage'
import MenuPage from './features/menu/MenuPage'

const NAV_TABS = [
  { path: '/', label: 'Residents' },
  { path: '/menu', label: 'Menu' },
  // { path: '/production', label: 'Production' },
  // { path: '/admin', label: 'Admin' },
  // { path: '/budget', label: 'Budget' },
  // { path: '/maintenance', label: 'Maintenance' },
]

function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-primary text-white px-4 py-3 flex items-center gap-6 shadow">
        <span className="font-bold text-lg tracking-tight">Shoreline</span>
        <nav className="flex gap-2 flex-1">
          {NAV_TABS.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/20' : 'hover:bg-white/10'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="opacity-75">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors text-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 p-4">
        <Routes>
          <Route path="/" element={<ResidentsPage />} />
          <Route path="/residents/:id" element={<ResidentProfilePage />} />
          <Route path="/menu" element={<MenuPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      />
    </Routes>
  )
}
