/**
 * Safely parse a quantity string like "1.5", "3/4", or "1 1/2" into a number.
 * Replaces eval() for recipe/production scaling.
 */
export function parseQuantity(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null

  // Mixed number: "1 1/2" or "1-1/2"
  const mixed = s.match(/^(\d+)\s+[-\s]?\s*(\d+)\s*\/\s*(\d+)$/)
  if (mixed) {
    const whole = Number(mixed[1])
    const num = Number(mixed[2])
    const den = Number(mixed[3])
    if (!den || !Number.isFinite(whole) || !Number.isFinite(num)) return null
    return whole + num / den
  }

  // Simple fraction: "3/4"
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (frac) {
    const num = Number(frac[1])
    const den = Number(frac[2])
    if (!den || !Number.isFinite(num)) return null
    return num / den
  }

  // Decimal / integer
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
