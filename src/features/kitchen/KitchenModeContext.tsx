/**
 * Kitchen mode — C02 kitchen-fitness pass.
 *
 * Shared context for the four kitchen workhorse pages
 * (/kitchen/orders, /kitchen/sheet, /production, /kitchen/traycards).
 * Kitchen mode is a dark, glare-safe, high-contrast, large-type theme
 * variant built for gloved hands on a hot, bright line: it forces the
 * Tailwind `dark` variant on the page subtree and layers the
 * `kitchen-mode` overrides from kitchen-fitness.css (56px targets,
 * enlarged clinical type). Styling only — no page logic changes.
 *
 * The preference persists per device in localStorage so each kitchen
 * tablet keeps its own setting.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { CookingPot } from 'lucide-react'
import './kitchen-fitness.css'

const STORAGE_KEY = 'shoreline:kitchen-mode'

interface KitchenModeValue {
  kitchenMode: boolean
  toggleKitchenMode: () => void
  setKitchenMode: (on: boolean) => void
}

const KitchenModeContext = createContext<KitchenModeValue>({
  kitchenMode: false,
  toggleKitchenMode: () => {},
  setKitchenMode: () => {},
})

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function KitchenModeProvider({ children }: { children: React.ReactNode }) {
  const [kitchenMode, setKitchenModeState] = useState<boolean>(readStored)

  const setKitchenMode = useCallback((on: boolean) => {
    setKitchenModeState(on)
    try {
      window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
    } catch {
      /* storage unavailable — session-only */
    }
  }, [])

  const toggleKitchenMode = useCallback(() => {
    setKitchenModeState(prev => {
      const next = !prev
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* storage unavailable — session-only */
      }
      return next
    })
  }, [])

  // Keep tabs on the same device in sync (e.g. sheet + orders side by side).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setKitchenModeState(e.newValue === '1')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <KitchenModeContext.Provider value={{ kitchenMode, toggleKitchenMode, setKitchenMode }}>
      {children}
    </KitchenModeContext.Provider>
  )
}

export function useKitchenMode(): KitchenModeValue {
  return useContext(KitchenModeContext)
}

/**
 * Page shell for the kitchen workhorse pages. Applies the `kitchen-fit`
 * touch-target/type floor always, and `dark` + `kitchen-mode` (glare-safe
 * high-contrast large-type theme) when the toggle is on. The `dark` class
 * activates the pages' existing Tailwind dark variants for this subtree
 * regardless of the device's OS theme setting.
 */
export function KitchenFitShell({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const { kitchenMode } = useKitchenMode()
  return (
    <div className={`kitchen-fit${kitchenMode ? ' dark kitchen-mode' : ''} ${className}`}>
      {children}
    </div>
  )
}

/** Header toggle button — drop into each kitchen page's header actions. */
export function KitchenModeToggle({ className = '' }: { className?: string }) {
  const { kitchenMode, toggleKitchenMode } = useKitchenMode()
  return (
    <button
      type="button"
      onClick={toggleKitchenMode}
      title={kitchenMode ? 'Kitchen mode on — tap to return to standard view' : 'Kitchen mode — dark, large-type, gloved-hand targets'}
      className={`km-toggle inline-flex items-center justify-center gap-2 rounded-xl border font-bold transition-colors select-none ${
        kitchenMode
          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_0_2px_rgba(251,191,36,0.35)]'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
      } ${className}`}
    >
      <CookingPot className="w-5 h-5 shrink-0" />
      <span className="whitespace-nowrap">Kitchen mode{kitchenMode ? ' · ON' : ''}</span>
    </button>
  )
}
