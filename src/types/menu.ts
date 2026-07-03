// ── Meal slots ───────────────────────────────────────────────────────────────
export type MealSlot =
  | 'breakfast'
  | 'lunchOpt1Meat' | 'lunchOpt1Veggie' | 'lunchOpt1Starch'
  | 'lunchOpt2Meat' | 'lunchOpt2Veggie' | 'lunchOpt2Starch'
  | 'lunchDessert'
  | 'dinnerOpt1Meat' | 'dinnerOpt1Veggie' | 'dinnerOpt1Starch'
  | 'dinnerOpt2Meat' | 'dinnerOpt2Veggie' | 'dinnerOpt2Starch'
  | 'dinnerDessert'

export const MEAL_SLOTS: MealSlot[] = [
  'breakfast',
  'lunchOpt1Meat', 'lunchOpt1Veggie', 'lunchOpt1Starch',
  'lunchOpt2Meat', 'lunchOpt2Veggie', 'lunchOpt2Starch',
  'lunchDessert',
  'dinnerOpt1Meat', 'dinnerOpt1Veggie', 'dinnerOpt1Starch',
  'dinnerOpt2Meat', 'dinnerOpt2Veggie', 'dinnerOpt2Starch',
  'dinnerDessert',
]

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast:        'Breakfast',
  lunchOpt1Meat:    'Meat',
  lunchOpt1Veggie:  'Veggie',
  lunchOpt1Starch:  'Starch',
  lunchOpt2Meat:    'Meat',
  lunchOpt2Veggie:  'Veggie',
  lunchOpt2Starch:  'Starch',
  lunchDessert:     'Dessert',
  dinnerOpt1Meat:   'Meat',
  dinnerOpt1Veggie: 'Veggie',
  dinnerOpt1Starch: 'Starch',
  dinnerOpt2Meat:   'Meat',
  dinnerOpt2Veggie: 'Veggie',
  dinnerOpt2Starch: 'Starch',
  dinnerDessert:    'Dessert',
}

// Groups used by the UI to render structured meal cards
export type MealGroup = {
  id: string
  label: string
  options?: {
    label: string
    slots: { slot: MealSlot; label: string }[]
  }[]
  singleSlot?: MealSlot
  dessertSlot?: MealSlot
}

export const MEAL_GROUPS: MealGroup[] = [
  {
    id: 'breakfast',
    label: 'Breakfast',
    singleSlot: 'breakfast',
  },
  {
    id: 'lunch',
    label: 'Lunch',
    options: [
      {
        label: 'Option 1',
        slots: [
          { slot: 'lunchOpt1Meat',   label: 'Meat' },
          { slot: 'lunchOpt1Veggie', label: 'Veggie' },
          { slot: 'lunchOpt1Starch', label: 'Starch' },
        ],
      },
      {
        label: 'Option 2',
        slots: [
          { slot: 'lunchOpt2Meat',   label: 'Meat' },
          { slot: 'lunchOpt2Veggie', label: 'Veggie' },
          { slot: 'lunchOpt2Starch', label: 'Starch' },
        ],
      },
    ],
    dessertSlot: 'lunchDessert',
  },
  {
    id: 'dinner',
    label: 'Dinner',
    options: [
      {
        label: 'Option 1',
        slots: [
          { slot: 'dinnerOpt1Meat',   label: 'Meat' },
          { slot: 'dinnerOpt1Veggie', label: 'Veggie' },
          { slot: 'dinnerOpt1Starch', label: 'Starch' },
        ],
      },
      {
        label: 'Option 2',
        slots: [
          { slot: 'dinnerOpt2Meat',   label: 'Meat' },
          { slot: 'dinnerOpt2Veggie', label: 'Veggie' },
          { slot: 'dinnerOpt2Starch', label: 'Starch' },
        ],
      },
    ],
    dessertSlot: 'dinnerDessert',
  },
]

// ── Days ──────────────────────────────────────────────────────────────────────
export const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

// ── Core data types ───────────────────────────────────────────────────────────
export type MenuItem = {
  id: string
  name: string
  notes?: string
  textureModified: boolean
}

export type MealEntry = {
  itemIds: string[]
  label?: string
}

export type DayMenu = Record<MealSlot, MealEntry>

export type MenuWeek = {
  id: string
  name: string
  effectiveFrom?: string
  days: Record<DayOfWeek, DayMenu>
  active: boolean
  createdAt: string
  updatedAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function emptyDayMenu(): DayMenu {
  return Object.fromEntries(
    MEAL_SLOTS.map(slot => [slot, { itemIds: [] }])
  ) as unknown as DayMenu
}

export function emptyWeek(name: string): Omit<MenuWeek, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    active: false,
    days: Object.fromEntries(
      DAYS_OF_WEEK.map(day => [day, emptyDayMenu()])
    ) as unknown as Record<DayOfWeek, DayMenu>,
  }
}
