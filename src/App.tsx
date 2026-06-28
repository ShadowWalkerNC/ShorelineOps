import { Routes, Route, NavLink } from 'react-router-dom'
import ResidentsPage from './features/residents/ResidentsPage'

const NAV_TABS = [
  { path: '/', label: 'Residents' },
  // Stubs — uncomment as each module is ported
  // { path: '/menu', label: 'Menu' },
  // { path: '/production', label: 'Production' },
  // { path: '/admin', label: 'Admin' },
  // { path: '/budget', label: 'Budget' },
  // { path: '/maintenance', label: 'Maintenance' },
]

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="bg-primary text-white px-4 py-3 flex items-center gap-6 shadow">
        <span className="font-bold text-lg tracking-tight">Shoreline</span>
        <nav className="flex gap-2">
          {NAV_TABS.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/20'
                    : 'hover:bg-white/10'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Page content */}
      <main className="flex-1 p-4">
        <Routes>
          <Route path="/" element={<ResidentsPage />} />
        </Routes>
      </main>
    </div>
  )
}
