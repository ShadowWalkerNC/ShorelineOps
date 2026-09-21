"use strict";
/**
 * WebhookEmitter — Shoreline v6.0
 *
 * In-memory webhook dispatcher with HMAC-SHA256 request signing,
 * 3-retry exponential backoff, and typed event payloads.
 *
 * Uses only Node.js built-in modules (https, crypto) — zero new deps.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalWebhookEmitter = exports.WebhookEmitter = void 0;
const crypto_1 = __importDefault(require("crypto"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
// ── Emitter ───────────────────────────────────────────────────────────────────
class WebhookEmitter {
    subscriptions = new Map();
    // ── Subscription Management ────────────────────────────────────────────────
    subscribe(url, secret, description) {
        const id = crypto_1.default.randomUUID();
        const sub = {
            id,
            url,
            secret,
            createdAt: new Date().toISOString(),
            description,
        };
        this.subscriptions.set(id, sub);
        return sub;
    }
    unsubscribe(id) {
        return this.subscriptions.delete(id);
    }
    listSubscriptions() {
        return Array.from(this.subscriptions.values());
    }
    getSubscription(id) {
        return this.subscriptions.get(id);
    }
    // ── Signature ──────────────────────────────────────────────────────────────
    /**
     * Generate HMAC-SHA256 signature for a payload using the subscriber secret.
     * Header format: `sha256=<hex-digest>`
     */
    static sign(payload, secret) {
        return ('sha256=' +
            crypto_1.default.createHmac('sha256', secret).update(payload, 'utf8').digest('hex'));
    }
    // ── HTTP Delivery ──────────────────────────────────────────────────────────
    /**
     * Deliver a single POST request to a subscriber URL.
     * Returns the HTTP status code or throws on network error.
     */
    static deliverOnce(url, body, signature) {
        return new Promise((resolve, reject) => {
            const parsed = new url_1.URL(url);
            const isHttps = parsed.protocol === 'https:';
            const transport = isHttps ? https_1.default : http_1.default;
            const options = {
                hostname: parsed.hostname,
                port: parsed.port || (isHttps ? 443 : 80),
                path: parsed.pathname + parsed.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    'X-Shoreline-Signature': signature,
                    'X-Shoreline-Event': 'webhook',
                    'User-Agent': 'Shoreline-Webhook/6.0',
                },
            };
            const req = transport.request(options, (res) => {
                // Drain the body so the socket can be reused
                res.resume();
                res.on('end', () => resolve(res.statusCode ?? 0));
            });
            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy(new Error('Webhook delivery timeout'));
            });
            req.write(body);
            req.end();
        });
    }
    /**
     * Deliver with exponential backoff: delays 1s, 2s, 4s on failure.
     */
    static async deliverWithRetry(url, body, signature, maxAttempts = 3) {
        let lastError;
        let lastStatus;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const status = await WebhookEmitter.deliverOnce(url, body, signature);
                if (status >= 200 && status < 300) {
                    return { success: true, statusCode: status, attempts: attempt };
                }
                lastStatus = status;
                lastError = `HTTP ${status}`;
            }
            catch (err) {
                lastError = err instanceof Error ? err.message : String(err);
            }
            if (attempt < maxAttempts) {
                await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
            }
        }
        return {
            success: false,
            statusCode: lastStatus,
            attempts: maxAttempts,
            error: lastError,
        };
    }
    // ── Emit ──────────────────────────────────────────────────────────────────
    /**
     * Emit an event to all registered subscribers in parallel.
     * Each subscriber is retried independently with exponential backoff.
     */
    async emit(event) {
        if (this.subscriptions.size === 0)
            return [];
        const body = JSON.stringify(event);
        const deliveries = Array.from(this.subscriptions.values()).map(async (sub) => {
            const signature = sub.secret
                ? WebhookEmitter.sign(body, sub.secret)
                : 'sha256=unsigned';
            const result = await WebhookEmitter.deliverWithRetry(sub.url, body, signature);
            if (!result.success) {
                console.warn(`[Webhook] FAILED to deliver ${event.event} to ${sub.url} after ${result.attempts} attempt(s): ${result.error}`);
            }
            return {
                subscriptionId: sub.id,
                url: sub.url,
                ...result,
            };
        });
        return Promise.all(deliveries);
    }
}
exports.WebhookEmitter = WebhookEmitter;
// ── Singleton ─────────────────────────────────────────────────────────────────
exports.globalWebhookEmitter = new WebhookEmitter();
