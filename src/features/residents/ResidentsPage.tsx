import { useEffect } from 'react'
import { useResidentsStore } from '@/state/residentsStore'
import ResidentTable from './components/ResidentTable'

export default function ResidentsPage() {
  const { residents, loading, error, fetch } = useResidentsStore()

  useEffect(() => {
    fetch()
  }, [])

  if (loading) return <p className="p-4 text-slate-500">Loading residents...</p>
  if (error) return <p className="p-4 text-red-500">Error: {error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Residents</h1>
        <button className="bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:bg-primary-dark transition-colors">
          + Add Resident
        </button>
      </div>
      <ResidentTable residents={residents} />
    </div>
  )
}
