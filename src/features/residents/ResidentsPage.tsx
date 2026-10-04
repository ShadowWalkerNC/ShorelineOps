import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useResidentsStore } from '@/state/residentsStore'
import ResidentCardList from './components/ResidentCardList'
import ResidentFormModal from './components/ResidentFormModal'
import CensusImportModal from './components/CensusImportModal'
import ConfirmDestructiveDialog from '@/components/ui/ConfirmDestructiveDialog'
import EhrReconciliationQueue from './EhrReconciliationQueue'
import DietReviewFlags from './DietReviewFlags'
import FeatureGate from '@/components/FeatureGate'
import { AppleButton, AppleCard } from '@/apple-ui'
import { useAuth } from '@/security/AuthContext'
import { iddsiForTexture, type Resident } from '@/types/resident'
import './stitch-residents.css'
import { AlertTriangle, Search, Plus, ShieldCheck, X, FileSpreadsheet } from 'lucide-react'

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
  const [showImportModal, setShowImportModal] = useState(false)
  const [deletingResident, setDeletingResident] = useState<Resident | null>(null)
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
    (id: string) => {
      const r = residents.find(x => x.id === id)
      if (r) setDeletingResident(r)
    },
    [residents]
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

  const npoCount = residents.filter(r => r.is_npo === true).length
  const holdCount = residents.filter(r => iddsiForTexture(r.texture).level === -1).length
  const fluidCount = residents.filter(r => r.fluid_restriction_ml != null).length
  const { hasCapability } = useAuth()
  const canImport = hasCapability('residents.import')
  const canAdd = hasCapability('residents.clinicalWrite')

  return (
    <div className="stitch-census">
      <header className="census-page-header">
        <div><p className="census-eyebrow">Clinical nutrition · Resident care</p><h1>Residents &amp; Diet Orders</h1><p className="census-page-description">One clear view of the census, nutrition orders and meal delivery needs.</p></div>
        <div className="census-header-actions">
          {canImport && <AppleButton variant="secondary" size="md" icon={<FileSpreadsheet className="w-4 h-4" />} onClick={() => setShowImportModal(true)}>Import census</AppleButton>}
          {canAdd && <AppleButton variant="primary" size="md" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing(null)}>Add resident</AppleButton>}
        </div>
      </header>

      <section className="census-metric-strip" aria-label="Current census summary">
        <button onClick={() => setActiveFilter('all')}><span>Resident census</span><strong>{residents.length}</strong><small>Records in the current search</small></button>
        <button onClick={() => setActiveFilter('active')}><span>Active residents</span><strong>{activeCount}</strong><small>{residents.length - activeCount} with another census status</small></button>
        <button onClick={() => setActiveFilter('texture')}><span>Modified textures</span><strong>{textureCount}</strong><small>Review individual IDDSI orders</small></button>
        <button onClick={() => setActiveFilter('room')}><span>Room delivery</span><strong>{roomTrayCount}</strong><small>Trays served in resident rooms</small></button>
      </section>

      <div className="census-workspace">
        <div className="census-main-column">
          {(npoCount > 0 || holdCount > 0) && <section className="census-safety-banner" aria-label="Clinical safety priorities">
            <AlertTriangle className="shrink-0" size={24} aria-hidden="true" />
            <div><h2>Clinical safety priorities</h2><p>{npoCount > 0 && <span>{npoCount} NPO {npoCount === 1 ? 'order' : 'orders'}: no food or liquids. </span>}{holdCount > 0 && <span>{holdCount} unassigned {holdCount === 1 ? 'texture requires' : 'textures require'} dietary confirmation. </span>}Review the resident's recorded order before meal service.</p></div>
          </section>}

          <section className="census-search-panel" aria-label="Search and filter census">
            <div className="census-search-heading"><h2>Find a resident</h2><span>{filteredResidents.length} of {residents.length} records</span></div>
            <div className="census-search-field"><Search size={19} aria-hidden="true" /><input aria-label="Search residents by name, room, diet or allergy" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, room, diet or food allergy" />{query && <button onClick={() => setQuery('')} aria-label="Clear resident search"><X size={18} aria-hidden="true" /></button>}</div>
            <div className="census-filter-tabs" aria-label="Census filters">
              {([
                ['all', 'All residents', residents.length],
                ['active', 'Active', activeCount],
                ['texture', 'Modified textures', textureCount],
                ['cardiac', 'Cardiac / NAS', undefined],
                ['room', 'Room delivery', roomTrayCount],
              ] as const).map(([value, label, count]) => <button key={value} onClick={() => setActiveFilter(value)} aria-pressed={activeFilter === value}>{label}{count !== undefined && <span>{count}</span>}</button>)}
            </div>
          </section>

          <FeatureGate requiredTier="enterprise" featureName="PointClickCare Live EHR 2-Way Sync & Reconciliation Queue" description="Review inbound EHR census and nutrition order changes before applying them to the resident record.">
            <EhrReconciliationQueue />
          </FeatureGate>
          <DietReviewFlags />
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

        </div>
        <aside className="census-context-panel" aria-label="Meal service context">
          <p className="census-eyebrow">Care coordination</p><h2>Before meal service</h2>
          <p>Use the individual chart to confirm each resident's current nutrition requirements.</p>
          <dl>
            <div><dt>NPO orders</dt><dd>{npoCount}</dd></div>
            <div><dt>Food allergy records</dt><dd>{allergyCount}</dd></div>
            <div><dt>Fluid restrictions</dt><dd>{fluidCount}</dd></div>
          </dl>
          <div className="census-context-note"><ShieldCheck size={20} aria-hidden="true" /><p>NPO hard-blocks and allergy exclusions remain non-overridable. An empty allergy list means no food allergies are recorded.</p></div>
          <p className="census-context-footnote">Counts reflect the current search. Census status does not certify a tray as safe to release.</p>
        </aside>
      </div>

      {/* Modal Editor */}
      {isModalOpen && (
        <ResidentFormModal
          resident={editing ?? null}
          onSave={handleSave}
          onClose={() => setEditing(undefined)}
        />
      )}

      {/* CSV Census & Diet Order Importer Modal */}
      <CensusImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => fetchRef.current(debouncedQuery || undefined)}
      />
      {/* Explicit Destructive Action Confirmation Dialog */}
      {deletingResident && (
        <ConfirmDestructiveDialog
          open={Boolean(deletingResident)}
          onClose={() => setDeletingResident(null)}
          onConfirm={async () => {
            if (deletingResident) {
              await remove(deletingResident.id)
              setDeletingResident(null)
            }
          }}
          resourceType="Resident Census Record"
          itemName={`${deletingResident.name} (Room ${deletingResident.room})`}
          consequences={[
            'Permanently deletes this resident census record and its recorded nutrition requirements.',
            'Removes this resident from the current census.',
            'This action cannot be undone from this screen.',
          ]}
        />
      )}
    </div>
  )
}

