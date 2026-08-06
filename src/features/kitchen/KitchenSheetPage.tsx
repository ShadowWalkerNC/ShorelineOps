import { useState, useEffect } from 'react'
import { tokenManager } from '@/security/tokenManager'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MEALS = ['Lunch', 'Supper']

function getSunday(date = new Date()) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}

export default function KitchenSheetPage() {
  const [week, setWeek] = useState(getSunday())
  const [day, setDay] = useState(DAYS[new Date().getDay()])
  const [meal, setMeal] = useState('Lunch')

  const [tally, setTally] = useState({ choice1: 0, choice2: 0 })
  const [modifiers, setModifiers] = useState<any[]>([])
  const [alternatives, setAlternatives] = useState<any[]>([])
  const [declined, setDeclined] = useState<any[]>([])
  const [mealOptions, setMealOptions] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)

  // Edit menus
  const [editMenuMode, setEditMenuMode] = useState(false)
  const [dish1, setDish1] = useState('')
  const [dish2, setDish2] = useState('')

  const token = tokenManager.getAccessToken()

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/kitchen/sheet?week=${week}&day=${day}&meal=${meal}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setTally(data.tally || { choice1: 0, choice2: 0 })
      setModifiers(data.modifiers || [])
      setAlternatives(data.alternatives || [])
      setDeclined(data.declined || [])
      setMealOptions(data.mealOptions || [])
      setSummary(data.summary || {})

      const o1 = (data.mealOptions || []).find((o: any) => o.choice_number === 1)
      const o2 = (data.mealOptions || []).find((o: any) => o.choice_number === 2)
      setDish1(o1 ? o1.dish_name : 'Choice 1')
      setDish2(o2 ? o2.dish_name : 'Choice 2')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [week, day, meal])

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const opts = [
        { week_start_date: week, day_of_week: day, meal_type: meal, choice_number: 1, dish_name: dish1 },
        { week_start_date: week, day_of_week: day, meal_type: meal, choice_number: 2, dish_name: dish2 }
      ]
      await fetch('/api/kitchen/meals/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ options: opts })
      })
      setEditMenuMode(false)
      loadData()
    } catch (err) {
      console.error(err)
    }
  }

  const choice1Name = mealOptions.find(o => o.choice_number === 1)?.dish_name || 'Choice 1'
  const choice2Name = mealOptions.find(o => o.choice_number === 2)?.dish_name || 'Choice 2'

  return (
    <div className="sl-page">
      {/* Printable Sheet Header (hidden on screen) */}
      <div className="ks-print-header" style={{ display: 'none' }}>
        <div>
          <div className="ks-print-title">Daily Kitchen Sheet</div>
          <div className="ks-print-meta">
            <strong>{day} - {meal}</strong> | Week of {week}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '11pt' }}>
          Total Residents: {summary.total_residents || 0}
        </div>
      </div>

      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Daily Kitchen Sheet</h1>
          <p className="page-subtitle">Daily batch totals, exceptions, and alternatives</p>
        </div>
        <div>
          <button className="btn btn-print" onClick={() => window.print()}>
            🖨️ Print Sheet
          </button>
        </div>
      </div>

      {/* Control panel */}
      <div className="controls-bar no-print card" style={{ background: 'var(--bg-surface)', padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', width: '100%' }}>
          <div className="form-group" style={{ minWidth: 150 }}>
            <label className="form-label">Week Beginning</label>
            <input type="date" className="form-input" value={week} onChange={(e) => setWeek(e.target.value)} />
          </div>

          <div className="form-group" style={{ minWidth: 120 }}>
            <label className="form-label">Select Day</label>
            <select className="form-select" value={day} onChange={(e) => setDay(e.target.value)}>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: 120 }}>
            <label className="form-label">Meal Type</label>
            <select className="form-select" value={meal} onChange={(e) => setMeal(e.target.value)}>
              {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-secondary" onClick={() => setEditMenuMode(true)}>
              ✏️ Edit Dish Names
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading Kitchen Sheet...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Section A: Batch Tally */}
          <div className="ks-section">
            <div className="ks-section-header">
              <span className="ks-section-label ks-label-tally">TALLY</span>
              <h2 className="ks-section-title">Batch Count Totals</h2>
            </div>
            <div className="tally-display">
              <div className="tally-item">
                <span className="tally-count ks-c1">{tally.choice1}</span>
                <span className="tally-dish"><strong>Choice 1:</strong> {choice1Name}</span>
              </div>
              <div className="tally-divider" />
              <div className="tally-item">
                <span className="tally-count ks-c2">{tally.choice2}</span>
                <span className="tally-dish"><strong>Choice 2:</strong> {choice2Name}</span>
              </div>
              <div className="tally-divider" />
              <div className="tally-item">
                <span className="tally-count" style={{ color: 'var(--text-secondary)' }}>
                  {summary.total_standard || 0}
                </span>
                <span className="tally-dish"><strong>Standard Orders</strong></span>
              </div>
            </div>
          </div>

          {/* Section B: Modifiers / Exceptions */}
          <div className="ks-section">
            <div className="ks-section-header">
              <span className="ks-section-label ks-label-mod">MODIFIERS</span>
              <h2 className="ks-section-title">Special Requests & Customizations</h2>
            </div>
            {modifiers.length === 0 ? (
              <div className="empty-state">No special requests for standard meals on this day.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>Room</th>
                    <th style={{ width: 180 }}>Resident</th>
                    <th style={{ width: 120 }}>Choice Selected</th>
                    <th>Request details</th>
                  </tr>
                </thead>
                <tbody>
                  {modifiers.map((m, idx) => (
                    <tr key={idx}>
                      <td className="room-cell">{m.room_number}</td>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td>
                        <span className={`badge ${m.choice_selected === 1 ? 'badge-c1' : 'badge-c2'}`}>
                          Choice {m.choice_selected}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-warning)', fontWeight: 600 }}>{m.modifier_text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Section C: Standing Alternatives & Declined */}
          <div className="ks-section">
            <div className="ks-section-header">
              <span className="ks-section-label ks-label-alt">ALTERNATIVES & DECLINED</span>
              <h2 className="ks-section-title">Standing Alternatives & Declined Meals</h2>
            </div>
            {alternatives.length === 0 && declined.length === 0 ? (
              <div className="empty-state">No alternatives or declined meals recorded.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 1 }}>
                
                {/* Alternatives List */}
                <div style={{ padding: 20, borderRight: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--alt-text)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Standing Alternatives</span>
                    <span>Count: {alternatives.length}</span>
                  </h3>
                  {alternatives.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>None</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {alternatives.map((alt, idx) => (
                        <div key={idx} className="ks-alt-item" style={{ paddingBottom: 8 }}>
                          <span className="ks-alt-room">[{alt.room_number}]</span> <strong>{alt.name}</strong>
                          <div className="ks-alt-desc" style={{ paddingLeft: 12, marginTop: 2, fontSize: '0.85rem' }}>
                            🍴 {alt.alternative_description || 'Standing alternative meal'}
                            {alt.modifier_text && <span style={{ color: 'var(--text-warning)' }}> ({alt.modifier_text})</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Declined List */}
                <div style={{ padding: 20 }}>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--declined-text)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Declined Meals</span>
                    <span>Count: {declined.length}</span>
                  </h3>
                  {declined.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>None</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {declined.map((dec, idx) => (
                        <div key={idx} style={{ paddingBottom: 6 }}>
                          <strong>[{dec.room_number}]</strong> {dec.name} — <span style={{ color: 'var(--text-danger)', fontSize: '0.8rem' }}>Declined</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>
      )}

      {/* Edit Menu Dialog */}
      {editMenuMode && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="modal-title">Edit Dishes: {day} {meal}</h2>
            <form onSubmit={handleSaveMenu} className="modal-form">
              <div className="form-group">
                <label className="form-label">Choice 1 Dish Name</label>
                <input type="text" className="form-input" required value={dish1} onChange={(e) => setDish1(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Choice 2 Dish Name</label>
                <input type="text" className="form-input" required value={dish2} onChange={(e) => setDish2(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditMenuMode(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Dishes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
