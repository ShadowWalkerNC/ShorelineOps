/**
 * Webhook Routes — Shoreline v6.0
 *
 * B13 scope cuts: all webhook subscription endpoints were CUT:
 *   POST   /api/webhooks/subscribe         Register a new webhook endpoint
 *   DELETE /api/webhooks/subscribe/:id     Unregister a webhook endpoint
 *   GET    /api/webhooks/subscriptions     List all registered subscriptions
 *   POST   /api/webhooks/test              Fire a test event to all subscribers
 *
 * The router stays mounted (server/src/index.ts owns mounts — do not unmount here)
 * so future webhook surface can re-attach under this namespace.
 * Internal emission via `globalWebhookEmitter` (server/src/webhooks/emitter.ts)
 * is untouched — it is still used by engine code (e.g. safetyEvaluator).
 */

import { Router } from 'express'

export const webhooksRouter = Router()

// ─────────────────────────────────────────────────────────────────────────────
// B13: subscribe/test endpoints removed (see header). Router intentionally empty.
// ─────────────────────────────────────────────────────────────────────────────
