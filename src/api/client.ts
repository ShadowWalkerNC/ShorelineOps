/**
 * Axios-based API client.
 * Automatically attaches the JWT access token and handles 401s
 * by attempting a silent refresh before retrying the original request.
 */
import axios from 'axios'
import { tokenManager } from '../security/tokenManager'
import { LicenseManager } from '../security/license'

export const api = axios.create({
  // Production uses the unified origin. Vite proxies /api during local work.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = tokenManager.getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  const licenseKey = LicenseManager.getLicenseKey()
  if (licenseKey) config.headers['X-Shoreline-License-Key'] = licenseKey
  return config
})

// On 401, try silent refresh once
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        await tokenManager.refresh()
        original.headers.Authorization = `Bearer ${tokenManager.getAccessToken()}`
        return api(original)
      } catch {
        tokenManager.clear()
        window.location.href = `${import.meta.env.BASE_URL}login`
      }
    }
    return Promise.reject(error)
  }
)
