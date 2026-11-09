import type { Queryable } from '../db/pool'

const SENSITIVE = /token|password|secret|cookie|authorization/i

function scrub(meta: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!meta) return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE.test(k)) continue
    out[k] = typeof v === 'string' ? v.slice(0, 300) : v
  }
  return out
}

// CP-12 audit for account actions. Never stores tokens or passwords.
// Keep audit writes on the caller's transaction when one is supplied.
export async function audit(
  pool: Queryable,
  action: string,
  opts: { accountId?: string | null; ip?: string | null; userAgent?: string | null; meta?: Record<string, unknown> }
): Promise<void> {
    await pool.query(
      'INSERT INTO control_audit_log (account_id, action, ip, user_agent, meta) VALUES ($1, $2, $3, $4, $5)',
      [
        opts.accountId ?? null,
        action,
        (opts.ip ?? null)?.slice(0, 100) ?? null,
        (opts.userAgent ?? null)?.slice(0, 300) ?? null,
        scrub(opts.meta),
      ]
    )
}
