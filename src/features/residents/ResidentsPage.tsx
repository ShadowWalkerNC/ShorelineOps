import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useResidentsStore } from '@/state/residentsStore'
import ResidentCardList from './components/ResidentCardList'
import ResidentFormModal from './components/ResidentFormModal'
import EhrReconciliationQueue from './EhrReconciliationQueue'
import FeatureGate from '@/components/FeatureGate'
import { AppleBadge, AppleButton, AppleCard, AppleSegmentedControl } from '@/apple-ui'
import type { Resident } from '@/types/resident'
import {
  Users,
  Heart,
  AlertTriangle,
  MapPin,
  Search,
  Plus,
  Filter,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  X,
} from 'lucide-react'

// Skeleton card for loading state
function SkeletonCard() {
  return (
    <AppleCard className="p-4 flex items-center gap-3 animate-pulse border border-slate-200/70 dark:border-slate-800/70 rounded-2xl">
      <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/5 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-1/4 rounded bg-slate-100 dark:bg-slate-850" />
      </div>
    </AppleCard>
  )
}

export default function ResidentsPage() {
  const { residents, loading, error, fetch, upsert, remove } = useResidentsStore()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'texture' | 'cardiac' | 'room'>('all')

  const fetchRef = useRef(fetch)
  fetchRef.current = fetch

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200)
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

  const handleEdit = useCallback((r: Resident) => setEditing(r), [])
  const handleDelete = useCallback(
    async (id: string) => {
      const r = residents.find(x => x.id === id)
      if (!r) return
      if (!window.confirm(`Delete resident record for ${r.name}? This cannot be undone.`)) return
      await remove(id)
    },
    [residents, remove]
  )

  // Clinical Census Metrics
  const activeCount   = useMemo(() => residents.filter(r => r.status === 'Active').length, [residents])
  const textureCount  = useMemo(() => residents.filter(r => r.texture && r.texture !== 'Regular').length, [residents])
  const allergyCount  = useMemo(() => residents.filter(r => r.allergies && r.allergies.length > 0).length, [residents])
  const roomTrayCount = useMemo(() => residents.filter(r => r.servingLocation === 'Room').length, [residents])

  // Filtered residents list
  const filteredResidents = useMemo(() => {
    let list = residents
    if (activeFilter === 'active') {
      list = list.filter(r => r.status === 'Active')
    } else if (activeFilter === 'texture') {
      list = list.filter(r => r.texture && r.texture !== 'Regular')
    } else if (activeFilter === 'cardiac') {
      list = list.filter(r => r.dietType === 'Cardiac' || r.dietType === 'Low Sodium')
    } else if (activeFilter === 'room') {
      list = list.filter(r => r.servingLocation === 'Room')
    }
    return list
  }, [residents, activeFilter])

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 py-2">

      {/* ── Apple Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
              Residents & Diet Orders
            </h1>
            <AppleBadge color="blue">
              Census: {residents.length}
            </AppleBadge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time clinical nutrition roster, IDDSI dysphagia orders, food allergies, and tray delivery locations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <AppleButton
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setEditing(null)}
          >
            Add Resident
          </AppleButton>
        </div>
      </div>

      {/* ── Apple Clinical Stats Dashboard ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <AppleCard
          className="p-3.5 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-all"
          onClick={() => setActiveFilter('active')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">Active Census</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-sans">{activeCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">{residents.length - activeCount} away (Hospital/LOA)</div>
        </AppleCard>

        <AppleCard
          className="p-3.5 cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-all"
          onClick={() => setActiveFilter('texture')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">IDDSI Textures</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-sans">{textureCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">Pureed, Minced, Cut-up</div>
        </AppleCard>

        <AppleCard className="p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">Allergens</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-sans">{allergyCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">Dairy, Gluten, Nuts, Seeds</div>
        </AppleCard>

        <AppleCard
          className="p-3.5 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
          onClick={() => setActiveFilter('room')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">In-Room Trays</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-sans">{roomTrayCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">{residents.length - roomTrayCount} Dining Room</div>
        </AppleCard>
      </div>

      {/* ── EHR Triage Exception Queue (Enterprise Tier) ── */}
      <FeatureGate
        requiredTier="enterprise"
        featureName="PointClickCare Live EHR 2-Way Sync & Reconciliation Queue"
        description="Automated bi-directional integration with PointClickCare, MatrixCare, and Epic EHR systems. Catches inbound ADT transfers, physician diet orders, and dysphagia texture modifications in real-time."
      >
        <EhrReconciliationQueue />
      </FeatureGate>

      {/* ── Search & Cupertino Filter Controls ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Apple Search Field */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, room number, diet, or allergy…"
            className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-xs"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Segmented Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All ({residents.length})
          </button>
          <button
            onClick={() => setActiveFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'active'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setActiveFilter('texture')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'texture'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Modified Textures ({textureCount})
          </button>
          <button
            onClick={() => setActiveFilter('cardiac')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'cardiac'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Cardiac / NAS
          </button>
          <button
            onClick={() => setActiveFilter('room')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'room'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Room Trays ({roomTrayCount})
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <AppleCard className="p-4 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-3 text-sm text-rose-800 dark:text-rose-200">
          <span>{error}</span>
          <AppleButton
            size="sm"
            variant="destructive"
            onClick={() => fetchRef.current(debouncedQuery || undefined)}
          >
            Retry
          </AppleButton>
        </AppleCard>
      )}

      {/* ── Resident Cards or Skeleton ── */}
      {loading && residents.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <ResidentCardList residents={filteredResidents} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      {/* Modal Editor */}
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

