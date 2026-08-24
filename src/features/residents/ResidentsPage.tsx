import { useEffect, useState, useCallback, useRef } from 'react'
import { useResidentsStore } from '@/state/residentsStore'
import ResidentCardList from './components/ResidentCardList'
import ResidentFormModal from './components/ResidentFormModal'
import EhrReconciliationQueue from './EhrReconciliationQueue'
import type { Resident } from '@/types/resident'

// Skeleton card for loading state
function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)', padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ width: 48, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--border-color)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 14, width: '55%', borderRadius: 6, background: 'var(--border-color)' }} />
        <div style={{ height: 10, width: '35%', borderRadius: 6, background: 'var(--border-color)', opacity: 0.6 }} />
      </div>
    </div>
  )
}

export default function ResidentsPage() {
  const { residents, loading, error, fetch, upsert, remove } = useResidentsStore()

  const [query, setQuery]               = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const fetchRef = useRef(fetch)
  fetchRef.current = fetch

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    fetchRef.current(debouncedQuery || undefined)
  }, [debouncedQuery])

  const [editing, setEditing] = useState<Resident | null | undefined>(undefined)
  const isModalOpen = editing !== undefined

  const handleSave = useCallback(
    async (values: Omit<Resident, 'id'>) => {
      await upsert(editing?.id ?? null, values)
      setEditing(undefined)
    },
    [editing, upsert]
  )

  const handleEdit   = useCallback((r: Resident) => setEditing(r), [])
  const handleDelete = useCallback(
    async (id: string) => {
      const r = residents.find(x => x.id === id)
      if (!r) return
      if (!window.confirm(`Delete resident record for ${r.name}? This cannot be undone.`)) return
      await remove(id)
    },
    [residents, remove]
  )

  const activeCount   = residents.filter(r => r.status === 'Active').length
  const totalCount    = residents.length

  return (
    <div className="sl-page">

      {/* ── Page header ── */}
      <div className="sl-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="sl-page-title">Residents</h1>
          {!loading && totalCount > 0 && (
            <p className="sl-page-subtitle">
              {totalCount} total &middot; {activeCount} active
            </p>
          )}
        </div>
      </div>

      {/* ── EHR Triage Exception Queue ── */}
      <EhrReconciliationQueue />

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, room, diet…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '11px 14px',
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)', fontSize: 14,
            color: 'var(--text-primary)', outline: 'none',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
        />
        <button
          onClick={() => setEditing(null)}
          style={{
            width: '100%', padding: '12px 0',
            background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-lg)',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.2px',
          }}
        >
          + Add Resident
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{
          marginBottom: 14, padding: '12px 16px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-danger-light)',
          border: '1px solid rgba(188,106,88,.35)',
          color: 'var(--color-danger-hover)',
          fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <span>{error}</span>
          <button
            onClick={() => fetchRef.current(debouncedQuery || undefined)}
            style={{ fontWeight: 700, fontSize: 12, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
          >Retry</button>
        </div>
      )}

      {/* ── Content ── */}
      {loading && residents.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <ResidentCardList residents={residents} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      {loading && residents.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>Updating…</p>
      )}

      {!loading && !error && residents.length === 0 && debouncedQuery && (
        <div style={{ textAlign: 'center', paddingTop: 40, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>No results for “{debouncedQuery}”</div>
          <button
            onClick={() => setQuery('')}
            style={{ marginTop: 8, fontSize: 13, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >Clear search</button>
        </div>
      )}

      {isModalOpen && (
        <ResidentFormModal
          resident={editing ?? null}
          onSave={handleSave}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}
