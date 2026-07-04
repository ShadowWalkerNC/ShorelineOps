import { useState, useMemo } from 'react'
import { useCommunicationsStore } from '../../state/communicationsStore'
import { useStaffStore } from '../../state/staffStore'
import { useAuth } from '../../security/AuthContext'

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
  reorderQty?: number
  cost?: number
  vendor?: string
  notes?: string
}

type WasteEntry = {
  id: string
  date: string
  item: string
  qty: number
  unit: string
  reason: 'Expired' | 'Overproduction' | 'Contamination' | 'Plate Waste' | 'Other'
  meal: 'Breakfast' | 'Lunch' | 'Dinner' | 'N/A'
  loggedBy: string
  cost?: number
}

type CountItem = {
  id: string
  itemId: string
  itemName: string
  unit: string
  expected: number
  counted: number | ''
  variance: number
  note: string
}

type CountStatus = 'Draft' | 'Submitted' | 'Approved' | 'Discrepancy'

type InventoryCount = {
  id: string
  countDate: string
  submittedById: string
  status: CountStatus
  items: CountItem[]
  notes: string
  submittedAt?: string
}

type OrderLineItem = {
  itemId: string
  itemName: string
  unit: string
  currentQty: number
  parLevel: number
  orderedQty: number
  receivedQty: number | ''
  unitCost: number
  vendor: string
  note: string
}

type OrderStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Submitted' | 'Received' | 'Partial'

type TruckOrder = {
  id: string
  vendorName: string
  deliveryDate: string
  cutoffDate: string
  status: OrderStatus
  items: OrderLineItem[]
  notes: string
  createdAt: string
  submittedById?: string
  receivedById?: string
}

// ── Seed data ────────────────────────────────────────────────────────────────
const SEED_STOCK: StockItem[] = [
  { id:'s1',  item:'Chicken Breast (frozen)',        category:'Proteins',          qty:40,  unit:'lbs',    min:20, reorderQty:30, cost:3.80, vendor:'Sysco' },
  { id:'s2',  item:'Salmon Fillet (frozen)',          category:'Proteins',          qty:12,  unit:'lbs',    min:10, reorderQty:15, cost:6.50, vendor:'Sysco' },
  { id:'s3',  item:'Ground Turkey',                  category:'Proteins',          qty:8,   unit:'lbs',    min:10, reorderQty:15, cost:4.20, vendor:'Sysco' },
  { id:'s4',  item:'Beef Chuck Roast',               category:'Proteins',          qty:20,  unit:'lbs',    min:15, reorderQty:20, cost:5.60, vendor:'Sysco' },
  { id:'s5',  item:'Pork Loin Chops',                category:'Proteins',          qty:6,   unit:'lbs',    min:10, reorderQty:12, cost:4.80, vendor:'Sysco' },
  { id:'s6',  item:'Russet Potatoes',                category:'Produce',           qty:50,  unit:'lbs',    min:30, reorderQty:40, cost:0.60, vendor:'Sysco' },
  { id:'s7',  item:'Green Beans (frozen)',            category:'Produce',           qty:20,  unit:'lbs',    min:15, reorderQty:20, cost:1.40, vendor:'Sysco' },
  { id:'s8',  item:'Broccoli (frozen)',               category:'Produce',           qty:15,  unit:'lbs',    min:10, reorderQty:15, cost:1.60, vendor:'Sysco' },
  { id:'s9',  item:'Carrots (fresh)',                 category:'Produce',           qty:10,  unit:'lbs',    min:8,  reorderQty:10, cost:0.80, vendor:'Sysco' },
  { id:'s10', item:'Bananas',                        category:'Produce',           qty:30,  unit:'each',   min:20, reorderQty:30, cost:0.25, vendor:'Sysco' },
  { id:'s11', item:'Whole Milk',                     category:'Dairy',             qty:8,   unit:'gallons',min:6,  reorderQty:8,  cost:4.10, vendor:'Sysco' },
  { id:'s12', item:'Butter (unsalted)',               category:'Dairy',             qty:6,   unit:'lbs',    min:4,  reorderQty:6,  cost:3.50, vendor:'Sysco' },
  { id:'s13', item:'Cheddar Cheese (shredded)',       category:'Dairy',             qty:5,   unit:'lbs',    min:3,  reorderQty:5,  cost:5.20, vendor:'Sysco' },
  { id:'s14', item:'Lactose-Free Milk',               category:'Dairy',             qty:4,   unit:'cartons',min:6,  reorderQty:8,  cost:3.00, vendor:'Sysco', notes:'Low — reorder' },
  { id:'s15', item:'Rolled Oats',                    category:'Dry Goods',         qty:20,  unit:'lbs',    min:10, reorderQty:15, cost:1.20, vendor:'Sysco' },
  { id:'s16', item:'Egg Noodles',                    category:'Dry Goods',         qty:10,  unit:'lbs',    min:8,  reorderQty:12, cost:1.80, vendor:'Sysco' },
  { id:'s17', item:'Brown Rice',                     category:'Dry Goods',         qty:15,  unit:'lbs',    min:10, reorderQty:15, cost:1.50, vendor:'Sysco' },
  { id:'s18', item:'Mac & Cheese (bulk)',             category:'Dry Goods',         qty:6,   unit:'lbs',    min:5,  reorderQty:8,  cost:2.20, vendor:'Sysco' },
  { id:'s19', item:'Gluten-Free Bread',               category:'Dietary / Special', qty:1,   unit:'loaves', min:3,  reorderQty:6,  cost:6.50, vendor:'Sysco', notes:'LOW — gluten-free residents' },
  { id:'s20', item:'Ensure Original (Vanilla)',       category:'Dietary / Special', qty:24,  unit:'cans',   min:12, reorderQty:24, cost:2.80, vendor:'Sysco' },
  { id:'s21', item:'Ensure Plus (Chocolate)',         category:'Dietary / Special', qty:6,   unit:'cans',   min:12, reorderQty:24, cost:3.10, vendor:'Sysco', notes:'Below par' },
  { id:'s22', item:'Simply Thick (Nectar)',           category:'Dietary / Special', qty:2,   unit:'bottles',min:3,  reorderQty:4,  cost:18.00,vendor:'Sysco', notes:'LOW — thickened liquid residents' },
  { id:'s23', item:'Simply Thick (Honey)',            category:'Dietary / Special', qty:3,   unit:'bottles',min:2,  reorderQty:4,  cost:18.00,vendor:'Sysco' },
  { id:'s24', item:'Sugar-Free Syrup',                category:'Dietary / Special', qty:3,   unit:'bottles',min:2,  reorderQty:4,  cost:4.50, vendor:'Sysco' },
  { id:'s25', item:'No-Added-Salt Seasoning',         category:'Dietary / Special', qty:4,   unit:'jars',   min:2,  reorderQty:4,  cost:3.80, vendor:'Sysco' },
  { id:'s26', item:'Orange Juice (gallon)',           category:'Beverages',         qty:10,  unit:'gallons',min:6,  reorderQty:8,  cost:5.20, vendor:'Sysco' },
  { id:'s27', item:'Apple Juice (gallon)',            category:'Beverages',         qty:8,   unit:'gallons',min:6,  reorderQty:8,  cost:4.80, vendor:'Sysco' },
  { id:'s28', item:'Decaf Coffee (ground)',           category:'Beverages',         qty:6,   unit:'lbs',    min:4,  reorderQty:6,  cost:9.00, vendor:'Sysco' },
  { id:'s29', item:'Hot Tea Bags',                   category:'Beverages',         qty:200, unit:'bags',   min:100,reorderQty:150,cost:0.05, vendor:'Sysco' },
  { id:'s30', item:'Hot Chocolate Mix',              category:'Beverages',         qty:3,   unit:'lbs',    min:2,  reorderQty:3,  cost:5.00, vendor:'Sysco' },
  { id:'s31', item:'Tray Liners',                    category:'Paper & Supplies',  qty:500, unit:'sheets', min:200,reorderQty:300,cost:0.04, vendor:'Sysco' },
  { id:'s32', item:'Disposable Cups (8 oz)',         category:'Paper & Supplies',  qty:300, unit:'each',   min:200,reorderQty:300,cost:0.06, vendor:'Sysco' },
  { id:'s33', item:'Napkins',                        category:'Paper & Supplies',  qty:1000,unit:'each',   min:500,reorderQty:500,cost:0.02, vendor:'Sysco' },
]

const TODAY = new Date().toISOString().slice(0,10)
const D = (d: number) => new Date(Date.now() - d*86400000).toISOString().slice(0,10)

const SEED_WASTE: WasteEntry[] = [
  { id:'w1', date:TODAY,   item:'Grilled Chicken Breast', qty:4,   unit:'portions', reason:'Overproduction', meal:'Lunch',   loggedBy:'Kitchen Staff', cost:15.20 },
  { id:'w2', date:TODAY,   item:'Mashed Potatoes',        qty:6,   unit:'portions', reason:'Plate Waste',    meal:'Dinner',  loggedBy:'Kitchen Staff', cost: 4.80 },
  { id:'w3', date:D(2),    item:'Salmon Fillet',          qty:2,   unit:'portions', reason:'Overproduction', meal:'Dinner',  loggedBy:'Cook',          cost:13.00 },
  { id:'w4', date:D(3),    item:'Whole Milk',             qty:0.5, unit:'gallons',  reason:'Expired',        meal:'N/A',     loggedBy:'Cook',          cost: 2.05 },
  { id:'w5', date:D(4),    item:'Green Beans',            qty:3,   unit:'lbs',      reason:'Overproduction', meal:'Lunch',   loggedBy:'Kitchen Staff', cost: 4.20 },
]

const CATEGORIES: Category[] = [
  'Proteins','Produce','Dairy','Dry Goods','Dietary / Special','Beverages','Paper & Supplies',
]
const WASTE_REASONS: WasteEntry['reason'][] = ['Overproduction','Plate Waste','Expired','Contamination','Other']

function uid() { return Math.random().toString(36).slice(2,10) }

function fmt$(n: number) { return `$${n.toFixed(2)}` }

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

const TH: React.CSSProperties = { padding:'8px 12px', textAlign:'left', fontSize:'var(--text-xs)', fontWeight:'var(--weight-bold)', textTransform:'uppercase', letterSpacing:'0.4px', color:'var(--text-muted)', whiteSpace:'nowrap' }
const TD: React.CSSProperties = { padding:'9px 12px', verticalAlign:'middle' }

// ── STOCK INVENTORY TAB ───────────────────────────────────────────────────────
function StockTab({ items, setItems }: { items: StockItem[]; setItems: React.Dispatch<React.SetStateAction<StockItem[]>> }) {
  const [search, setSearch]     = useState('')
  const [filterCat, setFilter]  = useState<Category | 'All'>('All')
  const [editing, setEditing]   = useState<string | null>(null)
  const [editVals, setEditVals] = useState<Partial<StockItem>>({})
  const [showAdd, setShowAdd]   = useState(false)
  const [newItem, setNewItem]   = useState<Partial<StockItem>>({ category:'Dry Goods', qty:0, unit:'', min:0 })

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

  function startEdit(item: StockItem) { setEditing(item.id); setEditVals({ qty: item.qty, min: item.min, notes: item.notes ?? '' }) }
  function saveEdit(id: string) { setItems(p => p.map(i => i.id === id ? { ...i, ...editVals } : i)); setEditing(null) }
  function addItem() {
    if (!newItem.item?.trim() || !newItem.unit?.trim()) return
    setItems(p => [...p, { id:uid(), item:newItem.item!, category:newItem.category as Category, qty:newItem.qty??0, unit:newItem.unit!, min:newItem.min??0, cost:newItem.cost, notes:newItem.notes }])
    setNewItem({ category:'Dry Goods', qty:0, unit:'', min:0 })
    setShowAdd(false)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>
      {lowItems.length > 0 && (
        <div className="sl-alert sl-alert-warning" style={{ display:'flex', flexWrap:'wrap', gap:'var(--space-2)', alignItems:'center' }}>
          <b>⚠ {lowItems.length} item{lowItems.length > 1 ? 's' : ''} below par:</b>
          {lowItems.map(i => <span key={i.id} style={{ fontSize:'var(--text-sm)' }}>{i.item} ({i.qty}/{i.min} {i.unit})</span>)}
        </div>
      )}
      <div style={{ display:'flex', gap:'var(--space-3)', flexWrap:'wrap', alignItems:'center' }}>
        <input className="sl-input" style={{ flex:'1 1 200px', maxWidth:300 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…" />
        <select className="sl-select" value={filterCat} onChange={e => setFilter(e.target.value as any)} style={{ flex:'1 1 160px', maxWidth:220 }}>
          <option value="All">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setShowAdd(v => !v)} className="btn btn-primary" style={{ marginLeft:'auto', whiteSpace:'nowrap' }}>+ Add Item</button>
      </div>
      {showAdd && (
        <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)', display:'flex', flexWrap:'wrap', gap:'var(--space-3)' }}>
          <div style={{ flex:'2 1 180px' }}><label>Item Name</label><input className="sl-input" value={newItem.item??''} onChange={e => setNewItem(p => ({...p,item:e.target.value}))} placeholder="e.g. Corn Starch" /></div>
          <div style={{ flex:'1 1 140px' }}><label>Category</label><select className="sl-select" value={newItem.category} onChange={e => setNewItem(p => ({...p,category:e.target.value as Category}))}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div style={{ flex:'0 1 90px' }}><label>Qty</label><input type="number" className="sl-input" value={newItem.qty} onChange={e => setNewItem(p => ({...p,qty:+e.target.value}))} /></div>
          <div style={{ flex:'0 1 90px' }}><label>Unit</label><input className="sl-input" value={newItem.unit??''} onChange={e => setNewItem(p => ({...p,unit:e.target.value}))} placeholder="lbs, cans…" /></div>
          <div style={{ flex:'0 1 90px' }}><label>Min Par</label><input type="number" className="sl-input" value={newItem.min} onChange={e => setNewItem(p => ({...p,min:+e.target.value}))} /></div>
          <div style={{ flex:'0 1 90px' }}><label>Cost/Unit $</label><input type="number" step="0.01" className="sl-input" value={newItem.cost??''} onChange={e => setNewItem(p => ({...p,cost:+e.target.value}))} /></div>
          <div style={{ flex:'2 1 200px' }}><label>Notes</label><input className="sl-input" value={newItem.notes??''} onChange={e => setNewItem(p => ({...p,notes:e.target.value}))} placeholder="Optional note" /></div>
          <div style={{ display:'flex', gap:'var(--space-2)', alignItems:'flex-end', flexShrink:0 }}>
            <button onClick={addItem} className="btn btn-primary">Save</button>
            <button onClick={() => setShowAdd(false)} className="btn btn-outline">Cancel</button>
          </div>
        </div>
      )}
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
                <thead><tr style={{ background:'var(--bg-app)' }}>
                  <th style={TH}>Item</th><th style={TH}>On Hand</th><th style={TH}>Min Par</th><th style={TH}>Status</th><th style={TH}>Cost/Unit</th><th style={TH}>Notes</th><th style={TH} />
                </tr></thead>
                <tbody>
                  {catItems.map((item, i) => {
                    const low = item.qty < item.min
                    const isEdit = editing === item.id
                    return (
                      <tr key={item.id} style={{ background: low ? '#fffbeb' : (i%2===0 ? 'var(--bg-card)' : 'var(--bg-app)'), borderBottom:'1px solid var(--border-color)' }}>
                        <td style={{ ...TD, fontWeight:'var(--weight-medium)', color:'var(--text-primary)' }}>{item.item}</td>
                        <td style={TD}>
                          {isEdit ? <input type="number" value={editVals.qty??''} onChange={e => setEditVals(p => ({...p,qty:+e.target.value}))} className="sl-input" style={{ width:70 }} />
                            : <b style={{ color: low ? '#d97706' : 'var(--text-primary)' }}>{item.qty}</b>}
                          &nbsp;<span style={{ color:'var(--text-muted)' }}>{item.unit}</span>
                        </td>
                        <td style={TD}>{item.min} <span style={{ color:'var(--text-muted)' }}>{item.unit}</span></td>
                        <td style={TD}>{low ? <LowBadge /> : <Badge color="#059669">OK</Badge>}</td>
                        <td style={TD}>{item.cost != null ? fmt$(item.cost) : '—'}</td>
                        <td style={TD}>
                          {isEdit ? <input value={editVals.notes??''} onChange={e => setEditVals(p => ({...p,notes:e.target.value}))} className="sl-input" style={{ minWidth:120 }} />
                            : <span style={{ color:'var(--text-muted)', fontStyle: item.notes ? 'normal' : 'italic' }}>{item.notes||'—'}</span>}
                        </td>
                        <td style={{ ...TD, whiteSpace:'nowrap' }}>
                          {isEdit
                            ? <><button onClick={() => saveEdit(item.id)} className="btn btn-primary btn-sm">Save</button><button onClick={() => setEditing(null)} className="btn btn-outline btn-sm" style={{ marginLeft:6 }}>Cancel</button></>
                            : <button onClick={() => startEdit(item)} className="btn btn-outline btn-sm">Edit</button>}
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
      {filtered.length === 0 && <div className="sl-empty"><div style={{ fontSize:36, marginBottom:'var(--space-3)' }}>📦</div><div className="sl-empty-title">No items match your search.</div></div>}
    </div>
  )
}

// ── WASTE LOG TAB ─────────────────────────────────────────────────────────────
function WasteTab() {
  const [entries,  setEntries]  = useState<WasteEntry[]>(JSON.parse(JSON.stringify(SEED_WASTE)))
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<Partial<WasteEntry>>({ date:TODAY, reason:'Overproduction', meal:'Lunch', loggedBy:'', qty:0, unit:'portions' })

  function addEntry() {
    if (!form.item?.trim() || !form.loggedBy?.trim()) return
    setEntries(p => [{ id:uid(), date:form.date!, item:form.item!, qty:form.qty??0, unit:form.unit!, reason:form.reason!, meal:form.meal!, loggedBy:form.loggedBy!, cost:form.cost }, ...p])
    setForm({ date:TODAY, reason:'Overproduction', meal:'Lunch', loggedBy:'', qty:0, unit:'portions' })
    setShowForm(false)
  }

  const totalCost = entries.reduce((s,e) => s + (e.cost??0), 0)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>
      <div style={{ display:'flex', gap:'var(--space-4)', flexWrap:'wrap' }}>
        <div className="sl-stat-card"><div className="sl-eyebrow">Waste Entries</div><div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'var(--color-primary)' }}>{entries.length}</div></div>
        <div className="sl-stat-card"><div className="sl-eyebrow">Estimated Waste Cost</div><div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'#dc2626' }}>{fmt$(totalCost)}</div></div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end' }}><button onClick={() => setShowForm(v => !v)} className="btn btn-primary">+ Log Waste</button></div>
      {showForm && (
        <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)', display:'flex', flexWrap:'wrap', gap:'var(--space-3)' }}>
          <div style={{ flex:'2 1 180px' }}><label>Item</label><input className="sl-input" value={form.item??''} onChange={e => setForm(p => ({...p,item:e.target.value}))} placeholder="e.g. Mashed Potatoes" /></div>
          <div style={{ flex:'0 1 90px' }}><label>Qty</label><input type="number" className="sl-input" value={form.qty} onChange={e => setForm(p => ({...p,qty:+e.target.value}))} /></div>
          <div style={{ flex:'0 1 100px' }}><label>Unit</label><input className="sl-input" value={form.unit??''} onChange={e => setForm(p => ({...p,unit:e.target.value}))} placeholder="portions, lbs…" /></div>
          <div style={{ flex:'1 1 130px' }}><label>Reason</label><select className="sl-select" value={form.reason} onChange={e => setForm(p => ({...p,reason:e.target.value as WasteEntry['reason']}))}>{WASTE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          <div style={{ flex:'0 1 130px' }}><label>Meal</label><select className="sl-select" value={form.meal} onChange={e => setForm(p => ({...p,meal:e.target.value as WasteEntry['meal']}))}>{(['Breakfast','Lunch','Dinner','N/A'] as WasteEntry['meal'][]).map(m => <option key={m} value={m}>{m}</option>)}</select></div>
          <div style={{ flex:'0 1 120px' }}><label>Date</label><input type="date" className="sl-input" value={form.date} onChange={e => setForm(p => ({...p,date:e.target.value}))} /></div>
          <div style={{ flex:'0 1 90px' }}><label>Est. Cost $</label><input type="number" step="0.01" className="sl-input" value={form.cost??''} onChange={e => setForm(p => ({...p,cost:+e.target.value}))} /></div>
          <div style={{ flex:'1 1 140px' }}><label>Logged By</label><input className="sl-input" value={form.loggedBy??''} onChange={e => setForm(p => ({...p,loggedBy:e.target.value}))} placeholder="Staff name" /></div>
          <div style={{ display:'flex', gap:'var(--space-2)', alignItems:'flex-end', flexShrink:0 }}><button onClick={addEntry} className="btn btn-primary">Save</button><button onClick={() => setShowForm(false)} className="btn btn-outline">Cancel</button></div>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
        {entries.map(e => {
          const rc: Record<WasteEntry['reason'],string> = { Overproduction:'#d97706', 'Plate Waste':'#7c3aed', Expired:'#dc2626', Contamination:'#9f1239', Other:'#64748b' }
          return (
            <div key={e.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:'var(--space-4)', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:160 }}>
                <div style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-semi)', color:'var(--text-primary)' }}>{e.item}</div>
                <div style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)', marginTop:2 }}>{e.qty} {e.unit} · {e.meal} · {e.date}</div>
                <div style={{ marginTop:4 }}><Badge color={rc[e.reason]}>{e.reason}</Badge></div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:2, textAlign:'right', flexShrink:0 }}>
                {e.cost != null && <span style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-black)', color:'#dc2626', fontFamily:'var(--font-display)' }}>{fmt$(e.cost)}</span>}
                <span style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)' }}>by {e.loggedBy}</span>
                <button onClick={() => setEntries(p => p.filter(x => x.id !== e.id))} style={{ background:'none', border:'none', color:'var(--color-danger)', cursor:'pointer', fontSize:12, padding:'2px 0', textAlign:'right' }}>Remove</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── ZERO-BALANCE COUNT TAB ────────────────────────────────────────────────────
function ZeroBalanceTab({ stockItems }: { stockItems: StockItem[] }) {
  const { user } = useAuth()
  const { profiles } = useStaffStore()
  const myProfile = profiles.find(p => (p as any).authUserId === user?.id || (p as any).userId === user?.id)
  const myStaffId = myProfile?.id ?? 'staff-3'
  const isPrivileged = user?.role === 'admin' || user?.role === 'manager'

  const [counts, setCounts] = useState<InventoryCount[]>([])
  const [activeCount, setActiveCount] = useState<InventoryCount | null>(null)
  const [filterCat, setFilterCat] = useState<Category | 'All'>('All')

  function startNewCount() {
    const items: CountItem[] = stockItems
      .filter(i => filterCat === 'All' || i.category === filterCat)
      .map(i => ({
        id: uid(), itemId: i.id, itemName: i.item, unit: i.unit,
        expected: i.qty, counted: '', variance: 0, note: '',
      }))
    const count: InventoryCount = {
      id: uid(), countDate: TODAY, submittedById: myStaffId,
      status: 'Draft', items, notes: '',
    }
    setActiveCount(count)
  }

  function updateCounted(itemId: string, val: string) {
    if (!activeCount) return
    setActiveCount(prev => prev ? {
      ...prev,
      items: prev.items.map(i => i.id !== itemId ? i : {
        ...i,
        counted: val === '' ? '' : Number(val),
        variance: val === '' ? 0 : Number(val) - i.expected,
      }),
    } : null)
  }

  function updateNote(itemId: string, val: string) {
    if (!activeCount) return
    setActiveCount(prev => prev ? { ...prev, items: prev.items.map(i => i.id !== itemId ? i : { ...i, note: val }) } : null)
  }

  function submitCount() {
    if (!activeCount) return
    const hasDiscrepancy = activeCount.items.some(i => Math.abs(i.variance) > 2)
    const submitted: InventoryCount = {
      ...activeCount,
      status: hasDiscrepancy ? 'Discrepancy' : 'Submitted',
      submittedAt: new Date().toISOString(),
    }
    setCounts(p => [submitted, ...p])
    setActiveCount(null)
  }

  function approveCount(id: string) {
    setCounts(p => p.map(c => c.id !== id ? c : { ...c, status: 'Approved' }))
  }

  const statusColor: Record<CountStatus, string> = {
    Draft: '#6b7280', Submitted: '#0284c7', Approved: '#059669', Discrepancy: '#dc2626',
  }

  const discrepancyItems = activeCount?.items.filter(i => i.counted !== '' && Math.abs(i.variance) > 2) ?? []

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>

      {/* Past counts */}
      {counts.length > 0 && (
        <div>
          <div className="sl-section-title" style={{ color:'var(--color-primary)', marginBottom:'var(--space-3)' }}>Recent Counts</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
            {counts.map(c => (
              <div key={c.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Count — {c.countDate}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{c.items.length} items · {c.items.filter(i => Math.abs(i.variance) > 2).length} discrepancies</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:`${statusColor[c.status]}22`, color:statusColor[c.status], border:`1px solid ${statusColor[c.status]}55` }}>{c.status}</span>
                  {isPrivileged && c.status === 'Submitted' && (
                    <button onClick={() => approveCount(c.id)} className="btn btn-primary btn-sm">Approve</button>
                  )}
                  {isPrivileged && c.status === 'Discrepancy' && (
                    <button onClick={() => approveCount(c.id)} className="btn btn-outline btn-sm" style={{ borderColor:'#dc2626', color:'#dc2626' }}>Resolve & Approve</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active count form */}
      {activeCount ? (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--color-primary)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', background:'var(--color-primary-light)', borderBottom:'1px solid var(--border-color)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:'var(--color-primary)', fontFamily:'var(--font-display)' }}>Zero-Balance Count — {activeCount.countDate}</div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{activeCount.items.length} items · enter physical counts below</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setActiveCount(null)} className="btn btn-outline btn-sm">Discard</button>
              <button onClick={submitCount} className="btn btn-primary btn-sm">Submit Count</button>
            </div>
          </div>

          {discrepancyItems.length > 0 && (
            <div style={{ padding:'10px 18px', background:'#fef2f2', borderBottom:'1px solid #fecaca', fontSize:12, color:'#991b1b', fontWeight:600 }}>
              ⚠ {discrepancyItems.length} item{discrepancyItems.length > 1 ? 's' : ''} with variance &gt; ±2 — will flag as Discrepancy on submit
            </div>
          )}

          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'var(--text-sm)' }}>
              <thead><tr style={{ background:'var(--bg-app)' }}>
                <th style={TH}>Item</th><th style={TH}>Unit</th><th style={TH}>Expected</th><th style={TH}>Counted</th><th style={TH}>Variance</th><th style={TH}>Note</th>
              </tr></thead>
              <tbody>
                {activeCount.items.map((item, i) => {
                  const hasVar = item.counted !== '' && Math.abs(item.variance) > 2
                  return (
                    <tr key={item.id} style={{ background: hasVar ? '#fef2f2' : (i%2===0 ? 'var(--bg-card)' : 'var(--bg-app)'), borderBottom:'1px solid var(--border-color)' }}>
                      <td style={{ ...TD, fontWeight:600, color:'var(--text-primary)' }}>{item.itemName}</td>
                      <td style={{ ...TD, color:'var(--text-muted)' }}>{item.unit}</td>
                      <td style={TD}><b>{item.expected}</b></td>
                      <td style={TD}>
                        <input
                          type="number" min={0}
                          value={item.counted === '' ? '' : item.counted}
                          onChange={e => updateCounted(item.id, e.target.value)}
                          className="sl-input" style={{ width:80 }}
                          placeholder="count"
                        />
                      </td>
                      <td style={{ ...TD, fontWeight:700, color: hasVar ? '#dc2626' : item.variance < 0 ? '#d97706' : '#059669' }}>
                        {item.counted === '' ? '—' : (item.variance >= 0 ? '+' : '') + item.variance}
                      </td>
                      <td style={TD}>
                        <input value={item.note} onChange={e => updateNote(item.id, e.target.value)} className="sl-input" style={{ minWidth:120 }} placeholder="optional note…" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border-color)', display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={() => setActiveCount(null)} className="btn btn-outline">Discard</button>
            <button onClick={submitCount} className="btn btn-primary">Submit Count</button>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
          <div style={{ display:'flex', gap:'var(--space-3)', alignItems:'center', flexWrap:'wrap' }}>
            <select className="sl-select" value={filterCat} onChange={e => setFilterCat(e.target.value as any)} style={{ flex:'1 1 160px', maxWidth:220 }}>
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={startNewCount} className="btn btn-primary" style={{ marginLeft:'auto' }}>+ Start New Count</button>
          </div>
          {counts.length === 0 && (
            <div className="sl-empty">
              <div style={{ fontSize:36, marginBottom:'var(--space-3)' }}>📋</div>
              <div className="sl-empty-title">No counts recorded yet.</div>
              <div className="sl-empty-desc">Start a new zero-balance count to log physical quantities.</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── TRUCK ORDERS TAB ──────────────────────────────────────────────────────────
function TruckOrdersTab({ stockItems }: { stockItems: StockItem[] }) {
  const { user } = useAuth()
  const { profiles } = useStaffStore()
  const { addApproval } = useCommunicationsStore()
  const myProfile = profiles.find(p => (p as any).authUserId === user?.id || (p as any).userId === user?.id)
  const myStaffId = myProfile?.id ?? 'staff-3'
  const isPrivileged = user?.role === 'admin' || user?.role === 'manager'

  const [orders, setOrders] = useState<TruckOrder[]>([])
  const [draftOrder, setDraftOrder] = useState<TruckOrder | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [receiveMode, setReceiveMode] = useState<string | null>(null)

  const lowItems = stockItems.filter(i => i.qty < i.min)

  // Compute next Wednesday as default delivery date
  function nextWeekday(dow: number) {
    const d = new Date()
    const diff = (dow - d.getDay() + 7) % 7 || 7
    d.setDate(d.getDate() + diff)
    return d.toISOString().slice(0,10)
  }

  function startOrderFromLow() {
    const items: OrderLineItem[] = lowItems.map(i => ({
      itemId: i.id,
      itemName: i.item,
      unit: i.unit,
      currentQty: i.qty,
      parLevel: i.min,
      orderedQty: i.reorderQty ?? (i.min - i.qty + (i.reorderQty ?? i.min)),
      receivedQty: '',
      unitCost: i.cost ?? 0,
      vendor: i.vendor ?? 'Sysco',
      note: '',
    }))
    setDraftOrder({
      id: uid(),
      vendorName: 'Sysco',
      deliveryDate: nextWeekday(3), // Wednesday
      cutoffDate: nextWeekday(1),   // Monday
      status: 'Draft',
      items,
      notes: '',
      createdAt: new Date().toISOString(),
    })
  }

  function startBlankOrder() {
    setDraftOrder({
      id: uid(),
      vendorName: 'Sysco',
      deliveryDate: nextWeekday(3),
      cutoffDate: nextWeekday(1),
      status: 'Draft',
      items: [],
      notes: '',
      createdAt: new Date().toISOString(),
    })
  }

  function addLineItem() {
    if (!draftOrder) return
    const blank: OrderLineItem = {
      itemId: uid(), itemName: '', unit: 'each', currentQty: 0,
      parLevel: 0, orderedQty: 1, receivedQty: '', unitCost: 0,
      vendor: draftOrder.vendorName, note: '',
    }
    setDraftOrder(p => p ? { ...p, items: [...p.items, blank] } : null)
  }

  function updateLine(itemId: string, field: keyof OrderLineItem, val: any) {
    setDraftOrder(p => p ? {
      ...p,
      items: p.items.map(i => i.itemId !== itemId ? i : { ...i, [field]: val }),
    } : null)
  }

  function removeLine(itemId: string) {
    setDraftOrder(p => p ? { ...p, items: p.items.filter(i => i.itemId !== itemId) } : null)
  }

  function calcTotal(items: OrderLineItem[]) {
    return items.reduce((s,i) => s + (i.orderedQty * i.unitCost), 0)
  }

  function submitForApproval() {
    if (!draftOrder || draftOrder.items.length === 0) return
    const total = calcTotal(draftOrder.items)
    const order: TruckOrder = { ...draftOrder, status: 'Pending Approval', submittedById: myStaffId }
    setOrders(p => [order, ...p])
    setDraftOrder(null)
    // Create approval request in comms store
    addApproval({
      type: 'truck_order',
      requestedById: myStaffId,
      assignedToId: 'staff-2',
      status: 'Pending',
      subject: `Truck Order — ${order.vendorName} · Delivery ${order.deliveryDate}`,
      description: `Order contains ${order.items.length} line items. Cutoff: ${order.cutoffDate}. Estimated total: $${total.toFixed(2)}. ${order.notes || ''}`.trim(),
      payload: {
        vendor: order.vendorName,
        deliveryDate: order.deliveryDate,
        cutoffDate: order.cutoffDate,
        estimatedTotal: total,
        items: order.items.map(i => ({ name: i.itemName, qty: i.orderedQty, unit: i.unit, estimatedCost: +(i.orderedQty * i.unitCost).toFixed(2) })),
      },
    })
  }

  function markApproved(orderId: string) {
    setOrders(p => p.map(o => o.id !== orderId ? o : { ...o, status: 'Approved' }))
  }

  function markSubmitted(orderId: string) {
    setOrders(p => p.map(o => o.id !== orderId ? o : { ...o, status: 'Submitted' }))
  }

  function openReceive(orderId: string) {
    setReceiveMode(orderId)
    setExpandedId(orderId)
  }

  function updateReceived(orderId: string, itemId: string, val: string) {
    setOrders(p => p.map(o => o.id !== orderId ? o : {
      ...o,
      items: o.items.map(i => i.itemId !== itemId ? i : { ...i, receivedQty: val === '' ? '' : Number(val) }),
    }))
  }

  function finishReceive(orderId: string) {
    setOrders(p => p.map(o => {
      if (o.id !== orderId) return o
      const allReceived = o.items.every(i => i.receivedQty !== '' && Number(i.receivedQty) >= i.orderedQty)
      return { ...o, status: allReceived ? 'Received' : 'Partial', receivedById: myStaffId }
    }))
    setReceiveMode(null)
  }

  const statusColor: Record<OrderStatus, string> = {
    Draft: '#6b7280', 'Pending Approval': '#d97706', Approved: '#059669',
    Submitted: '#0284c7', Received: '#7c3aed', Partial: '#dc2626',
  }

  const inputStyle: React.CSSProperties = { padding:'7px 10px', border:'1px solid var(--border-color)', borderRadius:'var(--radius-sm)', fontSize:13, color:'var(--text-primary)', background:'var(--bg-card)', width:'100%', boxSizing:'border-box' as any }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>

      {/* Low stock alert */}
      {lowItems.length > 0 && !draftOrder && (
        <div className="sl-alert sl-alert-warning" style={{ display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:10 }}>
          <div>
            <b>⚠ {lowItems.length} item{lowItems.length > 1 ? 's' : ''} below par level</b>
            <div style={{ fontSize:'var(--text-sm)', marginTop:2 }}>{lowItems.map(i => i.item).join(' · ')}</div>
          </div>
          <button onClick={startOrderFromLow} className="btn btn-primary" style={{ flexShrink:0 }}>Build Order from Low Items</button>
        </div>
      )}

      {/* Controls */}
      {!draftOrder && (
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={startBlankOrder} className="btn btn-outline">+ Blank Order</button>
        </div>
      )}

      {/* Draft builder */}
      {draftOrder && (
        <div style={{ background:'var(--bg-card)', border:'2px solid var(--color-primary)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', background:'var(--color-primary-light)', borderBottom:'1px solid var(--border-color)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--color-primary)', fontFamily:'var(--font-display)' }}>New Truck Order — Draft</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setDraftOrder(null)} className="btn btn-outline btn-sm">Discard</button>
              <button onClick={submitForApproval} disabled={draftOrder.items.length === 0} className="btn btn-primary btn-sm">Submit for Approval</button>
            </div>
          </div>

          {/* Order meta */}
          <div style={{ padding:'16px 18px', display:'flex', gap:12, flexWrap:'wrap', borderBottom:'1px solid var(--border-color)' }}>
            <div style={{ flex:'1 1 140px' }}>
              <label style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', display:'block', marginBottom:5 }}>Vendor</label>
              <input style={inputStyle} value={draftOrder.vendorName} onChange={e => setDraftOrder(p => p ? {...p,vendorName:e.target.value} : null)} />
            </div>
            <div style={{ flex:'1 1 130px' }}>
              <label style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', display:'block', marginBottom:5 }}>Delivery Date</label>
              <input type="date" style={inputStyle} value={draftOrder.deliveryDate} onChange={e => setDraftOrder(p => p ? {...p,deliveryDate:e.target.value} : null)} />
            </div>
            <div style={{ flex:'1 1 130px' }}>
              <label style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', display:'block', marginBottom:5 }}>Order Cutoff</label>
              <input type="date" style={inputStyle} value={draftOrder.cutoffDate} onChange={e => setDraftOrder(p => p ? {...p,cutoffDate:e.target.value} : null)} />
            </div>
            <div style={{ flex:'2 1 200px' }}>
              <label style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', display:'block', marginBottom:5 }}>Notes</label>
              <input style={inputStyle} value={draftOrder.notes} onChange={e => setDraftOrder(p => p ? {...p,notes:e.target.value} : null)} placeholder="Optional order notes…" />
            </div>
          </div>

          {/* Line items */}
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'var(--bg-app)' }}>
                <th style={TH}>Item</th><th style={TH}>Unit</th><th style={TH}>On Hand</th><th style={TH}>Par</th><th style={TH}>Qty to Order</th><th style={TH}>Unit Cost $</th><th style={TH}>Line Total</th><th style={TH}>Note</th><th style={TH} />
              </tr></thead>
              <tbody>
                {draftOrder.items.map((item, i) => (
                  <tr key={item.itemId} style={{ background: i%2===0 ? 'var(--bg-card)' : 'var(--bg-app)', borderBottom:'1px solid var(--border-color)' }}>
                    <td style={TD}><input style={{ ...inputStyle, minWidth:140 }} value={item.itemName} onChange={e => updateLine(item.itemId,'itemName',e.target.value)} placeholder="Item name" /></td>
                    <td style={TD}><input style={{ ...inputStyle, width:70 }} value={item.unit} onChange={e => updateLine(item.itemId,'unit',e.target.value)} /></td>
                    <td style={{ ...TD, color:'var(--text-muted)' }}>{item.currentQty}</td>
                    <td style={{ ...TD, color:'var(--text-muted)' }}>{item.parLevel}</td>
                    <td style={TD}><input type="number" min={0} style={{ ...inputStyle, width:70 }} value={item.orderedQty} onChange={e => updateLine(item.itemId,'orderedQty',+e.target.value)} /></td>
                    <td style={TD}><input type="number" min={0} step="0.01" style={{ ...inputStyle, width:80 }} value={item.unitCost} onChange={e => updateLine(item.itemId,'unitCost',+e.target.value)} /></td>
                    <td style={{ ...TD, fontWeight:700, color:'var(--color-primary)', whiteSpace:'nowrap' }}>{fmt$(item.orderedQty * item.unitCost)}</td>
                    <td style={TD}><input style={{ ...inputStyle, minWidth:110 }} value={item.note} onChange={e => updateLine(item.itemId,'note',e.target.value)} placeholder="note…" /></td>
                    <td style={TD}><button onClick={() => removeLine(item.itemId)} style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer', fontSize:18, lineHeight:1, padding:'2px 4px' }}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border-color)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <button onClick={addLineItem} className="btn btn-outline btn-sm">+ Add Line Item</button>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--color-primary)', fontFamily:'var(--font-display)' }}>
              Estimated Total: {fmt$(calcTotal(draftOrder.items))}
            </div>
          </div>
        </div>
      )}

      {/* Past orders */}
      {orders.length === 0 && !draftOrder ? (
        <div className="sl-empty">
          <div style={{ fontSize:36, marginBottom:'var(--space-3)' }}>🚛</div>
          <div className="sl-empty-title">No truck orders yet.</div>
          <div className="sl-empty-desc">Use "Build Order from Low Items" or "+ Blank Order" to start.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
          {orders.map(order => {
            const sc = statusColor[order.status]
            const isExpanded = expandedId === order.id
            const isReceiving = receiveMode === order.id
            const total = calcTotal(order.items)
            return (
              <div key={order.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
                {/* Header */}
                <div onClick={() => setExpandedId(v => v === order.id ? null : order.id)} style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14, cursor:'pointer', userSelect:'none', flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:`${sc}22`, color:sc, border:`1px solid ${sc}55` }}>{order.status}</span>
                      {order.status === 'Pending Approval' && <span style={{ fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:20, background:'#dc2626', color:'#fff' }}>NEEDS APPROVAL</span>}
                    </div>
                    <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{order.vendorName} — Delivery {order.deliveryDate}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>{order.items.length} items · Est. {fmt$(total)} · Cutoff {order.cutoffDate}</div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap' }}>
                    {isPrivileged && order.status === 'Pending Approval' && (
                      <button onClick={e => { e.stopPropagation(); markApproved(order.id) }} className="btn btn-primary btn-sm">Approve</button>
                    )}
                    {order.status === 'Approved' && (
                      <button onClick={e => { e.stopPropagation(); markSubmitted(order.id) }} className="btn btn-outline btn-sm">Mark Submitted to Vendor</button>
                    )}
                    {(order.status === 'Submitted' || order.status === 'Approved') && (
                      <button onClick={e => { e.stopPropagation(); openReceive(order.id) }} className="btn btn-primary btn-sm">Receive Delivery</button>
                    )}
                    <svg width="16" height="16" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s', marginLeft:4, alignSelf:'center' }}><path d="M6 9l6 6 6-6"/></svg>
                  </div>
                </div>

                {/* Expanded line items */}
                {isExpanded && (
                  <div style={{ borderTop:'1px solid var(--border-color)' }}>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                        <thead><tr style={{ background:'var(--bg-app)' }}>
                          <th style={TH}>Item</th><th style={TH}>Unit</th><th style={TH}>Ordered</th>
                          {isReceiving && <th style={TH}>Received</th>}
                          <th style={TH}>Unit Cost</th><th style={TH}>Line Total</th><th style={TH}>Note</th>
                        </tr></thead>
                        <tbody>
                          {order.items.map((item, i) => (
                            <tr key={item.itemId} style={{ background: i%2===0 ? 'var(--bg-card)' : 'var(--bg-app)', borderBottom:'1px solid var(--border-color)' }}>
                              <td style={{ ...TD, fontWeight:600 }}>{item.itemName}</td>
                              <td style={{ ...TD, color:'var(--text-muted)' }}>{item.unit}</td>
                              <td style={TD}><b>{item.orderedQty}</b></td>
                              {isReceiving && (
                                <td style={TD}>
                                  <input
                                    type="number" min={0}
                                    value={item.receivedQty === '' ? '' : item.receivedQty}
                                    onChange={e => updateReceived(order.id, item.itemId, e.target.value)}
                                    style={{ padding:'5px 8px', border:'1px solid var(--border-color)', borderRadius:'var(--radius-sm)', width:70, fontSize:13 }}
                                    placeholder="rcvd"
                                  />
                                </td>
                              )}
                              <td style={TD}>{fmt$(item.unitCost)}</td>
                              <td style={{ ...TD, fontWeight:700, color:'var(--color-primary)' }}>{fmt$(item.orderedQty * item.unitCost)}</td>
                              <td style={{ ...TD, color:'var(--text-muted)' }}>{item.note || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {isReceiving && (
                      <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border-color)', display:'flex', gap:8, justifyContent:'flex-end' }}>
                        <button onClick={() => setReceiveMode(null)} className="btn btn-outline">Cancel</button>
                        <button onClick={() => finishReceive(order.id)} className="btn btn-primary">Confirm Receipt</button>
                      </div>
                    )}
                    <div style={{ padding:'10px 18px', borderTop:'1px solid var(--border-color)', textAlign:'right', fontSize:14, fontWeight:800, color:'var(--color-primary)', fontFamily:'var(--font-display)' }}>
                      Order Total: {fmt$(total)}
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

// ── USAGE TRENDS TAB ──────────────────────────────────────────────────────────
function TrendsTab({ stockItems }: { stockItems: StockItem[] }) {
  const byReason: Record<string, { count: number; cost: number }> = {}
  const byMeal:   Record<string, { count: number; cost: number }> = {}
  SEED_WASTE.forEach(e => {
    byReason[e.reason] ??= { count:0, cost:0 }; byReason[e.reason].count++; byReason[e.reason].cost += e.cost??0
    byMeal[e.meal]     ??= { count:0, cost:0 }; byMeal[e.meal].count++;     byMeal[e.meal].cost     += e.cost??0
  })
  const lowItems = stockItems.filter(i => i.qty < i.min)
  const totalStockCost = stockItems.reduce((s,i) => s + (i.qty * (i.cost??0)), 0)
  const totalWasteCost = SEED_WASTE.reduce((s,e) => s + (e.cost??0), 0)

  function Bar({ label, val, max, color }: { label:string; val:number; max:number; color:string }) {
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
        <div className="sl-stat-card"><div className="sl-eyebrow">Items Below Par</div><div style={{ fontSize:'var(--text-4xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'#d97706' }}>{lowItems.length}</div></div>
        <div className="sl-stat-card"><div className="sl-eyebrow">Total Stock Value</div><div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'var(--color-primary)' }}>{fmt$(totalStockCost)}</div></div>
        <div className="sl-stat-card"><div className="sl-eyebrow">Total Waste Cost</div><div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'#dc2626' }}>{fmt$(totalWasteCost)}</div></div>
        <div className="sl-stat-card"><div className="sl-eyebrow">Waste Events Logged</div><div style={{ fontSize:'var(--text-4xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'var(--color-primary)' }}>{SEED_WASTE.length}</div></div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'var(--space-5)' }}>
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)' }}>
          <div className="sl-section-title" style={{ marginBottom:'var(--space-3)', color:'var(--color-primary)' }}>Waste by Reason</div>
          {Object.entries(byReason).sort((a,b)=>b[1].count-a[1].count).map(([r,v]) => <Bar key={r} label={r} val={v.count} max={SEED_WASTE.length} color="#d97706" />)}
        </div>
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)' }}>
          <div className="sl-section-title" style={{ marginBottom:'var(--space-3)', color:'var(--color-primary)' }}>Waste by Meal</div>
          {Object.entries(byMeal).sort((a,b)=>b[1].count-a[1].count).map(([m,v]) => <Bar key={m} label={m} val={v.count} max={SEED_WASTE.length} color="#6366f1" />)}
        </div>
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)' }}>
          <div className="sl-section-title" style={{ marginBottom:'var(--space-3)', color:'var(--color-primary)' }}>Stock by Category</div>
          {CATEGORIES.map(cat => {
            const count = stockItems.filter(i => i.category === cat).length
            const lc = stockItems.filter(i => i.category === cat && i.qty < i.min).length
            return (
              <div key={cat} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}>{cat}</span>
                <div style={{ display:'flex', gap:'var(--space-2)', alignItems:'center' }}>
                  <span style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color:'var(--text-primary)' }}>{count} items</span>
                  {lc > 0 && <Badge color="#d97706">{lc} low</Badge>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="sl-alert sl-alert-info" style={{ fontSize:'var(--text-sm)' }}>
        <b>📊 Tip:</b> Track waste consistently over 2–4 weeks to identify overproduction patterns. Use the data to adjust recipe scale-out quantities in the Production Worksheet.
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type InventoryTab = 'stock' | 'waste' | 'count' | 'orders' | 'trends'
const INV_TABS: { id: InventoryTab; label: string; icon: string }[] = [
  { id:'stock',  label:'Stock Inventory', icon:'📋' },
  { id:'waste',  label:'Waste Log',       icon:'🗑️' },
  { id:'count',  label:'Zero-Balance',    icon:'🔢' },
  { id:'orders', label:'Truck Orders',    icon:'🚛' },
  { id:'trends', label:'Trends',          icon:'📊' },
]

export default function InventoryPage() {
  const [tab, setTab] = useState<InventoryTab>('stock')
  // Shared stock state — mutations in StockTab update items reflected in other tabs
  const [stockItems, setStockItems] = useState<StockItem[]>(JSON.parse(JSON.stringify(SEED_STOCK)))

  return (
    <div className="sl-page fade-in">
      <div className="sl-page-header">
        <h1 className="sl-page-title">Inventory &amp; Waste</h1>
        <p className="sl-page-subtitle">Stock, waste log, zero-balance counts, truck orders, and usage trends.</p>
      </div>
      <div className="sl-pills" style={{ marginBottom:'var(--space-6)', flexWrap:'wrap' }}>
        {INV_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={tab === t.id ? 'sl-pill active' : 'sl-pill'}>
            <span style={{ marginRight:'var(--space-1)' }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-6)', boxShadow:'var(--shadow-sm)' }}>
        {tab === 'stock'  && <StockTab items={stockItems} setItems={setStockItems} />}
        {tab === 'waste'  && <WasteTab />}
        {tab === 'count'  && <ZeroBalanceTab stockItems={stockItems} />}
        {tab === 'orders' && <TruckOrdersTab stockItems={stockItems} />}
        {tab === 'trends' && <TrendsTab stockItems={stockItems} />}
      </div>
    </div>
  )
}
