import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'

export type Appearance = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'shoreline-appearance'
const AppearanceContext = createContext<{ appearance: Appearance; setAppearance: (value: Appearance) => void } | null>(null)

function parseAppearance(value: string | null): Appearance {
  return value === 'dark' || value === 'system' ? value : 'light'
}

function readAppearance(): Appearance {
  try { return parseAppearance(localStorage.getItem(STORAGE_KEY)) }
  catch { return 'light' }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, updateAppearance] = useState(readAppearance)
  function setAppearance(value: Appearance) {
    updateAppearance(value)
    try { localStorage.setItem(STORAGE_KEY, value) } catch { /* Keep the choice for this window when storage is unavailable. */ }
  }
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) updateAppearance(readAppearance())
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [])
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = appearance === 'dark' || (appearance === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [appearance])
  return <AppearanceContext.Provider value={{ appearance, setAppearance }}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  const context = useContext(AppearanceContext)
  if (!context) throw new Error('AppearanceProvider is required')
  return context
}
