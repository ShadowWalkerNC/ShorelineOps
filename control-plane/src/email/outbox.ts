import type { Pool } from 'pg'
import type { Queryable } from '../db/pool'
import { encryptOutbox, decryptOutbox } from '../security/outboxCrypto'
import { gmailStatus, sendViaGmail } from './gmail'

export type EmailKind = 'verify' | 'reset'
const MAX_ATTEMPTS = 10

export async function enqueueEmail(
  pool: Queryable,
  opts: { accountId: string | null; to: string; kind: EmailKind; subject: string; text: string }
): Promise<{ queued: boolean; unavailable?: boolean }> {
  try {
    const payloadEnc = encryptOutbox({ to: opts.to, subject: opts.subject, text: opts.text })
    await pool.query('INSERT INTO email_outbox (account_id, to_email, kind, payload_enc) VALUES ($1, $2, $3, $4)', [
      opts.accountId,
      opts.to,
      opts.kind,
      payloadEnc,
    ])
    return { queued: true }
  } catch (err) {
    if ((err as { code?: string }).code === 'OUTBOX_KEY_UNCONFIGURED') return { queued: false, unavailable: true }
    throw err
  }
}

// Each claim is one atomic statement. Expired claims can be recovered after a crash.
// Gmail delivery is at least once. Verification/reset tokens remain single use.
export async function dispatchDue(pool: Pool, batch = 5): Promise<{ dispatched: number; unavailable: boolean }> {
  if (!gmailStatus().configured) return { dispatched: 0, unavailable: true }
  await pool.query(`UPDATE email_outbox SET status = 'dead', payload_enc = '', last_error = 'expired'
    WHERE status IN ('queued', 'failed', 'sending')
    AND (claimed_until IS NULL OR claimed_until < now())
    AND (attempts >= $1 OR created_at < now() - CASE WHEN kind = 'reset' THEN interval '1 hour' ELSE interval '24 hours' END)`, [MAX_ATTEMPTS])
  let dispatched = 0
  for (let index = 0; index < batch; index++) {
    const { rows } = await pool.query(`UPDATE email_outbox SET status = 'sending',
      claim_token = gen_random_uuid(), claimed_until = now() + interval '90 seconds', attempts = attempts + 1
      WHERE id = (SELECT id FROM email_outbox WHERE attempts < $1 AND
        ((status IN ('queued', 'failed') AND next_retry_at <= now()) OR
         (status = 'sending' AND (claimed_until IS NULL OR claimed_until < now())))
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING id, payload_enc, attempts, claim_token`, [MAX_ATTEMPTS])
    const row = rows[0] as { id: string; payload_enc: string; attempts: number; claim_token: string } | undefined
    if (!row) break
    try {
      const payload = decryptOutbox(row.payload_enc)
      const result = await sendViaGmail(payload.to, payload.subject, payload.text)
      if (result.ok) {
        const sent = await pool.query(`UPDATE email_outbox SET status = 'sent', sent_at = now(), payload_enc = '',
          claimed_until = NULL, claim_token = NULL WHERE id = $1 AND claim_token = $2 AND status = 'sending'`, [row.id, row.claim_token])
        dispatched += sent.rowCount ?? 0
      } else if (result.unavailable) {
        await pool.query(`UPDATE email_outbox SET status = 'queued', claimed_until = NULL, last_error = 'provider_unconfigured' WHERE id = $1 AND claim_token = $2`, [
          row.id, row.claim_token,
        ])
        return { dispatched, unavailable: true }
      } else {
        throw new Error(result.error ?? 'send_failed')
      }
    } catch (err) {
      const attempts = row.attempts
      const dead = attempts >= MAX_ATTEMPTS
      const backoffMin = Math.min(2 ** attempts, 240)
      await pool.query(
        `UPDATE email_outbox SET status = $2, attempts = $3,
         next_retry_at = now() + ($4 || ' minutes')::interval, last_error = $5, claimed_until = NULL
         WHERE id = $1 AND claim_token = $6 AND status = 'sending'`,
        [row.id, dead ? 'dead' : 'failed', attempts, String(backoffMin), 'delivery_failed', row.claim_token]
      )
    }
  }
  return { dispatched, unavailable: false }
}
