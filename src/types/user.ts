export type StaffRole =
  | 'admin'
  | 'supervisor'
  | 'manager'
  | 'cook'
  | 'server'
  | 'nurse'
  | 'notetaker'

export type User = {
  username: string
  displayName: string
  role: StaffRole
  active: boolean
}
