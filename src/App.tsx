import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import { RequireRole } from './security/AuthContext'
const LoginPage = lazy(() => import('./features/auth/LoginPage'))
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'))
const ResidentsPage = lazy(() => import('./features/residents/ResidentsPage'))
const ResidentProfilePage = lazy(() => import('./features/residents/ResidentProfilePage'))
const MenuPage = lazy(() => import('./features/menu/MenuPage'))
const ProductionPage = lazy(() => import('./features/production/ProductionPage'))
const AdminPage = lazy(() => import('./features/admin/AdminPage'))
const RecipeBookPage = lazy(() => import('./features/recipes/RecipeBookPage'))
const InventoryPage = lazy(() => import('./features/inventory/InventoryPage'))
const StaffPage = lazy(() => import('./features/staff/StaffPage'))
const StaffProfilePage = lazy(() => import('./features/staff/StaffProfilePage'))
const TimecardPage = lazy(() => import('./features/timecard/TimecardPage'))
const OfflinePage = lazy(() => import('./features/offline/OfflinePage'))
const SetupWizardPage = lazy(() => import('./features/setup/SetupWizardPage'))
const LegalPage = lazy(() => import('./pages/Legal'))
import Layout from './components/Layout'
import PwaBanner from './components/PwaBanner'
const OrderEntryPage = lazy(() => import('./features/kitchen/OrderEntryPage'))
const KitchenSheetPage = lazy(() => import('./features/kitchen/KitchenSheetPage'))
const TrayCardGeneratorPage = lazy(() => import('./features/kitchen/TrayCardGeneratorPage'))
const TrayDispatchPage = lazy(() => import('./features/traydispatch/TrayDispatchPage'))
const PurchasingPage = lazy(() => import('./features/purchasing/PurchasingPage'))
const DistributorPortalPage = lazy(() => import('./features/distributor/DistributorPortalPage'))
const ReportingPage = lazy(() => import('./features/reporting/ReportingPage'))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'))
const MobileTasksPage = lazy(() => import('./features/tasks/MobileTasksPage'))

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
    <div className="stitch-standalone flex flex-col items-center justify-center gap-4 text-center">
      <p className="sl-eyebrow">ShorelineOps workspace</p>
      <h1 className="sl-page-title">404 — Page not found</h1>
      <p className="sl-page-subtitle max-w-md">
        This page doesn't exist or was removed. Use the navigation to get back to work.
      </p>
      <Link to="/" className="btn btn-primary">Go to Dashboard</Link>
    </div>
  )
}

export default function App() {
  return (
    <>
      {/* PWA install / update / offline-ready toast — rendered outside router outlets */}
      <PwaBanner />

      <Suspense fallback={<div role="status" aria-live="polite" className="stitch-standalone flex items-center justify-center">Loading workspace…</div>}>
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
      </Suspense>
    </>
  )
}
