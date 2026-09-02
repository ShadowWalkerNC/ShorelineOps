# ShorelineOps Webhook Events — Developer Reference

> **Version:** 6.0.0
> **Base:** `POST /api/webhooks/subscribe`
> **Signature header:** `X-Shoreline-Signature: sha256=<hex>`

---

## Overview

ShorelineOps fires deterministic webhook events for critical clinical, culinary, and financial state changes. All events are signed with HMAC-SHA256 using a per-subscription secret you provide at registration.

---

## Manage Subscriptions

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/webhooks/subscribe` | Register a new endpoint |
| `DELETE` | `/api/webhooks/subscribe/:id` | Remove a subscription |
| `GET` | `/api/webhooks/subscriptions` | List all subscriptions (secrets masked) |
| `POST` | `/api/webhooks/test` | Fire a synthetic test event to all subscribers |

### Register an Endpoint

```bash
curl -X POST https://your-facility.shorelineops.com/api/webhooks/subscribe \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://your-app.example.com/hooks","secret":"your-secret","description":"EHR alerts"}'
```

---

## Signature Verification (Node.js)

```js
const crypto = require('crypto')

function verifySignature(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'utf8'),
    Buffer.from(signatureHeader, 'utf8')
  )
}

app.post('/hooks', (req, res) => {
  const sig = req.headers['x-shoreline-signature']
  if (!verifySignature(JSON.stringify(req.body), sig, process.env.SHORELINE_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }
  console.log('Event:', req.body.event)
  res.sendStatus(200)
})
```

---

## Event Catalog

### `ehr.triage.pending`
Fired when a new inbound EHR diet change arrives and awaits RD approval.

```json
{
  "event": "ehr.triage.pending",
  "eventId": "uuid-v4",
  "facilityId": "FAC-001",
  "emittedAt": "2026-09-01T20:00:00.000Z",
  "payload": {
    "residentId": "SH-003",
    "residentName": "Martha Stewart",
    "room": "112-A",
    "changeType": "texture_change",
    "incomingTexture": "IDDSI Level 5 Minced",
    "sourceSystem": "PointClickCare",
    "triageQueueId": "TR-904"
  }
}
```

---

### `haccp.temp.violation`
Fired when a temperature reading violates safety thresholds (hot hold < 140°F, cold hold > 41°F, cook < 165°F).

```json
{
  "event": "haccp.temp.violation",
  "eventId": "uuid-v4",
  "facilityId": "FAC-001",
  "emittedAt": "2026-09-01T11:32:00.000Z",
  "payload": {
    "probeId": "PROBE-001",
    "stationId": "STEAM-TABLE-1",
    "itemName": "Herb Roasted Turkey",
    "measuredTempF": 132,
    "requiredMinTempF": 140,
    "violationType": "hot_hold_below_140",
    "loggedBy": "line-cook-01",
    "correctionRequired": true
  }
}
```

---

### `cpd.variance.alert`
Fired when daily food spend exceeds the configured CPD budget variance threshold.

```json
{
  "event": "cpd.variance.alert",
  "eventId": "uuid-v4",
  "facilityId": "FAC-001",
  "emittedAt": "2026-09-01T23:00:00.000Z",
  "payload": {
    "reportDate": "2026-09-01",
    "targetCpd": 8.50,
    "actualCpd": 9.75,
    "varianceDollars": 1.25,
    "variancePct": 14.7,
    "direction": "over_budget",
    "alertThresholdPct": 10,
    "activeCensus": 60
  }
}
```

---

### `npo.block.triggered`
Fired when the non-overridable NPO clinical hard-block fires during tray assembly.

```json
{
  "event": "npo.block.triggered",
  "eventId": "uuid-v4",
  "facilityId": "FAC-001",
  "emittedAt": "2026-09-01T12:10:00.000Z",
  "payload": {
    "residentId": "SH-004",
    "residentName": "Harold Finch",
    "room": "201-A",
    "npoReason": "Pre-surgical NPO order",
    "blockedMealType": "Lunch",
    "blockedAt": "2026-09-01T12:10:00.000Z",
    "evaluationRuleCode": "NPO_VIOLATION"
  }
}
```

---

### `mrp.po.generated`
Fired when the Split MRP engine auto-generates a vendor purchase order.

```json
{
  "event": "mrp.po.generated",
  "eventId": "uuid-v4",
  "facilityId": "FAC-001",
  "emittedAt": "2026-09-01T08:00:00.000Z",
  "payload": {
    "poId": "PO-2026090101",
    "vendorId": "DNS-001",
    "vendorName": "Dennis Food Service",
    "lineCount": 12,
    "totalCost": 1842.50,
    "deliveryDate": "2026-09-03",
    "generatedBy": "mrp-engine"
  }
}
```

---

## TypeScript Payload Types

See [`server/src/webhooks/events.ts`](../server/src/webhooks/events.ts) for the full discriminated union and typed payload definitions.