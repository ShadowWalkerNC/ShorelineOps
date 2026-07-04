// ============================================================
// useIsMobile
// ============================================================
// Returns true when the viewport width is below 768 px.
// Updates reactively on window resize.
// Shared by NotificationBell and any future responsive component.
// ============================================================
import { useState, useEffect } from 'react'

export function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(() => window.innerWidth < breakpoint)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return mobile
}
