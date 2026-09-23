"use strict";
/**
 * Clinical EHR & Nutrition Router (V3 Milestone)
 *
 * Exposes endpoints for EHR census synchronization, inbound ADT/diet webhooks,
 * dynamic meal validation, and therapeutic nutritional analysis.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ehrRouter = void 0;
exports.verifyEhrHmacSignature = verifyEhrHmacSignature;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const pointclickcare_1 = require("../integrations/pointclickcare");
const usda_1 = require("../integrations/usda");
const requireAuth_1 = require("../middleware/requireAuth");
const requireTier_1 = require("../middleware/requireTier");
const pool_1 = require("../db/pool");
exports.ehrRouter = (0, express_1.Router)();
const pcc = new pointclickcare_1.PointClickCareConnector();
const usda = new usda_1.USDAFoodDataConnector();
// ---------------------------------------------------------------------------
// EHR webhook security (A04) — HMAC-SHA256, fail-closed, audit-logged
// ---------------------------------------------------------------------------
/** Minimum accepted EHR webhook secret length — mirrors the timecard kiosk rule. */
const EHR_WEBHOOK_SECRET_MIN_LENGTH = 16;
const EHR_SIGNATURE_HEADER = 'x-ehr-signature';
/** Roles allowed to run the triage simulator. Strict: dietitian or admin only. */
const SIMULATOR_ROLES = ['dietitian', 'admin'];
function getEhrWebhookSecret() {
    const secret = process.env.EHR_WEBHOOK_SECRET;
    return secret && secret.length >= EHR_WEBHOOK_SECRET_MIN_LENGTH ? secret : undefined;
}
// Boot warning + fail closed: with no usable secret the webhook refuses all traffic.
if (!getEhrWebhookSecret()) {
    console.info('[EHR webhook] EHR_WEBHOOK_SECRET missing or <16 chars — ' +
        'POST /api/ehr/webhook will refuse all traffic (fail closed)');
}
/**
 * Pure HMAC-SHA256 signature check over the raw request bytes.
 * Exported for unit testing; the middleware below supplies request state.
 */
function verifyEhrHmacSignature(rawBody, signatureHeader, secret) {
    if (!rawBody || !signatureHeader)
        return false;
    // Accept the GitHub-style "sha256=<hex>" scheme, or a bare hex digest.
    const provided = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader;
    if (!/^[0-9a-fA-F]{64}$/.test(provided))
        return false;
    const expected = crypto_1.default.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto_1.default.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided.toLowerCase(), 'utf8'));
}
/** Best-effort security-event audit write. Never breaks the security response path. */
async function auditEhrSecurityEvent(req, action, reason, extra) {
    try {
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_type, outcome, ip_address, details)
       VALUES ($1, $2, $3, 'failure', $4, $5)`, [
            action,
            extra?.userId ?? null,
            action === 'ehr.simulate.denied' ? 'ehr_simulation' : 'ehr_webhook',
            req.ip ?? null,
            JSON.stringify({ reason, at: new Date().toISOString(), role: extra?.role ?? null }),
        ]);
    }
    catch (err) {
        console.error(`[EHR security] audit write failed (${action}):`, err.message);
    }
}
/**
 * A05: audit-logs every RD reconciliation decision (approve or reject).
 * Actor identity comes from the verified JWT claims — never the request body.
 * Best-effort: never breaks the resolve path.
 */
async function auditReconciliationDecision(req, opts, 
// F1: inside the resolve transaction pass the tx client so the audit row
// commits atomically; pool default preserves the old best-effort path.
db = pool_1.pool) {
    try {
        await db.query(`INSERT INTO audit_log (action, user_id, resource_type, outcome, ip_address, details)
       VALUES ('ehr.reconciliation.resolved', $1, 'ehr_reconciliation_queue', 'success', $2, $3)`, [
            opts.actorUserId,
            req.ip ?? null,
            JSON.stringify({
                itemId: opts.itemId,
                residentId: opts.residentId,
                residentName: opts.residentName ?? null,
                changeType: opts.changeType,
                decision: opts.decision,
                actorRole: opts.actorRole,
                at: new Date().toISOString(),
            }),
        ]);
    }
    catch (err) {
        console.error('[EHR reconciliation] audit write failed:', err.message);
    }
}
/**
 * Gates POST /api/ehr/webhook on HMAC-SHA256 verification against
 * EHR_WEBHOOK_SECRET. Missing/invalid signature → 401 + audit-logged.
 * Unset secret → 503 refusing all traffic (fail closed, kiosk pattern).
 */
function requireEhrWebhookSignature(req, res, next) {
    const secret = getEhrWebhookSecret();
    if (!secret) {
        void auditEhrSecurityEvent(req, 'ehr.webhook.disabled', 'EHR_WEBHOOK_SECRET not configured — refusing traffic (fail closed)');
        return res.status(503).json({ error: 'EHR webhook disabled — EHR_WEBHOOK_SECRET not configured' });
    }
    const header = req.headers[EHR_SIGNATURE_HEADER];
    const signatureHeader = Array.isArray(header) ? header[0] : header;
    if (!signatureHeader) {
        void auditEhrSecurityEvent(req, 'ehr.webhook.rejected', 'missing X-EHR-Signature header');
        return res.status(401).json({ error: 'Missing webhook signature' });
    }
    if (!verifyEhrHmacSignature(req.rawBody, signatureHeader, secret)) {
        void auditEhrSecurityEvent(req, 'ehr.webhook.rejected', 'invalid webhook signature');
        return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    next();
}
/**
 * Gates privileged EHR reconciliation actions (dietitian or admin only).
 * Anonymous, bad-token, or insufficient-role calls → 403 + audit-logged.
 * (Strict role equality: the rank-based requireRole('dietitian') would also admit
 * frontdesk/manager, so this security gate checks the two privileged roles exactly.)
 * B13: formerly also gated the cut POST /api/ehr/simulate-inbound-triage endpoint.
 */
function requireDietitianOrAdmin(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        void auditEhrSecurityEvent(req, 'ehr.simulate.denied', 'anonymous call — no bearer token');
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        const payload = (0, requireAuth_1.verifyAccessToken)(header.slice(7));
        if (!payload.sub)
            throw new Error('missing sub');
        const role = payload.role && requireAuth_1.API_ROLES.includes(payload.role)
            ? payload.role
            : undefined;
        req.userId = payload.sub;
        if (!role || !SIMULATOR_ROLES.includes(role)) {
            void auditEhrSecurityEvent(req, 'ehr.simulate.denied', 'insufficient role', { userId: payload.sub, role: role ?? 'unknown' });
            return res.status(403).json({ error: 'Forbidden' });
        }
        req.userRole = role;
        next();
    }
    catch {
        void auditEhrSecurityEvent(req, 'ehr.simulate.denied', 'invalid or expired token');
        return res.status(403).json({ error: 'Forbidden' });
    }
}
/**
 * GET /api/ehr/census
 * Pulls current active census from connected EHR.
 * A07: never serve synthetic data as live EHR data. With no EHR configured
 * → 503 EHR_NOT_CONNECTED. The built-in connector is a synthetic stub, so a
 * served payload is explicitly flagged `demo: true`.
 */
exports.ehrRouter.get('/census', requireAuth_1.requireAuth, (0, requireTier_1.requireTier)('enterprise'), async (_req, res) => {
    try {
        if (!pcc.isConnected()) {
            return res.status(503).json({
                success: false,
                code: 'EHR_NOT_CONNECTED',
                error: 'EHR not connected — configure PCC_CLIENT_ID, PCC_CLIENT_SECRET and PCC_FACILITY_ID to enable live census.',
            });
        }
        const census = await pcc.getCensus('FAC-DEFAULT');
        res.json({ system: pcc.systemName, count: census.length, residents: census, demo: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to fetch EHR census' });
    }
});
/**
 * POST /api/ehr/webhook
 * Ingests inbound diet order, texture, or ADT update from PointClickCare / MatrixCare.
 * A04: gated on HMAC-SHA256 signature (X-EHR-Signature: sha256=<hex>) against
 * EHR_WEBHOOK_SECRET. Missing/invalid signature → 401 + audit-logged.
 * Unset secret → 503, route refuses all traffic (fail closed).
 */
exports.ehrRouter.post('/webhook', requireEhrWebhookSignature, async (req, res) => {
    try {
        const update = await pcc.processInboundUpdate(req.body);
        const validation = await pcc.validateResidentMeals(update);
        // Lookup existing resident record to determine if this update constitutes a clinical change
        let existingResident = undefined;
        if (update.residentExternalId) {
            const { rows } = await pool_1.pool.query('SELECT id, name, room, diet_type, texture, allergies, is_npo FROM residents WHERE external_ehr_id = $1 OR id = $1 LIMIT 1', [update.residentExternalId]);
            if (rows.length > 0) {
                const r = rows[0];
                existingResident = {
                    id: r.id,
                    dietType: r.diet_type || 'Regular',
                    texture: r.texture || 'Regular',
                    allergies: typeof r.allergies === 'string' ? JSON.parse(r.allergies || '[]') : (r.allergies || []),
                    isNpo: Boolean(r.is_npo),
                };
            }
        }
        if (!existingResident && (update.firstName || update.lastName)) {
            const fullName = `${update.firstName ?? ''} ${update.lastName ?? ''}`.trim();
            if (fullName) {
                const { rows } = await pool_1.pool.query('SELECT id, name, room, diet_type, texture, allergies, is_npo FROM residents WHERE LOWER(name) = LOWER($1) LIMIT 1', [fullName]);
                if (rows.length > 0) {
                    const r = rows[0];
                    existingResident = {
                        id: r.id,
                        dietType: r.diet_type || 'Regular',
                        texture: r.texture || 'Regular',
                        allergies: typeof r.allergies === 'string' ? JSON.parse(r.allergies || '[]') : (r.allergies || []),
                        isNpo: Boolean(r.is_npo),
                    };
                }
            }
        }
        const triageItem = pcc.evaluateInboundTriage(update, existingResident);
        let queueEntry = null;
        if (triageItem) {
            const incomingPayloadStr = JSON.stringify(triageItem.incomingPayload);
            const { rows: [inserted] } = await pool_1.pool.query(`
        INSERT INTO ehr_reconciliation_queue (
          resident_id, resident_name, external_ehr_id, source_ehr,
          change_type, incoming_payload, conflict_reason, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *
      `, [
                existingResident?.id || null,
                triageItem.residentName,
                triageItem.externalEhrId,
                triageItem.sourceEhr,
                triageItem.changeType,
                incomingPayloadStr,
                triageItem.conflictReason,
                'PENDING_TRIAGE'
            ]);
            queueEntry = inserted;
        }
        res.json({
            success: true,
            processedAt: new Date().toISOString(),
            resident: update,
            validation,
            triageItem: queueEntry || triageItem || null,
            queuedForTriage: Boolean(triageItem),
        });
    }
    catch (err) {
        res.status(400).json({ error: err.message || 'Webhook processing failed' });
    }
});
/**
 * POST /api/ehr/nutrients/analyze
 * Computes therapeutic nutritional analysis for a planned meal & diet order
 */
exports.ehrRouter.post('/nutrients/analyze', requireAuth_1.requireAuth, (req, res) => {
    try {
        const { dietOrder = 'Regular', items = [] } = req.body;
        const breakdown = pcc.calculateNutrients(dietOrder, items);
        res.json({ dietOrder, breakdown });
    }
    catch (err) {
        res.status(400).json({ error: err.message || 'Nutrient analysis failed' });
    }
});
/**
 * POST /api/ehr/nutrients/usda
 * Comprehensive USDA FoodData Central meal breakdown & clinical compliance flags
 */
exports.ehrRouter.post('/nutrients/usda', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { dietOrder = 'Regular', items = [] } = req.body;
        const analysis = await usda.analyzeMeal(items, dietOrder);
        res.json(analysis);
    }
    catch (err) {
        res.status(400).json({ error: err.message || 'USDA nutrient analysis failed' });
    }
});
/**
 * GET /api/ehr/reconciliation-queue
 * Lists all pending, approved, and rejected inbound EHR triage items for Registered Dietitians
 */
exports.ehrRouter.get('/reconciliation-queue', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { status = 'PENDING_TRIAGE' } = req.query;
        const { rows } = await pool_1.pool.query(`
      SELECT * FROM ehr_reconciliation_queue 
      WHERE status = $1 
      ORDER BY created_at DESC
    `, [String(status)]);
        res.json({
            totalPending: rows.length,
            items: rows,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to fetch reconciliation queue' });
    }
});
/**
 * POST /api/ehr/reconciliation-queue/:id/resolve
 * RD resolves an inbound EHR change (APPROVE or REJECT)
 * A05: dietitian or admin only — reuses A04's requireDietitianOrAdmin (strict
 * role equality, not rank-based, so frontdesk/manager are refused). Denied
 * calls → 403 + audit-logged by the middleware.
 */
exports.ehrRouter.post('/reconciliation-queue/:id/resolve', requireDietitianOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'APPROVED_BY_RD' | 'REJECTED_BY_RD'
        // A05: any client-supplied `resolvedBy` is deliberately ignored — the actor
        // identity comes from the verified JWT claims (req.userId/req.userRole) only.
        const actorUserId = req.userId ?? 'unknown';
        const actorRole = req.userRole ?? 'unknown';
        const resolvedBy = actorUserId;
        if (!action || !['APPROVED_BY_RD', 'REJECTED_BY_RD'].includes(action)) {
            return res.status(400).json({ error: "action must be 'APPROVED_BY_RD' or 'REJECTED_BY_RD'" });
        }
        // F1: apply-then-resolve inside one transaction. The queue row is only
        // marked after the resident change commits; malformed or unsupported
        // payloads stay pending so no allergy is silently cleared.
        const client = await pool_1.pool.connect();
        let started = false;
        try {
            await client.query('BEGIN');
            started = true;
            const { rows: [triageItem] } = await client.query('SELECT * FROM ehr_reconciliation_queue WHERE id = $1', [id]);
            if (!triageItem) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Triage item not found' });
            }
            if (triageItem.status !== 'PENDING_TRIAGE') {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Item already ' + triageItem.status + ' — reload the queue' });
            }
            if (action === 'APPROVED_BY_RD' && triageItem.resident_id) {
                const payload = typeof triageItem.incoming_payload === 'string'
                    ? JSON.parse(triageItem.incoming_payload)
                    : triageItem.incoming_payload ?? {};
                if (triageItem.change_type === 'DIET_ORDER') {
                    if (typeof payload.dietOrder !== 'string' || !payload.dietOrder.trim()) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: 'DIET_ORDER payload missing dietOrder — left pending' });
                    }
                    await client.query('UPDATE residents SET diet_type = $1, profile_version = profile_version + 1, updated_at = NOW() WHERE id = $2', [payload.dietOrder, triageItem.resident_id]);
                }
                else if (triageItem.change_type === 'TEXTURE_UPDATE') {
                    if (typeof payload.texture !== 'string' || !payload.texture.trim()) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: 'TEXTURE_UPDATE payload missing texture — left pending' });
                    }
                    await client.query('UPDATE residents SET texture = $1, profile_version = profile_version + 1, updated_at = NOW() WHERE id = $2', [payload.texture, triageItem.resident_id]);
                }
                else if (triageItem.change_type === 'NPO_ORDER') {
                    await client.query("UPDATE residents SET is_npo = true, npo_reason = 'EHR Physician Order', profile_version = profile_version + 1, updated_at = NOW() WHERE id = $1", [triageItem.resident_id]);
                }
                else if (triageItem.change_type === 'NEW_ALLERGEN') {
                    const incoming = Array.isArray(payload.allergies) ? payload.allergies : [];
                    const fresh = incoming.map((a) => String(a ?? '').trim()).filter(Boolean);
                    if (fresh.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: 'NEW_ALLERGEN payload missing allergies — left pending' });
                    }
                    const { rows: [resident] } = await client.query('SELECT allergies FROM residents WHERE id = $1', [triageItem.resident_id]);
                    if (!resident) {
                        await client.query('ROLLBACK');
                        return res.status(404).json({ error: 'Resident not found — left pending' });
                    }
                    const current = typeof resident.allergies === 'string'
                        ? JSON.parse(resident.allergies || '[]')
                        : (resident.allergies || []);
                    const seen = new Set(current.map((a) => String(a).toLowerCase().trim()));
                    for (const allergen of fresh) {
                        if (!seen.has(allergen.toLowerCase())) {
                            current.push(allergen);
                            seen.add(allergen.toLowerCase());
                        }
                    }
                    await client.query('UPDATE residents SET allergies = $1, profile_version = profile_version + 1, updated_at = NOW() WHERE id = $2', [current, triageItem.resident_id]);
                }
                else {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Unsupported change type ' + triageItem.change_type + ' — left pending' });
                }
            }
            await client.query('UPDATE ehr_reconciliation_queue SET status = $1, resolved_by = $2, resolved_at = NOW() WHERE id = $3', [action, resolvedBy, id]);
            // A05: audit-log every decision with the JWT-derived actor identity —
            // item id, resident, change type, decision, actor, timestamp.
            await auditReconciliationDecision(req, {
                itemId: id,
                residentId: triageItem.resident_id ?? null,
                residentName: triageItem.resident_name ?? null,
                changeType: triageItem.change_type,
                decision: action,
                actorUserId,
                actorRole,
            }, client);
            await client.query('COMMIT');
            res.json({
                success: true,
                resolvedId: id,
                action,
                resolvedBy,
                resolvedAt: new Date().toISOString(),
            });
        }
        catch (txErr) {
            try {
                if (started)
                    await client.query('ROLLBACK');
            }
            catch { /* already closed */ }
            throw txErr;
        }
        finally {
            client.release();
        }
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to resolve reconciliation item' });
    }
});
// B13: POST /api/ehr/simulate-inbound-triage was CUT (mock/simulated endpoint).
