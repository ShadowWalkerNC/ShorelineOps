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
import TimecardPage from './features/timecard/TimecardPage'
import OfflinePage from './features/offline/OfflinePage'
import SetupWizardPage from './features/setup/SetupWizardPage'
import LegalPage from './pages/Legal'
import Layout from './components/Layout'
import PwaBanner from './components/PwaBanner'
import OrderEntryPage from './features/kitchen/OrderEntryPage'
import KitchenSheetPage from './features/kitchen/KitchenSheetPage'
import TrayCardGeneratorPage from './features/kitchen/TrayCardGeneratorPage'
import TrayDispatchPage from './features/traydispatch/TrayDispatchPage'
import PurchasingPage from './features/purchasing/PurchasingPage'
import DistributorPortalPage from './features/distributor/DistributorPortalPage'
import ReportingPage from './features/reporting/ReportingPage'
import SettingsPage from './features/settings/SettingsPage'
import MobileTasksPage from './features/tasks/MobileTasksPage'

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

/** B13: cut routes render a real 404 instead of silently redirecting. */
function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold text-slate-900">404 — Page not found</h1>
      <p className="text-slate-600 max-w-md">
        This page doesn't exist or was removed. Use the navigation to get back to work.
      </p>
      <a href="/" className="text-blue-600 underline">Go to Dashboard</a>
    </div>
  )
}

export default function App() {
  return (
    <>
      {/* PWA install / update / offline-ready toast — rendered outside router outlets */}
      <PwaBanner />

      <Routes>
        <Route path="/setup"   element={<SetupWizardPage />} />
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
        <Route path="/legal"           element={<AuthedLayout><LegalPage /></AuthedLayout>} />
        <Route path="/kitchen/orders"    element={<AuthedLayout><OrderEntryPage /></AuthedLayout>} />
        <Route path="/kitchen/sheet"     element={<AuthedLayout><KitchenSheetPage /></AuthedLayout>} />
        <Route path="/kitchen/traycards" element={<AuthedLayout><TrayCardGeneratorPage /></AuthedLayout>} />
        <Route path="/kitchen/dispatch"  element={<AuthedLayout><TrayDispatchPage /></AuthedLayout>} />
        <Route path="/purchasing"        element={<AuthedLayout><PurchasingPage /></AuthedLayout>} />
        <Route path="/distributor"       element={<AuthedLayout><DistributorPortalPage /></AuthedLayout>} />
        <Route path="/reporting"         element={<AuthedLayout><ReportingPage /></AuthedLayout>} />
        <Route path="/settings"          element={<AuthedLayout><SettingsPage /></AuthedLayout>} />
        <Route path="/tasks"             element={<AuthedLayout><MobileTasksPage /></AuthedLayout>} />

        {/* ── Manager+ routes ──────────────────────────────────────── */}
        {/* /budget merged into /reporting (B13 scope cut) — legacy redirect */}
        <Route path="/budget" element={<Navigate to="/reporting" replace />} />
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

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
