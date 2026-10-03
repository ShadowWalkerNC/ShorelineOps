/**
 * Axios-based API client.
 *
 * Live builds attach the JWT access token (plus license key) and handle 401s
 * by attempting a silent refresh before retrying the original request.
 *
 * Demo builds (VITE_DEMO_MODE=true) never read or attach live credentials,
 * never issue network requests (rejecting adapter installed below), and never
 * refresh or redirect on 401. Unsupported API-backed features reject with an
 * honest DEMO_API_UNAVAILABLE error; stores fall back to their local adapters.
 */
import axios from 'axios'
import type { AxiosAdapter, AxiosRequestConfig } from 'axios'
import { tokenManager } from '../security/tokenManager'
import { LicenseManager } from '../security/license'
import {
  applyRequestPolicy,
  createDemoUnavailableError,
  handleResponseError,
  isDemoBuild,
} from '../../server/src/apiClientPolicy'

const isDemo = isDemoBuild(import.meta.env)

export const api = axios.create({
  // Production uses the unified origin. Vite proxies /api during local work.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Demo builds must not reach the network at all: reject every request before
// dispatch with an explicit unavailable error (no fake successes).
if (isDemo) {
  const demoAdapter: AxiosAdapter = async (config) => {
    throw createDemoUnavailableError({ method: config?.method, url: config?.url })
  }
  api.defaults.adapter = demoAdapter
}

// Attach access token to every request (live only; demo returns untouched)
api.interceptors.request.use((config) =>
  applyRequestPolicy(config, isDemo, {
    getAccessToken: () => tokenManager.getAccessToken(),
    getLicenseKey: () => LicenseManager.getLicenseKey(),
  })
)

// On 401, try silent refresh once (live only; demo always rejects untouched)
api.interceptors.response.use(
  (res) => res,
  async (error) =>
    handleResponseError(error, isDemo, {
      refreshAccessToken: () => tokenManager.refresh(),
      getAccessToken: () => tokenManager.getAccessToken(),
      clearSession: () => tokenManager.clear(),
      redirectToLogin: () => {
        window.location.href = `${import.meta.env.BASE_URL}login`
      },
      retryRequest: (original) => api(original as unknown as AxiosRequestConfig),
    })
)
