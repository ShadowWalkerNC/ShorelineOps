import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'

export type DeviceMode = 'auto' | 'desktop' | 'tablet' | 'mobile'
export type EffectiveDevice = 'desktop' | 'tablet' | 'mobile'

interface DeviceContextValue {
  /** Screen width in pixels */
  width: number
  /** Screen height in pixels */
  height: number
  /** Current mode setting (persisted in localStorage) */
  deviceMode: DeviceMode
  /** Function to manually override device mode (e.g. for testing/preview) */
  setDeviceMode: (mode: DeviceMode) => void
  /** The effective active device tier */
  device: EffectiveDevice
  /** True if effective device is mobile (< 768px) */
  isMobile: boolean
  /** True if effective device is tablet (768px - 1023px) */
  isTablet: boolean
  /** True if effective device is desktop (>= 1024px) */
  isDesktop: boolean
  /** True if touch capability is detected */
  isTouch: boolean
  /** Screen orientation */
  orientation: 'portrait' | 'landscape'
}

const STORAGE_KEY = 'shoreline:device-mode-override'

const DeviceContext = createContext<DeviceContextValue | null>(null)

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [dimensions, setDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }))

  const [deviceMode, setDeviceModeState] = useState<DeviceMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'desktop' || saved === 'tablet' || saved === 'mobile') {
        return saved
      }
    } catch {
      /* ignore */
    }
    return 'auto'
  })

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const setDeviceMode = (mode: DeviceMode) => {
    setDeviceModeState(mode)
    try {
      if (mode === 'auto') {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, mode)
      }
    } catch {
      /* ignore */
    }
  }

  const isTouch = useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }, [])

  const orientation = dimensions.width >= dimensions.height ? 'landscape' : 'portrait'

  const device: EffectiveDevice = useMemo(() => {
    if (deviceMode === 'desktop') return 'desktop'
    if (deviceMode === 'tablet') return 'tablet'
    if (deviceMode === 'mobile') return 'mobile'

    // Auto detection based on responsive breakpoints
    if (dimensions.width < 768) return 'mobile'
    if (dimensions.width < 1024) return 'tablet'
    return 'desktop'
  }, [deviceMode, dimensions.width])

  const value: DeviceContextValue = useMemo(() => ({
    width: dimensions.width,
    height: dimensions.height,
    deviceMode,
    setDeviceMode,
    device,
    isMobile: device === 'mobile',
    isTablet: device === 'tablet',
    isDesktop: device === 'desktop',
    isTouch,
    orientation,
  }), [dimensions, deviceMode, device, isTouch, orientation])

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  )
}

export function useDevice(): DeviceContextValue {
  const context = useContext(DeviceContext)
  if (!context) {
    // Fallback if rendered outside DeviceProvider
    const width = typeof window !== 'undefined' ? window.innerWidth : 1200
    const height = typeof window !== 'undefined' ? window.innerHeight : 800
    const isMobile = width < 768
    const isTablet = width >= 768 && width < 1024
    const isDesktop = width >= 1024
    return {
      width,
      height,
      deviceMode: 'auto',
      setDeviceMode: () => {},
      device: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
      isMobile,
      isTablet,
      isDesktop,
      isTouch: false,
      orientation: width >= height ? 'landscape' : 'portrait',
    }
  }
  return context
}
