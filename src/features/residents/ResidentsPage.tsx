import { useEffect, useState, useCallback } from 'react'
import { useResidentsStore } from '@/state/residentsStore'
import ResidentTable from './components/ResidentTable'
import ResidentFormModal from './components/ResidentFormModal'
import type { Resident } from '@/types/resident'

/** Skeleton row shown while the first fetch is in-flight. */
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-gray-100">
          {Array.from({ length: 5 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export default function ResidentsPage() {
  const { residents, loading, error, fetch, upsert, remove } = useResidentsStore()

  // Search
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce search — wait 300 ms after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  // Re-fetch whenever the debounced query changes
  useEffect(() => {
    fetch(debouncedQuery || undefined)
  }, [debouncedQuery])

  // Modal state: undefined = closed, null = add mode, Resident = edit mode
  const [editing, setEditing] = useState<Resident | null | undefined>(undefined)
  const isModalOpen = editing !== undefined

  const handleSave = useCallback(
    async (values: Omit<Resident, 'id'>) => {
      await upsert(editing?.id ?? null, values)
      setEditing(undefined)
    },
    [editing, upsert]
  )

  const handleEdit = useCallback((resident: Resident) => {
    setEditing(resident)
  }, [])

  const handleDelete = useCallback(
    async (id: string) => {
      const r = residents.find((x) => x.id === id)
      if (!r) return
      if (!window.confirm(`Delete resident record for ${r.name}? This cannot be undone.`)) return
      await remove(id)
    },
    [residents, remove]
  )

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <h1 className="text-xl font-semibold shrink-0">Residents</h1>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, room, diet…"
          className="flex-1 max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />

        <button
          className="bg-primary text-white px-4 py-2 rounded text-sm font-medium
                     hover:bg-primary/90 transition-colors shrink-0"
          onClick={() => setEditing(null)}
        >
          + Add Resident
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetch(debouncedQuery || undefined)}
            className="ml-4 text-red-700 underline text-sm hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table — skeleton on first load, real data after */}
      {loading && residents.length === 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                {['Name', 'Room', 'Status', 'Diet', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <SkeletonRows />
            </tbody>
          </table>
        </div>
      ) : (
        <ResidentTable
          residents={residents}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Subtle loading indicator on subsequent fetches (search) */}
      {loading && residents.length > 0 && (
        <p className="mt-2 text-xs text-gray-400">Updating…</p>
      )}

      {/* Empty state */}
      {!loading && !error && residents.length === 0 && (
        <div className="mt-12 text-center text-gray-400">
          <p className="text-lg font-medium">No residents found</p>
          {debouncedQuery && (
            <p className="text-sm mt-1">
              No results for “{debouncedQuery}” —{' '}
              <button
                className="underline hover:no-underline"
                onClick={() => setQuery('')}
              >
                clear search
              </button>
            </p>
          )}
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
