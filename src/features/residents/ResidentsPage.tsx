import { useEffect, useState } from 'react'
import { useResidentsStore } from '@/state/residentsStore'
import ResidentTable from './components/ResidentTable'
import ResidentFormModal from './components/ResidentFormModal'
import type { Resident } from '@/types/resident'

export default function ResidentsPage() {
  const { residents, loading, error, fetch, upsert, remove } = useResidentsStore()

  // Modal state: null = closed, undefined = add mode, Resident = edit mode
  const [editing, setEditing] = useState<Resident | null | undefined>(undefined)
  const isModalOpen = editing !== undefined

  useEffect(() => {
    fetch()
  }, [])

  async function handleSave(values: Omit<Resident, 'id'>) {
    await upsert(editing?.id ?? null, values)
    setEditing(undefined)
  }

  function handleEdit(resident: Resident) {
    setEditing(resident)
  }

  async function handleDelete(id: string) {
    const r = residents.find((x) => x.id === id)
    if (!r) return
    if (!window.confirm(`Delete resident record for ${r.name}? This cannot be undone.`)) return
    await remove(id)
  }

  if (loading) return <p className="p-4 text-slate-500">Loading residents...</p>
  if (error) return <p className="p-4 text-red-500">Error: {error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Residents</h1>
        <button
          className="bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:bg-primary-dark transition-colors"
          onClick={() => setEditing(null)}
        >
          + Add Resident
        </button>
      </div>

      <ResidentTable
        residents={residents}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

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
