/**
 * ============================================================
 * SESSION TIMEOUT — Deprecated standalone hook
 * ============================================================
 * Session timeout is now managed directly inside AuthProvider
 * in AuthContext.tsx for mandatory enforcement.
 *
 * This file is retained for any legacy imports but is a no-op.
 * Do not use this hook directly — use useAuth() instead.
 * The AuthProvider wires timeout, warning, and key clearing
 * automatically for all authenticated sessions.
 * ============================================================
 */

// No-op export retained for import compatibility
export function useSessionTimeout(
  _onTimeout: () => void,
  _userId?: string
): void {
  // Timeout is now mandatory and managed in AuthProvider.
  // This hook is intentionally a no-op.
}
