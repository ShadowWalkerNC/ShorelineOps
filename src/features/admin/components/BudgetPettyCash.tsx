import { useState, useMemo } from 'react'

type TxType = 'income' | 'expense'
type Transaction = {
  id: string; date: string; description: string
  type: TxType; amount: number; category: string; note: string
}

const EXPENSE_CATS = ['Supplies', 'Food & Beverage', 'Equipment', 'Staff', 'Events', 'Other']
const INCOME_CATS  = ['Bottle Drive', 'Donation', 'Reimbursement', 'Budget Allocation', 'Other']

export default function BudgetPettyCash() {
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id:'1', date:'2026-07-01', description:'Ensure cases restocked',  type:'expense', amount:48.96, category:'Food & Beverage', note:'' },
    { id:'2', date:'2026-07-01', description:'Bottle drive deposit',    type:'income',  amount:112.50, category:'Bottle Drive', note:'June collection' },
    { id:'3', date:'2026-06-30', description:'Paper goods restock',     type:'expense', amount:23.14, category:'Supplies', note:'' },
    { id:'4', date:'2026-06-28', description:'Budget allocation Q3',    type:'income',  amount:500.00, category:'Budget Allocation', note:'July-Sep' },
  ])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: '', description: '', type: 'expense' as TxType, amount: '', category: 'Supplies', note: '' })
  const [filterType, setFilterType] = useState<TxType | 'all'>('all')

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = totalIncome - totalExpense

  const shown = filterType === 'all' ? transactions : transactions.filter(t => t.type === filterType)
  const cats = form.type === 'expense' ? EXPENSE_CATS : INCOME_CATS

  function add() {
    if (!form.description.trim() || !form.amount || !form.date) return
    setTransactions(prev => [{ id: Date.now().toString(), ...form, amount: parseFloat(form.amount) }, ...prev])
    setForm({ date: '', description: '', type: 'expense', amount: '', category: 'Supplies', note: '' })
    setShowForm(false)
  }

  function remove(id: string) { setTransactions(prev => prev.filter(t => t.id !== id)) }

  const inp = { padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' as const, width: '100%' }
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
        {[
          { label: 'Total Income',  value: fmt(totalIncome),  color: '#16a34a' },
          { label: 'Total Expenses',value: fmt(totalExpense), color: '#dc2626' },
          { label: 'Balance',       value: fmt(balance),      color: balance >= 0 ? '#16a34a' : '#dc2626' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px 16px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'income', 'expense'] as const).map(f => (
            <button key={f} onClick={() => setFilterType(f)} style={{
              background: filterType === f ? 'var(--color-primary)' : 'var(--bg-app)',
              color: filterType === f ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${filterType === f ? 'var(--color-primary)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-md)', padding: '6px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize',
            }}>{f === 'all' ? 'All' : f === 'income' ? 'Income' : 'Expenses'}</button>
          ))}
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add Transaction</button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {[['Date','date','date',''],['Description','description','text','e.g. Paper goods'],['Amount ($)','amount','number','0.00'],['Note','note','text','Optional']].map(([label,key,type,ph]) => (
            <div key={key}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
              <input type={type} placeholder={ph} style={inp} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Type</label>
            <select style={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as TxType, category: e.target.value === 'expense' ? 'Supplies' : 'Bottle Drive' }))}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Category</label>
            <select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button onClick={add} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setShowForm(false)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shown.map(t => (
          <div key={t.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t.description}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.date} · {t.category}{t.note ? ` · ${t.note}` : ''}</div>
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: t.type === 'income' ? '#16a34a' : '#dc2626', fontFamily: 'Outfit, sans-serif' }}>
              {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
            </span>
            <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
          </div>
        ))}
        {shown.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0', fontSize: 14 }}>No transactions found.</p>}
      </div>
    </div>
  )
}
