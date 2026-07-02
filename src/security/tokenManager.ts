/**
 * Token manager — stores access token in memory only (never localStorage).
 * Refresh token is stored in sessionStorage so it survives page reload
 * within the same browser tab, but not across tabs or after close.
 *
 * HIPAA: PHI-bearing JWTs must not persist in localStorage.
 */
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'

let _accessToken: string | null = null

export const tokenManager = {
  getAccessToken: () => _accessToken,

  set: (accessToken: string, refreshToken: string) => {
    _accessToken = accessToken
    sessionStorage.setItem('_rt', refreshToken)
  },

  refresh: async (): Promise<void> => {
    const refreshToken = sessionStorage.getItem('_rt')
    if (!refreshToken) throw new Error('No refresh token')
    const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken })
    _accessToken = data.accessToken
    sessionStorage.setItem('_rt', data.refreshToken)
  },

  clear: () => {
    _accessToken = null
    sessionStorage.removeItem('_rt')
  },

  hasRefreshToken: () => !!sessionStorage.getItem('_rt'),
}
