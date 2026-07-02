// ── Meal slot labels ─────────────────────────────────────────────────────────
export type MealSlot = 'breakfast' | 'morningSnack' | 'lunch' | 'afternoonSnack' | 'dinner'

export const MEAL_SLOTS: MealSlot[] = [
  'breakfast',
  'morningSnack',
  'lunch',
  'afternoonSnack',
  'dinner',
]

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  morningSnack: 'Morning Snack',
  lunch: 'Lunch',
  afternoonSnack: 'Afternoon Snack',
  dinner: 'Dinner',
}

// ── Days ──────────────────────────────────────────────────────────────────────
export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

// ── Core data types ───────────────────────────────────────────────────────────

/**
 * A single item (dish) that can appear in a meal slot.
 * Items can be reused across days/weeks.
 */
export type MenuItem = {
  id: string
  name: string
  /** Optional plain-text notes (e.g. "Contains nuts", "Puréed option available") */
  notes?: string
  /** Whether this item has an available texture-modified version */
  textureModified: boolean
}

/**
 * One meal slot on one day: an ordered list of menu item IDs.
 * We store IDs so items can be looked up from the items map.
 */
export type MealEntry = {
  itemIds: string[]
  /** Free-text override label shown instead of item names when set */
  label?: string
}

/** All meal slots for one day */
export type DayMenu = Record<MealSlot, MealEntry>

/**
 * A named weekly cycle menu (e.g. "Week A", "Summer Menu").
 * days is keyed by DayOfWeek.
 */
export type MenuWeek = {
  id: string
  name: string
  /** ISO date string of the first day this week cycle was active */
  effectiveFrom?: string
  days: Record<DayOfWeek, DayMenu>
  /** True = this is the currently active cycle */
  active: boolean
  createdAt: string
  updatedAt: string
}

// ── Helper: build an empty week ───────────────────────────────────────────────
export function emptyDayMenu(): DayMenu {
  return Object.fromEntries(
    MEAL_SLOTS.map((slot) => [slot, { itemIds: [] }])
  ) as DayMenu
}

export function emptyWeek(name: string): Omit<MenuWeek, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    active: false,
    days: Object.fromEntries(
      DAYS_OF_WEEK.map((day) => [day, emptyDayMenu()])
    ) as Record<DayOfWeek, DayMenu>,
  }
}
