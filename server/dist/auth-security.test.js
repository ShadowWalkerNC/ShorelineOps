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
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const OTPAuth = __importStar(require("otpauth"));
// Configure storage before importing any application module. Never load .env.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.SQLITE_PATH = node_path_1.default.join((0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), 'shoreline-auth-test-')), 'auth.db');
process.env.JWT_SECRET = node_crypto_1.default.randomBytes(32).toString('hex');
void (0, node_test_1.test)('access credentials stay separate from pending MFA credentials', async (t) => {
    const { pool } = await Promise.resolve().then(() => __importStar(require('./db/pool')));
    const { runMigrations } = await Promise.resolve().then(() => __importStar(require('./db/migrate')));
    const { authRouter } = await Promise.resolve().then(() => __importStar(require('./routes/auth')));
    const { ehrRouter } = await Promise.resolve().then(() => __importStar(require('./routes/ehr')));
    const { residentsRouter } = await Promise.resolve().then(() => __importStar(require('./routes/residents')));
    const { recipesRouter } = await Promise.resolve().then(() => __importStar(require('./routes/recipes')));
    const { requireAuth, verifyAccessToken } = await Promise.resolve().then(() => __importStar(require('./middleware/requireAuth')));
    const { errorHandler } = await Promise.resolve().then(() => __importStar(require('./middleware/errorHandler')));
    await runMigrations();
    const password = 'Test-Only-Long-Passphrase-9!';
    const passwordHash = await bcryptjs_1.default.hash(password, 4);
    const mfaSecret = new OTPAuth.Secret({ size: 20 }).base32;
    const userId = node_crypto_1.default.randomUUID();
    const plainId = node_crypto_1.default.randomUUID();
    for (const [id, email, enabled, secret] of [
        [userId, 'mfa@example.invalid', true, mfaSecret],
        [plainId, 'plain@example.invalid', false, null],
    ]) {
        await pool.query('INSERT INTO users (id,name,email,password,role,active,mfa_enabled,mfa_secret) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [id, 'Synthetic account', email, passwordHash, 'admin', true, enabled, secret]);
    }
    await pool.query('UPDATE system_settings SET mfa_required = false WHERE id = 1');
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use('/api/auth', authRouter);
    app.use('/api/residents', requireAuth, residentsRouter);
    app.use('/api/recipes', requireAuth, recipesRouter);
    app.use('/api/ehr', ehrRouter);
    app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const address = server.address();
    const base = `http://127.0.0.1:${address.port}`;
    const request = (url, token, body) => fetch(base + url, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const login = async (email) => {
        const response = await request('/api/auth/login', undefined, { email, password });
        strict_1.default.equal(response.status, 200);
        return response.json();
    };
    try {
        const challenge = await login('mfa@example.invalid');
        strict_1.default.equal(challenge.mfaRequired, true);
        strict_1.default.equal(challenge.accessToken, undefined);
        const verifyToken = challenge.mfaToken;
        await pool.query('UPDATE system_settings SET mfa_required = true WHERE id = 1');
        const enrollChallenge = await login('plain@example.invalid');
        strict_1.default.equal(enrollChallenge.mfaEnrollmentRequired, true);
        const enrollToken = enrollChallenge.mfaToken;
        for (const [kind, token] of [['verify', verifyToken], ['enroll', enrollToken]]) {
            await t.test(`${kind} pending token rejected by all access-token consumers`, async () => {
                for (const url of ['/api/residents', '/api/recipes', '/api/auth/me', '/api/ehr/census']) {
                    strict_1.default.equal((await request(url, token)).status, 401, url);
                }
                strict_1.default.equal((await request('/api/auth/mfa/setup/begin', token, {})).status, 401);
                strict_1.default.equal((await request('/api/auth/mfa/setup/confirm', token, { code: '000000' })).status, 401);
                strict_1.default.equal((await request('/api/ehr/reconciliation-queue/synthetic/resolve', token, {})).status, 403);
            });
        }
        await t.test('MFA tokens cannot be exchanged across pending purposes', async () => {
            strict_1.default.equal((await request('/api/auth/mfa/setup/begin', undefined, { mfaToken: verifyToken })).status, 401);
            strict_1.default.equal((await request('/api/auth/mfa/verify', undefined, { mfaToken: enrollToken, code: '000000' })).status, 401);
        });
        let completed;
        await t.test('valid TOTP completes login and access works', async () => {
            const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(mfaSecret) }).generate();
            const response = await request('/api/auth/mfa/verify', undefined, { mfaToken: verifyToken, code });
            strict_1.default.equal(response.status, 200);
            completed = await response.json();
            strict_1.default.equal(verifyAccessToken(completed.accessToken).mfa, true);
            for (const url of ['/api/auth/me', '/api/residents']) {
                strict_1.default.equal((await request(url, completed.accessToken)).status, 200, url);
            }
        });
        await t.test('enrollment works only via its explicit body-token flow', async () => {
            const begun = await request('/api/auth/mfa/setup/begin', undefined, { mfaToken: enrollToken });
            strict_1.default.equal(begun.status, 200);
            const setup = await begun.json();
            const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(setup.secret) }).generate();
            const confirmed = await request('/api/auth/mfa/setup/confirm', undefined, { mfaToken: enrollToken, code });
            strict_1.default.equal(confirmed.status, 200);
            const session = await confirmed.json();
            strict_1.default.equal(verifyAccessToken(session.accessToken).sub, plainId);
            strict_1.default.equal((await request('/api/auth/me', session.accessToken)).status, 200);
        });
        await t.test('refresh issues the same restricted access-token class', async () => {
            const response = await request('/api/auth/refresh', undefined, { refreshToken: completed.refreshToken });
            strict_1.default.equal(response.status, 200);
            const refreshed = await response.json();
            strict_1.default.equal(verifyAccessToken(refreshed.accessToken).purpose, 'access');
            strict_1.default.equal((await request('/api/auth/refresh', undefined, { refreshToken: completed.refreshToken })).status, 401);
            const newHash = node_crypto_1.default.createHash('sha256').update(refreshed.refreshToken).digest('hex');
            await pool.query('UPDATE refresh_tokens SET expires_at = $1 WHERE token_hash = $2', [new Date(Date.now() - 60_000).toISOString(), newHash]);
            strict_1.default.equal((await request('/api/auth/refresh', undefined, { refreshToken: refreshed.refreshToken })).status, 401);
            strict_1.default.equal((await request('/api/auth/me', refreshed.accessToken)).status, 200);
        });
        await t.test('non-MFA login remains valid when MFA is not required', async () => {
            await pool.query('UPDATE system_settings SET mfa_required = false WHERE id = 1');
            await pool.query('UPDATE users SET mfa_enabled = false, mfa_secret = NULL WHERE id = $1', [plainId]);
            const session = await login('plain@example.invalid');
            strict_1.default.equal(verifyAccessToken(session.accessToken).mfa, false);
            strict_1.default.equal((await request('/api/auth/me', session.accessToken)).status, 200);
        });
        await t.test('legacy, malformed, expired and wrong-audience tokens fail closed', async () => {
            const secret = process.env.JWT_SECRET;
            const valid = { sub: userId, role: 'admin', purpose: 'access', mfa: true };
            const tokens = [
                jsonwebtoken_1.default.sign({ sub: userId, role: 'admin' }, secret, { expiresIn: '1m' }),
                jsonwebtoken_1.default.sign(valid, secret, { expiresIn: '1m', audience: 'shoreline-mfa' }),
                jsonwebtoken_1.default.sign({ ...valid, purpose: 'mfa_verify' }, secret, { expiresIn: '1m', audience: 'shoreline-api' }),
                jsonwebtoken_1.default.sign({ ...valid, role: 'toString' }, secret, { expiresIn: '1m', audience: 'shoreline-api' }),
                jsonwebtoken_1.default.sign({ ...valid, sub: '' }, secret, { expiresIn: '1m', audience: 'shoreline-api' }),
                jsonwebtoken_1.default.sign(valid, secret, { expiresIn: -1, audience: 'shoreline-api' }),
                jsonwebtoken_1.default.sign(valid, secret, { audience: 'shoreline-api' }),
                jsonwebtoken_1.default.sign(valid, secret, { expiresIn: '1m', audience: 'shoreline-api', algorithm: 'HS384' }),
            ];
            for (const token of tokens)
                strict_1.default.equal((await request('/api/auth/me', token)).status, 401);
        });
        await t.test('completed access token cannot masquerade as enrollment token', async () => {
            strict_1.default.equal((await request('/api/auth/mfa/setup/begin', undefined, { mfaToken: completed.accessToken })).status, 401);
        });
    }
    finally {
        await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
        await pool.end();
    }
});
