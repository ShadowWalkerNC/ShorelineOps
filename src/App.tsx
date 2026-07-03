import { Routes, Route } from 'react-router-dom'
import AuthGuard from './features/auth/AuthGuard'
import LoginPage from './features/auth/LoginPage'
import ResidentsPage from './features/residents/ResidentsPage'
import ResidentProfilePage from './features/residents/ResidentProfilePage'
import MenuPage from './features/menu/MenuPage'
import ProductionPage from './features/production/ProductionPage'
import AdminPage from './features/admin/AdminPage'
import Layout from './components/Layout'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <AuthGuard>
            <Layout>
              <Routes>
                <Route path="/residents"     element={<ResidentsPage />} />
                <Route path="/residents/:id" element={<ResidentProfilePage />} />
                <Route path="/menu"          element={<MenuPage />} />
                <Route path="/production"    element={<ProductionPage />} />
                <Route path="/admin"         element={<AdminPage />} />
                <Route path="*"              element={<ResidentsPage />} />
              </Routes>
            </Layout>
          </AuthGuard>
        }
      />
    </Routes>
  )
}
