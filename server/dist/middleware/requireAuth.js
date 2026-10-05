"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MFA_TOKEN_AUDIENCE = exports.ACCESS_TOKEN_AUDIENCE = exports.API_ROLES = void 0;
exports.verifyAccessToken = verifyAccessToken;
exports.getJwtSecret = getJwtSecret;
exports.validateAccessSession = validateAccessSession;
exports.requireAuth = requireAuth;
exports.requirePlatformAdmin = requirePlatformAdmin;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const pool_1 = require("../db/pool");
/** Roles accepted by the API — aligned with frontend UserRole. */
exports.API_ROLES = [
    'admin',
    'manager',
    'dietitian',
    'frontdesk',
    'dietary',
    'distributor',
    'activities',
    'server',
    'staff',
    'readonly',
];
exports.ACCESS_TOKEN_AUDIENCE = 'shoreline-api';
exports.MFA_TOKEN_AUDIENCE = 'shoreline-mfa';
function verifyAccessToken(token) {
    try {
        const payload = jsonwebtoken_1.default.verify(token, getJwtSecret(), {
            algorithms: ['HS256'],
            audience: exports.ACCESS_TOKEN_AUDIENCE,
        });
        if (typeof payload === 'string' ||
            typeof payload.sub !== 'string' || !payload.sub.trim() ||
            payload.purpose !== 'access' ||
            typeof payload.mfa !== 'boolean' ||
            typeof payload.facilityId !== 'string' ||
            typeof payload.platformAdmin !== 'boolean' ||
            typeof payload.exp !== 'number' ||
            typeof payload.sessionId !== 'string' || !payload.sessionId.trim() ||
            !Number.isSafeInteger(payload.authVersion) || Number(payload.authVersion) < 0 ||
            !exports.API_ROLES.includes(payload.role)) {
            throw new Error('Invalid access token claims');
        }
        return payload;
    }
    catch {
        throw Object.assign(new Error('Invalid or expired token'), { status: 401 });
    }
}
const ROLE_RANK = {
    readonly: 0,
    distributor: 1,
    staff: 2,
    server: 3,
    activities: 4,
    dietary: 5,
    dietitian: 6,
    frontdesk: 7,
    manager: 8,
    admin: 9,
};
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('JWT_SECRET must be set to a value at least 32 characters long');
    }
    return secret;
}
/** Verify identity and revocable persisted session without trusting stale JWT privileges. */
async function validateAccessSession(token) {
    const payload = verifyAccessToken(token);
    let rows;
    try {
        const result = await pool_1.pool.query(`SELECT u.role, u.facility_id, u.platform_admin, u.auth_version, rt.mfa_verified
       FROM users u JOIN refresh_tokens rt ON rt.user_id = u.id
       WHERE u.id = $1 AND u.active = true AND rt.id = $2 AND rt.expires_at > $3
         AND rt.auth_version = u.auth_version`, [payload.sub, payload.sessionId, new Date().toISOString()]);
        rows = result.rows;
    }
    catch {
        throw Object.assign(new Error('Authentication service unavailable'), { status: 503 });
    }
    const user = rows[0];
    if (!user || user.role !== payload.role || (user.facility_id || 'default') !== payload.facilityId ||
        !!user.platform_admin !== payload.platformAdmin || Number(user.auth_version) !== payload.authVersion) {
        throw Object.assign(new Error('Invalid or revoked session'), { status: 401 });
    }
    if (!!user.mfa_verified !== payload.mfa)
        throw Object.assign(new Error('Invalid or revoked session'), { status: 401 });
    return payload;
}
async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = header.slice(7);
    try {
        const payload = await validateAccessSession(token);
        req.userId = payload.sub;
        req.userRole = payload.role;
        req.facilityId = payload.facilityId;
        req.platformAdmin = payload.platformAdmin;
        next();
    }
    catch (error) {
        if (error.status === 503)
            return res.status(503).json({ error: 'Authentication service unavailable' });
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
function requirePlatformAdmin(req, res, next) {
    if (!req.platformAdmin) {
        return res.status(403).json({ error: 'ShorelineOps platform-owner access required' });
    }
    next();
}
/** Require the caller to have at least the given role rank. */
function requireRole(role) {
    return (req, res, next) => {
        if (!req.userRole || ROLE_RANK[req.userRole] < ROLE_RANK[role]) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
}
