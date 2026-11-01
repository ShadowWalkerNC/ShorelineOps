/**
 * Demo-only credentials. Only imported when VITE_DEMO_MODE=true or in local dev.
 * Never ship this path in a production PHI deployment.
 */
import type { UserRole } from '../types/roles'

export interface DemoUser {
  id: string
  name: string
  email: string
  role: UserRole
  mfaVerified: boolean
  facilityId: string
  platformAdmin: boolean
  password: string
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: 'demo-admin-1',
    name: 'Shoreline Demo Admin',
    email: 'admin@shoreline.demo',
    password: 'Admin1234!',
    role: 'admin',
    mfaVerified: true,
    facilityId: 'demo',
    platformAdmin: true,
  },
]

export const DEMO_ACCOUNTS = DEMO_USERS.map((u) => ({
  role: u.role,
  email: u.email,
  password: u.password,
}))

export const DEV_SEED_ACCOUNTS = [
  { role: 'admin', email: 'admin@shoreline.local', password: 'admin123' },
  { role: 'manager', email: 'chef@shoreline.local', password: 'admin123' },
  { role: 'dietitian', email: 'rdn@shoreline.local', password: 'admin123' },
  { role: 'dietary', email: 'cook@shoreline.local', password: 'admin123' },
  { role: 'frontdesk', email: 'frontdesk@shoreline.local', password: 'admin123' },
]
