import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useResidentsStore } from '@/state/residentsStore'
import ResidentFormModal from './components/ResidentFormModal'
import type { Resident } from '@/types/resident'

// ── Status badge colours (mirrors ResidentTable) ─────────────────────────────
const STATUS_COLORS: Record<Resident['status'], string> = {
  Active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  Hospital: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  LOA: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Passed Away': 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-40 shrink-0 text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-800 dark:text-slate-100 flex-1">{children}</span>
    </div>
  )
}

function PillList({ items, colorClass }: { items: string[]; colorClass: string }) {
  if (!items.length) return <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => (
        <span key={i} className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>{i}</span>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ResidentProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { residents, loading, error, fetch, upsert } = useResidentsStore()

  // Make sure the store is populated (handles direct URL visits)
  useEffect(() => {
    if (residents.length === 0 && !loading && !error) {
      fetch()
    }
  }, [])

  const resident = residents.find((r) => r.id === id)

  // Edit modal
  const [editing, setEditing] = useState(false)

  const handleSave = useCallback(
    async (values: Omit<Resident, 'id'>) => {
      if (!resident) return
      await upsert(resident.id, values)
      setEditing(false)
    },
    [resident, upsert]
  )

  // ── Loading / not-found states ────────────────────────────────────────────
  if (loading && !resident) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <svg className="animate-spin h-6 w-6 mr-3 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading…
      </div>
    )
  }

  if (!resident) {
    return (
      <div className="text-center py-24">
        <p className="text-lg font-medium text-slate-500">Resident not found.</p>
        <Link to="/" className="mt-3 inline-block text-sm text-primary underline">
          ← Back to residents list
        </Link>
      </div>
    )
  }

  const birthday =
    resident.birthdayMonth
      ? `${resident.birthdayMonth}${resident.birthdayDay ? ` ${resident.birthdayDay}` : ''}`
      : '—'

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-primary mb-5 transition-colors"
      >
        <span>←</span> All Residents
      </Link>

      {/* Profile header card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {/* Avatar initials */}
            <div className="flex items-center gap-4 mb-3">
              <div
                className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center
                           text-xl font-bold select-none shrink-0"
                aria-hidden
              >
                {resident.name
                  .split(' ')
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                  {resident.name}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                  Room {resident.room}
                  {resident.tableAssignment ? ` · ${resident.tableAssignment}` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[resident.status]}`}>
                {resident.status}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                🎂 {birthday}
              </span>
            </div>
          </div>

          <button
            onClick={() => setEditing(true)}
            className="shrink-0 px-4 py-2 text-sm font-medium rounded bg-primary text-white
                       hover:bg-primary/90 transition-colors"
          >
            Edit Profile
          </button>
        </div>
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Diet Order */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-4">
          <Section title="Diet Order">
            <Row label="Diet type">{resident.dietType}</Row>
            <Row label="Texture">
              {resident.texture !== 'Regular' ? (
                <span className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 px-2 py-0.5 rounded text-xs font-medium">
                  {resident.texture}
                </span>
              ) : 'Regular'}
            </Row>
            <Row label="Portion size">{resident.portionSize}</Row>
            <Row label="Serving location">{resident.servingLocation}</Row>
            <Row label="Table assignment">{resident.tableAssignment || '—'}</Row>
            <Row label="Ensure per day">
              {resident.ensurePerDay > 0
                ? `${resident.ensurePerDay} can${resident.ensurePerDay !== 1 ? 's' : ''}`
                : '—'}
            </Row>
          </Section>
        </div>

        {/* Allergies & Beverages */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-5">
          <Section title="Allergies & Restrictions">
            <PillList
              items={resident.allergies}
              colorClass="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
            />
          </Section>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <Section title="Beverage Preferences">
              <PillList
                items={resident.beverages}
                colorClass="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
              />
            </Section>
          </div>
        </div>

        {/* Preferences & Notes — full width */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-4">
          <Section title="Preferences & Notes">
            <Row label="Likes">
              <span className="whitespace-pre-wrap">{resident.likes || '—'}</span>
            </Row>
            <Row label="Dislikes">
              <span className="whitespace-pre-wrap">{resident.dislikes || '—'}</span>
            </Row>
            <Row label="Special instructions">
              <span className="whitespace-pre-wrap font-normal text-slate-700 dark:text-slate-300">
                {resident.specialInstructions || '—'}
              </span>
            </Row>
          </Section>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <ResidentFormModal
          resident={resident}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
