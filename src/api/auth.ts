import { api } from './client'
import type { AuthUser } from '../security/AuthContext'

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),

  me: () =>
    api.get<AuthUser>('/auth/me'),
}
