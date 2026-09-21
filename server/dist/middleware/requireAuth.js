"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MFA_TOKEN_AUDIENCE = exports.ACCESS_TOKEN_AUDIENCE = exports.API_ROLES = void 0;
exports.verifyAccessToken = verifyAccessToken;
exports.getJwtSecret = getJwtSecret;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
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
            typeof payload.exp !== 'number' ||
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
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = header.slice(7);
    try {
        const payload = verifyAccessToken(token);
        req.userId = payload.sub;
        req.userRole = payload.role;
        next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
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
