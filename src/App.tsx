import { Routes, Route, Navigate } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import LoginPage from './features/auth/LoginPage'
import DashboardPage from './features/dashboard/DashboardPage'
import ResidentsPage from './features/residents/ResidentsPage'
import ResidentProfilePage from './features/residents/ResidentProfilePage'
import MenuPage from './features/menu/MenuPage'
import ProductionPage from './features/production/ProductionPage'
import AdminPage from './features/admin/AdminPage'
import RecipeBookPage from './features/recipes/RecipeBookPage'
import InventoryPage from './features/inventory/InventoryPage'
import StaffPage from './features/staff/StaffPage'
import StaffProfilePage from './features/staff/StaffProfilePage'
import CommunicationsPage from './features/communications/CommunicationsPage'
import Layout from './components/Layout'

function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Layout>{children}</Layout>
    </RequireAuth>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/"                 element={<AuthedLayout><DashboardPage /></AuthedLayout>} />
      <Route path="/residents"        element={<AuthedLayout><ResidentsPage /></AuthedLayout>} />
      <Route path="/residents/:id"    element={<AuthedLayout><ResidentProfilePage /></AuthedLayout>} />
      <Route path="/menu"             element={<AuthedLayout><MenuPage /></AuthedLayout>} />
      <Route path="/production"       element={<AuthedLayout><ProductionPage /></AuthedLayout>} />
      <Route path="/recipes"          element={<AuthedLayout><RecipeBookPage /></AuthedLayout>} />
      <Route path="/inventory"        element={<AuthedLayout><InventoryPage /></AuthedLayout>} />
      <Route path="/staff"            element={<AuthedLayout><StaffPage /></AuthedLayout>} />
      <Route path="/staff/:staffId"   element={<AuthedLayout><StaffProfilePage /></AuthedLayout>} />
      <Route path="/communications"   element={<AuthedLayout><CommunicationsPage /></AuthedLayout>} />
      <Route path="/admin"            element={<AuthedLayout><AdminPage /></AuthedLayout>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
