import type { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import type { AuthRequest } from './requireAuth'

export type LicenseTier = 'community' | 'pro' | 'enterprise' | 'demo'

export function getEffectiveTier(req: Request): { tier: LicenseTier; facility: string; valid: boolean } {
  if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'test') {
    return { tier: 'demo', facility: 'Demo Evaluation Facility', valid: true }
  }

  if ((req as AuthRequest).platformAdmin) {
    return { tier: 'enterprise', facility: 'ShorelineOps Platform Administration', valid: true }
  }

  const key = (req.headers['x-shoreline-license-key'] as string) || process.env.SHORELINE_LICENSE_KEY || ''
  if (!key) {
    return { tier: 'community', facility: 'Self-Hosted Community Instance', valid: true }
  }

  try {
    const signingSecret = process.env.LICENSE_SIGNING_SECRET
    if (signingSecret && signingSecret.length >= 32 && (key.startsWith('SH_ENT_') || key.startsWith('SH_PRO_'))) {
      const isEnt = key.startsWith('SH_ENT_')
      const token = key.replace(/^SH_(ENT|PRO)_/, '')
      const [payloadPart, signaturePart] = token.split('.')
      if (!payloadPart || !signaturePart) throw new Error('Malformed license')
      const expected = crypto.createHmac('sha256', signingSecret).update(payloadPart).digest()
      const supplied = Buffer.from(signaturePart, 'base64url')
      if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
        throw new Error('Invalid license signature')
      }
      const payloadStr = Buffer.from(payloadPart, 'base64url').toString('utf-8')
      const payload = JSON.parse(payloadStr)
      const isExpired = payload.exp && new Date(payload.exp * 1000) < new Date()
      if (isExpired) {
        return { tier: 'community', facility: payload.facility || 'Expired License', valid: false }
      }
      return {
        tier: isEnt ? 'enterprise' : 'pro',
        facility: payload.facility || 'Licensed Enterprise Facility',
        valid: true,
      }
    }
  } catch {
    // fallback
  }

  return { tier: 'community', facility: 'Self-Hosted Community Instance', valid: false }
}

export function requireTier(requiredTier: 'pro' | 'enterprise') {
  return (req: Request, res: Response, next: NextFunction) => {
    const { tier, valid } = getEffectiveTier(req)

    if (tier === 'demo' || tier === 'enterprise') {
      return next()
    }

    if (tier === 'pro' && requiredTier === 'pro') {
      return next()
    }

    return res.status(402).json({
      error: 'LICENSE_TIER_REQUIRED',
      requiredTier,
      currentTier: tier,
      message: `The requested endpoint requires a ShorelineOps ${requiredTier.toUpperCase()} SaaS license key. Visit https://shoreline-marketing.onrender.com/pricing for licensing.`,
    })
  }
}
