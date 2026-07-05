/**
 * ============================================================
 * TOKEN MANAGER — Local Session Token (No Backend)
 * ============================================================
 * The local branch has no backend API, no JWTs, and no refresh
 * tokens. Authentication is handled entirely by AuthContext.
 *
 * This module provides a simple in-tab session token
 * (crypto.randomUUID stored in sessionStorage) used only as
 * a correlation ID for the sessionStore tracker.
 *
 * No network calls. No axios. No credentials transmitted.
 * ============================================================
 */

const SESSION_TOKEN_KEY = 'sl_session_token'

function generate(): string {
  const token = crypto.randomUUID()
  sessionStorage.setItem(SESSION_TOKEN_KEY, token)
  return token
}

function get(): string | null {
  return sessionStorage.getItem(SESSION_TOKEN_KEY)
}

function clear(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY)
}

function getOrGenerate(): string {
  return get() ?? generate()
}

export const tokenManager = {
  generate,
  get,
  clear,
  getOrGenerate,
}
