import { useState } from 'react'

type Note = { id: string; date: string; author: string; content: string; pinned: boolean }

const SAMPLE: Note[] = [
  { id:'1', date:'2026-06-28', author:'Admin', content:'Residents requested more variety in breakfast options. Consider adding a rotating hot cereal station.', pinned:true },
  { id:'2', date:'2026-06-21', author:'Sylvia R.', content:'Discussed upcoming July 4th holiday menu. Residents voted for BBQ theme.', pinned:false },
]

export default function CouncilNotes() {
  const [notes, setNotes] = useState<Note[]>(SAMPLE)
  const [form, setForm] = useState({ author:'', content:'' })
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = notes.filter(n =>
    n.content.toLowerCase().includes(search.toLowerCase()) ||
    n.author.toLowerCase().includes(search.toLowerCase())
  ).sort((a,b) => (b.pinned ? 1:-1) || b.date.localeCompare(a.date))

  function add() {
    if (!form.content.trim()) return
    setNotes(prev => [{ id:Date.now().toString(), date:new Date().toISOString().slice(0,10), author:form.author||'Admin', content:form.content.trim(), pinned:false }, ...prev])
    setForm({ author:'', content:'' }); setShowForm(false)
  }

  function togglePin(id: string) { setNotes(prev => prev.map(n => n.id===id ? {...n, pinned:!n.pinned} : n)) }
  function remove(id: string) { setNotes(prev => prev.filter(n => n.id!==id)) }

  const inputStyle = { padding:'8px 12px', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', background:'var(--bg-card)', color:'var(--text-primary)', fontSize:13, width:'100%', boxSizing:'border-box' as const }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <input style={{...inputStyle, flex:1, maxWidth:360}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes…" />
        <button onClick={()=>setShowForm(v=>!v)} style={{ background:'var(--color-primary)', color:'white', border:'none', borderRadius:'var(--radius-md)', padding:'9px 18px', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0 }}>+ New Note</button>
      </div>

      {showForm && (
        <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:16, display:'flex', flexDirection:'column', gap:10 }}>
          <input style={inputStyle} value={form.author} onChange={e=>setForm(f=>({...f,author:e.target.value}))} placeholder="Author name" />
          <textarea rows={4} style={{...inputStyle, resize:'vertical' as const}} value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} placeholder="Council note content…" />
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'7px 16px', fontSize:13, cursor:'pointer', color:'var(--text-secondary)' }}>Cancel</button>
            <button onClick={add} style={{ background:'var(--color-primary)', color:'white', border:'none', borderRadius:'var(--radius-md)', padding:'7px 18px', fontWeight:700, fontSize:13, cursor:'pointer' }}>Save Note</button>
          </div>
        </div>
      )}

      {filtered.map(note => (
        <div key={note.id} style={{ background:'var(--bg-card)', border:`1px solid ${note.pinned ? 'var(--color-primary)' : 'var(--border-color)'}`, borderRadius:'var(--radius-lg)', padding:18, boxShadow:'var(--shadow-sm)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
            <div>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{note.author}</span>
              <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:10 }}>{note.date}</span>
              {note.pinned && <span style={{ marginLeft:8, fontSize:10, fontWeight:700, color:'var(--color-primary)', background:'var(--color-primary-light)', border:'1px solid var(--color-primary)', padding:'1px 7px', borderRadius:10 }}>📌 Pinned</span>}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={()=>togglePin(note.id)} style={{ background:'none', border:'1px solid var(--border-color)', borderRadius:'var(--radius-sm)', padding:'3px 10px', fontSize:11, cursor:'pointer', color:'var(--text-secondary)' }}>{note.pinned?'Unpin':'Pin'}</button>
              <button onClick={()=>remove(note.id)} style={{ background:'none', border:'none', color:'var(--color-danger)', fontSize:12, fontWeight:700, cursor:'pointer' }}>Delete</button>
            </div>
          </div>
          <p style={{ fontSize:14, color:'var(--text-secondary)', lineHeight:1.65, margin:0 }}>{note.content}</p>
        </div>
      ))}
    </div>
  )
}
