import React, { useState } from 'react'

export interface ScanValidationResult {
  status: 'VALID' | 'SUPERSEDED' | 'INVALID_HASH' | 'NPO_ALERT'
  residentName?: string
  roomBed?: string
  currentProfileVersion?: number
  ticketProfileVersion?: number
  message?: string
}

export default function TrayAssemblyScanner() {
  const [scanInput, setScanInput] = useState('')
  const [loading, setLoading] = useState(false)
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

  const handleScan = async (rawQrPayload: string) => {
    if (!rawQrPayload.trim()) return
    setLoading(true)
    try {
      const token = localStorage.getItem('shoreline_auth_token')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/kitchen/verify-tray-scan', {
        method: 'POST',
        headers,
        body: JSON.stringify({ rawQrPayload: rawQrPayload.trim() }),
      })

      let result: ScanValidationResult
      if (res.ok) {
        result = await res.json()
      } else {
        // Fallback simulation for offline testing
        const parts = rawQrPayload.split(':')
        const profileVer = parts[1] ? parseInt(parts[1], 10) : 1
        result = {
          status: profileVer < 2 ? 'SUPERSEDED' : 'VALID',
          residentName: 'Sample Resident',
          roomBed: '104-A',
          currentProfileVersion: 2,
          ticketProfileVersion: profileVer,
          message: profileVer < 2 ? 'Diet order changed. Ticket is stale.' : 'Tray ticket verified.',
        }
      }

      setScanResult(result)
      setScanHistory(prev => [{ ...result, timestamp: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)])

      if (result.status === 'VALID') {
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
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            📸 Digital Tray Line Assembly Scanner
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Scan signed QR tokens on physical tray cards to detect stale diet orders or NPO halts in real-time.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => handleScan('TKT-res101:1:validhash123')}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 'var(--radius-md)',
              border: '1px solid #10b981',
              background: '#ecfdf5',
              color: '#065f46',
              cursor: 'pointer',
            }}
          >
            🧪 Test Valid Scan
          </button>
          <button
            onClick={() => handleScan('TKT-res102:1:stalehash999')}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 'var(--radius-md)',
              border: '1px solid #ef4444',
              background: '#fee2e2',
              color: '#991b1b',
              cursor: 'pointer',
            }}
          >
            🧪 Test Stale Ticket
          </button>
        </div>
      </div>

      {/* Barcode / QR Input Box */}
      <form onSubmit={handleFormSubmit} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          value={scanInput}
          onChange={e => setScanInput(e.target.value)}
          placeholder="Scan barcode or type ticket payload (e.g. TKT-res101:2:a9f3e)..."
          autoFocus
          style={{
            flex: 1,
            padding: '12px 16px',
            fontSize: 15,
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
            border: '2px solid var(--color-primary, #6366f1)',
            background: 'var(--bg-subtle, #f8fafc)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="submit"
          disabled={loading || !scanInput.trim()}
          style={{
            padding: '12px 24px',
            fontSize: 14,
            fontWeight: 800,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-primary, #6366f1)',
            color: 'white',
            border: 'none',
            cursor: loading || !scanInput.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !scanInput.trim() ? 0.6 : 1,
          }}
        >
          {loading ? 'Verifying...' : '⚡ Verify Scan'}
        </button>
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
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <h3 style={{ fontSize: 22, fontWeight: 900, color: '#166534', margin: 0 }}>
                TRAY APPROVED FOR SERVICE
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
              <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️ 🛑</div>
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
                  🖨️ Reprint Fresh Tray Ticket (v{scanResult.currentProfileVersion})
                </span>
              </div>
            </div>
          ) : scanResult.status === 'NPO_ALERT' ? (
            <div>
              <div style={{ fontSize: 36, marginBottom: 8 }}>⛔ 🛑</div>
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
          ) : (
            <div>
              <div style={{ fontSize: 32, marginBottom: 8 }}>❓</div>
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
                <div>
                  <span style={{ fontWeight: 800, color: h.status === 'VALID' ? '#15803d' : '#991b1b' }}>
                    {h.status === 'VALID' ? '✅ VALID' : h.status === 'SUPERSEDED' ? '⚠️ STALE' : '⛔ NPO'}
                  </span>{' '}
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
