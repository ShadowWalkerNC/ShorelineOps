/**
 * Demo-only credentials. Only imported when VITE_DEMO_MODE=true.
 * Never ship this path in a production PHI deployment.
 */
import type { UserRole } from '../types/roles'

export interface DemoUser {
  id: string
  name: string
  email: string
  role: UserRole
  mfaVerified: boolean
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
  },
]

export const DEMO_ACCOUNTS = DEMO_USERS.map((u) => ({
  role: u.role,
  email: u.email,
  password: u.password,
}))
