/**
 * Prevent open redirects via protocol-relative or absolute URLs
 * (mitigates react-router open-redirect class issues for post-login navigation).
 */
export function safeRedirectPath(path: unknown, fallback = '/'): string {
  if (typeof path !== 'string' || !path) return fallback
  // Must be a same-app relative path: starts with single /, not //, no backslashes, no scheme
  if (!path.startsWith('/')) return fallback
  if (path.startsWith('//')) return fallback
  if (path.includes('\\')) return fallback
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return fallback
  return path
}
