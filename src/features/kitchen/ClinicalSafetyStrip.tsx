/**
 * ClinicalSafetyStrip — C02 kitchen-fitness pass.
 *
 * Ambient clinical awareness for the kitchen pages' headers: the current
 * meal service plus live counts of residents with recorded allergies and
 * residents flagged NPO. Read-only: uses the existing /api/residents
 * endpoint (no new server endpoints). Pages that already hold resident
 * rows may pass them via `residents` to avoid a duplicate fetch; the
 * strip never mutates page data.
 */
import { useEffect, useMemo, useState } from 'react'
import { UtensilsCrossed, AlertTriangle, OctagonX, Users } from 'lucide-react'
import { tokenManager } from '@/security/tokenManager'

/** Current meal service from the clock (facility slots: 07:30 / 12:00 / 17:00). */
export function currentMealService(now = new Date()): 'Breakfast' | 'Lunch' | 'Dinner' {
  const mins = now.getHours() * 60 + now.getMinutes()
  if (mins < 10 * 60 + 30) return 'Breakfast'
  if (mins < 15 * 60) return 'Lunch'
  return 'Dinner'
}

function isNpo(r: any): boolean {
  return Boolean(r?.is_npo ?? r?.isNpo ?? false)
}

function allergiesOf(r: any): string[] {
  const a = r?.allergies ?? []
  return Array.isArray(a) ? a : []
}

export default function ClinicalSafetyStrip({
  residents,
  meal,
  className = '',
}: {
  /** Optional pre-loaded resident rows (snake_case or camelCase). */
  residents?: any[]
  /** Override the derived current-meal label. */
  meal?: string
  className?: string
}) {
  const [fetched, setFetched] = useState<any[] | null>(null)

  useEffect(() => {
    if (residents) return
    let cancelled = false
    const token = tokenManager.getAccessToken()
    fetch('/api/residents', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data) return
        setFetched(data.residents || (Array.isArray(data) ? data : []))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [residents])

  const rows = residents ?? fetched ?? []
  const { allergyCount, npoCount } = useMemo(() => {
    let allergyCount = 0
    let npoCount = 0
    for (const r of rows) {
      if (allergiesOf(r).length > 0) allergyCount += 1
      if (isNpo(r)) npoCount += 1
    }
    return { allergyCount, npoCount }
  }, [rows])

  const mealLabel = meal ?? currentMealService()

  return (
    <div className={`km-safety-strip ${className}`}>
      <span className="km-stat">
        <UtensilsCrossed />
        {mealLabel} service
      </span>
      <span className="km-stat">
        <AlertTriangle />
        {allergyCount} resident{allergyCount === 1 ? '' : 's'} with allergies
      </span>
      <span className="km-stat km-danger">
        <OctagonX />
        {npoCount} NPO — no tray
      </span>
      <span className="km-stat km-muted">
        <Users />
        {rows.length} on census
      </span>
    </div>
  )
}
