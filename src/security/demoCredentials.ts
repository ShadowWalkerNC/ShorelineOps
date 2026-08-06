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
    name: 'Alex Rivera',
    email: 'admin@shoreline.demo',
    password: 'Admin1234!',
    role: 'admin',
    mfaVerified: true,
  },
  {
    id: 'demo-manager-1',
    name: 'Morgan Ellis',
    email: 'manager@shoreline.demo',
    password: 'Manager1234!',
    role: 'manager',
    mfaVerified: true,
  },
  {
    id: 'demo-staff-1',
    name: 'Staff User',
    email: 'staff@shoreline.demo',
    password: 'Staff1234!',
    role: 'staff',
    mfaVerified: true,
  },
  {
    id: 'demo-readonly-1',
    name: 'Read-Only User',
    email: 'readonly@shoreline.demo',
    password: 'Readonly1234!',
    role: 'readonly',
    mfaVerified: true,
  },
]

export const DEMO_ACCOUNTS = DEMO_USERS.map((u) => ({
  role: u.role,
  email: u.email,
  password: u.password,
}))
