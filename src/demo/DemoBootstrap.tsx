/**
 * ============================================================
 * DEMO BOOTSTRAP
 * ============================================================
 * Only imported (and bundled) in VITE_MODE=demo builds.
 *
 * HOW SEEDING WORKS
 * ─────────────────
 * Stores in this app have two storage patterns:
 *
 *   • PHI keys (residents) — normally written via cs (AES-256-GCM).
 *     In demo mode there is no encryption key (no password login),
 *     so we write residents as plain JSON directly to localStorage.
 *     This is safe because demo residents are entirely fictional —
 *     no real PHI ever enters a demo build.
 *
 *   • Non-PHI keys (menu, production) — written via ls (plain JSON).
 *
 *   • recipesStore — uses a module-level _recipes variable, not
 *     localStorage at all. It self-seeds from SEED_RECIPES on import.
 *     We just call fetch() to load them into Zustand state.
 *
 * After writing to localStorage, we call each store’s existing
 * fetch/fetchItems/fetchWeeks/fetchSheets method so Zustand state
 * reflects what we wrote. No bulk setters needed on any store.
 * ============================================================
 */
import React, { useEffect, useState } from 'react'
import { useResidentsStore } from '@/state/residentsStore'
import { useMenuStore } from '@/state/menuStore'
import { useRecipesStore } from '@/state/recipesStore'
import { useProductionStore } from '@/state/productionStore'
import { useAuth } from '@/security/AuthContext'
import { ls, LS_KEYS } from '@/lib/localStorage'
import {
  SEED_RESIDENTS,
  SEED_MENU_ITEMS,
  SEED_MENU_WEEKS,
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

  // Store fetch methods — these load from localStorage into Zustand state.
  // We write to localStorage first, then call these.
  const fetchResidents   = useResidentsStore(s => s.fetch)
  const fetchItems       = useMenuStore(s => s.fetchItems)
  const fetchWeeks       = useMenuStore(s => s.fetchWeeks)
  const fetchRecipes     = useRecipesStore(s => s.fetch)
  const fetchSheets      = useProductionStore(s => s.fetchSheets)
  const { loginAsDemo }  = useAuth()

  useEffect(() => {
    if (sessionStorage.getItem(DEMO_SEEDED_KEY)) {
      // Already seeded this session — just re-fetch into state
      void Promise.all([
        fetchResidents(),
        fetchItems(),
        fetchWeeks(),
        fetchRecipes(),
        fetchSheets(),
      ]).then(() => setReady(true))
      return
    }

    // ── 1. Mark setup complete ────────────────────────────────────────
    ls.set(LS_KEYS.setupComplete, true)

    // ── 2. Write residents as plain JSON (no encryption key in demo) ──
    // cs would throw because keyManager.isKeyReady() === false.
    // Demo data is entirely fictional so skipping encryption is correct.
    localStorage.setItem(LS_KEYS.residents, JSON.stringify(SEED_RESIDENTS))

    // ── 3. Write non-PHI keys via ls ───────────────────────────────
    ls.set(LS_KEYS.menuItems,   SEED_MENU_ITEMS)
    ls.set(LS_KEYS.menuWeeks,   SEED_MENU_WEEKS)
    ls.set(LS_KEYS.productions, SEED_PRODUCTION_SHEETS)
    // recipesStore seeds itself from SEED_RECIPES at module load — no write needed.

    // ── 4. Sign in as demo admin ──────────────────────────────────
    loginAsDemo(DEMO_ADMIN)

    sessionStorage.setItem(DEMO_SEEDED_KEY, '1')

    // ── 5. Fetch seed data into Zustand state ──────────────────────
    // residentsStore.fetch uses cs.get which checks keyManager.isKeyReady().
    // When key is not ready, cs.get returns the fallback [].
    // So we read directly from localStorage and set state manually here.
    const rawResidents = localStorage.getItem(LS_KEYS.residents)
    if (rawResidents) {
      try {
        const parsed = JSON.parse(rawResidents)
        useResidentsStore.setState({ residents: parsed, loading: false })
      } catch { /* ignore */ }
    }

    void Promise.all([
      fetchItems(),
      fetchWeeks(),
      fetchRecipes(),
      fetchSheets(),
    ]).then(() => setReady(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      <div style={{ paddingTop: 28 }}>
        {children}
      </div>
    </>
  )
}
