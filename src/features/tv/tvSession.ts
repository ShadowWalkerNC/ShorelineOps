/**
 * Wall-display session.
 *
 * TVs pair once (see TvSetupPage) and keep the display refresh token in
 * localStorage so the board survives reboots without re-pairing. The token
 * belongs to the reserved read-only TV Display identity and the server
 * denies it on every non-TV route, so a stolen box yields at most the
 * counts-only ops feed and the menu board — both non-PHI. Revoke from the
 * web app by disabling the TV Display user or bumping its auth_version.
 */
import axios from 'axios'
import { tokenManager } from '@/security/tokenManager'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const TV_RT_KEY = 'shoreline:tv-rt'
const TV_FACILITY_KEY = 'shoreline:tv-facility'
// NOTE: must match tokenManager's sessionStorage key.
const MANAGER_RT_KEY = '_rt'

export const tvSession = {
  saveDisplayTokens(accessToken: string, refreshToken: string, facilityId: string): void {
    tokenManager.set(accessToken, refreshToken)
    try {
      localStorage.setItem(TV_RT_KEY, refreshToken)
      localStorage.setItem(TV_FACILITY_KEY, facilityId)
    } catch {
      /* private-mode WebView: session works until the page unloads */
    }
  },

  /** Persist rotations performed by the shared api client back to the TV store. */
  mirrorRefreshToken(): void {
    try {
      const current = sessionStorage.getItem(MANAGER_RT_KEY)
      if (current) localStorage.setItem(TV_RT_KEY, current)
    } catch {
      /* ignore */
    }
  },

  /** Restore a display session after boot. False when the TV must (re-)pair. */
  async restore(): Promise<boolean> {
    if (tokenManager.hasRefreshToken()) {
      try {
        await tokenManager.refresh()
        tvSession.mirrorRefreshToken()
        return true
      } catch {
        /* fall through to the TV store */
      }
    }
    let stored: string | null = null
    try {
      stored = localStorage.getItem(TV_RT_KEY)
    } catch {
      return false
    }
    if (!stored) return false
    try {
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: stored })
      tokenManager.set(data.accessToken, data.refreshToken)
      tvSession.mirrorRefreshToken()
      return true
    } catch {
      try {
        localStorage.removeItem(TV_RT_KEY)
      } catch {
        /* ignore */
      }
      return false
    }
  },

  clear(): void {
    tokenManager.clear()
    try {
      localStorage.removeItem(TV_RT_KEY)
      localStorage.removeItem(TV_FACILITY_KEY)
    } catch {
      /* ignore */
    }
  },

  facilityId(): string | null {
    try {
      return localStorage.getItem(TV_FACILITY_KEY)
    } catch {
      return null
    }
  },
}
