"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEffectiveTier = getEffectiveTier;
exports.requireTier = requireTier;
function getEffectiveTier(req) {
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'test') {
        return { tier: 'demo', facility: 'Demo Evaluation Facility', valid: true };
    }
    const key = req.headers['x-shoreline-license-key'] || process.env.SHORELINE_LICENSE_KEY || '';
    if (!key) {
        return { tier: 'community', facility: 'Self-Hosted Community Instance', valid: true };
    }
    try {
        if (key.startsWith('SH_ENT_') || key.startsWith('SH_PRO_')) {
            const isEnt = key.startsWith('SH_ENT_');
            const payloadStr = Buffer.from(key.replace(/^SH_(ENT|PRO)_/, ''), 'base64').toString('utf-8');
            const payload = JSON.parse(payloadStr);
            const isExpired = payload.exp && new Date(payload.exp * 1000) < new Date();
            if (isExpired) {
                return { tier: 'community', facility: payload.facility || 'Expired License', valid: false };
            }
            return {
                tier: isEnt ? 'enterprise' : 'pro',
                facility: payload.facility || 'Licensed Enterprise Facility',
                valid: true,
            };
        }
    }
    catch {
        // fallback
    }
    return { tier: 'community', facility: 'Self-Hosted Community Instance', valid: true };
}
function requireTier(requiredTier) {
    return (req, res, next) => {
        const { tier, valid } = getEffectiveTier(req);
        if (tier === 'demo' || tier === 'enterprise') {
            return next();
        }
        if (tier === 'pro' && requiredTier === 'pro') {
            return next();
        }
        return res.status(402).json({
            error: 'LICENSE_TIER_REQUIRED',
            requiredTier,
            currentTier: tier,
            message: `The requested endpoint requires a ShorelineOps ${requiredTier.toUpperCase()} SaaS license key. Visit https://shoreline-marketing.onrender.com/pricing for licensing.`,
        });
    };
}
