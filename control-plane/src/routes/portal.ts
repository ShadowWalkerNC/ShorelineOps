import { Router } from 'express'
import { requireSession, asyncRoute, db } from '../security/middleware'
import { gmailStatus } from '../email/gmail'
import { facilityStatus, Plan } from '../activation'
import { transaction } from '../db/pool'
import { audit } from '../security/audit'

export const portalRouter = Router()

portalRouter.get('/status', requireSession, asyncRoute(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  return res.json({
    email: req.session?.email,
    emailVerified: req.session?.verified,
    billing: { implemented: false },
    provisioning: await facilityStatus(db(req), req.session!.accountId),
    sender: { configured: gmailStatus().configured },
  })
}))

// Records intent only. No public route can create resources or activate plans.
portalRouter.post('/activation-request', requireSession, asyncRoute(async (req, res) => {
  if (!req.session!.verified) return res.status(403).json({ error: 'VERIFIED_ACCOUNT_REQUIRED' })
  const parsed = Plan.safeParse(req.body?.plan)
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_PLAN' })
  const accepted = await transaction(db(req), async client => {
    const account = await client.query('SELECT email_verified_at FROM accounts WHERE id = $1 FOR UPDATE', [req.session!.accountId])
    if (!account.rows[0]?.email_verified_at) return false
    const deployed = await client.query('SELECT account_id FROM facility_deployments WHERE account_id = $1', [req.session!.accountId])
    if (deployed.rowCount) return false
    await client.query(`INSERT INTO activation_requests(account_id,plan) VALUES($1,$2)
      ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,requested_at=now()`, [req.session!.accountId, parsed.data])
    await audit(client, 'FACILITY_ACTIVATION_REQUESTED', { accountId: req.session!.accountId, meta: { plan: parsed.data } })
    return true
  })
  return res.status(accepted ? 202 : 409).json(accepted ? { status: 'awaiting-owner-activation', automaticProvisioning: false } : { error: 'ACTIVATION_REQUEST_CONFLICT' })
}))
