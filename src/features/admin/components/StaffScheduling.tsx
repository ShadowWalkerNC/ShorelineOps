import React, { useState, useMemo, useEffect } from 'react'
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Check,
  X,
  Sunrise,
  Sun,
  Moon,
  User,
  UserX,
  UserCheck,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react'
import { useStaffStore, type Shift, type ShiftWindow } from '../../../state/staffStore'

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const SHIFT_WINDOWS: { id: ShiftWindow; label: string; time: string; icon: LucideIcon }[] = [
  { id: 'Morning', label: 'Morning', time: '6:00 AM – 2:00 PM', icon: Sunrise },
  { id: 'Midday',  label: 'Midday',  time: '10:00 AM – 6:00 PM', icon: Sun },
  { id: 'Evening', label: 'Evening', time: '2:00 PM – 10:00 PM', icon: Moon },
]

const STATIONS = [
  'Hot Line',
  'Cold Prep',
  'Tray Assembly',
  'Special Diets',
  'Dish Room',
  'Dining Room',
  'Bakery',
  'Float / Utility',
]

const CALL_OUT_REASONS = [
  'Sick',
  'Personal',
  'Family Emergency',
  'Medical Appointment',
  'Bereavement',
  'Other',
]

interface StaffSchedulingProps {
  staffIdFilter?: string
  hideHeader?: boolean
}

interface ShiftFormData {
  id?: string
  staffId: string
  staffName: string
  isCustomStaff: boolean
  date: string
  shift: ShiftWindow
  position: string
  station: string
  callOut: boolean
  callOutReason: string
  coverageStatus: string
  notes: string
}

const DEFAULT_FORM: ShiftFormData = {
  staffId: '',
  staffName: '',
  isCustomStaff: false,
  date: new Date().toISOString().slice(0, 10),
  shift: 'Morning',
  position: 'Dietary Aide',
  station: 'Hot Line',
  callOut: false,
  callOutReason: 'Sick',
  coverageStatus: 'Uncovered',
  notes: '',
}

export default function StaffScheduling({ staffIdFilter, hideHeader = false }: StaffSchedulingProps) {
  const {
    profiles,
    shifts,
    shiftsLoading,
    fetch: fetchAll,
    fetchShifts,
    createShift,
    updateShift,
    deleteShift,
    toggleCallOut,
  } = useStaffStore()

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [filterWindow, setFilterWindow] = useState<ShiftWindow | 'All'>('All')
  const [activeMobileDay, setActiveMobileDay] = useState<number>(() => new Date().getDay())

  // Modal states
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [form, setForm] = useState<ShiftFormData>(DEFAULT_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Quick call-out modal state
  const [callOutModalShift, setCallOutModalShift] = useState<Shift | null>(null)
  const [callOutReason, setCallOutReason] = useState('Sick')
  const [callOutNotes, setCallOutNotes] = useState('')

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Compute 7 days of the currently selected week (Sunday to Saturday)
  const weekDays = useMemo(() => {
    const start = new Date(selectedDate)
    const dayOfWeek = start.getDay() // 0 = Sun
    start.setDate(start.getDate() - dayOfWeek)
    start.setHours(0, 0, 0, 0)

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      return {
        date: d,
        dateStr,
        dayShort: DAYS_SHORT[i],
        dayFull: DAYS_FULL[i],
        dayOfMonth: d.getDate(),
        monthShort: d.toLocaleDateString(undefined, { month: 'short' }),
        isToday: dateStr === new Date().toISOString().slice(0, 10),
      }
    })
  }, [selectedDate])

  const weekStartStr = weekDays[0]?.dateStr ?? ''
  const weekEndStr = weekDays[6]?.dateStr ?? ''

  // Filter shifts for the active week and optional staffIdFilter
  const weekShifts = useMemo(() => {
    return shifts.filter(s => {
      if (staffIdFilter && s.staffId !== staffIdFilter) return false
      return s.date >= weekStartStr && s.date <= weekEndStr
    })
  }, [shifts, weekStartStr, weekEndStr, staffIdFilter])

  // Group shifts by date and window
  const shiftsByDateAndWindow = useMemo(() => {
    const map: Record<string, Record<ShiftWindow, Shift[]>> = {}
    for (const d of weekDays) {
      map[d.dateStr] = {
        Morning: [],
        Midday: [],
        Evening: [],
      }
    }
    for (const s of weekShifts) {
      if (map[s.date] && map[s.date][s.shift]) {
        map[s.date][s.shift].push(s)
      }
    }
    return map
  }, [weekDays, weekShifts])

  // Weekly summary statistics
  const totalShifts = weekShifts.length
  const totalHours = totalShifts * 8
  const uniqueStaffCount = new Set(weekShifts.map(s => s.staffId || s.staffName)).size
  const callOutsCount = weekShifts.filter(s => s.callOut).length
  const uncoveredCount = weekShifts.filter(s => s.callOut && s.coverageStatus === 'Uncovered').length

  function navigateWeek(deltaWeeks: number) {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + deltaWeeks * 7)
    setSelectedDate(next)
  }

  function goToToday() {
    const today = new Date()
    setSelectedDate(today)
    setActiveMobileDay(today.getDay())
  }

  function openCreateModal(defaultDate?: string, defaultWindow?: ShiftWindow) {
    setFormError(null)
    const initialStaff = profiles[0]
    setForm({
      ...DEFAULT_FORM,
      staffId: staffIdFilter || (initialStaff ? initialStaff.id : ''),
      staffName: initialStaff ? `${initialStaff.firstName} ${initialStaff.lastName}` : '',
      position: initialStaff ? initialStaff.position : 'Dietary Aide',
      date: defaultDate || weekDays[activeMobileDay]?.dateStr || new Date().toISOString().slice(0, 10),
      shift: defaultWindow || 'Morning',
    })
    setShowShiftModal(true)
  }

  function openEditModal(shift: Shift) {
    setFormError(null)
    setForm({
      id: shift.id,
      staffId: shift.staffId,
      staffName: shift.staffName,
      isCustomStaff: !profiles.some(p => p.id === shift.staffId),
      date: shift.date,
      shift: shift.shift,
      position: shift.position || 'Dietary Aide',
      station: shift.station || 'Hot Line',
      callOut: shift.callOut,
      callOutReason: shift.callOutReason || 'Sick',
      coverageStatus: shift.coverageStatus || 'Uncovered',
      notes: shift.notes || '',
    })
    setShowShiftModal(true)
  }

  async function handleSaveShift(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const finalStaffName = form.staffName.trim()
    if (!finalStaffName) {
      setFormError('Please select or specify a staff member name.')
      return
    }
    if (!form.date) {
      setFormError('Please select a valid shift date.')
      return
    }

    setIsSubmitting(true)
    try {
      if (form.id) {
        await updateShift(form.id, {
          staffId: form.staffId || undefined,
          staffName: finalStaffName,
          date: form.date,
          shift: form.shift,
          position: form.position.trim(),
          station: form.station.trim(),
          callOut: form.callOut,
          callOutReason: form.callOut ? form.callOutReason : undefined,
          coverageStatus: form.callOut ? form.coverageStatus : undefined,
          notes: form.notes.trim() || undefined,
        })
      } else {
        await createShift({
          staffId: form.staffId || undefined,
          staffName: finalStaffName,
          date: form.date,
          shift: form.shift,
          position: form.position.trim(),
          station: form.station.trim(),
          callOut: form.callOut,
          callOutReason: form.callOut ? form.callOutReason : undefined,
          coverageStatus: form.callOut ? form.coverageStatus : undefined,
          notes: form.notes.trim() || undefined,
        })
      }
      setShowShiftModal(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save shift'
      setFormError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteShift(shift: Shift) {
    const confirmMessage = `Remove ${shift.staffName}'s ${shift.shift} shift on ${shift.date}?`
    if (window.confirm(confirmMessage)) {
      await deleteShift(shift.id)
    }
  }

  function handleQuickCallOut(shift: Shift) {
    if (shift.callOut) {
      // Clear call-out immediately
      toggleCallOut(shift.id)
    } else {
      // Prompt with quick modal for reason and notes
      setCallOutModalShift(shift)
      setCallOutReason('Sick')
      setCallOutNotes(shift.notes || '')
    }
  }

  async function confirmQuickCallOut() {
    if (!callOutModalShift) return
    setIsSubmitting(true)
    try {
      await toggleCallOut(callOutModalShift.id, callOutReason, callOutNotes)
      setCallOutModalShift(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full text-slate-800 dark:text-slate-100">
      {/* Optional Header */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="text-teal-600 dark:text-teal-400" size={22} />
              Weekly Shift Roster
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Active scheduling synchronized with the kitchen status board and TV display wall.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="min-h-[44px] px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold text-sm rounded-lg shadow-sm flex items-center gap-2 transition-colors cursor-pointer shrink-0"
            aria-label="Add Shift Assignment"
          >
            <Plus size={18} />
            <span>Schedule Shift</span>
          </button>
        </div>
      )}

      {/* Weekly Tallies */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl">
          <div className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
            Weekly Hours
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-teal-900 dark:text-teal-100 mt-1">
            {totalHours}h
          </div>
          <div className="text-xs text-teal-700 dark:text-teal-400 mt-0.5">8h per shift</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Staff Scheduled
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {uniqueStaffCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Active crew members</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Shifts
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {totalShifts}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sun – Sat window</div>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            callOutsCount > 0
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                callOutsCount > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Call-Outs / Absences
            </span>
            {callOutsCount > 0 && <AlertTriangle className="text-amber-600 dark:text-amber-400" size={16} />}
          </div>
          <div
            className={`text-2xl sm:text-3xl font-extrabold mt-1 ${
              callOutsCount > 0 ? 'text-amber-900 dark:text-amber-100' : 'text-slate-900 dark:text-white'
            }`}
          >
            {callOutsCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {uncoveredCount > 0 ? `${uncoveredCount} uncovered shift${uncoveredCount > 1 ? 's' : ''}` : 'All covered'}
          </div>
        </div>
      </div>

      {/* Week Navigation & Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs">
        {/* Date Navigator */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigateWeek(-1)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            aria-label="Previous Week"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="min-h-[44px] px-3.5 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => navigateWeek(1)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            aria-label="Next Week"
          >
            <ChevronRight size={20} />
          </button>
          <div className="ml-2 font-bold text-sm text-slate-900 dark:text-white">
            {weekDays[0]?.monthShort} {weekDays[0]?.dayOfMonth} – {weekDays[6]?.monthShort} {weekDays[6]?.dayOfMonth},{' '}
            {weekDays[6]?.date.getFullYear()}
          </div>
        </div>

        {/* Shift Window Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(['All', 'Morning', 'Midday', 'Evening'] as const).map(w => (
            <button
              key={w}
              type="button"
              onClick={() => setFilterWindow(w)}
              className={`min-h-[44px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filterWindow === w
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              aria-pressed={filterWindow === w}
            >
              {w === 'All' ? 'All Shifts' : w}
            </button>
          ))}
          {shiftsLoading && (
            <div className="flex items-center gap-1 text-xs text-slate-400 pl-2">
              <RotateCcw className="animate-spin" size={14} />
              <span>Syncing…</span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Day Selector Tabs (< md screens) */}
      <div className="md:hidden flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Select day of week">
        {weekDays.map((d, index) => {
          const dayShifts = weekShifts.filter(s => s.date === d.dateStr)
          const isSelected = activeMobileDay === index
          return (
            <button
              key={d.dateStr}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveMobileDay(index)}
              className={`min-h-[44px] min-w-[54px] flex-1 py-2 px-1 flex flex-col items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className="text-[10px] font-bold uppercase">{d.dayShort}</span>
              <span className="text-sm font-extrabold">{d.dayOfMonth}</span>
              {dayShifts.length > 0 && (
                <span
                  className={`text-[9px] font-extrabold px-1 rounded-full ${
                    isSelected ? 'bg-white/30 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {dayShifts.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Desktop 7-Day Grid View (md and up) */}
      <div className="hidden md:grid md:grid-cols-7 gap-3">
        {weekDays.map(d => {
          return (
            <div
              key={d.dateStr}
              className={`flex flex-col bg-white dark:bg-slate-800 border rounded-xl overflow-hidden shadow-xs ${
                d.isToday
                  ? 'border-teal-500 dark:border-teal-400 ring-2 ring-teal-500/20'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {/* Day Header */}
              <div
                className={`p-3 text-center border-b ${
                  d.isToday
                    ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {d.dayShort}
                </div>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {d.dayOfMonth}
                </div>
              </div>

              {/* Day Windows */}
              <div className="p-2 flex flex-col gap-3 flex-1 min-h-[300px]">
                {SHIFT_WINDOWS.filter(w => filterWindow === 'All' || filterWindow === w.id).map(w => {
                  const windowShifts = shiftsByDateAndWindow[d.dateStr]?.[w.id] || []
                  const IconComponent = w.icon
                  return (
                    <div key={w.id} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1 pt-1">
                        <span className="flex items-center gap-1">
                          <IconComponent size={12} className="text-slate-400" />
                          {w.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => openCreateModal(d.dateStr, w.id)}
                          className="min-h-[44px] min-w-[44px] p-1 flex items-center justify-center text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 rounded cursor-pointer"
                          title={`Add ${w.label} shift for ${d.dayShort}`}
                          aria-label={`Add ${w.label} shift for ${d.dayShort}`}
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      {windowShifts.length === 0 ? (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 text-center py-2 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                          No shifts
                        </div>
                      ) : (
                        windowShifts.map(shift => (
                          <ShiftCard
                            key={shift.id}
                            shift={shift}
                            onEdit={() => openEditModal(shift)}
                            onDelete={() => handleDeleteShift(shift)}
                            onToggleCallOut={() => handleQuickCallOut(shift)}
                          />
                        ))
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile Single Day View (< md screens) */}
      <div className="md:hidden flex flex-col gap-4">
        {weekDays[activeMobileDay] && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {weekDays[activeMobileDay].dayFull}, {weekDays[activeMobileDay].monthShort}{' '}
                  {weekDays[activeMobileDay].dayOfMonth}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {weekShifts.filter(s => s.date === weekDays[activeMobileDay].dateStr).length} scheduled shifts
                </span>
              </div>
              <button
                type="button"
                onClick={() => openCreateModal(weekDays[activeMobileDay].dateStr)}
                className="min-h-[44px] px-3.5 bg-teal-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                aria-label="Add shift for this day"
              >
                <Plus size={16} />
                <span>Add Shift</span>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {SHIFT_WINDOWS.filter(w => filterWindow === 'All' || filterWindow === w.id).map(w => {
                const dayStr = weekDays[activeMobileDay].dateStr
                const windowShifts = shiftsByDateAndWindow[dayStr]?.[w.id] || []
                const IconComponent = w.icon
                return (
                  <div key={w.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg">
                      <span className="flex items-center gap-1.5">
                        <IconComponent size={14} className="text-teal-600 dark:text-teal-400" />
                        {w.label} ({w.time})
                      </span>
                      <button
                        type="button"
                        onClick={() => openCreateModal(dayStr, w.id)}
                        className="min-h-[44px] px-2 text-teal-600 dark:text-teal-400 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Add</span>
                      </button>
                    </div>

                    {windowShifts.length === 0 ? (
                      <div className="text-xs text-slate-400 dark:text-slate-500 text-center py-3 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        No shifts scheduled for {w.label.toLowerCase()}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {windowShifts.map(shift => (
                          <ShiftCard
                            key={shift.id}
                            shift={shift}
                            onEdit={() => openEditModal(shift)}
                            onDelete={() => handleDeleteShift(shift)}
                            onToggleCallOut={() => handleQuickCallOut(shift)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Shift Modal */}
      {showShiftModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shift-modal-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg p-6 shadow-xl relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
              <h3 id="shift-modal-title" className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="text-teal-600 dark:text-teal-400" size={20} />
                {form.id ? 'Edit Scheduled Shift' : 'Schedule Staff Shift'}
              </h3>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveShift} className="mt-4 flex flex-col gap-4">
              {/* Staff Member Selector */}
              <div>
                <label htmlFor="shift-staff-select" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Staff Member
                </label>
                {!form.isCustomStaff ? (
                  <div className="flex flex-col gap-2">
                    <select
                      id="shift-staff-select"
                      className="w-full min-h-[44px] px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white cursor-pointer"
                      value={form.staffId}
                      onChange={e => {
                        const val = e.target.value
                        if (val === '__custom__') {
                          setForm(f => ({ ...f, isCustomStaff: true, staffId: '', staffName: '' }))
                        } else {
                          const prof = profiles.find(p => p.id === val)
                          setForm(f => ({
                            ...f,
                            staffId: val,
                            staffName: prof ? `${prof.firstName} ${prof.lastName}` : f.staffName,
                            position: prof ? prof.position : f.position,
                          }))
                        }
                      }}
                    >
                      <option value="">Select an employee…</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} — {p.position} ({p.department})
                        </option>
                      ))}
                      <option value="__custom__">+ Enter Custom / External Staff Name</option>
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      id="shift-staff-custom"
                      placeholder="e.g. Maria Gonzalez"
                      value={form.staffName}
                      onChange={e => setForm(f => ({ ...f, staffName: e.target.value }))}
                      className="w-full min-h-[44px] px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, isCustomStaff: false }))}
                      className="text-xs text-teal-600 dark:text-teal-400 hover:underline self-start cursor-pointer"
                    >
                      Select from existing employee roster
                    </button>
                  </div>
                )}
              </div>

              {/* Date & Shift Window */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="shift-date" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Shift Date
                  </label>
                  <input
                    type="date"
                    id="shift-date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full min-h-[44px] px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white cursor-pointer"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="shift-window-select" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Shift Window
                  </label>
                  <select
                    id="shift-window-select"
                    value={form.shift}
                    onChange={e => setForm(f => ({ ...f, shift: e.target.value as ShiftWindow }))}
                    className="w-full min-h-[44px] px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white cursor-pointer"
                  >
                    {SHIFT_WINDOWS.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.label} ({w.time})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Position & Station */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="shift-position" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Position / Role
                  </label>
                  <input
                    type="text"
                    id="shift-position"
                    value={form.position}
                    onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                    placeholder="e.g. Lead Cook"
                    className="w-full min-h-[44px] px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="shift-station" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Kitchen Station
                  </label>
                  <select
                    id="shift-station"
                    value={form.station}
                    onChange={e => setForm(f => ({ ...f, station: e.target.value }))}
                    className="w-full min-h-[44px] px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white cursor-pointer"
                  >
                    {STATIONS.map(st => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Call-Out / Absence Controls */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer select-none min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={form.callOut}
                    onChange={e => setForm(f => ({ ...f, callOut: e.target.checked }))}
                    className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Report Call-Out / Unplanned Absence
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Updates coverage alerts on TV status boards and kitchen displays.
                    </p>
                  </div>
                </label>

                {form.callOut && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <label htmlFor="shift-callout-reason" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Absence Reason
                      </label>
                      <select
                        id="shift-callout-reason"
                        value={form.callOutReason}
                        onChange={e => setForm(f => ({ ...f, callOutReason: e.target.value }))}
                        className="w-full min-h-[44px] px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white cursor-pointer"
                      >
                        {CALL_OUT_REASONS.map(r => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="shift-coverage-status" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Coverage Status
                      </label>
                      <select
                        id="shift-coverage-status"
                        value={form.coverageStatus}
                        onChange={e => setForm(f => ({ ...f, coverageStatus: e.target.value }))}
                        className="w-full min-h-[44px] px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white cursor-pointer"
                      >
                        <option value="Uncovered">Uncovered (Needs replacement)</option>
                        <option value="Covered">Covered (Replacement found)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Coverage / Manager Notes */}
              <div>
                <label htmlFor="shift-notes" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Manager &amp; Coverage Notes (Optional)
                </label>
                <textarea
                  id="shift-notes"
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Covering tray line assembly; authorized overtime"
                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white resize-y"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowShiftModal(false)}
                  className="min-h-[44px] px-4 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] px-5 rounded-lg bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Check size={16} />
                  <span>{isSubmitting ? 'Saving…' : form.id ? 'Save Changes' : 'Schedule Shift'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Call-Out Modal */}
      {callOutModalShift && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="callout-modal-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6 shadow-xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 id="callout-modal-title" className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="text-amber-600 dark:text-amber-400" size={18} />
                Log Unplanned Absence
              </h3>
              <button
                type="button"
                onClick={() => setCallOutModalShift(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="my-4 text-sm text-slate-600 dark:text-slate-300">
              Record a call-out for{' '}
              <strong className="text-slate-900 dark:text-white">{callOutModalShift.staffName}</strong> on{' '}
              <strong>
                {callOutModalShift.date} ({callOutModalShift.shift})
              </strong>
              .
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="quick-callout-reason" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Absence Reason
                </label>
                <select
                  id="quick-callout-reason"
                  value={callOutReason}
                  onChange={e => setCallOutReason(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white cursor-pointer"
                >
                  {CALL_OUT_REASONS.map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="quick-callout-notes" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Manager Notes
                </label>
                <textarea
                  id="quick-callout-notes"
                  rows={2}
                  value={callOutNotes}
                  onChange={e => setCallOutNotes(e.target.value)}
                  placeholder="e.g. Called in at 5:00 AM with fever"
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white resize-y"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setCallOutModalShift(null)}
                className="min-h-[44px] px-4 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmQuickCallOut}
                disabled={isSubmitting}
                className="min-h-[44px] px-5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                <AlertTriangle size={16} />
                <span>{isSubmitting ? 'Recording…' : 'Record Call-Out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ShiftCard({
  shift,
  onEdit,
  onDelete,
  onToggleCallOut,
}: {
  shift: Shift
  onEdit: () => void
  onDelete: () => void
  onToggleCallOut: () => void
}) {
  return (
    <div
      className={`p-2.5 rounded-lg border text-left flex flex-col gap-1.5 transition-all shadow-2xs relative ${
        shift.callOut
          ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
          : 'bg-slate-50/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/80 hover:border-teal-300 dark:hover:border-teal-700'
      }`}
    >
      {/* Header: Name and Call-Out indicator */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="font-bold text-xs text-slate-900 dark:text-white truncate flex items-center gap-1">
            <User size={12} className="text-slate-400 shrink-0" />
            <span className="truncate">{shift.staffName}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            {shift.position || 'Staff'}
            {shift.station ? ` · ${shift.station}` : ''}
          </div>
        </div>
      </div>

      {/* Call-out status badge */}
      {shift.callOut && (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px] font-bold">
          <AlertTriangle size={11} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="truncate">Called Out ({shift.callOutReason || 'Sick'})</span>
        </div>
      )}

      {/* Notes preview if present */}
      {shift.notes && (
        <div className="text-[10px] text-slate-500 dark:text-slate-400 italic line-clamp-1 bg-white/60 dark:bg-slate-800/60 px-1.5 py-0.5 rounded">
          {shift.notes}
        </div>
      )}

      {/* Accessible Action Buttons: min-h-[44px] */}
      <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 mt-0.5">
        <button
          type="button"
          onClick={onToggleCallOut}
          className={`min-h-[44px] min-w-[44px] p-2 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
            shift.callOut
              ? 'text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/40'
              : 'text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40'
          }`}
          title={shift.callOut ? 'Clear absence / mark present' : 'Report call-out / absence'}
          aria-label={shift.callOut ? 'Clear absence' : 'Report call-out'}
        >
          {shift.callOut ? <UserCheck size={16} /> : <UserX size={16} />}
        </button>

        <button
          type="button"
          onClick={onEdit}
          className="min-h-[44px] min-w-[44px] p-2 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-md transition-colors cursor-pointer"
          title="Edit shift"
          aria-label="Edit shift"
        >
          <Pencil size={15} />
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="min-h-[44px] min-w-[44px] p-2 flex items-center justify-center text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-colors cursor-pointer"
          title="Remove shift"
          aria-label="Remove shift"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
