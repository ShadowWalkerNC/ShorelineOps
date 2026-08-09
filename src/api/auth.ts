import { api } from './client'
import type { AuthUser } from '../security/AuthContext'
import axios from 'axios'
import { tokenManager } from '../security/tokenManager'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'

export interface LoginSuccess {
  accessToken: string
  refreshToken: string
  user: AuthUser
  mfaRequired?: false
  mfaEnrollmentRequired?: false
}

export interface LoginMfaChallenge {
  mfaRequired: true
  mfaToken: string
  user: { id: string; email: string; name: string }
}

export interface LoginMfaEnroll {
  mfaEnrollmentRequired: true
  mfaToken: string
  user: { id: string; email: string; name: string }
}

export type LoginResponse = LoginSuccess | LoginMfaChallenge | LoginMfaEnroll

export interface MfaSetupBeginResponse {
  secret: string
  otpauthUrl: string
  issuer: string
  account: string
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),

  verifyMfa: (mfaToken: string, code: string) =>
    axios.post<LoginSuccess>(`${API_BASE}/auth/mfa/verify`, { mfaToken, code }),

  beginMfaSetup: (mfaToken?: string) =>
    axios.post<MfaSetupBeginResponse>(
      `${API_BASE}/auth/mfa/setup/begin`,
      { mfaToken },
      mfaToken
        ? undefined
        : { headers: { Authorization: `Bearer ${tokenManager.getAccessToken()}` } }
    ),

  confirmMfaSetup: (code: string, mfaToken?: string) =>
    axios.post<LoginSuccess | { success: true; mfaEnabled: true }>(
      `${API_BASE}/auth/mfa/setup/confirm`,
      { code, mfaToken },
      mfaToken
        ? undefined
        : { headers: { Authorization: `Bearer ${tokenManager.getAccessToken()}` } }
    ),

  disableMfa: (code: string) =>
    api.post('/auth/mfa/disable', { code }),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),

  me: () =>
    api.get<AuthUser & { mfaEnabled?: boolean }>('/auth/me'),
}
