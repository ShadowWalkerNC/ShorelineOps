import { useState } from 'react'

type Entry = { id: string; date: string; donor: string; amount: number; note: string }

const SAMPLE: Entry[] = [
  { id: '1', date: '2026-06-01', donor: 'Resident Council', amount: 42.50, note: 'June bottle drive collection' },
  { id: '2', date: '2026-05-15', donor: 'Family Donations',  amount: 28.00, note: 'May bottle drive' },
]

export default function BottleDrive() {
  const [entries, setEntries] = useState<Entry[]>(SAMPLE)
  const [form, setForm] = useState({ donor: '', amount: '', note: '' })
  const [showForm, setShowForm] = useState(false)

  const total = entries.reduce((s, e) => s + e.amount, 0)

  function add() {
    const amt = parseFloat(form.amount)
    if (!form.donor.trim() || isNaN(amt)) return
    setEntries(prev => [{
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 10),
      donor: form.donor.trim(),
      amount: amt,
      note: form.note,
    }, ...prev])
    setForm({ donor: '', amount: '', note: '' })
    setShowForm(false)
  }

  function remove(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const inp = {
    padding: '8px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          background: 'var(--color-primary-light)',
          border: '1px solid var(--color-primary)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 24px', minWidth: 180,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-primary)', marginBottom: 6 }}>
            Total Funds Collected
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'Outfit, sans-serif' }}>
            ${total.toFixed(2)}
          </div>
        </div>

        <div style={{
          background: 'var(--bg-app)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 24px', minWidth: 140,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 6 }}>
            Entries
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
            {entries.length}
          </div>
        </div>
      </div>

      {/* Add button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            background: 'var(--color-primary)', color: 'white',
            border: 'none', borderRadius: 'var(--radius-md)',
            padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}
        >
          + Log Funds
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{
          background: 'var(--bg-app)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)', padding: 16,
          display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end',
        }}>
          <div style={{ flex: '2 1 150px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Donor / Source
            </label>
            <input
              style={inp}
              value={form.donor}
              onChange={e => setForm(f => ({ ...f, donor: e.target.value }))}
              placeholder="e.g. Resident Council"
            />
          </div>

          <div style={{ flex: '1 1 100px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Amount ($)
            </label>
            <input
              type="number" step="0.01"
              style={inp}
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          <div style={{ flex: '3 1 200px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Note
            </label>
            <input
              style={inp}
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="e.g. July collection"
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={add}
              style={{
                background: 'var(--color-primary)', color: 'white',
                border: 'none', borderRadius: 'var(--radius-md)',
                padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)', padding: '9px 14px',
                fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Entry list */}
      {entries.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0', fontSize: 14 }}>
          No bottle drive entries yet.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map(e => (
          <div
            key={e.id}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)', padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{e.donor}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {e.date}{e.note ? ` · ${e.note}` : ''}
              </div>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', fontFamily: 'Outfit, sans-serif' }}>
              +${e.amount.toFixed(2)}
            </span>
            <button
              onClick={() => remove(e.id)}
              style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
