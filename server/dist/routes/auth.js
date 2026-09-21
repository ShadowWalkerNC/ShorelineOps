"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const OTPAuth = __importStar(require("otpauth"));
const pool_1 = require("../db/pool");
const requireAuth_1 = require("../middleware/requireAuth");
exports.authRouter = (0, express_1.Router)();
const JWT_EXPIRES = (process.env.JWT_EXPIRES_IN ?? '15m');
const REFRESH_EXPIRES_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 7);
const MFA_PENDING_EXPIRES = '5m';
const ISSUER = process.env.MFA_ISSUER || 'ShorelineOps';
function makeTokens(userId, role, mfaVerified) {
    const accessToken = jsonwebtoken_1.default.sign({ sub: userId, role, mfa: mfaVerified, purpose: 'access' }, (0, requireAuth_1.getJwtSecret)(), { expiresIn: JWT_EXPIRES, audience: requireAuth_1.ACCESS_TOKEN_AUDIENCE, algorithm: 'HS256' });
    const refreshToken = crypto_1.default.randomBytes(48).toString('hex');
    return { accessToken, refreshToken };
}
function makeMfaPendingToken(userId, purpose) {
    return jsonwebtoken_1.default.sign({ sub: userId, purpose }, (0, requireAuth_1.getJwtSecret)(), { expiresIn: MFA_PENDING_EXPIRES, audience: requireAuth_1.MFA_TOKEN_AUDIENCE, algorithm: 'HS256' });
}
function verifyMfaPendingToken(token, purpose) {
    try {
        const payload = jsonwebtoken_1.default.verify(token, (0, requireAuth_1.getJwtSecret)(), {
            algorithms: ['HS256'], audience: requireAuth_1.MFA_TOKEN_AUDIENCE,
        });
        if (typeof payload === 'string' || typeof payload.sub !== 'string' ||
            !payload.sub.trim() || payload.purpose !== purpose || typeof payload.exp !== 'number') {
            throw new Error('Invalid MFA claims');
        }
        return payload.sub;
    }
    catch {
        throw Object.assign(new Error('Invalid MFA session'), { status: 401 });
    }
}
function asApiRole(role) {
    return requireAuth_1.API_ROLES.includes(role) ? role : 'readonly';
}
function totpFromSecret(secretBase32) {
    return new OTPAuth.TOTP({
        issuer: ISSUER,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secretBase32),
    });
}
function verifyTotp(secretBase32, code) {
    const delta = totpFromSecret(secretBase32).validate({ token: code, window: 1 });
    return delta !== null;
}
async function isMfaRequiredGlobally() {
    try {
        const { rows } = await pool_1.pool.query('SELECT mfa_required FROM system_settings WHERE id = 1');
        return !!rows[0]?.mfa_required;
    }
    catch {
        return false;
    }
}
async function issueSession(user, mfaVerified) {
    const role = asApiRole(user.role);
    const { accessToken, refreshToken } = makeTokens(user.id, role, mfaVerified);
    const tokenHash = crypto_1.default.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 86400_000);
    await pool_1.pool.query(`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`, [crypto_1.default.randomUUID(), user.id, tokenHash, expiresAt.toISOString()]);
    await pool_1.pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);
    await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
     VALUES ('LOGIN', $1, 'auth', 'success', $2)`, [user.id, JSON.stringify({ mfaVerified })]);
    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role,
            mfaVerified,
        },
    };
}
// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
exports.authRouter.post('/login', async (req, res, next) => {
    try {
        const { email, password } = zod_1.z.object({
            email: zod_1.z.string().email(),
            password: zod_1.z.string().min(1),
        }).parse(req.body);
        const { rows } = await pool_1.pool.query('SELECT * FROM users WHERE email = $1 AND active = true', [email.toLowerCase()]);
        const user = rows[0];
        const passwordMatch = user
            ? await bcryptjs_1.default.compare(password, user.password)
            : await bcryptjs_1.default.compare(password, '$2a$12$invalidhashfortimingprotection000000');
        if (!user || !passwordMatch) {
            await pool_1.pool.query(`INSERT INTO audit_log (action, resource_type, outcome, details)
         VALUES ('LOGIN', 'auth', 'failure', $1)`, [JSON.stringify({ email })]);
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        const globalMfa = await isMfaRequiredGlobally();
        const userMfaEnabled = !!user.mfa_enabled && !!user.mfa_secret;
        if (userMfaEnabled) {
            const mfaToken = makeMfaPendingToken(user.id, 'mfa_verify');
            return res.json({
                mfaRequired: true,
                mfaToken,
                user: { id: user.id, email: user.email, name: user.name },
            });
        }
        if (globalMfa && !userMfaEnabled) {
            const mfaToken = makeMfaPendingToken(user.id, 'mfa_enroll');
            return res.json({
                mfaEnrollmentRequired: true,
                mfaToken,
                user: { id: user.id, email: user.email, name: user.name },
            });
        }
        res.json(await issueSession(user, false));
    }
    catch (err) {
        next(err);
    }
});
// ─────────────────────────────────────────────
// POST /api/auth/mfa/verify — complete login with TOTP
// ─────────────────────────────────────────────
exports.authRouter.post('/mfa/verify', async (req, res, next) => {
    try {
        const { mfaToken, code } = zod_1.z.object({
            mfaToken: zod_1.z.string().min(1),
            code: zod_1.z.string().regex(/^\d{6}$/),
        }).parse(req.body);
        const userId = verifyMfaPendingToken(mfaToken, 'mfa_verify');
        const { rows } = await pool_1.pool.query('SELECT * FROM users WHERE id = $1 AND active = true', [userId]);
        const user = rows[0];
        if (!user?.mfa_secret || !user.mfa_enabled) {
            return res.status(400).json({ error: 'MFA is not enabled for this account.' });
        }
        if (!verifyTotp(user.mfa_secret, code)) {
            await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
         VALUES ('LOGIN', $1, 'auth', 'failure', $2)`, [user.id, JSON.stringify({ reason: 'mfa_invalid' })]);
            return res.status(401).json({ error: 'Invalid authentication code.' });
        }
        res.json(await issueSession(user, true));
    }
    catch (err) {
        next(err);
    }
});
// ─────────────────────────────────────────────
// POST /api/auth/mfa/setup/begin — start enrollment (pending or authenticated)
// ─────────────────────────────────────────────
exports.authRouter.post('/mfa/setup/begin', async (req, res, next) => {
    try {
        const body = zod_1.z.object({
            mfaToken: zod_1.z.string().optional(),
        }).parse(req.body);
        let userId;
        if (body.mfaToken) {
            userId = verifyMfaPendingToken(body.mfaToken, 'mfa_enroll');
        }
        else {
            const header = req.headers.authorization;
            if (!header?.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const payload = (0, requireAuth_1.verifyAccessToken)(header.slice(7));
            userId = payload.sub;
        }
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { rows } = await pool_1.pool.query('SELECT id, email, name, mfa_enabled FROM users WHERE id = $1 AND active = true', [userId]);
        const user = rows[0];
        if (!user)
            return res.status(401).json({ error: 'User not found.' });
        if (user.mfa_enabled) {
            return res.status(400).json({ error: 'MFA is already enabled. Disable it before re-enrolling.' });
        }
        const secret = new OTPAuth.Secret({ size: 20 });
        const totp = new OTPAuth.TOTP({
            issuer: ISSUER,
            label: user.email,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret,
        });
        // Store pending secret (not enabled until confirmed)
        await pool_1.pool.query(`UPDATE users SET mfa_secret = $1, mfa_enabled = false, updated_at = NOW() WHERE id = $2`, [secret.base32, userId]);
        res.json({
            secret: secret.base32,
            otpauthUrl: totp.toString(),
            issuer: ISSUER,
            account: user.email,
        });
    }
    catch (err) {
        next(err);
    }
});
// ─────────────────────────────────────────────
// POST /api/auth/mfa/setup/confirm — enable MFA after verifying first code
// ─────────────────────────────────────────────
exports.authRouter.post('/mfa/setup/confirm', async (req, res, next) => {
    try {
        const { mfaToken, code } = zod_1.z.object({
            mfaToken: zod_1.z.string().optional(),
            code: zod_1.z.string().regex(/^\d{6}$/),
        }).parse(req.body);
        let userId;
        let fromEnrollment = false;
        if (mfaToken) {
            userId = verifyMfaPendingToken(mfaToken, 'mfa_enroll');
            fromEnrollment = true;
        }
        else {
            const header = req.headers.authorization;
            if (!header?.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const payload = (0, requireAuth_1.verifyAccessToken)(header.slice(7));
            userId = payload.sub;
        }
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { rows } = await pool_1.pool.query('SELECT * FROM users WHERE id = $1 AND active = true', [userId]);
        const user = rows[0];
        if (!user?.mfa_secret) {
            return res.status(400).json({ error: 'Call /mfa/setup/begin first.' });
        }
        if (!verifyTotp(user.mfa_secret, code)) {
            return res.status(401).json({ error: 'Invalid authentication code.' });
        }
        await pool_1.pool.query(`UPDATE users SET mfa_enabled = true, updated_at = NOW() WHERE id = $1`, [userId]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_type, outcome)
       VALUES ('MFA_ENABLE', $1, 'auth', 'success')`, [userId]);
        if (fromEnrollment) {
            // Complete login after forced enrollment
            return res.json(await issueSession(user, true));
        }
        res.json({ success: true, mfaEnabled: true });
    }
    catch (err) {
        next(err);
    }
});
// ─────────────────────────────────────────────
// POST /api/auth/mfa/disable — admin/self with current TOTP
// ─────────────────────────────────────────────
exports.authRouter.post('/mfa/disable', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { code } = zod_1.z.object({ code: zod_1.z.string().regex(/^\d{6}$/) }).parse(req.body);
        const { rows } = await pool_1.pool.query('SELECT * FROM users WHERE id = $1 AND active = true', [req.userId]);
        const user = rows[0];
        if (!user?.mfa_enabled || !user.mfa_secret) {
            return res.status(400).json({ error: 'MFA is not enabled.' });
        }
        if (!verifyTotp(user.mfa_secret, code)) {
            return res.status(401).json({ error: 'Invalid authentication code.' });
        }
        await pool_1.pool.query(`UPDATE users SET mfa_enabled = false, mfa_secret = NULL, updated_at = NOW() WHERE id = $1`, [req.userId]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_type, outcome)
       VALUES ('MFA_DISABLE', $1, 'auth', 'success')`, [req.userId]);
        res.json({ success: true, mfaEnabled: false });
    }
    catch (err) {
        next(err);
    }
});
// ─────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────
exports.authRouter.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = zod_1.z.object({ refreshToken: zod_1.z.string() }).parse(req.body);
        const tokenHash = crypto_1.default.createHash('sha256').update(refreshToken).digest('hex');
        const { rows } = await pool_1.pool.query(`SELECT rt.*, u.id AS uid, u.name, u.email, u.role, u.active, u.mfa_enabled
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.expires_at > $2 AND u.active = true`, [tokenHash, new Date().toISOString()]);
        if (!rows[0])
            return res.status(401).json({ error: 'Invalid or expired refresh token.' });
        await pool_1.pool.query('DELETE FROM refresh_tokens WHERE id = $1', [rows[0].id]);
        const role = asApiRole(rows[0].role);
        // Refresh preserves prior MFA satisfaction for enrolled users (session continuity)
        const mfaVerified = !!rows[0].mfa_enabled;
        const { accessToken, refreshToken: newRefreshToken } = makeTokens(rows[0].uid, role, mfaVerified);
        const newHash = crypto_1.default.createHash('sha256').update(newRefreshToken).digest('hex');
        const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 86400_000);
        await pool_1.pool.query(`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`, [crypto_1.default.randomUUID(), rows[0].uid, newHash, expiresAt.toISOString()]);
        res.json({ accessToken, refreshToken: newRefreshToken });
    }
    catch (err) {
        next(err);
    }
});
// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
exports.authRouter.get('/me', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT id, name, email, role, mfa_enabled FROM users WHERE id = $1 AND active = true', [req.userId]);
        if (!rows[0])
            return res.status(401).json({ error: 'User not found.' });
        const header = req.headers.authorization;
        const payload = (0, requireAuth_1.verifyAccessToken)(header.slice(7));
        res.json({
            id: rows[0].id,
            name: rows[0].name,
            email: rows[0].email,
            role: asApiRole(rows[0].role),
            mfaEnabled: !!rows[0].mfa_enabled,
            mfaVerified: !!payload.mfa,
        });
    }
    catch (err) {
        next(err);
    }
});
// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────
exports.authRouter.post('/logout', async (req, res, next) => {
    try {
        const { refreshToken } = zod_1.z.object({ refreshToken: zod_1.z.string() }).parse(req.body);
        const tokenHash = crypto_1.default.createHash('sha256').update(refreshToken).digest('hex');
        await pool_1.pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
