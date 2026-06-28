export type ResidentStatus = 'Active' | 'Hospital' | 'LOA' | 'Passed Away'
export type Texture = 'Regular' | 'Minced' | 'Minced & Moist' | 'Pureed' | 'Liquid'
export type PortionSize = 'Regular' | 'Small' | 'Large'

export type Resident = {
  id: string
  name: string
  room: string
  status: ResidentStatus
  dietType: string
  texture: Texture
  portionSize: PortionSize
  ensurePerDay: number
  allergies: string[]
  beveragePrefs: string[]
  birthdayMonth?: string
  birthdayDay?: number
  servingLocation: string
  tableAssignment?: string
  likes?: string
  dislikes?: string
  dietaryCustom?: string
}
