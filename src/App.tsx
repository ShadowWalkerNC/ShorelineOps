import { Routes, Route, Navigate } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import { RequireRole } from './security/AuthContext'
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
import BudgetPage from './features/budget/BudgetPage'
import TimecardPage from './features/timecard/TimecardPage'
import OfflinePage from './features/offline/OfflinePage'
import LegalPage from './pages/Legal'
import Layout from './components/Layout'
import PwaBanner from './components/PwaBanner'

function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Layout>{children}</Layout>
    </RequireAuth>
  )
}

/** Wraps a route so only users with at least `role` can access it.
 *  Everyone else is redirected to the dashboard. */
function RoleGate({ role, children }: { role: Parameters<typeof RequireRole>[0]['role']; children: React.ReactNode }) {
  return (
    <RequireRole role={role} fallback={<Navigate to="/" replace />}>
      {children}
    </RequireRole>
  )
}

export default function App() {
  return (
    <>
      {/* PWA install / update / offline-ready toast — rendered outside router outlets */}
      <PwaBanner />

      <Routes>
        <Route path="/login"   element={<LoginPage />} />
        <Route path="/offline" element={<OfflinePage />} />

        {/* ── All-staff routes ─────────────────────────────────────── */}
        <Route path="/"                element={<AuthedLayout><DashboardPage /></AuthedLayout>} />
        <Route path="/residents"       element={<AuthedLayout><ResidentsPage /></AuthedLayout>} />
        <Route path="/residents/:id"   element={<AuthedLayout><ResidentProfilePage /></AuthedLayout>} />
        <Route path="/menu"            element={<AuthedLayout><MenuPage /></AuthedLayout>} />
        <Route path="/production"      element={<AuthedLayout><ProductionPage /></AuthedLayout>} />
        <Route path="/recipes"         element={<AuthedLayout><RecipeBookPage /></AuthedLayout>} />
        <Route path="/inventory"       element={<AuthedLayout><InventoryPage /></AuthedLayout>} />
        <Route path="/timecards"       element={<AuthedLayout><TimecardPage /></AuthedLayout>} />
        <Route path="/communications"  element={<AuthedLayout><CommunicationsPage /></AuthedLayout>} />
        <Route path="/legal"           element={<AuthedLayout><LegalPage /></AuthedLayout>} />

        {/* ── Manager+ routes ──────────────────────────────────────── */}
        <Route
          path="/budget"
          element={
            <AuthedLayout>
              <RoleGate role="manager"><BudgetPage /></RoleGate>
            </AuthedLayout>
          }
        />
        <Route
          path="/staff"
          element={
            <AuthedLayout>
              <RoleGate role="manager"><StaffPage /></RoleGate>
            </AuthedLayout>
          }
        />
        <Route
          path="/staff/:staffId"
          element={
            <AuthedLayout>
              <RoleGate role="manager"><StaffProfilePage /></RoleGate>
            </AuthedLayout>
          }
        />

        {/* ── Admin-only routes ────────────────────────────────────── */}
        <Route
          path="/admin"
          element={
            <AuthedLayout>
              <RoleGate role="admin"><AdminPage /></RoleGate>
            </AuthedLayout>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
