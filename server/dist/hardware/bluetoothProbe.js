"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalProbeManager = exports.BluetoothProbeManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
const emitter_1 = require("../webhooks/emitter");
// ── Mock probe registry (replace with real BLE discovery in production) ───────
const MOCK_PROBES = [
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
];
// ── Engine ────────────────────────────────────────────────────────────────────
class BluetoothProbeManager {
    static HOT_HOLD_MIN_F = 140;
    static COLD_HOLD_MAX_F = 41;
    /**
     * Scan for available BLE HACCP probes.
     * Returns all registered probe devices and their connection status.
     */
    scanForProbes() {
        return MOCK_PROBES.map((p) => ({
            ...p,
            lastSeenAt: new Date().toISOString(),
        }));
    }
    /**
     * Read the current temperature from a specific probe.
     * Deterministic simulation: uses probe ID hash + time bucket to vary readings.
     */
    readTemperature(probeId, stationId = 'STATION-UNKNOWN') {
        const probe = MOCK_PROBES.find((p) => p.probeId === probeId);
        if (!probe) {
            throw new Error(`Probe ${probeId} not found`);
        }
        // Deterministic temp: hash of probeId+minuteBucket maps to 128-175 range
        const minuteBucket = Math.floor(Date.now() / 60000);
        const hash = crypto_1.default
            .createHash('md5')
            .update(`${probeId}:${minuteBucket}`)
            .digest('hex');
        const hashInt = parseInt(hash.slice(0, 4), 16);
        // PROBE-003 simulates a cold-hold probe (35-45 range)
        let tempF;
        if (probeId === 'PROBE-003') {
            tempF = 35 + (hashInt % 15);
        }
        else {
            // Hot-hold probes: range 128-175 F; some will violate 140 threshold
            tempF = 128 + (hashInt % 48);
        }
        const tempC = Math.round(((tempF - 32) * 5) / 9 * 10) / 10;
        return {
            probeId,
            stationId,
            tempF,
            tempC,
            readAt: new Date().toISOString(),
            signalRssi: -60 - (hashInt % 20),
        };
    }
    /**
     * Log a HACCP temperature reading to the audit trail.
     * Fires a haccp.temp.violation webhook event if temperature violates safety thresholds.
     */
    async logToHaccp(probeId, stationId, itemName, loggedBy = 'system') {
        const reading = this.readTemperature(probeId, stationId);
        const logId = `HACCP-${Date.now()}-${crypto_1.default.randomBytes(3).toString('hex').toUpperCase()}`;
        // Determine violation type
        let violationType;
        let compliant = true;
        let correctionRequired = false;
        if (reading.tempF < BluetoothProbeManager.HOT_HOLD_MIN_F && probeId !== 'PROBE-003') {
            violationType = 'hot_hold_below_140';
            compliant = false;
            correctionRequired = true;
        }
        else if (reading.tempF > BluetoothProbeManager.COLD_HOLD_MAX_F && probeId === 'PROBE-003') {
            violationType = 'cold_hold_above_41';
            compliant = false;
            correctionRequired = true;
        }
        let webhookFired = false;
        if (!compliant && violationType) {
            // Fire webhook event
            const event = {
                event: 'haccp.temp.violation',
                eventId: crypto_1.default.randomUUID(),
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
            };
            emitter_1.globalWebhookEmitter.emit(event).catch((err) => {
                console.error('[BluetoothProbe] Webhook emit error:', err);
            });
            webhookFired = true;
            console.warn(`[HACCP] VIOLATION: ${itemName} at ${stationId} read ${reading.tempF}F (min: ${BluetoothProbeManager.HOT_HOLD_MIN_F}F) — webhook fired`);
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
        };
    }
}
exports.BluetoothProbeManager = BluetoothProbeManager;
// ── Singleton ─────────────────────────────────────────────────────────────────
exports.globalProbeManager = new BluetoothProbeManager();
