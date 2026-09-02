/**
 * Shoreline Webhook Event Payloads — v6.0
 *
 * Typed event definitions for all system-generated webhook events.
 * Each event has a discriminated `event` string for easy routing.
 */

// ── Base ─────────────────────────────────────────────────────────────────────

export interface WebhookBasePayload {
  /** ISO-8601 timestamp of when the event was emitted */
  emittedAt: string
  /** Unique event ID (UUIDv4) */
  eventId: string
  /** Facility identifier */
  facilityId: string
}

// ── ehr.triage.pending ───────────────────────────────────────────────────────

export interface EhrTriagePendingEvent extends WebhookBasePayload {
  event: 'ehr.triage.pending'
  payload: {
    residentId: string
    residentName: string
    room: string
    changeType: 'diet_order' | 'texture_change' | 'admission' | 'discharge' | 'npo_change'
    incomingDietOrder?: string
    incomingTexture?: string
    sourceSystem: string
    triageQueueId: string
  }
}

// ── haccp.temp.violation ─────────────────────────────────────────────────────

export interface HaccpTempViolationEvent extends WebhookBasePayload {
  event: 'haccp.temp.violation'
  payload: {
    probeId: string
    stationId: string
    itemName: string
    measuredTempF: number
    requiredMinTempF: number
    violationType: 'hot_hold_below_140' | 'cold_hold_above_41' | 'cook_below_165'
    loggedBy: string
    correctionRequired: boolean
  }
}

// ── cpd.variance.alert ───────────────────────────────────────────────────────

export interface CpdVarianceAlertEvent extends WebhookBasePayload {
  event: 'cpd.variance.alert'
  payload: {
    reportDate: string
    targetCpd: number
    actualCpd: number
    varianceDollars: number
    variancePct: number
    direction: 'over_budget' | 'under_budget'
    alertThresholdPct: number
    activeCensus: number
  }
}

// ── npo.block.triggered ──────────────────────────────────────────────────────

export interface NpoBlockTriggeredEvent extends WebhookBasePayload {
  event: 'npo.block.triggered'
  payload: {
    residentId: string
    residentName: string
    room: string
    npoReason: string
    blockedMealType: string
    blockedAt: string
    clinicalNote?: string
    evaluationRuleCode: 'NPO_VIOLATION'
  }
}

// ── mrp.po.generated ─────────────────────────────────────────────────────────

export interface MrpPoGeneratedEvent extends WebhookBasePayload {
  event: 'mrp.po.generated'
  payload: {
    poId: string
    vendorId: string
    vendorName: string
    lineCount: number
    totalCost: number
    deliveryDate: string
    generatedBy: string
  }
}

// ── Union ────────────────────────────────────────────────────────────────────

export type WebhookEvent =
  | EhrTriagePendingEvent
  | HaccpTempViolationEvent
  | CpdVarianceAlertEvent
  | NpoBlockTriggeredEvent
  | MrpPoGeneratedEvent

export type WebhookEventName = WebhookEvent['event']
