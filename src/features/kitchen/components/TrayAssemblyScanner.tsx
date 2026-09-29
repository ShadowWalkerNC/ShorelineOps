import React, { useRef, useState } from 'react'
import { AppleButton, AppleBadge } from '@/apple-ui'
import {
  QrCode,
  CheckCircle2,
  AlertOctagon,
  Ban,
  ShieldAlert,
  HelpCircle,
  Volume2,
  RefreshCw,
  Sparkles,
  Check,
  AlertTriangle
} from 'lucide-react'
import { tokenManager } from '../../../security/tokenManager'

export interface ScanValidationResult {
  ticketId?: string
  residentId?: string
  mealSlot?: string
  serviceDate?: string
  status: 'VALID' | 'SUPERSEDED' | 'INVALID_HASH' | 'NPO_ALERT' | 'HOLD_TRAY_RD_SIGNOFF'
  residentName?: string
  roomBed?: string
  currentProfileVersion?: number
  ticketProfileVersion?: number
  message?: string
  triageReason?: string
  simulated?: boolean
}

/**
 * TrayAssemblyScanner — Inspired by Epic Rover & Computrition HS onTray.
 * High-contrast, tactile verification scanner for kitchen tablet kiosks.
 * Features audio-haptic feedback, deterministic NPO hard-blocks, and
 * a built-in clinical drill simulator for training and onboarding.
 */
export default function TrayAssemblyScanner() {
  const [scanInput, setScanInput] = useState('')
  const [loading, setLoading] = useState(false)
  const inFlight = useRef(false)
  const [scanResult, setScanResult] = useState<ScanValidationResult | null>(null)
  const [scanHistory, setScanHistory] = useState<Array<ScanValidationResult & { timestamp: string }>>([])
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Web Audio chime / buzzer synthesizer (zero external mp3 assets needed)
  const playFeedbackSound = (type: 'success' | 'alert' | 'danger') => {
    if (!soundEnabled) return
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()

      if (type === 'success') {
        // High-pitched double chime (D5 -> A5)
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1) // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
        osc.start()
        osc.stop(ctx.currentTime + 0.3)
      } else if (type === 'danger') {
        // Urgent repeating siren buzzer (Low A3 -> Low F3)
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(220, ctx.currentTime)
        osc.frequency.setValueAtTime(174.61, ctx.currentTime + 0.15)
        gain.gain.setValueAtTime(0.35, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        osc.start()
        osc.stop(ctx.currentTime + 0.5)
      } else {
        // Warning tone (Medium E4)
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(329.63, ctx.currentTime)
        gain.gain.setValueAtTime(0.25, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
        osc.start()
        osc.stop(ctx.currentTime + 0.35)
      }
    } catch {
      // AudioContext unavailable or blocked
    }
  }

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200])
    }
  }

  const recordAssembledEvent = async (rawQrPayload: string, result: ScanValidationResult) => {
    const token = tokenManager.getAccessToken()
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` }
    const ensureRes = await fetch('/api/trayruns/ensure', {
      method: 'POST',
      headers,
      body: JSON.stringify({ mealSlot: result.mealSlot, serviceDate: result.serviceDate })
    })
    if (!ensureRes.ok) throw new Error('Assembly not recorded. Hold tray and retry.')
    const { run } = await ensureRes.json()
    if (!run?.id) throw new Error('No tray run returned. Hold tray.')
    const response = await fetch(`/api/trayruns/${run.id}/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rawQrPayload, event: 'assembled', note: 'Signed tray verified at assembly' })
    })
    if (!response.ok) throw new Error((await response.json()).error || 'Assembly not recorded. Hold tray.')
  }

  const handleScan = async (rawQrPayload: string) => {
    if (!rawQrPayload.trim() || inFlight.current) return
    inFlight.current = true
    setLoading(true)
    try {
      const token = tokenManager.getAccessToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/kitchen/verify-tray-scan', {
        method: 'POST',
        headers,
        body: JSON.stringify({ rawQrPayload: rawQrPayload.trim() }),
      })

      if (!res.ok) throw new Error('Verification unavailable. Hold tray and retry when connected.')
      const result: ScanValidationResult = await res.json()
      if (!['VALID', 'SUPERSEDED', 'INVALID_HASH', 'NPO_ALERT', 'HOLD_TRAY_RD_SIGNOFF'].includes(result.status)) {
        throw new Error('Invalid verification response. Hold tray.')
      }

      if (result.status === 'VALID') {
        if (!result.ticketId || !result.residentId || !result.mealSlot || !result.serviceDate) {
          throw new Error('Incomplete verification. Hold tray.')
        }
        await recordAssembledEvent(rawQrPayload.trim(), result)
        result.message = 'Assembly recorded. Current signed tray verified.'
      }

      setScanResult(result)
      setScanHistory(prev => [{ ...result, timestamp: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)])

      if (result.status === 'VALID' && !result.simulated) {
        playFeedbackSound('success')
      } else if (result.status === 'NPO_ALERT' || result.status === 'HOLD_TRAY_RD_SIGNOFF') {
        playFeedbackSound('danger')
        triggerHaptic()
      } else {
        playFeedbackSound('alert')
        triggerHaptic()
      }
    } catch (err: any) {
      const errorResult: ScanValidationResult = {
        status: 'INVALID_HASH',
        message: `Scan verification error: ${err.message}`,
      }
      setScanResult(errorResult)
      playFeedbackSound('alert')
    } finally {
      inFlight.current = false
      setLoading(false)
      setScanInput('')
    }
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleScan(scanInput)
  }

  // Clinical Drill Simulation Helpers for Training
  const triggerDrill = (type: 'valid' | 'stale' | 'npo' | 'hold') => {
    let result: ScanValidationResult
    if (type === 'valid') {
      result = {
        status: 'VALID',
        ticketId: 'tkt-demo-101',
        residentName: 'Harold Simmons',
        roomBed: '104-A',
        mealSlot: 'Lunch',
        serviceDate: new Date().toISOString().slice(0, 10),
        currentProfileVersion: 3,
        ticketProfileVersion: 3,
        message: 'Current signed tray verified. All allergens and pureed texture checks cleared.',
        simulated: true,
      }
      playFeedbackSound('success')
    } else if (type === 'stale') {
      result = {
        status: 'SUPERSEDED',
        ticketId: 'tkt-demo-089',
        residentName: 'Dorothy Miller',
        roomBed: '202-B',
        mealSlot: 'Lunch',
        serviceDate: new Date().toISOString().slice(0, 10),
        currentProfileVersion: 4,
        ticketProfileVersion: 3,
        message: 'Diet order was updated from Level 6 to Level 4 Pureed after ticket printing.',
        simulated: true,
      }
      playFeedbackSound('alert')
      triggerHaptic()
    } else if (type === 'npo') {
      result = {
        status: 'NPO_ALERT',
        ticketId: 'tkt-demo-077',
        residentName: 'Arthur Pendelton',
        roomBed: '118-A',
        mealSlot: 'Lunch',
        serviceDate: new Date().toISOString().slice(0, 10),
        currentProfileVersion: 2,
        ticketProfileVersion: 2,
        message: 'Physician placed resident on Strict NPO pending barium swallow evaluation at 1:30 PM.',
        simulated: true,
      }
      playFeedbackSound('danger')
      triggerHaptic()
    } else {
      result = {
        status: 'HOLD_TRAY_RD_SIGNOFF',
        ticketId: 'tkt-demo-065',
        residentName: 'Evelyn Vance',
        roomBed: '305-C',
        mealSlot: 'Lunch',
        serviceDate: new Date().toISOString().slice(0, 10),
        currentProfileVersion: 5,
        ticketProfileVersion: 4,
        message: 'PointClickCare inbound webhook received: new Shellfish allergy requires RD sign-off.',
        triageReason: 'Allergy Conflict: Entree contains oyster sauce; pending dietitian substitution.',
        simulated: true,
      }
      playFeedbackSound('danger')
      triggerHaptic()
    }
    setScanResult(result)
    setScanHistory(prev => [{ ...result, timestamp: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)])
  }

  return (
    <div className="border border-slate-200 dark:border-obsidian-border rounded-xl bg-white dark:bg-obsidian-card p-5 sm:p-6 shadow-surface mb-6">
      {/* Scanner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-shoreline-600 dark:text-shoreline-400" />
            <span>Digital Tray Line Assembly Scanner</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Positive Patient Identification (PPID) &amp; cryptographic QR validation. Halts stale tickets and NPO orders in real time.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors ${
              soundEnabled
                ? 'bg-shoreline-500/10 border-shoreline-500/30 text-shoreline-700 dark:text-shoreline-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{soundEnabled ? 'Audio Chime ON' : 'Audio OFF'}</span>
          </button>
        </div>
      </div>

      {/* Barcode / QR Input Box */}
      <form onSubmit={handleFormSubmit} className="flex flex-wrap gap-2.5 mb-5">
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            aria-label="Scan signed tray QR token"
            placeholder="Scan barcode or paste ticket token (e.g. tkt-104:v3:hash)..."
            disabled={loading}
            autoFocus
            className="w-full min-h-[46px] px-4 text-xs sm:text-sm font-mono bg-slate-50 dark:bg-obsidian-surface border border-slate-200 dark:border-obsidian-border rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-shoreline-500/30"
          />
        </div>
        <AppleButton
          type="submit"
          variant="primary"
          size="md"
          className="min-h-[46px] px-5"
          disabled={loading || !scanInput.trim()}
        >
          {loading ? 'Verifying...' : 'Verify Scan'}
        </AppleButton>
      </form>

      {/* Clinical Drill Simulator Buttons (Toast/Epic Rover Training) */}
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-obsidian-surface/60 border border-slate-200/80 dark:border-obsidian-border mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-shoreline-600" />
            <span>KITCHEN DRILL &amp; SAFETY SIMULATOR (TAP TO TEST WORKFLOW)</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <button
            type="button"
            onClick={() => triggerDrill('valid')}
            className="py-2 px-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-semibold font-mono text-[11px] text-center transition-colors"
          >
            ✓ Drill: Valid Tray
          </button>
          <button
            type="button"
            onClick={() => triggerDrill('stale')}
            className="py-2 px-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold font-mono text-[11px] text-center transition-colors"
          >
            ⚠ Drill: Stale Ticket
          </button>
          <button
            type="button"
            onClick={() => triggerDrill('npo')}
            className="py-2 px-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-800 dark:text-rose-300 font-semibold font-mono text-[11px] text-center transition-colors"
          >
            ⛔ Drill: Strict NPO
          </button>
          <button
            type="button"
            onClick={() => triggerDrill('hold')}
            className="py-2 px-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-800 dark:text-purple-300 font-semibold font-mono text-[11px] text-center transition-colors"
          >
            🛡 Drill: RD Hold
          </button>
        </div>
      </div>

      {/* High-Impact Clinical Scan Takeover Result */}
      {scanResult && (
        <div
          className={`p-6 rounded-xl border-2 mb-6 transition-all ${
            scanResult.status === 'VALID'
              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
              : scanResult.status === 'SUPERSEDED'
              ? 'border-amber-500 bg-amber-500/10 text-amber-950 dark:text-amber-100 animate-pulse'
              : scanResult.status === 'NPO_ALERT'
              ? 'border-rose-600 bg-rose-600/15 text-rose-950 dark:text-rose-100 animate-pulse'
              : scanResult.status === 'HOLD_TRAY_RD_SIGNOFF'
              ? 'border-purple-600 bg-purple-600/15 text-purple-950 dark:text-purple-100'
              : 'border-slate-500 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
          }`}
        >
          {scanResult.status === 'VALID' ? (
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
              {scanResult.simulated && (
                <div className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 uppercase mb-2">
                  DRILL SIMULATION
                </div>
              )}
              <h3 className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-tight">
                ASSEMBLY CLEARED · READY FOR DELIVERY
              </h3>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                {scanResult.residentName} (Room {scanResult.roomBed}) · Verified Active Profile (v{scanResult.currentProfileVersion})
              </p>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1 max-w-lg mx-auto">
                {scanResult.message}
              </p>
            </div>
          ) : scanResult.status === 'SUPERSEDED' ? (
            <div className="text-center">
              <AlertOctagon className="w-12 h-12 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
              <div className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 uppercase mb-2">
                CRITICAL WARNING
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-300 uppercase tracking-tight">
                HALT: TICKET SUPERSEDED BY EHR ORDER
              </h3>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                Resident <strong>{scanResult.residentName}</strong> (Room {scanResult.roomBed}) has an active diet profile (v{scanResult.currentProfileVersion}).
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 max-w-xl mx-auto">
                This paper ticket is version <strong>v{scanResult.ticketProfileVersion} (STALE)</strong>. The diet or texture was modified in the EHR after this ticket was printed.
              </p>
              <div className="mt-4">
                <span className="px-4 py-2 rounded-lg bg-amber-600 text-white font-mono text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                  <span>DISCARD CARD &amp; REPRINT FRESH TICKET</span>
                </span>
              </div>
            </div>
          ) : scanResult.status === 'NPO_ALERT' ? (
            <div className="text-center">
              <Ban className="w-12 h-12 text-rose-600 dark:text-rose-400 mx-auto mb-2" />
              <div className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-600/20 text-rose-800 dark:text-rose-200 border border-rose-600/30 uppercase mb-2">
                NON-OVERRIDABLE CLINICAL SAFETY HALT
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-300 uppercase tracking-tight">
                STRICT NPO · DO NOT DISPATCH TRAY
              </h3>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                Resident <strong>{scanResult.residentName}</strong> (Room {scanResult.roomBed}) is currently designated NPO.
              </p>
              <p className="text-xs text-rose-800 dark:text-rose-200 mt-1 max-w-lg mx-auto">
                {scanResult.message}
              </p>
              <div className="mt-4">
                <span className="px-4 py-2 rounded-lg bg-rose-700 text-white font-mono text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                  <span>HOLD TRAY AT PASS · CONTACT FLOOR NURSE</span>
                </span>
              </div>
            </div>
          ) : scanResult.status === 'HOLD_TRAY_RD_SIGNOFF' ? (
            <div className="text-center">
              <ShieldAlert className="w-12 h-12 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
              <div className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-600/20 text-purple-800 dark:text-purple-300 border border-purple-600/30 uppercase mb-2">
                CLINICAL TRIAGE GATE
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-purple-700 dark:text-purple-300 uppercase tracking-tight">
                CLINICAL HOLD: DIET UPDATE PENDING RD SIGN-OFF
              </h3>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                Resident <strong>{scanResult.residentName}</strong> (Room {scanResult.roomBed}) has an unverified change in the RD Triage Queue.
              </p>
              {scanResult.triageReason && (
                <div className="my-3 max-w-lg mx-auto p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-900 dark:text-purple-200 text-left font-mono">
                  <strong>Conflict:</strong> {scanResult.triageReason}
                </div>
              )}
              <div className="mt-4">
                <span className="px-4 py-2 rounded-lg bg-purple-700 text-white font-mono text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                  <span>HOLD AT PASS UNTIL DIETITIAN RECONCILIATION</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <HelpCircle className="w-12 h-12 text-slate-500 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase">
                UNRECOGNIZED TICKET TOKEN
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {scanResult.message || 'Ticket hash cannot be matched against active clinical census.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recent Scan History Log */}
      {scanHistory.length > 0 && (
        <div>
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
            RECENT LINE SCANS (AUDIT TRAIL)
          </div>
          <div className="space-y-1.5">
            {scanHistory.map((h, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-mono transition-colors ${
                  h.status === 'VALID'
                    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-950 dark:text-emerald-200'
                    : h.status === 'SUPERSEDED'
                    ? 'border-amber-500/20 bg-amber-500/5 text-amber-950 dark:text-amber-200'
                    : 'border-rose-500/20 bg-rose-500/5 text-rose-950 dark:text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      h.status === 'VALID' ? 'bg-emerald-500' : h.status === 'SUPERSEDED' ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                  />
                  <span className="font-bold">{h.status}</span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {h.residentName || 'Ticket Scan'} ({h.roomBed || 'Rm'})
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">{h.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
