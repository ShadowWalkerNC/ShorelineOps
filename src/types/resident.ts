export type ResidentStatus = 'Active' | 'Hospital' | 'LOA' | 'Passed Away'
export type Texture = 'Regular' | 'Minced' | 'Minced & Moist' | 'Pureed' | 'Cut-Up' | 'Liquid'
export type PortionSize = 'Regular' | 'Small' | 'Large'
export type ServingLocation = 'Dining Room' | 'Room' | 'Assisted Living' | 'Memory Care'

export const DIET_TYPES = [
  'Regular', 'Diabetic', 'Cardiac', 'Renal', 'Low Sodium', 'Mechanical Soft',
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
}
