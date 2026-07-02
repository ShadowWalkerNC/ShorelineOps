import React from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import AuthGuard from './features/auth/AuthGuard'
import LoginPage from './features/auth/LoginPage'
import ResidentsPage from './features/residents/ResidentsPage'
import MenuPage from './features/menu/MenuPage'
import ProductionPage from './features/production/ProductionPage'
import AdminPage from './features/admin/AdminPage'
import { useAuth } from './security/AuthContext'

const NAV = [
  { to: '/residents',  label: 'Residents' },
  { to: '/menu',       label: 'Menu' },
  { to: '/production', label: 'Production' },
]

function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center gap-6">
        <span className="text-lg font-bold text-blue-700 tracking-tight">Shoreline</span>
        <div className="flex gap-1">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  isActive ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              Admin
            </NavLink>
          )}
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <Layout>
                <Routes>
                  <Route path="/residents"  element={<ResidentsPage />} />
                  <Route path="/menu"       element={<MenuPage />} />
                  <Route path="/production" element={<ProductionPage />} />
                  <Route path="/admin"      element={<AdminPage />} />
                  <Route path="*"           element={<ResidentsPage />} />
                </Routes>
              </Layout>
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
