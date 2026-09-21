"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEffectiveTier = getEffectiveTier;
exports.requireTier = requireTier;
const crypto_1 = __importDefault(require("crypto"));
function getEffectiveTier(req) {
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'test') {
        return { tier: 'demo', facility: 'Demo Evaluation Facility', valid: true };
    }
    if (req.platformAdmin) {
        return { tier: 'enterprise', facility: 'ShorelineOps Platform Administration', valid: true };
    }
    const key = req.headers['x-shoreline-license-key'] || process.env.SHORELINE_LICENSE_KEY || '';
    if (!key) {
        return { tier: 'community', facility: 'Self-Hosted Community Instance', valid: true };
    }
    try {
        const signingSecret = process.env.LICENSE_SIGNING_SECRET;
        if (signingSecret && signingSecret.length >= 32 && (key.startsWith('SH_ENT_') || key.startsWith('SH_PRO_'))) {
            const isEnt = key.startsWith('SH_ENT_');
            const token = key.replace(/^SH_(ENT|PRO)_/, '');
            const [payloadPart, signaturePart] = token.split('.');
            if (!payloadPart || !signaturePart)
                throw new Error('Malformed license');
            const expected = crypto_1.default.createHmac('sha256', signingSecret).update(payloadPart).digest();
            const supplied = Buffer.from(signaturePart, 'base64url');
            if (expected.length !== supplied.length || !crypto_1.default.timingSafeEqual(expected, supplied)) {
                throw new Error('Invalid license signature');
            }
            const payloadStr = Buffer.from(payloadPart, 'base64url').toString('utf-8');
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
    return { tier: 'community', facility: 'Self-Hosted Community Instance', valid: false };
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
