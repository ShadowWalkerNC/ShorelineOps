/**
 * ============================================================
 * DEMO BOOTSTRAP
 * ============================================================
 * Only imported (and bundled) in VITE_MODE=demo builds.
 *
 * On first mount this component:
 *   1. Seeds all Zustand stores with fake data from seed.ts
 *   2. Marks setup as complete so SetupGuard passes through
 *   3. Signs in as the demo admin user (no password required)
 *
 * After seeding is done it renders its children normally.
 * A "Demo Mode" banner is shown at the top of the page.
 * ============================================================
 */
import React, { useEffect, useState } from 'react'
import { useResidentsStore } from '@/state/residentsStore'
import { useMenuStore } from '@/state/menuStore'
import { useRecipeStore } from '@/state/recipeStore'
import { useProductionStore } from '@/state/productionStore'
import { useAuth } from '@/security/AuthContext'
import { ls, LS_KEYS } from '@/lib/localStorage'
import {
  SEED_RESIDENTS,
  SEED_MENU_ITEMS,
  SEED_MENU_WEEKS,
  SEED_RECIPES,
  SEED_PRODUCTION_SHEETS,
} from './seed'

const DEMO_ADMIN = {
  id: 'demo-admin-1',
  name: 'Admin User',
  email: 'admin@shoreline.demo',
  role: 'admin' as const,
}

const DEMO_SEEDED_KEY = 'sl_demo_seeded'

export default function DemoBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  const { setResidents } = useResidentsStore()
  const { setItems, setWeeks } = useMenuStore()
  const { setRecipes } = useRecipeStore()
  const { setSheets } = useProductionStore()
  const { loginAsDemo } = useAuth()

  useEffect(() => {
    // Only seed once per session (avoid re-seeding on hot reload)
    if (sessionStorage.getItem(DEMO_SEEDED_KEY)) {
      setReady(true)
      return
    }

    // 1. Mark setup complete so SetupGuard never redirects
    ls.set(LS_KEYS.setupComplete, true)

    // 2. Seed all stores
    setResidents(SEED_RESIDENTS)
    setItems(SEED_MENU_ITEMS)
    setWeeks(SEED_MENU_WEEKS)
    setRecipes(SEED_RECIPES)
    setSheets(SEED_PRODUCTION_SHEETS)

    // 3. Log in as demo admin (bypasses password check)
    loginAsDemo(DEMO_ADMIN)

    sessionStorage.setItem(DEMO_SEEDED_KEY, '1')
    setReady(true)
  }, [setResidents, setItems, setWeeks, setRecipes, setSheets, loginAsDemo])

  if (!ready) return null

  return (
    <>
      {/* Demo mode banner */}
      <div
        role="banner"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: '#1e40af',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textAlign: 'center',
          padding: '5px 16px',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        🔵 DEMO MODE — All data is fictional. No real PHI is present in this build.
      </div>
      {/* Push content down below the banner */}
      <div style={{ paddingTop: 28 }}>
        {children}
      </div>
    </>
  )
}
