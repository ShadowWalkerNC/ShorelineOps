/**
 * BluetoothProbeManager — Shoreline Hardware Integration v6.0
 *
 * Manages Bluetooth LE HACCP temperature probes.
 * Simulates BLE device scanning and temperature reads deterministically.
 * Fires haccp.temp.violation webhook events when temperature is < 140 deg F.
 *
 * In production, replace scanForProbes() and readTemperature() with
 * a real BLE driver bridge (e.g. noble, bleat, or a hardware gateway REST API).
 */

import crypto from 'crypto'
import { globalWebhookEmitter } from '../webhooks/emitter'
import type { HaccpTempViolationEvent } from '../webhooks/events'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProbeDevice {
  probeId: string
  name: string
  model: string
  macAddress: string
  batteryPct: number
  isConnected: boolean
  lastSeenAt: string
}

export interface ProbeReading {
  probeId: string
  stationId: string
  tempF: number
  tempC: number
  readAt: string
  signalRssi?: number
}

export interface HaccpLogEntry {
  logId: string
  probeId: string
  stationId: string
  itemName: string
  measuredTempF: number
  requiredMinTempF: number
  compliant: boolean
  violationType?: 'hot_hold_below_140' | 'cold_hold_above_41' | 'cook_below_165'
  correctionRequired: boolean
  loggedAt: string
  webhookFired: boolean
}

// ── Mock probe registry (replace with real BLE discovery in production) ───────

const MOCK_PROBES: ProbeDevice[] = [
  {
    probeId: 'PROBE-001',
    name: 'Hot Line Probe Alpha',
    model: 'ThermoWorks Signals BT',
    macAddress: 'AA:BB:CC:DD:EE:01',
    batteryPct: 87,
    isConnected: true,
    lastSeenAt: new Date().toISOString(),
  },
  {
    probeId: 'PROBE-002',
    name: 'Steam Table Probe Beta',
    model: 'ThermoWorks Signals BT',
    macAddress: 'AA:BB:CC:DD:EE:02',
    batteryPct: 62,
    isConnected: true,
    lastSeenAt: new Date().toISOString(),
  },
  {
    probeId: 'PROBE-003',
    name: 'Cold Holding Probe Gamma',
    model: 'Govee H5074',
    macAddress: 'AA:BB:CC:DD:EE:03',
    batteryPct: 45,
    isConnected: false,
    lastSeenAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
]

// ── Engine ────────────────────────────────────────────────────────────────────

export class BluetoothProbeManager {
  private static readonly HOT_HOLD_MIN_F = 140
  private static readonly COLD_HOLD_MAX_F = 41

  /**
   * Scan for available BLE HACCP probes.
   * Returns all registered probe devices and their connection status.
   */
  scanForProbes(): ProbeDevice[] {
    return MOCK_PROBES.map((p) => ({
      ...p,
      lastSeenAt: new Date().toISOString(),
    }))
  }

  /**
   * Read the current temperature from a specific probe.
   * Deterministic simulation: uses probe ID hash + time bucket to vary readings.
   */
  readTemperature(probeId: string, stationId: string = 'STATION-UNKNOWN'): ProbeReading {
    const probe = MOCK_PROBES.find((p) => p.probeId === probeId)
    if (!probe) {
      throw new Error(`Probe ${probeId} not found`)
    }

    // Deterministic temp: hash of probeId+minuteBucket maps to 128-175 range
    const minuteBucket = Math.floor(Date.now() / 60000)
    const hash = crypto
      .createHash('md5')
      .update(`${probeId}:${minuteBucket}`)
      .digest('hex')
    const hashInt = parseInt(hash.slice(0, 4), 16)

    // PROBE-003 simulates a cold-hold probe (35-45 range)
    let tempF: number
    if (probeId === 'PROBE-003') {
      tempF = 35 + (hashInt % 15)
    } else {
      // Hot-hold probes: range 128-175 F; some will violate 140 threshold
      tempF = 128 + (hashInt % 48)
    }

    const tempC = Math.round(((tempF - 32) * 5) / 9 * 10) / 10

    return {
      probeId,
      stationId,
      tempF,
      tempC,
      readAt: new Date().toISOString(),
      signalRssi: -60 - (hashInt % 20),
    }
  }

  /**
   * Log a HACCP temperature reading to the audit trail.
   * Fires a haccp.temp.violation webhook event if temperature violates safety thresholds.
   */
  async logToHaccp(
    probeId: string,
    stationId: string,
    itemName: string,
    loggedBy: string = 'system'
  ): Promise<HaccpLogEntry> {
    const reading = this.readTemperature(probeId, stationId)
    const logId = `HACCP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`

    // Determine violation type
    let violationType: HaccpLogEntry['violationType'] | undefined
    let compliant = true
    let correctionRequired = false

    if (reading.tempF < BluetoothProbeManager.HOT_HOLD_MIN_F && probeId !== 'PROBE-003') {
      violationType = 'hot_hold_below_140'
      compliant = false
      correctionRequired = true
    } else if (reading.tempF > BluetoothProbeManager.COLD_HOLD_MAX_F && probeId === 'PROBE-003') {
      violationType = 'cold_hold_above_41'
      compliant = false
      correctionRequired = true
    }

    let webhookFired = false

    if (!compliant && violationType) {
      // Fire webhook event
      const event: HaccpTempViolationEvent = {
        event: 'haccp.temp.violation',
        eventId: crypto.randomUUID(),
        facilityId: process.env.FACILITY_ID ?? 'FAC-001',
        emittedAt: new Date().toISOString(),
        payload: {
          probeId,
          stationId,
          itemName,
          measuredTempF: reading.tempF,
          requiredMinTempF: BluetoothProbeManager.HOT_HOLD_MIN_F,
          violationType,
          loggedBy,
          correctionRequired,
        },
      }

      globalWebhookEmitter.emit(event).catch((err) => {
        console.error('[BluetoothProbe] Webhook emit error:', err)
      })

      webhookFired = true
      console.warn(
        `[HACCP] VIOLATION: ${itemName} at ${stationId} read ${reading.tempF}F (min: ${BluetoothProbeManager.HOT_HOLD_MIN_F}F) — webhook fired`
      )
    }

    return {
      logId,
      probeId,
      stationId,
      itemName,
      measuredTempF: reading.tempF,
      requiredMinTempF: BluetoothProbeManager.HOT_HOLD_MIN_F,
      compliant,
      violationType,
      correctionRequired,
      loggedAt: reading.readAt,
      webhookFired,
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const globalProbeManager = new BluetoothProbeManager()
