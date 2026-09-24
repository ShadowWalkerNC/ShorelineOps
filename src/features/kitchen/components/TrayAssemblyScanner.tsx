import React, { useRef, useState } from 'react'
import { AppleButton, AppleBadge } from '@/apple-ui'
import { QrCode, CheckCircle2, AlertOctagon, Ban, ShieldAlert, HelpCircle } from 'lucide-react'
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
  // B14 demo-honesty: set when the result was fabricated client-side because the
  // validation service was unreachable — never present it as a real verification.
  simulated?: boolean
}

export default function TrayAssemblyScanner() {
  const [scanInput, setScanInput] = useState('')
  const [loading, setLoading] = useState(false)
  const inFlight = useRef(false)
  const [scanResult, setScanResult] = useState<ScanValidationResult | null>(null)
  const [scanHistory, setScanHistory] = useState<Array<ScanValidationResult & { timestamp: string }>>([])

  // Web Audio chime / buzzer synthesizer (zero external assets needed)
  const playFeedbackSound = (type: 'success' | 'alert') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      if (type === 'success') {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1) // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
        osc.start()
        osc.stop(ctx.currentTime + 0.3)
      } else {
        // Harsh alert buzzer
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(220, ctx.currentTime) // A3
        osc.frequency.setValueAtTime(164.81, ctx.currentTime + 0.15) // E3
        gain.gain.setValueAtTime(0.4, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        osc.start()
        osc.stop(ctx.currentTime + 0.5)
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
    const ensureRes = await fetch('/api/trayruns/ensure', { method: 'POST', headers,
      body: JSON.stringify({ mealSlot: result.mealSlot, serviceDate: result.serviceDate }) })
    if (!ensureRes.ok) throw new Error('Assembly not recorded. Hold tray and retry.')
    const { run } = await ensureRes.json()
    if (!run?.id) throw new Error('No tray run returned. Hold tray.')
    const response = await fetch(`/api/trayruns/${run.id}/events`, { method: 'POST', headers,
      body: JSON.stringify({ rawQrPayload, event: 'assembled', note: 'Signed tray verified at assembly' }) })
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
      if (!['VALID', 'SUPERSEDED', 'INVALID_HASH', 'NPO_ALERT', 'HOLD_TRAY_RD_SIGNOFF'].includes(result.status)) throw new Error('Invalid verification response. Hold tray.')
      if (result.status === 'VALID') {
        if (!result.ticketId || !result.residentId || !result.mealSlot || !result.serviceDate) throw new Error('Incomplete verification. Hold tray.')
        await recordAssembledEvent(rawQrPayload.trim(), result)
        result.message = 'Assembly recorded. Current signed tray verified.'
      }

      setScanResult(result)
      setScanHistory(prev => [{ ...result, timestamp: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)])

      if (result.status === 'VALID' && !result.simulated) {
        playFeedbackSound('success')
      } else {
        playFeedbackSound('alert')
        triggerHaptic()
      }
    } catch (err: any) {
      const errorResult: ScanValidationResult = {
        status: 'INVALID_HASH',
        message: `Scan verification network error: ${err.message}`,
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

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: 20,
      marginBottom: 24,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <QrCode className="w-5 h-5 text-teal-600" />
            <span>Digital Tray Line Assembly Scanner</span>
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Scan signed QR tokens on physical tray cards to detect stale diet orders or NPO halts in real-time.
          </p>
        </div>
      </div>

      {/* Barcode / QR Input Box */}
      <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          value={scanInput}
          onChange={e => setScanInput(e.target.value)}
          aria-label="Complete signed tray QR code"
          placeholder="Scan or paste the complete signed QR code"
          disabled={loading}
          autoFocus
          style={{
            flex: '1 1 200px',
            minWidth: 0,
            minHeight: 48,
            height: 'var(--btn-height-md)',
            padding: '0 16px',
            fontSize: 14,
            fontFamily: 'var(--font-mono)',
            border: '2px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            outline: 'none',
            background: 'var(--bg-app)',
            color: 'var(--text-primary)',
          }}
        />
        <AppleButton
          type="submit"
          variant="primary"
          size="md"
          disabled={loading || !scanInput.trim()}
        >
          {loading ? 'Verifying...' : 'Verify Scan'}
        </AppleButton>
      </form>

      {/* Live Scan Result Banner */}
      {scanResult && (
        <div style={{
          padding: 24,
          borderRadius: 'var(--radius-lg)',
          borderWidth: 4,
          borderStyle: 'solid',
          borderColor: scanResult.status === 'VALID' ? '#10b981' : '#ef4444',
          background: scanResult.status === 'VALID' ? '#f0fdf4' : '#fef2f2',
          marginBottom: 20,
          textAlign: 'center',
          animation: scanResult.status !== 'VALID' ? 'pulse 1s infinite' : 'none',
        }}>
          {scanResult.status === 'VALID' ? (
            <div>
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" style={{ marginBottom: 8 }} />
              {scanResult.simulated && (
                <AppleBadge color="orange">SIMULATED — not a real scan verification</AppleBadge>
              )}
              <h3 style={{ fontSize: 22, fontWeight: 900, color: '#166534', margin: 0 }}>
                {scanResult.simulated ? 'TRAY SCAN SIMULATED (OFFLINE)' : 'ASSEMBLY RECORDED'}
              </h3>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#15803d', margin: '8px 0 0' }}>
                {scanResult.residentName} (Room {scanResult.roomBed}) • Current Diet Profile (v{scanResult.currentProfileVersion})
              </p>
              <div style={{ fontSize: 13, color: '#166534', marginTop: 4 }}>
                {scanResult.message}
              </div>
            </div>
          ) : scanResult.status === 'SUPERSEDED' ? (
            <div>
              <AlertOctagon className="w-10 h-10 text-rose-600 mx-auto" style={{ marginBottom: 8 }} />
              {scanResult.simulated && (
                <AppleBadge color="orange">SIMULATED — not a real scan verification</AppleBadge>
              )}
              <h3 style={{ fontSize: 24, fontWeight: 900, color: '#991b1b', margin: 0, textTransform: 'uppercase' }}>
                HALT: DIET ORDER CHANGED
              </h3>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#7f1d1d', margin: '8px 0 0' }}>
                Resident <strong>{scanResult.residentName}</strong> (Room {scanResult.roomBed}) has an updated diet order (v{scanResult.currentProfileVersion}).
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c', margin: '6px 0 0' }}>
                This physical tray card is version <strong>v{scanResult.ticketProfileVersion} (STALE)</strong> and must be discarded.
              </p>
              <div style={{ marginTop: 14 }}>
                <span style={{
                  padding: '6px 14px',
                  background: '#dc2626',
                  color: 'white',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 800,
                  display: 'inline-block',
                }}>
                  Reprint Fresh Tray Ticket (v{scanResult.currentProfileVersion})
                </span>
              </div>
            </div>
          ) : scanResult.status === 'NPO_ALERT' ? (
            <div>
              <Ban className="w-10 h-10 text-rose-700 mx-auto" style={{ marginBottom: 8 }} />
              <h3 style={{ fontSize: 24, fontWeight: 900, color: '#991b1b', margin: 0, textTransform: 'uppercase' }}>
                STRICT NPO - DO NOT SERVE MEAL
              </h3>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#7f1d1d', margin: '8px 0 0' }}>
                {scanResult.residentName} (Room {scanResult.roomBed}) is designated <strong>NPO</strong>.
              </p>
              <div style={{ fontSize: 14, color: '#991b1b', marginTop: 4 }}>
                {scanResult.message}
              </div>
            </div>
          ) : scanResult.status === 'HOLD_TRAY_RD_SIGNOFF' ? (
            <div>
              <ShieldAlert className="w-10 h-10 text-rose-700 mx-auto" style={{ marginBottom: 8 }} />
              <h3 style={{ fontSize: 24, fontWeight: 900, color: '#991b1b', margin: 0, textTransform: 'uppercase' }}>
                CLINICAL HOLD: EHR DIET UPDATE PENDING RD SIGN-OFF
              </h3>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#7f1d1d', margin: '8px 0 0' }}>
                {scanResult.residentName} (Room {scanResult.roomBed}) has an unverified clinical diet change received from PointClickCare.
              </p>
              <div style={{
                margin: '12px auto',
                maxWidth: 550,
                padding: '10px 14px',
                background: '#fee2e2',
                borderRadius: 8,
                border: '1px solid #f87171',
                fontSize: 13,
                fontWeight: 700,
                color: '#991b1b',
                textAlign: 'left'
              }}>
                <strong>Clinical Conflict Reason:</strong> {scanResult.triageReason || scanResult.message || 'Incoming EHR order conflicts with active tray profile.'}
              </div>
              <div style={{ marginTop: 14 }}>
                <span style={{
                  padding: '8px 18px',
                  background: '#991b1b',
                  color: 'white',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 900,
                  display: 'inline-block',
                  letterSpacing: '0.05em'
                }}>
                  HARD-BLOCK: TRAY HELD AT PASS UNTIL RD RECONCILIATION
                </span>
              </div>
            </div>
          ) : (
            <div>
              <HelpCircle className="w-10 h-10 text-amber-600 mx-auto" style={{ marginBottom: 8 }} />
              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#92400e', margin: 0 }}>
                UNRECOGNIZED TRAY CARD HASH
              </h3>
              <div style={{ fontSize: 13, color: '#b45309', marginTop: 4 }}>
                {scanResult.message}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Scan History */}
      {scanHistory.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Recent Line Scans
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {scanHistory.map((h, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: h.status === 'VALID' ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${h.status === 'VALID' ? '#bbf7d0' : '#fecaca'}`,
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AppleBadge
                    color={h.status === 'VALID' ? 'green' : h.status === 'SUPERSEDED' ? 'orange' : 'red'}
                    dot
                  >
                    {h.status === 'VALID' ? 'VALID' : h.status === 'SUPERSEDED' ? 'STALE' : 'NPO'}
                  </AppleBadge>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {h.residentName || 'Card Scan'} ({h.roomBed || 'Room'})
                  </span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  {h.timestamp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
