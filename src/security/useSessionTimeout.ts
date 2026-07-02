/**
 * Session timeout hook — HIPAA §164.312(a)(2)(iii) requires automatic
 * logoff after a period of inactivity.
 *
 * Default: 15 minutes (900,000ms). Configurable via VITE_SESSION_TIMEOUT_MS.
 */
import { useEffect, useRef, useCallback } from 'react'
import { auditLog } from './auditLog'

const TIMEOUT_MS = Number(
  import.meta.env.VITE_SESSION_TIMEOUT_MS ?? 900_000 // 15 minutes
)

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
]

export function useSessionTimeout(
  onTimeout: () => void,
  userId?: string
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      auditLog('SESSION_TIMEOUT', { userId, outcome: 'success' })
      onTimeout()
    }, TIMEOUT_MS)
  }, [onTimeout, userId])

  useEffect(() => {
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, resetTimer, { passive: true })
    )
    resetTimer()

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      )
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resetTimer])
}
