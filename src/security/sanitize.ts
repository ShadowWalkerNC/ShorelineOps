/**
 * PHI/PII input sanitization utility.
 * Strips HTML tags and dangerous characters from any string before
 * it is rendered or sent to the API. Required for HIPAA / SOC 2 / ISO 27002.
 */
export function sanitizeInput(value: string): string {
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
}

/**
 * Validates that a string contains no script injection patterns.
 * Returns true if safe, false if suspicious.
 */
export function isSafeInput(value: string): boolean {
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:text\/html/i,
    /vbscript:/i,
  ]
  return !dangerousPatterns.some((pattern) => pattern.test(value))
}

/**
 * Never store PHI in localStorage. Use this for any non-sensitive
 * preference data only.
 */
export const secureStorage = {
  set: (key: string, value: string) => {
    // Only allow non-PHI keys
    const allowedKeys = ['theme', 'sidebarCollapsed', 'lastRoute']
    if (!allowedKeys.includes(key)) {
      console.warn(`[Security] Blocked localStorage write for key: ${key}`)
      return
    }
    localStorage.setItem(key, value)
  },
  get: (key: string): string | null => localStorage.getItem(key),
  remove: (key: string) => localStorage.removeItem(key),
}
