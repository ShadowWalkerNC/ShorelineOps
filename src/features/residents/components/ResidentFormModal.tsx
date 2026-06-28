import { useEffect } from 'react'
import {
  ALLERGY_OPTIONS,
  BEVERAGE_OPTIONS,
  DIET_TYPES,
  MONTHS,
  type Resident,
} from '@/types/resident'
import { useResidentForm } from '@/hooks/useResidentForm'
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
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Diet Type">
                  <select
                    className={input()}
                    value={values.dietType}
                    onChange={(e) => set('dietType', e.target.value as typeof values.dietType)}
                  >
                    {DIET_TYPES.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </FormField>

                <FormField label="Texture">
                  <select
                    className={input()}
                    value={values.texture}
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
              <CheckboxGroup
                options={ALLERGY_OPTIONS as unknown as string[]}
                selected={values.allergies}
                onChange={(item) => toggleArrayItem('allergies', item)}
                colorClass="border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-700 text-red-800 dark:text-red-200"
                checkedClass="ring-2 ring-red-400"
              />
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
