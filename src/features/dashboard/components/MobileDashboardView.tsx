import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Thermometer,
  Truck,
  Users,
  Utensils,
  ChevronRight,
  Zap,
  Boxes,
  HeartPulse,
  ChefHat,
  ShieldCheck,
  Plus,
} from 'lucide-react'
import type { Resident } from '@/types/resident'

export interface DashboardViewProps {
  active: Resident[]
  residents: Resident[]
  loading: boolean
  hospital: number
  loa: number
  totalEnsure: number
  roomTrays: number
  diningRoom: number
  cutUp: number
  minced: number
  pureed: number
  keyAllergyCount: Record<string, number>
  upcomingBirthdays: { name: string; room: string; monthDay: string; daysUntil: number }[]
  todayDay: string
  lunchOpt1: string[]
  lunchOpt2: string[]
  dinnerOpt1: string[]
  dinnerOpt2: string[]
  lunchDessert: string
  dinnerDessert: string
  pendingApprovals: number
  unreadThreads: number
  completedSheets: number
  totalSheets: number
  prodPct: number
  lowParItems: any[]
  zeroItems: any[]
  totalBudget: number
  totalSpent: number
  dailyPerRes: number
  budgetPct: number
  period: any
  isManager: boolean
  user: any
}

export default function MobileDashboardView(props: DashboardViewProps) {
  const navigate = useNavigate()
  const {
    active,
    loading,
    hospital,
    loa,
    totalEnsure,
    roomTrays,
    diningRoom,
    cutUp,
    minced,
    pureed,
    keyAllergyCount,
    todayDay,
    lunchOpt1,
    lunchOpt2,
    dinnerOpt1,
    dinnerOpt2,
    lunchDessert,
    dinnerDessert,
    completedSheets,
    totalSheets,
    prodPct,
    lowParItems,
    zeroItems,
    user,
  } = props

  // NPO Hard-block residents
  const npoResidents = active.filter(r => r.is_npo === true)

  // Interactive quick checklist for mobile floor staff
  const [checklist, setChecklist] = useState([
    { id: '1', label: '165°F Cook & Hold Temp Log', done: true },
    { id: '2', label: 'Check 3 NPO Tray Exclusions', done: false, alert: true },
    { id: '3', label: 'East Wing Tray Cart Dispatch', done: false },
    { id: '4', label: 'Dish Sanitizer Titration Test', done: false },
  ])

  const toggleCheck = (id: string) => {
    setChecklist(prev =>
      prev.map(item => (item.id === id ? { ...item, done: !item.done } : item))
    )
  }

  // Determine current meal window
  const currentHour = new Date().getHours()
  const mealWindow = currentHour < 10
    ? { name: 'Breakfast Service', time: '7:00 AM – 9:00 AM', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50' }
    : currentHour < 14
    ? { name: 'Lunch Service', time: '11:30 AM – 1:00 PM', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' }
    : { name: 'Dinner Service', time: '5:00 PM – 6:30 PM', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50' }

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-4 animate-fadeIn">
      {/* ── Active Service Header Bar ── */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${mealWindow.color}`}>
            ● {mealWindow.name}
          </span>
          <span className="text-[11px] font-mono text-slate-500">{mealWindow.time}</span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Shift Operations
            </h2>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {loading ? '…' : active.length} Residents Active &middot; {roomTrays} Room Trays
            </div>
          </div>
          <Link
            to="/residents"
            className="px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center gap-1"
          >
            <span>Census</span>
            <ChevronRight size={12} />
          </Link>
        </div>
      </div>

      {/* ── Clinical NPO Hard-Alert (Deterministic Safety) ── */}
      {npoResidents.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-red-600 text-white shadow-sm animate-pulse flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black uppercase tracking-wider">
              Clinical Hard-Block: {npoResidents.length} NPO Order(s)
            </div>
            <div className="text-[11px] mt-0.5 font-bold leading-tight">
              Zero trays or liquids may be dispatched for:{' '}
              {npoResidents.map(r => `${r.name} (Rm ${r.room})`).join(', ')}
            </div>
          </div>
        </div>
      )}

      {/* ── 4 Quick Action Touch Tiles (Thumb Friendly >= 48px) ── */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => navigate('/kitchen/sheet')}
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 shadow-xs flex items-center gap-3 text-left transition-all active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <Thermometer className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Log Temp</div>
            <div className="text-[10px] text-slate-500 mt-0.5">165°F HACCP</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/kitchen/dispatch')}
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-600 shadow-xs flex items-center gap-3 text-left transition-all active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Dispatch Cart</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Scan Tray SLA</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/residents')}
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 shadow-xs flex items-center gap-3 text-left transition-all active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Find Resident</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Search & Orders</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/tasks')}
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-600 shadow-xs flex items-center gap-3 text-left transition-all active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Shift Tasks</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Floor Checklist</div>
          </div>
        </button>
      </div>

      {/* ── Floor Operational Checklist Card ── */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Shift Checklist
            </h3>
          </div>
          <Link to="/tasks" className="text-[11px] font-bold text-teal-600 dark:text-teal-400">
            View All →
          </Link>
        </div>

        <div className="space-y-2">
          {checklist.map(item => (
            <div
              key={item.id}
              onClick={() => toggleCheck(item.id)}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
            >
              <button
                className="w-7 h-7 flex items-center justify-center shrink-0"
                onClick={e => {
                  e.stopPropagation()
                  toggleCheck(item.id)
                }}
              >
                {item.done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100 dark:fill-emerald-950/50" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                )}
              </button>
              <span
                className={`text-xs font-semibold flex-1 ${
                  item.done
                    ? 'line-through text-slate-400 dark:text-slate-500'
                    : item.alert
                    ? 'text-amber-700 dark:text-amber-400 font-bold'
                    : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Today's Glanceable Menu Card ── */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              {todayDay} Menu
            </h3>
          </div>
          <Link to="/menu" className="text-[11px] font-bold text-teal-600 dark:text-teal-400">
            Full Menu →
          </Link>
        </div>

        <div className="space-y-2 pt-1">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 font-mono">
              Lunch Entrée
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate">
              {lunchOpt1.join(', ') || 'Roast Turkey Breast with Herb Gravy'}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 font-mono">
              Dinner Entrée
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate">
              {dinnerOpt1.join(', ') || 'Baked Atlantic Cod with Lemon Herb'}
            </div>
          </div>
        </div>

        {/* Texture Counters */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-[11px]">
          <span className="text-slate-500 font-semibold">Special Textures:</span>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold border border-amber-200">
              {cutUp} Cut
            </span>
            <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold border border-purple-200">
              {minced} Minced
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200">
              {pureed} Puree
            </span>
          </div>
        </div>
      </div>

      {/* ── Inventory Out / Par Alert Strip ── */}
      {lowParItems.length > 0 && (
        <Link
          to="/inventory"
          className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between shadow-xs block"
        >
          <div className="flex items-center gap-2.5">
            <Boxes className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
              {lowParItems.length} items below par level {zeroItems.length > 0 ? `(${zeroItems.length} at zero)` : ''}
            </span>
          </div>
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
            Check Par →
          </span>
        </Link>
      )}
    </div>
  )
}
