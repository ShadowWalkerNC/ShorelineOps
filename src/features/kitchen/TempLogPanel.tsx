import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { WebBluetoothProbeDriver } from './WebBluetoothProbe'
import {
  Thermometer,
  AlertTriangle,
  CheckCircle2,
  Bluetooth,
  Mic,
  MicOff,
  Radio,
  Edit3,
  Printer,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────────────────────
// TEMP LOG PANEL (C01) — durable HACCP temperature logging (CMS F812)
// Self-contained: equipment schedule, temp entry, violation flow, log list.
// No fabricated records: every row comes from the persisted haccp_logs table.
// A violation (out-of-range temp) cannot be saved without corrective-action
// text — the server enforces it (422) and this UI guides it.
// ────────────────────────────────────────────────────────────────────────────

type CheckType = 'food' | 'equipment'

interface Equipment {
  id: string
  name: string
  type: 'fridge' | 'freezer' | 'dishwasher' | 'hot-hold'
  target_temp_f: number
  check_frequency: string
}

interface ScheduleRow extends Equipment {
  last_log_id: string | null
  last_recorded_at: string | null
  last_temp_f: number | null
  next_due_at: string | null
  status: 'ok' | 'due' | 'overdue'
}

interface TempLog {
  id: string
  recorded_at: string
  check_type: CheckType
  item_name: string
  equipment_id: string | null
  equipment_name: string | null
  temp_f: number
  target_temp_f: number
  compliant: boolean | number
  violation_type: string | null
  corrective_action: string
  source: string
  probe_device: string | null
  recorded_by: string | null
}

const TYPE_LABEL: Record<string, string> = {
  fridge: 'Refrigerator',
  freezer: 'Freezer',
  dishwasher: 'Dishwasher',
  'hot-hold': 'Hot Hold',
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  ok:      { bg: '#e7f6ec', fg: '#166534', label: 'On schedule' },
  due:     { bg: '#fef3c7', fg: '#92400e', label: 'Due soon' },
  overdue: { bg: '#fee2e2', fg: '#991b1b', label: 'OVERDUE' },
}

function asBool(v: boolean | number | undefined): boolean {
  return v === true || v === 1
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function TempLogPanel() {
  const [tab, setTab] = useState<'log' | 'schedule' | 'logs'>('log')
  const [schedule, setSchedule] = useState<ScheduleRow[]>([])
  const [todayLogs, setTodayLogs] = useState<TempLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // — Entry form state —
  const [checkType, setCheckType] = useState<CheckType>('food')
  const [equipmentId, setEquipmentId] = useState('')
  const [itemName, setItemName] = useState('')
  const [tempF, setTempF] = useState('')
  const [targetTempF, setTargetTempF] = useState('165')
  const [source, setSource] = useState<'manual' | 'probe'>('manual')
  const [probeDevice, setProbeDevice] = useState('')
  const [violation, setViolation] = useState<{ measuredTempF: number; targetTempF: number; violationType: string } | null>(null)
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [fixLogId, setFixLogId] = useState<string | null>(null) // PATCH flow: add corrective action to an existing open violation
  const [fixAction, setFixAction] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // — Hardware & Voice Ergonomics —
  const [bluetoothConnecting, setBluetoothConnecting] = useState(false)
  const [bluetoothConnected, setBluetoothConnected] = useState(false)
  const [bluetoothDeviceName, setBluetoothDeviceName] = useState<string | null>(null)
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null)

  const handlePairBluetooth = async () => {
    setError(null)
    setNotice(null)
    if (!WebBluetoothProbeDriver.isSupported()) {
      setError('Web Bluetooth is not supported in this browser. Please use Chrome or Edge.')
      return
    }

    const driver = new WebBluetoothProbeDriver()
    setBluetoothConnecting(true)
    try {
      const res = await driver.connect((reading) => {
        setTempF(String(reading.temperatureF))
        setNotice(`Live BLE reading: ${reading.temperatureF}°F (${reading.deviceName})`)
      })
      if (res.success) {
        setBluetoothConnected(true)
        setBluetoothDeviceName(res.deviceName || 'HACCP BLE Probe')
        setProbeDevice(res.deviceName || 'HACCP BLE Probe')
        setSource('probe')
        setNotice(`Paired with ${res.deviceName || 'HACCP BLE Probe'}. Ready for live readings.`)
      } else if (res.error) {
        setError(res.error)
      }
    } catch (e: any) {
      setError(e.message || 'Bluetooth pairing failed')
    } finally {
      setBluetoothConnecting(false)
    }
  }

  const handleToggleVoice = () => {
    setError(null)
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRec) {
      setError('Hands-free voice recognition is not supported in this browser. Please use Chrome or Edge.')
      return
    }
    if (voiceListening) {
      setVoiceListening(false)
      setVoiceTranscript(null)
      return
    }

    try {
      const recognition = new SpeechRec()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'
      setVoiceListening(true)
      setVoiceTranscript('Listening... Speak temperature (e.g., "165 degrees")')

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setVoiceTranscript(`Heard: "${transcript}"`)
        const match = transcript.match(/\d+(\.\d+)?/)
        if (match) {
          setTempF(match[0])
          setNotice(`Voice captured temperature: ${match[0]}°F`)
        } else {
          setError(`Could not detect temperature number in: "${transcript}"`)
        }
        setVoiceListening(false)
      }

      recognition.onerror = (event: any) => {
        setError(`Voice error: ${event.error}`)
        setVoiceListening(false)
        setVoiceTranscript(null)
      }

      recognition.onend = () => {
        setVoiceListening(false)
      }

      recognition.start()
    } catch (err: any) {
      setError(err.message || 'Failed to start voice recognition')
      setVoiceListening(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [schedRes, logsRes] = await Promise.all([
        api.get('/hardware/haccp/schedule'),
        api.get('/hardware/haccp/logs', { params: { start: today, end: today } }),
      ])
      setSchedule(schedRes.data.equipment ?? [])
      setTodayLogs(logsRes.data ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to load temperature data')
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => { void refresh() }, [refresh])

  // When equipment changes, default the target to its configured target.
  useEffect(() => {
    if (checkType === 'equipment' && equipmentId) {
      const eq = schedule.find(e => e.id === equipmentId)
      if (eq) setTargetTempF(String(eq.target_temp_f))
    } else if (checkType === 'food') {
      setTargetTempF('165')
    }
  }, [checkType, equipmentId, schedule])

  async function submitLog() {
    setError(null)
    setNotice(null)
    const measured = parseFloat(tempF)
    if (!Number.isFinite(measured)) { setError('Enter the measured temperature in °F.'); return }
    if (checkType === 'equipment' && !equipmentId) { setError('Select the equipment being checked.'); return }
    if (checkType === 'food' && !itemName.trim()) { setError('Enter the food item name.'); return }
    if (source === 'probe' && !probeDevice.trim()) { setError('Probe readings must name the probe device.'); return }

    setSaving(true)
    try {
      await api.post('/hardware/haccp/log-temp', {
        checkType,
        itemName: checkType === 'food' ? itemName.trim() : '',
        equipmentId: checkType === 'equipment' ? equipmentId : undefined,
        tempF: measured,
        targetTempF: parseFloat(targetTempF),
        source,
        probeDevice: source === 'probe' ? probeDevice.trim() : undefined,
        correctiveAction: violation ? correctiveAction.trim() : '',
      })
      setNotice(violation ? 'Violation logged with corrective action.' : 'Temperature logged.')
      setTempF('')
      setItemName('')
      setViolation(null)
      setCorrectiveAction('')
      await refresh()
    } catch (e: any) {
      const data = e?.response?.data
      if (e?.response?.status === 422 && data?.compliant === false) {
        // Out-of-range: the log stays OPEN until corrective action is given.
        setViolation({
          measuredTempF: data.measuredTempF,
          targetTempF: data.targetTempF,
          violationType: data.violationType,
        })
      } else {
        setError(data?.error ?? 'Failed to log temperature')
      }
    } finally {
      setSaving(false)
    }
  }

  async function submitFix() {
    if (!fixLogId || !fixAction.trim()) { setError('Corrective-action text is required to close a violation.'); return }
    setSaving(true)
    try {
      await api.patch(`/hardware/haccp/logs/${fixLogId}`, { correctiveAction: fixAction.trim() })
      setNotice('Corrective action recorded — violation closed.')
      setFixLogId(null)
      setFixAction('')
      await refresh()
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to record corrective action')
    } finally {
      setSaving(false)
    }
  }

  const openViolations = todayLogs.filter(l => !asBool(l.compliant) && !l.corrective_action)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1px solid var(--border-color)', background: 'var(--bg-app)',
    color: 'var(--text-primary)', fontSize: 15, minHeight: 44,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, display: 'block',
  }
  const tabBtn = (id: 'log' | 'schedule' | 'logs', label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      style={{
        padding: '10px 16px', borderRadius: 12, border: '1px solid var(--border-color)',
        background: tab === id ? 'var(--color-primary)' : 'transparent',
        color: tab === id ? '#fff' : 'var(--text-primary)',
        fontWeight: 700, fontSize: 14, minHeight: 44, cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )

  if (loading) return <div style={{ padding: 24 }}>Loading temperature logs…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Thermometer className="w-5 h-5 text-sky-500" />
            <span>Temperature Log (HACCP)</span>
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Every check is persisted with user + timestamp for the survey binder. Out-of-range temps require a corrective action before the log closes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tabBtn('log', 'Log Temp')}
          {tabBtn('schedule', `Schedule${schedule.some(s => s.status !== 'ok') ? ' (Needs Attention)' : ''}`)}
          {tabBtn('logs', "Today's Log")}
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div style={{ background: '#e7f6ec', color: '#166534', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* ── LOG ENTRY ── */}
      {tab === 'log' && (
        <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
          <div>
            <span style={labelStyle}>Check type</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['food', 'equipment'] as CheckType[]).map(t => (
                <button key={t} onClick={() => { setCheckType(t); setViolation(null) }}
                  style={{ ...inputStyle, width: 'auto', flex: 1, cursor: 'pointer',
                    background: checkType === t ? 'var(--color-primary)' : 'var(--bg-app)',
                    color: checkType === t ? '#fff' : 'var(--text-primary)', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {t === 'food' ? (
                    <>
                      <Radio className="w-4 h-4" />
                      <span>Food Temp</span>
                    </>
                  ) : (
                    <>
                      <Thermometer className="w-4 h-4" />
                      <span>Equipment Temp</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {checkType === 'equipment' ? (
            <div>
              <label style={labelStyle} htmlFor="haccp-eq">Equipment</label>
              <select id="haccp-eq" value={equipmentId} onChange={e => setEquipmentId(e.target.value)} style={inputStyle}>
                <option value="">— Select equipment —</option>
                {schedule.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({TYPE_LABEL[e.type] ?? e.type}, target {e.target_temp_f}°F)
                    {e.status !== 'ok' ? ` — ${STATUS_STYLE[e.status].label.toUpperCase()}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label style={labelStyle} htmlFor="haccp-item">Food item</label>
              <input id="haccp-item" value={itemName} onChange={e => setItemName(e.target.value)}
                placeholder="e.g. Roast turkey breast (batch)" style={inputStyle} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }} htmlFor="haccp-temp">Measured temp (°F)</label>
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: voiceListening ? '#fee2e2' : 'var(--bg-card)',
                    color: voiceListening ? '#991b1b' : 'var(--text-muted)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    minHeight: 28,
                  }}
                  title="Tap to speak temperature hands-free"
                >
                  {voiceListening ? <MicOff className="w-3 h-3 text-red-600 animate-pulse" /> : <Mic className="w-3 h-3 text-sky-600" />}
                  <span>{voiceListening ? 'Listening…' : 'Tap to Speak'}</span>
                </button>
              </div>
              <input id="haccp-temp" inputMode="decimal" value={tempF} onChange={e => setTempF(e.target.value)}
                placeholder="e.g. 168" style={inputStyle} />
              {voiceTranscript && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>{voiceTranscript}</p>
              )}
            </div>
            <div>
              <label style={labelStyle} htmlFor="haccp-target">Target (°F)</label>
              <input id="haccp-target" inputMode="decimal" value={targetTempF} onChange={e => setTargetTempF(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <span style={labelStyle}>Reading source</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['manual', 'probe'] as const).map(s => (
                <button key={s} onClick={() => setSource(s)}
                  style={{ ...inputStyle, width: 'auto', flex: 1, cursor: 'pointer',
                    background: source === s ? 'var(--color-primary)' : 'var(--bg-app)',
                    color: source === s ? '#fff' : 'var(--text-primary)', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {s === 'manual' ? (
                    <>
                      <Edit3 className="w-4 h-4" />
                      <span>Manual Entry</span>
                    </>
                  ) : (
                    <>
                      <Bluetooth className="w-4 h-4" />
                      <span>Probe Reading</span>
                    </>
                  )}
                </button>
              ))}
            </div>
            {source === 'probe' && (
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }} htmlFor="haccp-probe">Probe device name (required)</label>
                  <button
                    type="button"
                    onClick={handlePairBluetooth}
                    disabled={bluetoothConnecting}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid #0071e3',
                      background: bluetoothConnected ? '#e7f6ec' : 'rgba(0, 113, 227, 0.08)',
                      color: bluetoothConnected ? '#166534' : '#0071e3',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      minHeight: 36,
                    }}
                  >
                    <Bluetooth className="w-3.5 h-3.5" />
                    <span>{bluetoothConnecting ? 'Connecting…' : bluetoothConnected ? `Paired (${bluetoothDeviceName})` : 'Pair Bluetooth Probe'}</span>
                  </button>
                </div>
                <input id="haccp-probe" value={probeDevice} onChange={e => setProbeDevice(e.target.value)}
                  placeholder="e.g. ThermoWorks Signals BT — Hot Line" style={inputStyle} />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                  {bluetoothConnected
                    ? 'Connected to Bluetooth probe. Measured temperature auto-syncs on probe reading.'
                    : 'Zero-driver Web Bluetooth pairing for ThermoWorks, Inkbird, and standard BLE probes.'}
                </p>
              </div>
            )}
          </div>

          {/* Violation → corrective action required before the log can close */}
          {violation && (
            <div style={{ border: '2px solid #991b1b', borderRadius: 12, padding: 14, background: '#fef2f2' }}>
              <div style={{ fontWeight: 800, color: '#991b1b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                <span>Temperature violation — {violation.measuredTempF}°F vs target {violation.targetTempF}°F</span>
                <span style={{ fontWeight: 600, fontSize: 12 }}> ({violation.violationType})</span>
              </div>
              <p style={{ fontSize: 13, color: '#7f1d1d', margin: '0 0 8px' }}>
                This log cannot be closed until a corrective action is recorded.
              </p>
              <label style={{ ...labelStyle, color: '#7f1d1d' }} htmlFor="haccp-ca">Corrective action (required)</label>
              <textarea id="haccp-ca" value={correctiveAction} onChange={e => setCorrectiveAction(e.target.value)}
                placeholder="e.g. Reheated to 172°F and re-checked; held at 150°F on steam table."
                rows={3} style={{ ...inputStyle, minHeight: 76 }} />
            </div>
          )}

          <button onClick={submitLog} disabled={saving}
            style={{ padding: '12px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: violation ? '#991b1b' : 'var(--color-primary)', color: '#fff',
              fontWeight: 800, fontSize: 16, minHeight: 48 }}>
            {saving ? 'Saving…' : violation ? 'Log violation with corrective action' : 'Log temperature'}
          </button>
        </div>
      )}

      {/* ── SCHEDULE ── */}
      {tab === 'schedule' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {schedule.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>
              No equipment registered yet. Add fridges, freezers, dishwashers, and hot-hold units to build the temp-check schedule.
            </p>
          )}
          {schedule.map(e => {
            const st = STATUS_STYLE[e.status]
            return (
              <div key={e.id} style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: '12px 14px', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{e.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {TYPE_LABEL[e.type] ?? e.type} · target {e.target_temp_f}°F · {e.check_frequency}
                    </div>
                  </div>
                  <span style={{ background: st.bg, color: st.fg, borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 800 }}>
                    {st.label}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                  Last check: {e.last_recorded_at ? `${fmtTime(e.last_recorded_at)} — ${e.last_temp_f}°F` : 'never'}
                  {e.next_due_at && ` · next due ${fmtTime(e.next_due_at)}`}
                </div>
                {e.status !== 'ok' && (
                  <button onClick={() => { setCheckType('equipment'); setEquipmentId(e.id); setTab('log'); setViolation(null) }}
                    style={{ marginTop: 8, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: 'var(--color-primary)', color: '#fff', fontWeight: 700, minHeight: 44 }}>
                    Log temp now
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── TODAY'S LOGS ── */}
      {tab === 'logs' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
              Physical clipboard audit logs for CMS F812 survey binder.
            </span>
            <button
              onClick={() => window.print()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-app)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                minHeight: 38
              }}
            >
              <Printer className="w-3.5 h-3.5" />
              Print Daily Temperature Log
            </button>
          </div>
          {openViolations.length > 0 && (
            <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 700 }}>
              {openViolations.length} open violation{openViolations.length > 1 ? 's' : ''} need{openViolations.length === 1 ? 's' : ''} a corrective action.
            </div>
          )}
          {todayLogs.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No temperature checks logged today yet.</p>
          )}
          {todayLogs.map(l => {
            const ok = asBool(l.compliant)
            const fixing = fixLogId === l.id
            return (
              <div key={l.id} style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: '10px 14px',
                background: ok ? 'var(--bg-card)' : '#fef2f2', borderLeft: ok ? undefined : '4px solid #991b1b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center' }}>
                    {ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 inline mr-1.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 inline mr-1.5 shrink-0" />
                    )}
                    <span>{l.check_type === 'equipment' ? (l.equipment_name ?? 'Equipment') : l.item_name || 'Food item'}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{fmtTime(l.recorded_at)}</div>
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {l.temp_f}°F (target {l.target_temp_f}°F){l.source === 'probe' ? ` · probe: ${l.probe_device ?? 'unknown'}` : ''}
                  {l.violation_type && !ok && <span style={{ color: '#991b1b', fontWeight: 700 }}> · {l.violation_type}</span>}
                </div>
                {!ok && l.corrective_action && (
                  <div style={{ fontSize: 13, marginTop: 4 }}><b>Corrective action:</b> {l.corrective_action}</div>
                )}
                {!ok && !l.corrective_action && !fixing && (
                  <button onClick={() => { setFixLogId(l.id); setFixAction(''); setError(null) }}
                    style={{ marginTop: 8, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: '#991b1b', color: '#fff', fontWeight: 700, minHeight: 44 }}>
                    Add corrective action (required to close)
                  </button>
                )}
                {fixing && (
                  <div style={{ marginTop: 8 }}>
                    <textarea value={fixAction} onChange={e => setFixAction(e.target.value)} rows={2}
                      placeholder="Describe the corrective action taken…" style={{ ...inputStyle, minHeight: 64 }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button onClick={submitFix} disabled={saving}
                        style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                          background: '#991b1b', color: '#fff', fontWeight: 700, minHeight: 44 }}>
                        {saving ? 'Saving…' : 'Close violation'}
                      </button>
                      <button onClick={() => { setFixLogId(null); setFixAction('') }}
                        style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-color)',
                          cursor: 'pointer', background: 'transparent', color: 'var(--text-primary)', minHeight: 44 }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
