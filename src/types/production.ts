import type { MealSlot, DayOfWeek } from './menu'
import type { Texture, DietType, ServingLocation } from './resident'

// ── Row in the production grid ────────────────────────────────────────────────

/** A single item row on a production sheet */
export type ProductionRow = {
  menuItemId: string
  menuItemName: string
  textureModified: boolean
  /** Counts keyed by texture */
  textureCounts: Record<Texture, number>
  /** Counts keyed by diet */
  dietCounts: Record<DietType, number>
  /** Counts keyed by serving location */
  locationCounts: Record<ServingLocation, number>
  /** Free-text kitchen note for this item (e.g. "Hold sauce") */
  kitchenNote?: string
  /** Total resident count for this item */
  total: number
}

// ── Summary counts (header cards) ─────────────────────────────────────────────

export type MealCount = {
  total: number
  diningRoom: number
  room: number
  assistedLiving: number
  memoryCare: number
  /** Residents on hospital / LOA — excluded from total but shown */
  absent: number
}

// ── The full sheet for one meal slot on one day ────────────────────────────────

export type ProductionSheet = {
  id: string
  /** Which menu week was active */
  menuWeekId: string
  day: DayOfWeek
  slot: MealSlot
  rows: ProductionRow[]
  counts: MealCount
  /** Staff who signed off on this sheet */
  signedOffBy?: string
  signedOffAt?: string
  createdAt: string
  updatedAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const TEXTURE_LIST: Texture[] = [
  'Regular',
  'Cut-Up',
  'Minced',
  'Minced & Moist',
  'Pureed',
  'Liquid',
]

export const DIET_LIST: DietType[] = [
  'Regular',
  'Diabetic',
  'Cardiac',
  'Renal',
  'Low Sodium',
  'Mechanical Soft',
]

export const LOCATION_LIST: ServingLocation[] = [
  'Dining Room',
  'Room',
  'Assisted Living',
  'Memory Care',
]

export function emptyMealCount(): MealCount {
  return { total: 0, diningRoom: 0, room: 0, assistedLiving: 0, memoryCare: 0, absent: 0 }
}
