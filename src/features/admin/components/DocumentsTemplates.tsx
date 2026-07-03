import { useState } from 'react'

type DocCategory = 'Forms' | 'Policies' | 'Templates' | 'Reports' | 'Other'
type Doc = { id: string; name: string; category: DocCategory; description: string; url: string; updatedAt: string }

const CATEGORIES: DocCategory[] = ['Forms', 'Policies', 'Templates', 'Reports', 'Other']

const SAMPLE_DOCS: Doc[] = [
  { id:'1', name:'Diet Order Change Form',       category:'Forms',     description:'Used to update a resident\'s dietary orders.',     url:'#', updatedAt:'2026-06-01' },
  { id:'2', name:'Meal Production Worksheet',    category:'Templates', description:'Printable worksheet for daily meal production.',    url:'#', updatedAt:'2026-05-15' },
  { id:'3', name:'Allergy Alert Protocol',       category:'Policies',  description:'Staff protocol for handling resident allergies.',   url:'#', updatedAt:'2026-04-22' },
  { id:'4', name:'Monthly Food Cost Report',     category:'Reports',   description:'Template for tracking monthly food expenditures.',  url:'#', updatedAt:'2026-06-30' },
  { id:'5', name:'Tray Ticket Template',         category:'Templates', description:'Blank tray ticket for custom room-service orders.',  url:'#', updatedAt:'2026-05-01' },
  { id:'6', name:'Staff Incident Report Form',   category:'Forms',     description:'Document workplace incidents or near-misses.',       url:'#', updatedAt:'2026-03-10' },
]

export default function DocumentsTemplates() {
  const [docs, setDocs] = useState<Doc[]>(SAMPLE_DOCS)
  const [activeCategory, setActiveCategory] = useState<DocCategory | 'All'>('All')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'Forms' as DocCategory, description: '', url: '' })

  const filtered = docs.filter(d => {
    const matchCat = activeCategory === 'All' || d.category === activeCategory
    const matchQ = !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()) || d.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchQ
  })

  function add() {
    if (!form.name.trim()) return
    setDocs(prev => [...prev, { id: Date.now().toString(), ...form, updatedAt: new Date().toISOString().slice(0,10) }])
    setForm({ name: '', category: 'Forms', description: '', url: '' })
    setShowForm(false)
  }

  function remove(id: string) { setDocs(prev => prev.filter(d => d.id !== id)) }

  const CATEGORY_ICONS: Record<DocCategory | 'Other', string> = {
    Forms: '📋', Policies: '📜', Templates: '🗂️', Reports: '📊', Other: '📁',
  }

  const inp = { padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' as const, width: '100%' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input
          placeholder="Search documents..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, flex: 1, maxWidth: 320, width: 'auto' }}
        />
        <button onClick={() => setShowForm(v => !v)} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add Document</button>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['All', ...CATEGORIES] as const).map(c => (
          <button key={c} onClick={() => setActiveCategory(c)} style={{
            background: activeCategory === c ? 'var(--color-primary)' : 'var(--bg-app)',
            color: activeCategory === c ? 'white' : 'var(--text-secondary)',
            border: `1px solid ${activeCategory === c ? 'var(--color-primary)' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-md)', padding: '6px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}>{c}</button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
          {[['Document Name','name','text','e.g. Diet Order Form'],['Description','description','text','Brief description'],['File URL / Path','url','text','https:// or /docs/...']].map(([label,key,type,ph]) => (
            <div key={key} style={{ gridColumn: key === 'description' ? 'span 2' : undefined }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
              <input type={type} placeholder={ph} style={inp} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Category</label>
            <select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as DocCategory }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button onClick={add} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setShowForm(false)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Document grid */}
      {filtered.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0', fontSize: 14 }}>No documents found.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
        {filtered.map(d => (
          <div key={d.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ fontSize: 24 }}>{CATEGORY_ICONS[d.category]}</div>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', borderRadius: 10, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{d.category}</span>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{d.name}</div>
              {d.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{d.description}</div>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Updated: {d.updatedAt}</div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border-color)' }}>
              {d.url && d.url !== '#' ? (
                <a href={d.url} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', background: 'var(--color-primary)', color: 'white', textDecoration: 'none', borderRadius: 'var(--radius-md)', padding: '6px 0', fontSize: 12, fontWeight: 700 }}>Open / Download</a>
              ) : (
                <button disabled style={{ flex: 1, background: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)', padding: '6px 0', fontSize: 12, fontWeight: 600, cursor: 'not-allowed' }}>No file linked</button>
              )}
              <button onClick={() => remove(d.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 15, padding: '0 4px' }}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
