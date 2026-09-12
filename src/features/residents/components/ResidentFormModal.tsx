import { useEffect, useState } from 'react'
import {
  ALLERGY_OPTIONS,
  BEVERAGE_OPTIONS,
  DIET_TYPES,
  MONTHS,
  type Resident,
} from '@/types/resident'
import { useResidentForm } from '@/hooks/useResidentForm'
import { useAuth } from '@/security/AuthContext'
import FormField from '@/components/FormField'
import CheckboxGroup from '@/components/CheckboxGroup'

type Props = {
  resident?: Resident | null  // null/undefined = add mode
  onSave: (values: Omit<Resident, 'id'>) => void
  onClose: () => void
}

const TEXTURES = ['Regular', 'Cut-Up', 'Minced', 'Minced & Moist', 'Pureed', 'Liquid'] as const
const PORTIONS = ['Regular', 'Small', 'Large'] as const
const STATUSES = ['Active', 'Hospital', 'LOA', 'Passed Away'] as const
const SERVING_LOCATIONS = ['Dining Room', 'Room', 'Assisted Living', 'Memory Care'] as const

export default function ResidentFormModal({ resident, onSave, onClose }: Props) {
  const isEdit = Boolean(resident)
  const { values, errors, set, toggleArrayItem, validate, reset } = useResidentForm()
  const { user } = useAuth()

  // B04 (Owner Decision 3): therapeutic diet orders are dietitian/manager-only.
  // Everyone else sees read-only diet fields plus a "flag for RD review" path.
  const canEditDiet = user?.role === 'dietitian' || user?.role === 'manager'

  // Aide "flag for RD review" composer state
  const [flagOpen, setFlagOpen] = useState(false)
  const [flagMessage, setFlagMessage] = useState('')
  const [flagStatus, setFlagStatus] = useState<string | null>(null)

  async function submitFlag() {
    if (!resident || !flagMessage.trim()) return
    try {
      const token = localStorage.getItem('shoreline_auth_token')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/residents/${resident.id}/flags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: flagMessage.trim() }),
      })
      if (res.ok) {
        setFlagStatus('Flag sent to the dietitian review worklist.')
        setFlagMessage('')
        setFlagOpen(false)
      } else {
        setFlagStatus('Could not send the flag — please try again.')
      }
    } catch {
      setFlagStatus('Could not reach the server — please try again.')
    }
    setTimeout(() => setFlagStatus(null), 4000)
  }

  // Seed form when editing
  useEffect(() => {
    if (resident) {
      reset({
        name: resident.name,
        room: resident.room,
        status: resident.status,
        dietType: resident.dietType,
        texture: resident.texture,
        portionSize: resident.portionSize,
        ensurePerDay: resident.ensurePerDay,
        allergies: resident.allergies,
        beverages: resident.beverages,
        birthdayMonth: resident.birthdayMonth,
        birthdayDay: resident.birthdayDay,
        servingLocation: resident.servingLocation,
        tableAssignment: resident.tableAssignment,
        likes: resident.likes,
        dislikes: resident.dislikes,
        specialInstructions: resident.specialInstructions,
        // B04: NPO fields are seeded for privileged editors; aides never see them.
        is_npo: resident.is_npo ?? false,
        npo_reason: resident.npo_reason ?? '',
      })
    } else {
      reset()
    }
  }, [resident])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    onSave(values)
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal panel */}
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold">
            {isEdit ? 'Edit Resident Profile' : 'Add New Resident'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-6 overflow-y-auto">

            {/* ── Section: Identity ─────────────────────────── */}
            <Section title="Identity">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Full Name" required error={errors.name}>
                  <input
                    className={input(errors.name)}
                    value={values.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="e.g. Mary Johnson"
                  />
                </FormField>

                <FormField label="Room" required error={errors.room}>
                  <input
                    className={input(errors.room)}
                    value={values.room}
                    onChange={(e) => set('room', e.target.value)}
                    placeholder="e.g. 214"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField label="Status">
                  <select
                    className={input()}
                    value={values.status}
                    onChange={(e) => set('status', e.target.value as typeof values.status)}
                  >
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </FormField>

                <FormField label="Birth Month" required error={errors.birthdayMonth}>
                  <select
                    className={input(errors.birthdayMonth)}
                    value={values.birthdayMonth}
                    onChange={(e) => set('birthdayMonth', e.target.value)}
                  >
                    <option value="">— Select —</option>
                    {MONTHS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </FormField>

                <FormField label="Birth Day">
                  <input
                    type="number"
                    className={input()}
                    value={values.birthdayDay ?? ''}
                    min={1}
                    max={31}
                    onChange={(e) =>
                      set('birthdayDay', e.target.value ? Number(e.target.value) : null)
                    }
                    placeholder="1–31"
                  />
                </FormField>
              </div>
            </Section>

            {/* ── Section: Diet Order ───────────────────────── */}
            <Section title="Diet Order">
              {!canEditDiet && (
                <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
                  Diet orders are managed by the dietitian or manager. These fields are
                  read-only for your role — use “Flag for RD review” below to request a change.
                </p>
              )}
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Diet Type">
                  <select
                    className={input()}
                    value={values.dietType}
                    disabled={!canEditDiet}
                    onChange={(e) => set('dietType', e.target.value as typeof values.dietType)}
                  >
                    {DIET_TYPES.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </FormField>

                <FormField label="Texture">
                  <select
                    className={input()}
                    value={values.texture}
                    disabled={!canEditDiet}
                    onChange={(e) => set('texture', e.target.value as typeof values.texture)}
                  >
                    {TEXTURES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </FormField>

                <FormField label="Portion Size">
                  <select
                    className={input()}
                    value={values.portionSize}
                    onChange={(e) => set('portionSize', e.target.value as typeof values.portionSize)}
                  >
                    {PORTIONS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </FormField>
              </div>

              {/* B04: NPO is settable through the profile by dietitian/manager only. */}
              {canEditDiet && (
                <div className="rounded border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/40 p-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-red-900 dark:text-red-200 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-red-600"
                      checked={Boolean(values.is_npo)}
                      onChange={(e) => set('is_npo', e.target.checked)}
                    />
                    NPO — nothing by mouth (hard block, cannot be overridden)
                  </label>
                  {Boolean(values.is_npo) && (
                    <FormField label="NPO Reason">
                      <input
                        className={input()}
                        value={values.npo_reason ?? ''}
                        onChange={(e) => set('npo_reason', e.target.value)}
                        placeholder="e.g. Pre-op, aspiration precautions"
                      />
                    </FormField>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Serving Location">
                  <select
                    className={input()}
                    value={values.servingLocation}
                    onChange={(e) => set('servingLocation', e.target.value as typeof values.servingLocation)}
                  >
                    {SERVING_LOCATIONS.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </FormField>

                <FormField label="Table Assignment">
                  <input
                    className={input()}
                    value={values.tableAssignment}
                    onChange={(e) => set('tableAssignment', e.target.value)}
                    placeholder="e.g. Table 3"
                  />
                </FormField>
              </div>

              <FormField label="Ensure per Day">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    className={`${input()} w-24`}
                    value={values.ensurePerDay}
                    min={0}
                    max={10}
                    onChange={(e) => set('ensurePerDay', Number(e.target.value))}
                  />
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    cans / day (0 = none)
                  </span>
                </div>
              </FormField>
            </Section>

            {/* ── Section: Allergies ────────────────────────── */}
            <Section title="Allergies & Restrictions">
              {canEditDiet ? (
                <CheckboxGroup
                  options={ALLERGY_OPTIONS as unknown as string[]}
                  selected={values.allergies}
                  onChange={(item) => toggleArrayItem('allergies', item)}
                  colorClass="border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-700 text-red-800 dark:text-red-200"
                  checkedClass="ring-2 ring-red-400"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {values.allergies.length === 0 && (
                    <span className="text-sm text-slate-400">No known allergies recorded.</span>
                  )}
                  {values.allergies.map((a) => (
                    <span
                      key={a}
                      className="text-xs font-medium px-2.5 py-1 rounded-full border border-red-300 bg-red-50 text-red-800 dark:bg-red-950 dark:border-red-700 dark:text-red-200"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Section: Beverages ────────────────────────── */}
            <Section title="Beverage Preferences">
              <CheckboxGroup
                options={BEVERAGE_OPTIONS as unknown as string[]}
                selected={values.beverages}
                onChange={(item) => toggleArrayItem('beverages', item)}
                colorClass="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-700 text-blue-800 dark:text-blue-200"
                checkedClass="ring-2 ring-blue-400"
              />
            </Section>

            {/* ── Section: Preferences & Notes ─────────────── */}
            <Section title="Preferences & Notes">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Likes">
                  <textarea
                    className={`${input()} resize-none`}
                    rows={2}
                    value={values.likes}
                    onChange={(e) => set('likes', e.target.value)}
                    placeholder="Foods they enjoy..."
                  />
                </FormField>

                <FormField label="Dislikes">
                  <textarea
                    className={`${input()} resize-none`}
                    rows={2}
                    value={values.dislikes}
                    onChange={(e) => set('dislikes', e.target.value)}
                    placeholder="Foods to avoid..."
                  />
                </FormField>
              </div>

              <FormField label="Special Instructions">
                <textarea
                  className={`${input()} resize-none`}
                  rows={3}
                  value={values.specialInstructions}
                  onChange={(e) => set('specialInstructions', e.target.value)}
                  placeholder="Thickened liquids, no pork, cut everything into quarters..."
                />
              </FormField>
            </Section>

            {/* ── B04: Flag for RD review (aides / non-clinical roles) ── */}
            {isEdit && !canEditDiet && (
              <Section title="Request Diet Review">
                {flagStatus && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded px-3 py-2">
                    {flagStatus}
                  </p>
                )}
                {!flagOpen ? (
                  <button
                    type="button"
                    onClick={() => setFlagOpen(true)}
                    className="px-4 py-2 text-sm font-medium rounded border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                  >
                    🚩 Flag for RD review
                  </button>
                ) : (
                  <div className="space-y-3">
                    <FormField label="What should the dietitian review?">
                      <textarea
                        className={`${input()} resize-none`}
                        rows={3}
                        value={flagMessage}
                        onChange={(e) => setFlagMessage(e.target.value)}
                        placeholder="e.g. Resident refused pureed lunch twice — possible texture downgrade needed."
                      />
                    </FormField>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!flagMessage.trim()}
                        onClick={submitFlag}
                        className="px-4 py-2 text-sm font-medium rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 transition-colors"
                      >
                        Send flag
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFlagOpen(false); setFlagMessage('') }}
                        className="px-4 py-2 text-sm font-medium rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </Section>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium rounded bg-primary text-white hover:bg-primary-dark transition-colors"
            >
              {isEdit ? 'Save Changes' : 'Add Resident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function input(error?: string) {
  return [
    'w-full rounded border px-3 py-2 text-sm bg-white dark:bg-slate-800',
    'focus:outline-none focus:ring-2 focus:ring-primary/50 transition',
    error
      ? 'border-red-400 dark:border-red-500'
      : 'border-slate-300 dark:border-slate-600',
  ].join(' ')
}
