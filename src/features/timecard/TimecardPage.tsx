import { useEffect, useState } from 'react'
import { fetchPunches, TimecardPunch } from '@/api/timecard'
import { api } from '@/api/client'

export default function TimecardPage() {
  const [activeTab, setActiveTab] = useState<'terminal' | 'logs'>('terminal')
  const [punches, setPunches] = useState<TimecardPunch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // Terminal state
  const [badgeId, setBadgeId] = useState('')
  const [terminalMessage, setTerminalMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [submittingPunch, setSubmittingPunch] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPunches()
      setPunches(data)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch punches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'logs') {
      loadData()
    }
  }, [activeTab])

  const handleKeypadPress = (val: string) => {
    setTerminalMessage(null)
    if (val === 'CLEAR') {
      setBadgeId('')
    } else if (val === 'BACK') {
      setBadgeId(prev => prev.slice(0, -1))
    } else {
      if (badgeId.length < 10) {
        setBadgeId(prev => prev + val)
      }
    }
  }

  const triggerWebhookPunch = async (operation: 'In' | 'Out') => {
    if (!badgeId.trim()) {
      setTerminalMessage({ text: 'Please enter a valid Badge ID.', type: 'error' })
      return
    }

    setSubmittingPunch(true)
    setTerminalMessage(null)

    try {
      // Simulate sending to the webhook endpoint in real-time
      const response = await api.post('/timecard/webhook', {
        badge_id: badgeId,
        operation: operation,
        kiosk_id: 'Demo Kiosk Terminal',
        punched_at: new Date().toISOString()
      })

      if (response.data.success) {
        setTerminalMessage({
          text: `Successfully clocked ${operation === 'In' ? 'IN' : 'OUT'} for Badge #${badgeId}!`,
          type: 'success'
        })
        setBadgeId('')
      } else {
        setTerminalMessage({ text: 'Error recording punch.', type: 'error' })
      }
    } catch (err: any) {
      setTerminalMessage({ text: err.response?.data?.error || 'Failed to connect to webhook API.', type: 'error' })
    } finally {
      setSubmittingPunch(false)
    }
  }

  const filteredPunches = punches.filter(p =>
    p.badge_id.toLowerCase().includes(query.toLowerCase()) ||
    p.kiosk_id.toLowerCase().includes(query.toLowerCase()) ||
    p.operation.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px', margin: 0 }}>
          Time Clock Operations
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Demo mode showing real-time API integrations and webhook simulation.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 24, gap: 16 }}>
        <button
          onClick={() => setActiveTab('terminal')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'terminal' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'terminal' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'terminal' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif',
            transition: 'all 0.2s ease',
          }}
        >
          Kiosk Keypad Terminal
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'logs' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'logs' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'logs' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif',
            transition: 'all 0.2s ease',
          }}
        >
          Manager Punch History
        </button>
      </div>

      {/* TAB 1: KIOSK TERMINAL */}
      {activeTab === 'terminal' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: '100%',
            maxWidth: 440,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-lg)',
            padding: 24,
            boxSizing: 'border-box',
          }}>
            {/* Clock Widget */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginTop: 4 }}>
                {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>

            {/* Display Input */}
            <div style={{
              background: 'var(--bg-app)',
              border: '2px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
              textAlign: 'center',
              fontSize: 26,
              fontWeight: 800,
              fontFamily: 'Outfit, sans-serif',
              letterSpacing: '4px',
              color: badgeId ? 'var(--text-primary)' : 'var(--text-muted)',
              marginBottom: 16,
              minHeight: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {badgeId || 'ENTER BADGE'}
            </div>

            {/* Message alert */}
            {terminalMessage && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'center',
                marginBottom: 16,
                background: terminalMessage.type === 'success' ? 'var(--color-primary-light)' : 'var(--color-danger-light)',
                color: terminalMessage.type === 'success' ? 'var(--color-primary)' : 'var(--color-danger-hover)',
                border: terminalMessage.type === 'success' ? '1px solid var(--color-primary)' : '1px solid rgba(188,106,88,.25)',
              }}>
                {terminalMessage.text}
              </div>
            )}

            {/* Keypad Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginBottom: 20,
            }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(val => (
                <button
                  key={val}
                  onClick={() => handleKeypadPress(val)}
                  style={{
                    padding: '16px 0',
                    fontSize: 18,
                    fontWeight: 700,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                >
                  {val}
                </button>
              ))}
              <button
                onClick={() => handleKeypadPress('CLEAR')}
                style={{
                  padding: '16px 0',
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--color-danger-hover)',
                  cursor: 'pointer',
                }}
              >
                CLEAR
              </button>
              <button
                onClick={() => handleKeypadPress('0')}
                style={{
                  padding: '16px 0',
                  fontSize: 18,
                  fontWeight: 700,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                0
              </button>
              <button
                onClick={() => handleKeypadPress('BACK')}
                style={{
                  padding: '16px 0',
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                DELETE
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                disabled={submittingPunch}
                onClick={() => triggerWebhookPunch('In')}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                {submittingPunch ? 'Processing...' : 'CLOCK IN'}
              </button>
              <button
                disabled={submittingPunch}
                onClick={() => triggerWebhookPunch('Out')}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
              >
                {submittingPunch ? 'Processing...' : 'CLOCK OUT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LOGS VIEW */}
      {activeTab === 'logs' && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter punches by Badge ID, Kiosk, or status..."
              style={{
                flex: 1, boxSizing: 'border-box',
                padding: '11px 14px',
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)', fontSize: 14,
                color: 'var(--text-primary)', outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
            />
            <button
              onClick={loadData}
              disabled={loading}
              style={{
                padding: '0 20px',
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-primary)',
                borderRadius: 'var(--radius-lg)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* Table */}
          {loading && punches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Loading logs...
            </div>
          ) : filteredPunches.length === 0 ? (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)', padding: '40px 20px', textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              No punch events match this search.
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Badge ID</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status / Action</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Kiosk</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Punch Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPunches.map((punch) => {
                    const isClockIn = punch.operation.toLowerCase() === 'in';
                    return (
                      <tr key={punch.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                          {punch.badge_id}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: isClockIn ? 'var(--color-primary-light)' : 'rgba(188, 106, 88, 0.1)',
                            color: isClockIn ? 'var(--color-primary)' : 'var(--color-danger-hover)',
                            border: isClockIn ? '1px solid var(--color-primary)' : '1px solid rgba(188, 106, 88, 0.25)'
                          }}>
                            {punch.operation}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          {punch.kiosk_id}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          {new Date(punch.punched_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
