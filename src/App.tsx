import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import { RequireRole } from './security/AuthContext'
import { ls, LS_KEYS } from './lib/localStorage'
import { FEATURES } from '@/config/mode'
import LoginPage from './features/auth/LoginPage'
import ChangePasswordPage from './features/auth/ChangePasswordPage'
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
import Layout from './components/Layout'
import PwaBanner from './components/PwaBanner'
import SessionWarningModal from './components/SessionWarningModal'

// SetupWizardPage is only bundled in local builds.
// In demo/web builds this import resolves to a no-op component (see below).
const SetupWizardPage = FEATURES.setupWizard
  ? lazy(() => import('./features/setup/SetupWizardPage'))
  : () => <Navigate to="/" replace />

// DemoBootstrap auto-seeds stores and logs in a demo user.
// Only bundled in demo builds.
const DemoBootstrap = FEATURES.demoSeed
  ? lazy(() => import('./demo/DemoBootstrap'))
  : ({ children }: { children: React.ReactNode }) => <>{children}</>

// ── Layout helpers ────────────────────────────────────────────────────────────
function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Layout>{children}</Layout>
    </RequireAuth>
  )
}

function RoleGate({
  role,
  children,
}: {
  role: Parameters<typeof RequireRole>[0]['role']
  children: React.ReactNode
}) {
  return (
    <RequireRole role={role} fallback={<Navigate to="/" replace />}>
      {children}
    </RequireRole>
  )
}

// ── Setup guards (local-only) ─────────────────────────────────────────────────
/**
 * In LOCAL mode: redirect to /setup if first-run setup is not complete.
 * In DEMO / WEB mode: setup is never required — pass through immediately.
 */
function SetupGuard({ children }: { children: React.ReactNode }) {
  if (!FEATURES.setupWizard) return <>{children}</>
  const isSetupDone = ls.get<boolean>(LS_KEYS.setupComplete, false)
  if (!isSetupDone) return <Navigate to="/setup" replace />
  return <>{children}</>
}

/** Guard for the /setup route itself. */
function SetupRoute() {
  if (!FEATURES.setupWizard) return <Navigate to="/" replace />
  const isSetupDone = ls.get<boolean>(LS_KEYS.setupComplete, false)
  if (isSetupDone) return <Navigate to="/" replace />
  return (
    <Suspense fallback={null}>
      <SetupWizardPage />
    </Suspense>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Suspense fallback={null}>
      {/*
        DemoBootstrap wraps the whole app in demo mode.
        It seeds localStorage with fake residents/menu/staff and
        signs in as the demo admin before rendering any routes.
        In local/web mode it is a transparent pass-through.
      */}
      <DemoBootstrap>
        <PwaBanner />
        <SessionWarningModal />

        <Routes>
          <Route path="/setup"   element={<SetupRoute />} />
          <Route path="/login"   element={<SetupGuard><LoginPage /></SetupGuard>} />
          <Route path="/offline" element={<OfflinePage />} />

          {/* ── All-staff routes ───────────────────────────────────────── */}
          <Route path="/"                element={<SetupGuard><AuthedLayout><DashboardPage /></AuthedLayout></SetupGuard>} />
          <Route path="/change-password" element={<SetupGuard><AuthedLayout><ChangePasswordPage /></AuthedLayout></SetupGuard>} />
          <Route path="/residents"       element={<SetupGuard><AuthedLayout><ResidentsPage /></AuthedLayout></SetupGuard>} />
          <Route path="/residents/:id"   element={<SetupGuard><AuthedLayout><ResidentProfilePage /></AuthedLayout></SetupGuard>} />
          <Route path="/menu"            element={<SetupGuard><AuthedLayout><MenuPage /></AuthedLayout></SetupGuard>} />
          <Route path="/production"      element={<SetupGuard><AuthedLayout><ProductionPage /></AuthedLayout></SetupGuard>} />
          <Route path="/recipes"         element={<SetupGuard><AuthedLayout><RecipeBookPage /></AuthedLayout></SetupGuard>} />
          <Route path="/inventory"       element={<SetupGuard><AuthedLayout><InventoryPage /></AuthedLayout></SetupGuard>} />
          <Route path="/communications"  element={<SetupGuard><AuthedLayout><CommunicationsPage /></AuthedLayout></SetupGuard>} />

          {/* ── Timecards (local only) ─────────────────────────────────── */}
          {FEATURES.timeclock && (
            <Route path="/timecards" element={<SetupGuard><AuthedLayout><TimecardPage /></AuthedLayout></SetupGuard>} />
          )}

          {/* ── Manager+ routes ────────────────────────────────────────── */}
          <Route
            path="/budget"
            element={
              <SetupGuard><AuthedLayout>
                <RoleGate role="manager"><BudgetPage /></RoleGate>
              </AuthedLayout></SetupGuard>
            }
          />
          <Route
            path="/staff"
            element={
              <SetupGuard><AuthedLayout>
                <RoleGate role="manager"><StaffPage /></RoleGate>
              </AuthedLayout></SetupGuard>
            }
          />
          <Route
            path="/staff/:staffId"
            element={
              <SetupGuard><AuthedLayout>
                <RoleGate role="manager"><StaffProfilePage /></RoleGate>
              </AuthedLayout></SetupGuard>
            }
          />

          {/* ── Admin-only routes ──────────────────────────────────────── */}
          <Route
            path="/admin"
            element={
              <SetupGuard><AuthedLayout>
                <RoleGate role="admin"><AdminPage /></RoleGate>
              </AuthedLayout></SetupGuard>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DemoBootstrap>
    </Suspense>
  )
}
