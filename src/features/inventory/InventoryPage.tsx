import { useState, useMemo } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────
type Category =
  | 'Proteins'
  | 'Produce'
  | 'Dairy'
  | 'Dry Goods'
  | 'Dietary / Special'
  | 'Beverages'
  | 'Paper & Supplies'

type StockItem = {
  id: string
  item: string
  category: Category
  qty: number
  unit: string
  min: number
  cost?: number // per unit, optional
  notes?: string
}

type WasteEntry = {
  id: string
  date: string // ISO YYYY-MM-DD
  item: string
  qty: number
  unit: string
  reason: 'Expired' | 'Overproduction' | 'Contamination' | 'Plate Waste' | 'Other'
  meal: 'Breakfast' | 'Lunch' | 'Dinner' | 'N/A'
  loggedBy: string
  cost?: number
}

// ── Seed data ────────────────────────────────────────────────────────────────
const SEED_STOCK: StockItem[] = [
  // Proteins
  { id:'s1',  item:'Chicken Breast (frozen)',        category:'Proteins',           qty:40,  unit:'lbs',    min:20, cost:3.80 },
  { id:'s2',  item:'Salmon Fillet (frozen)',          category:'Proteins',           qty:12,  unit:'lbs',    min:10, cost:6.50 },
  { id:'s3',  item:'Ground Turkey',                  category:'Proteins',           qty:8,   unit:'lbs',    min:10, cost:4.20 },
  { id:'s4',  item:'Beef Chuck Roast',               category:'Proteins',           qty:20,  unit:'lbs',    min:15, cost:5.60 },
  { id:'s5',  item:'Pork Loin Chops',                category:'Proteins',           qty:6,   unit:'lbs',    min:10, cost:4.80 },
  // Produce
  { id:'s6',  item:'Russet Potatoes',                category:'Produce',            qty:50,  unit:'lbs',    min:30, cost:0.60 },
  { id:'s7',  item:'Green Beans (frozen)',            category:'Produce',            qty:20,  unit:'lbs',    min:15, cost:1.40 },
  { id:'s8',  item:'Broccoli (frozen)',               category:'Produce',            qty:15,  unit:'lbs',    min:10, cost:1.60 },
  { id:'s9',  item:'Carrots (fresh)',                 category:'Produce',            qty:10,  unit:'lbs',    min:8,  cost:0.80 },
  { id:'s10', item:'Bananas',                        category:'Produce',            qty:30,  unit:'each',   min:20, cost:0.25 },
  // Dairy
  { id:'s11', item:'Whole Milk',                     category:'Dairy',              qty:8,   unit:'gallons',min:6,  cost:4.10 },
  { id:'s12', item:'Butter (unsalted)',               category:'Dairy',              qty:6,   unit:'lbs',    min:4,  cost:3.50 },
  { id:'s13', item:'Cheddar Cheese (shredded)',       category:'Dairy',              qty:5,   unit:'lbs',    min:3,  cost:5.20 },
  { id:'s14', item:'Lactose-Free Milk',               category:'Dairy',              qty:4,   unit:'cartons',min:6,  cost:3.00, notes:'Low — reorder' },
  // Dry Goods
  { id:'s15', item:'Rolled Oats',                    category:'Dry Goods',          qty:20,  unit:'lbs',    min:10, cost:1.20 },
  { id:'s16', item:'Egg Noodles',                    category:'Dry Goods',          qty:10,  unit:'lbs',    min:8,  cost:1.80 },
  { id:'s17', item:'Brown Rice',                     category:'Dry Goods',          qty:15,  unit:'lbs',    min:10, cost:1.50 },
  { id:'s18', item:'Mac & Cheese (bulk)',             category:'Dry Goods',          qty:6,   unit:'lbs',    min:5,  cost:2.20 },
  { id:'s19', item:'Gluten-Free Bread',              category:'Dietary / Special',  qty:1,   unit:'loaves', min:3,  cost:6.50, notes:'LOW — gluten-free residents' },
  // Dietary / Special
  { id:'s20', item:'Ensure Original (Vanilla)',      category:'Dietary / Special',  qty:24,  unit:'cans',   min:12, cost:2.80 },
  { id:'s21', item:'Ensure Plus (Chocolate)',        category:'Dietary / Special',  qty:6,   unit:'cans',   min:12, cost:3.10, notes:'Below par' },
  { id:'s22', item:'Simply Thick (Nectar)',          category:'Dietary / Special',  qty:2,   unit:'bottles',min:3,  cost:18.00,notes:'LOW — thickened liquid residents' },
  { id:'s23', item:'Simply Thick (Honey)',           category:'Dietary / Special',  qty:3,   unit:'bottles',min:2,  cost:18.00 },
  { id:'s24', item:'Sugar-Free Syrup',               category:'Dietary / Special',  qty:3,   unit:'bottles',min:2,  cost:4.50 },
  { id:'s25', item:'No-Added-Salt Seasoning',        category:'Dietary / Special',  qty:4,   unit:'jars',   min:2,  cost:3.80 },
  // Beverages
  { id:'s26', item:'Orange Juice (gallon)',          category:'Beverages',          qty:10,  unit:'gallons',min:6,  cost:5.20 },
  { id:'s27', item:'Apple Juice (gallon)',           category:'Beverages',          qty:8,   unit:'gallons',min:6,  cost:4.80 },
  { id:'s28', item:'Decaf Coffee (ground)',          category:'Beverages',          qty:6,   unit:'lbs',    min:4,  cost:9.00 },
  { id:'s29', item:'Hot Tea Bags',                  category:'Beverages',          qty:200, unit:'bags',   min:100,cost:0.05 },
  { id:'s30', item:'Hot Chocolate Mix',             category:'Beverages',          qty:3,   unit:'lbs',    min:2,  cost:5.00 },
  // Paper & Supplies
  { id:'s31', item:'Tray Liners',                   category:'Paper & Supplies',   qty:500, unit:'sheets', min:200,cost:0.04 },
  { id:'s32', item:'Disposable Cups (8 oz)',        category:'Paper & Supplies',   qty:300, unit:'each',   min:200,cost:0.06 },
  { id:'s33', item:'Napkins',                       category:'Paper & Supplies',   qty:1000,unit:'each',   min:500,cost:0.02 },
]

const TODAY = new Date().toISOString().slice(0,10)
const SEED_WASTE: WasteEntry[] = [
  { id:'w1', date:TODAY,                item:'Grilled Chicken Breast', qty:4,  unit:'portions', reason:'Overproduction', meal:'Lunch',     loggedBy:'Kitchen Staff', cost:15.20 },
  { id:'w2', date:TODAY,                item:'Mashed Potatoes',        qty:6,  unit:'portions', reason:'Plate Waste',    meal:'Dinner',    loggedBy:'Kitchen Staff', cost: 4.80 },
  { id:'w3', date:'2026-07-02',         item:'Salmon Fillet',          qty:2,  unit:'portions', reason:'Overproduction', meal:'Dinner',    loggedBy:'Cook',          cost:13.00 },
  { id:'w4', date:'2026-07-01',         item:'Whole Milk',             qty:0.5,unit:'gallons',  reason:'Expired',        meal:'N/A',       loggedBy:'Cook',          cost: 2.05 },
  { id:'w5', date:'2026-06-30',         item:'Green Beans',            qty:3,  unit:'lbs',      reason:'Overproduction', meal:'Lunch',     loggedBy:'Kitchen Staff', cost: 4.20 },
]

const CATEGORIES: Category[] = [
  'Proteins','Produce','Dairy','Dry Goods','Dietary / Special','Beverages','Paper & Supplies',
]

const WASTE_REASONS: WasteEntry['reason'][] = [
  'Overproduction','Plate Waste','Expired','Contamination','Other',
]

// ── Utility ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2,10) }

// ── Sub-components ────────────────────────────────────────────────────────────
function Badge({ children, color = 'var(--color-primary)' }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      display:'inline-block', fontSize:'var(--text-xs)', fontWeight:'var(--weight-bold)',
      padding:'2px 8px', borderRadius:20,
      background:`${color}22`, color, border:`1px solid ${color}55`,
    }}>{children}</span>
  )
}

function LowBadge() { return <Badge color="#d97706">LOW</Badge> }

// ── STOCK INVENTORY TAB ───────────────────────────────────────────────────────
function StockTab() {
  const [items, setItems]       = useState<StockItem[]>(JSON.parse(JSON.stringify(SEED_STOCK)))
  const [search, setSearch]     = useState('')
  const [filterCat, setFilter]  = useState<Category | 'All'>('All')
  const [editing, setEditing]   = useState<string | null>(null)
  const [editVals, setEditVals] = useState<Partial<StockItem>>({})
  const [showAdd, setShowAdd]   = useState(false)
  const [newItem, setNewItem]   = useState<Partial<StockItem>>({
    category:'Dry Goods', qty:0, unit:'', min:0,
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return items.filter(i =>
      (filterCat === 'All' || i.category === filterCat) &&
      (!q || i.item.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
    )
  }, [items, search, filterCat])

  const grouped = useMemo(() => {
    const map: Partial<Record<Category, StockItem[]>> = {}
    filtered.forEach(i => { (map[i.category] ??= []).push(i) })
    return map
  }, [filtered])

  const lowItems = items.filter(i => i.qty < i.min)

  function startEdit(item: StockItem) {
    setEditing(item.id)
    setEditVals({ qty: item.qty, min: item.min, notes: item.notes ?? '' })
  }

  function saveEdit(id: string) {
    setItems(p => p.map(i => i.id === id ? { ...i, ...editVals } : i))
    setEditing(null)
  }

  function addItem() {
    if (!newItem.item?.trim() || !newItem.unit?.trim()) return
    const item: StockItem = {
      id: uid(), item: newItem.item!, category: newItem.category as Category,
      qty: newItem.qty ?? 0, unit: newItem.unit!, min: newItem.min ?? 0,
      cost: newItem.cost, notes: newItem.notes,
    }
    setItems(p => [...p, item])
    setNewItem({ category:'Dry Goods', qty:0, unit:'', min:0 })
    setShowAdd(false)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>

      {/* Low stock alert banner */}
      {lowItems.length > 0 && (
        <div className="sl-alert sl-alert-warning" style={{ display:'flex', flexWrap:'wrap', gap:'var(--space-2)', alignItems:'center' }}>
          <b>⚠ {lowItems.length} item{lowItems.length > 1 ? 's' : ''} below par:</b>
          {lowItems.map(i => (
            <span key={i.id} style={{ fontSize:'var(--text-sm)' }}>{i.item} ({i.qty}/{i.min} {i.unit})</span>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ display:'flex', gap:'var(--space-3)', flexWrap:'wrap', alignItems:'center' }}>
        <input
          className="sl-input" style={{ flex:'1 1 200px', maxWidth:300 }}
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search items…"
        />
        <select className="sl-select" value={filterCat} onChange={e => setFilter(e.target.value as any)} style={{ flex:'1 1 160px', maxWidth:220 }}>
          <option value="All">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setShowAdd(v => !v)} className="btn btn-primary" style={{ marginLeft:'auto', whiteSpace:'nowrap' }}>+ Add Item</button>
      </div>

      {/* Add item form */}
      {showAdd && (
        <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)', display:'flex', flexWrap:'wrap', gap:'var(--space-3)' }}>
          <div style={{ flex:'2 1 180px' }}>
            <label>Item Name</label>
            <input className="sl-input" value={newItem.item ?? ''} onChange={e => setNewItem(p => ({...p,item:e.target.value}))} placeholder="e.g. Corn Starch" />
          </div>
          <div style={{ flex:'1 1 140px' }}>
            <label>Category</label>
            <select className="sl-select" value={newItem.category} onChange={e => setNewItem(p => ({...p,category:e.target.value as Category}))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex:'0 1 90px' }}>
            <label>Qty</label>
            <input type="number" className="sl-input" value={newItem.qty} onChange={e => setNewItem(p => ({...p,qty:+e.target.value}))} />
          </div>
          <div style={{ flex:'0 1 90px' }}>
            <label>Unit</label>
            <input className="sl-input" value={newItem.unit ?? ''} onChange={e => setNewItem(p => ({...p,unit:e.target.value}))} placeholder="lbs, cans…" />
          </div>
          <div style={{ flex:'0 1 90px' }}>
            <label>Min Par</label>
            <input type="number" className="sl-input" value={newItem.min} onChange={e => setNewItem(p => ({...p,min:+e.target.value}))} />
          </div>
          <div style={{ flex:'0 1 90px' }}>
            <label>Cost/Unit $</label>
            <input type="number" step="0.01" className="sl-input" value={newItem.cost ?? ''} onChange={e => setNewItem(p => ({...p,cost:+e.target.value}))} />
          </div>
          <div style={{ flex:'2 1 200px' }}>
            <label>Notes</label>
            <input className="sl-input" value={newItem.notes ?? ''} onChange={e => setNewItem(p => ({...p,notes:e.target.value}))} placeholder="Optional note" />
          </div>
          <div style={{ display:'flex', gap:'var(--space-2)', alignItems:'flex-end', flexShrink:0 }}>
            <button onClick={addItem} className="btn btn-primary">Save</button>
            <button onClick={() => setShowAdd(false)} className="btn btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* Grouped tables */}
      {CATEGORIES.map(cat => {
        const catItems = grouped[cat]
        if (!catItems?.length) return null
        return (
          <div key={cat}>
            <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)', marginBottom:'var(--space-2)' }}>
              <div className="sl-section-title" style={{ color:'var(--color-primary)', margin:0 }}>{cat}</div>
              <div style={{ flex:1, height:1, background:'var(--border-color)' }} />
              <span style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)' }}>{catItems.length} items</span>
            </div>
            <div style={{ border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'var(--text-sm)' }}>
                <thead>
                  <tr style={{ background:'var(--bg-app)' }}>
                    <th style={TH}>Item</th>
                    <th style={TH}>On Hand</th>
                    <th style={TH}>Min Par</th>
                    <th style={TH}>Status</th>
                    <th style={TH}>Cost/Unit</th>
                    <th style={TH}>Notes</th>
                    <th style={TH} />
                  </tr>
                </thead>
                <tbody>
                  {catItems.map((item, i) => {
                    const low = item.qty < item.min
                    const isEdit = editing === item.id
                    return (
                      <tr key={item.id} style={{ background: low ? '#fffbeb' : (i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-app)'), borderBottom:'1px solid var(--border-color)' }}>
                        <td style={{ ...TD, fontWeight:'var(--weight-medium)', color:'var(--text-primary)' }}>{item.item}</td>
                        <td style={TD}>
                          {isEdit
                            ? <input type="number" value={editVals.qty ?? ''} onChange={e => setEditVals(p => ({...p,qty:+e.target.value}))} className="sl-input" style={{ width:70 }} />
                            : <b style={{ color: low ? '#d97706' : 'var(--text-primary)' }}>{item.qty}</b>}
                          &nbsp;<span style={{ color:'var(--text-muted)' }}>{item.unit}</span>
                        </td>
                        <td style={TD}>{item.min} <span style={{ color:'var(--text-muted)' }}>{item.unit}</span></td>
                        <td style={TD}>{low ? <LowBadge /> : <Badge color="#059669">OK</Badge>}</td>
                        <td style={TD}>{item.cost != null ? `$${item.cost.toFixed(2)}` : '—'}</td>
                        <td style={TD}>
                          {isEdit
                            ? <input value={editVals.notes ?? ''} onChange={e => setEditVals(p => ({...p,notes:e.target.value}))} className="sl-input" style={{ minWidth:120 }} />
                            : <span style={{ color:'var(--text-muted)', fontStyle: item.notes ? 'normal' : 'italic' }}>{item.notes || '—'}</span>}
                        </td>
                        <td style={{ ...TD, whiteSpace:'nowrap' }}>
                          {isEdit
                            ? <>
                                <button onClick={() => saveEdit(item.id)} className="btn btn-primary btn-sm">Save</button>
                                <button onClick={() => setEditing(null)} className="btn btn-outline btn-sm" style={{ marginLeft:6 }}>Cancel</button>
                              </>
                            : <button onClick={() => startEdit(item)} className="btn btn-outline btn-sm">Edit</button>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="sl-empty">
          <div style={{ fontSize:36, marginBottom:'var(--space-3)' }}>📦</div>
          <div className="sl-empty-title">No items match your search.</div>
        </div>
      )}
    </div>
  )
}

const TH: React.CSSProperties = { padding:'8px 12px', textAlign:'left', fontSize:'var(--text-xs)', fontWeight:'var(--weight-bold)', textTransform:'uppercase', letterSpacing:'0.4px', color:'var(--text-muted)', whiteSpace:'nowrap' }
const TD: React.CSSProperties = { padding:'9px 12px', verticalAlign:'middle' }

// ── WASTE LOG TAB ─────────────────────────────────────────────────────────────
function WasteTab() {
  const [entries,  setEntries]  = useState<WasteEntry[]>(JSON.parse(JSON.stringify(SEED_WASTE)))
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<Partial<WasteEntry>>({
    date: TODAY, reason:'Overproduction', meal:'Lunch', loggedBy:'', qty:0, unit:'portions',
  })

  function addEntry() {
    if (!form.item?.trim() || !form.loggedBy?.trim()) return
    const entry: WasteEntry = {
      id: uid(), date: form.date!, item: form.item!, qty: form.qty ?? 0,
      unit: form.unit!, reason: form.reason!, meal: form.meal!, loggedBy: form.loggedBy!, cost: form.cost,
    }
    setEntries(p => [entry, ...p])
    setForm({ date:TODAY, reason:'Overproduction', meal:'Lunch', loggedBy:'', qty:0, unit:'portions' })
    setShowForm(false)
  }

  function remove(id: string) { setEntries(p => p.filter(e => e.id !== id)) }

  const totalCost = entries.reduce((sum, e) => sum + (e.cost ?? 0), 0)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>

      {/* Summary */}
      <div style={{ display:'flex', gap:'var(--space-4)', flexWrap:'wrap' }}>
        <div className="sl-stat-card">
          <div className="sl-eyebrow">Waste Entries (all time)</div>
          <div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'var(--color-primary)' }}>{entries.length}</div>
        </div>
        <div className="sl-stat-card">
          <div className="sl-eyebrow">Estimated Waste Cost</div>
          <div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'#dc2626' }}>
            ${totalCost.toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={() => setShowForm(v => !v)} className="btn btn-primary">+ Log Waste</button>
      </div>

      {/* Log form */}
      {showForm && (
        <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)', display:'flex', flexWrap:'wrap', gap:'var(--space-3)' }}>
          <div style={{ flex:'2 1 180px' }}>
            <label>Item</label>
            <input className="sl-input" value={form.item ?? ''} onChange={e => setForm(p => ({...p,item:e.target.value}))} placeholder="e.g. Mashed Potatoes" />
          </div>
          <div style={{ flex:'0 1 90px' }}>
            <label>Qty</label>
            <input type="number" className="sl-input" value={form.qty} onChange={e => setForm(p => ({...p,qty:+e.target.value}))} />
          </div>
          <div style={{ flex:'0 1 100px' }}>
            <label>Unit</label>
            <input className="sl-input" value={form.unit ?? ''} onChange={e => setForm(p => ({...p,unit:e.target.value}))} placeholder="portions, lbs…" />
          </div>
          <div style={{ flex:'1 1 130px' }}>
            <label>Reason</label>
            <select className="sl-select" value={form.reason} onChange={e => setForm(p => ({...p,reason:e.target.value as WasteEntry['reason']})) }>
              {WASTE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ flex:'0 1 130px' }}>
            <label>Meal</label>
            <select className="sl-select" value={form.meal} onChange={e => setForm(p => ({...p,meal:e.target.value as WasteEntry['meal']})) }>
              {(['Breakfast','Lunch','Dinner','N/A'] as WasteEntry['meal'][]).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ flex:'0 1 120px' }}>
            <label>Date</label>
            <input type="date" className="sl-input" value={form.date} onChange={e => setForm(p => ({...p,date:e.target.value}))} />
          </div>
          <div style={{ flex:'0 1 90px' }}>
            <label>Est. Cost $</label>
            <input type="number" step="0.01" className="sl-input" value={form.cost ?? ''} onChange={e => setForm(p => ({...p,cost:+e.target.value}))} />
          </div>
          <div style={{ flex:'1 1 140px' }}>
            <label>Logged By</label>
            <input className="sl-input" value={form.loggedBy ?? ''} onChange={e => setForm(p => ({...p,loggedBy:e.target.value}))} placeholder="Staff name" />
          </div>
          <div style={{ display:'flex', gap:'var(--space-2)', alignItems:'flex-end', flexShrink:0 }}>
            <button onClick={addEntry} className="btn btn-primary">Save</button>
            <button onClick={() => setShowForm(false)} className="btn btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* Entries list */}
      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
        {entries.map(e => {
          const reasonColor: Record<WasteEntry['reason'], string> = {
            Overproduction:'#d97706', 'Plate Waste':'#7c3aed', Expired:'#dc2626', Contamination:'#9f1239', Other:'#64748b',
          }
          return (
            <div key={e.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:'var(--space-4)', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:160 }}>
                <div style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-semi)', color:'var(--text-primary)' }}>{e.item}</div>
                <div style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)', marginTop:2 }}>{e.qty} {e.unit} · {e.meal} · {e.date}</div>
                <div style={{ marginTop:4 }}><Badge color={reasonColor[e.reason]}>{e.reason}</Badge></div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:2, textAlign:'right', flexShrink:0 }}>
                {e.cost != null && <span style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-black)', color:'#dc2626', fontFamily:'var(--font-display)' }}>${e.cost.toFixed(2)}</span>}
                <span style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)' }}>by {e.loggedBy}</span>
                <button onClick={() => remove(e.id)} style={{ background:'none', border:'none', color:'var(--color-danger)', cursor:'pointer', fontSize:12, padding:'2px 0', textAlign:'right' }}>Remove</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── USAGE TRENDS TAB ──────────────────────────────────────────────────────────
function TrendsTab() {
  // Simple static summary using the seed waste data
  const byReason: Record<string, { count: number; cost: number }> = {}
  const byMeal:   Record<string, { count: number; cost: number }> = {}
  SEED_WASTE.forEach(e => {
    byReason[e.reason] ??= { count:0, cost:0 }
    byReason[e.reason].count++
    byReason[e.reason].cost += e.cost ?? 0
    byMeal[e.meal] ??= { count:0, cost:0 }
    byMeal[e.meal].count++
    byMeal[e.meal].cost += e.cost ?? 0
  })

  const lowItems = SEED_STOCK.filter(i => i.qty < i.min)
  const totalStockCost = SEED_STOCK.reduce((s,i) => s + (i.qty * (i.cost ?? 0)), 0)
  const totalWasteCost = SEED_WASTE.reduce((s,e) => s + (e.cost ?? 0), 0)

  function Bar({ label, val, max, color }: { label: string; val: number; max: number; color: string }) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)', marginBottom:'var(--space-2)' }}>
        <span style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)', minWidth:130 }}>{label}</span>
        <div style={{ flex:1, height:12, background:'var(--bg-app)', borderRadius:6, overflow:'hidden', border:'1px solid var(--border-color)' }}>
          <div style={{ height:'100%', width:`${Math.max(4,(val/max)*100)}%`, background:color, borderRadius:6, transition:'width 0.4s ease' }} />
        </div>
        <span style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color:'var(--text-primary)', minWidth:40, textAlign:'right' }}>{val}</span>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-6)' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'var(--space-3)' }}>
        <div className="sl-stat-card">
          <div className="sl-eyebrow">Items Below Par</div>
          <div style={{ fontSize:'var(--text-4xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'#d97706' }}>{lowItems.length}</div>
        </div>
        <div className="sl-stat-card">
          <div className="sl-eyebrow">Total Stock Value</div>
          <div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'var(--color-primary)' }}>${totalStockCost.toFixed(0)}</div>
        </div>
        <div className="sl-stat-card">
          <div className="sl-eyebrow">Total Waste Cost</div>
          <div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'#dc2626' }}>${totalWasteCost.toFixed(2)}</div>
        </div>
        <div className="sl-stat-card">
          <div className="sl-eyebrow">Waste Events Logged</div>
          <div style={{ fontSize:'var(--text-4xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'var(--color-primary)' }}>{SEED_WASTE.length}</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'var(--space-5)' }}>
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)' }}>
          <div className="sl-section-title" style={{ marginBottom:'var(--space-3)', color:'var(--color-primary)' }}>Waste by Reason</div>
          {Object.entries(byReason).sort((a,b)=>b[1].count-a[1].count).map(([r,v]) => (
            <Bar key={r} label={r} val={v.count} max={SEED_WASTE.length} color="#d97706" />
          ))}
        </div>

        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)' }}>
          <div className="sl-section-title" style={{ marginBottom:'var(--space-3)', color:'var(--color-primary)' }}>Waste by Meal</div>
          {Object.entries(byMeal).sort((a,b)=>b[1].count-a[1].count).map(([m,v]) => (
            <Bar key={m} label={m} val={v.count} max={SEED_WASTE.length} color="#6366f1" />
          ))}
        </div>

        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)' }}>
          <div className="sl-section-title" style={{ marginBottom:'var(--space-3)', color:'var(--color-primary)' }}>Stock by Category</div>
          {CATEGORIES.map(cat => {
            const count = SEED_STOCK.filter(i => i.category === cat).length
            const lowCount = SEED_STOCK.filter(i => i.category === cat && i.qty < i.min).length
            return (
              <div key={cat} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}>{cat}</span>
                <div style={{ display:'flex', gap:'var(--space-2)', alignItems:'center' }}>
                  <span style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color:'var(--text-primary)' }}>{count} items</span>
                  {lowCount > 0 && <Badge color="#d97706">{lowCount} low</Badge>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="sl-alert sl-alert-info" style={{ fontSize:'var(--text-sm)' }}>
        <b>📊 Tip:</b> Track waste consistently over 2–4 weeks to identify overproduction patterns by menu item. Use the data to adjust recipe scale-out quantities in the Production Worksheet.
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type InventoryTab = 'stock' | 'waste' | 'trends'
const INV_TABS: { id: InventoryTab; label: string; icon: string }[] = [
  { id:'stock',  label:'Stock Inventory', icon:'📋' },
  { id:'waste',  label:'Waste Log',       icon:'🗑️' },
  { id:'trends', label:'Usage & Trends',  icon:'📊' },
]

export default function InventoryPage() {
  const [tab, setTab] = useState<InventoryTab>('stock')
  return (
    <div className="sl-page fade-in">
      <div className="sl-page-header">
        <h1 className="sl-page-title">Inventory &amp; Waste</h1>
        <p className="sl-page-subtitle">Track all stock (general + dietary), log waste, and audit usage trends.</p>
      </div>

      <div className="sl-pills" style={{ marginBottom:'var(--space-6)' }}>
        {INV_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={tab === t.id ? 'sl-pill active' : 'sl-pill'}>
            <span style={{ marginRight:'var(--space-1)' }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-6)', boxShadow:'var(--shadow-sm)' }}>
        {tab === 'stock'  && <StockTab />}
        {tab === 'waste'  && <WasteTab />}
        {tab === 'trends' && <TrendsTab />}
      </div>
    </div>
  )
}
