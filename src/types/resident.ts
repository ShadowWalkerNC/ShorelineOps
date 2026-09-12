export type ResidentStatus = 'Active' | 'Hospital' | 'LOA' | 'Passed Away'
export type Texture = 'Regular' | 'Minced' | 'Minced & Moist' | 'Pureed' | 'Cut-Up' | 'Liquid'
export type PortionSize = 'Regular' | 'Small' | 'Large'
export type ServingLocation = 'Dining Room' | 'Room' | 'Assisted Living' | 'Memory Care'

export const DIET_TYPES = [
  'Regular', 'Diabetic', 'Cardiac', 'Renal', 'Low Sodium', 'Mechanical Soft',
  // B04: NPO (nothing by mouth) — selectable in the resident profile only by
  // dietitian/manager roles (server-enforced); selecting it implies the
  // non-overridable NPO hard-block flag.
  'NPO',
] as const
export type DietType = typeof DIET_TYPES[number]

export const ALLERGY_OPTIONS = [
  'Nuts', 'Dairy', 'Gluten', 'Strawberries', 'Seeds', 'Caffeine',
] as const
export type Allergy = typeof ALLERGY_OPTIONS[number]

export const BEVERAGE_OPTIONS = [
  'Coffee', 'Tea', 'Juice', 'Milk', 'Hot Chocolate', 'Decaf', 'Water Only',
] as const
export type Beverage = typeof BEVERAGE_OPTIONS[number]

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
] as const

export type Resident = {
  id: string
  name: string
  room: string
  status: ResidentStatus
  dietType: DietType
  texture: Texture
  portionSize: PortionSize
  ensurePerDay: number
  allergies: string[]
  beverages: string[]
  birthdayMonth: string
  birthdayDay: number | null
  servingLocation: ServingLocation
  tableAssignment: string
  likes: string
  dislikes: string
  specialInstructions: string
  // ── B02: clinical fields surfaced at meal-decision points ──────────────
  // Optional so existing forms/seeds keep compiling; the resident clients
  // (residentsStore, /api/residents) normalize these with safe defaults.
  /** NPO (nil per os) hard-block flag. Non-overridable; surfaced, never edited here. */
  is_npo?: boolean
  /** Physician reason for the NPO order (e.g. pre-op, aspiration precautions). */
  npo_reason?: string
  /** Daily fluid restriction in mL (null = no restriction). */
  fluid_restriction_ml?: number | null
  /** Legacy thickened-liquid consistency label (e.g. 'Thin', 'Nectar-Thick'). */
  fluidConsistency?: string
}

// ── IDDSI 2.0 framework (food levels) mapped from legacy texture names ─────
// IDDSI food levels: 7 Regular · 6 Soft & Bite-Sized · 5 Minced & Moist ·
// 4 Pureed · 3 Liquidised. (Drink levels 0–4 are a separate scale.)
export type IddsiFoodLevel = 3 | 4 | 5 | 6 | 7

export const IDDSI_TEXTURE_LEVELS: Record<string, { level: IddsiFoodLevel; label: string }> = {
  Regular:          { level: 7, label: 'Regular' },
  'Cut-Up':         { level: 6, label: 'Soft & Bite-Sized' },
  Minced:           { level: 5, label: 'Minced & Moist' },
  'Minced & Moist': { level: 5, label: 'Minced & Moist' },
  Pureed:           { level: 4, label: 'Pureed' },
  Liquid:           { level: 3, label: 'Liquidised' },
}

/** Map a legacy texture name to its IDDSI 2.0 food level. Unknown → Regular (7). */
export function iddsiForTexture(texture: string | null | undefined): { level: IddsiFoodLevel; label: string } {
  const key = (texture ?? '').trim()
  return IDDSI_TEXTURE_LEVELS[key] ?? { level: 7, label: 'Regular' }
}

/** Short chip label, e.g. "L4 Pureed". */
export function iddsiChipLabel(texture: string | null | undefined): string {
  const { level, label } = iddsiForTexture(texture)
  return `L${level} ${label}`
}
