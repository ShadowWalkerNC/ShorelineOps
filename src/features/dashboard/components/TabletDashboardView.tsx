import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import {
  Users,
  AlertTriangle,
  AlertOctagon,
  Utensils,
  CheckCircle2,
  Clock,
  Zap,
  TrendingUp,
  ClipboardList,
  ChefHat,
  Truck,
  Boxes,
  ShieldCheck,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react'
import type { DashboardViewProps } from './MobileDashboardView'

export default function TabletDashboardView(props: DashboardViewProps) {
  const navigate = useNavigate()
  const {
    active,
    residents,
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
    upcomingBirthdays,
    todayDay,
    lunchOpt1,
    lunchOpt2,
    dinnerOpt1,
    dinnerOpt2,
    completedSheets,
    totalSheets,
    prodPct,
    lowParItems,
    zeroItems,
    pendingApprovals,
    totalBudget,
    totalSpent,
    dailyPerRes,
    budgetPct,
    isManager,
    user,
  } = props

  const npoResidents = active.filter(r => r.is_npo === true)

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-8 animate-fadeIn">
      {/* ── Tablet Header & Clinical Census Summary ── */}
      <div className="flex items-center justify-between p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Clinical & Kitchen Operations
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tablet Supervisory Console &middot; {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/residents"
            className="px-3 py-2 rounded-2xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200/70 dark:border-teal-800/70 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center gap-1.5"
          >
            <Users className="w-4 h-4" />
            <span>{active.length} Active Census</span>
          </Link>
          <Link
            to="/kitchen/sheet"
            className="px-3 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/70 dark:border-amber-800/70 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5"
          >
            <ChefHat className="w-4 h-4" />
            <span>Cook Sheet</span>
          </Link>
        </div>
      </div>

      {/* ── NPO Safety Hard-Alert (if present) ── */}
      {npoResidents.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-600 text-white shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-6 h-6 shrink-0" />
            <div>
              <div className="text-xs font-black uppercase tracking-wider">
                SAFETY HARD-BLOCK: {npoResidents.length} Active NPO Resident(s)
              </div>
              <div className="text-xs mt-0.5 font-bold">
                Trays excluded: {npoResidents.map(r => `${r.name} (Rm ${r.room})`).join(', ')}
              </div>
            </div>
          </div>
          <Link
            to="/residents"
            className="px-3 py-1.5 rounded-xl bg-white text-red-600 font-bold text-xs shrink-0 shadow-xs"
          >
            Review Orders
          </Link>
        </div>
      )}

      {/* ── 4 High-Contrast Tablet KPI Cards (Touch Ergonomics >= 48px) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          onClick={() => navigate('/residents')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer hover:border-teal-500 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              Census & Trays
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-sans">
            {active.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {roomTrays} Room Trays &middot; {diningRoom} Dining
          </div>
        </div>

        <div
          onClick={() => navigate('/production')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer hover:border-teal-500 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              Production
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 font-sans">
            {prodPct}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {completedSheets} of {totalSheets || 1} batch sheets signed
          </div>
        </div>

        <div
          onClick={() => navigate('/inventory')}
          className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition-all ${
            lowParItems.length > 0
              ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-teal-500'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              Inventory Par
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 font-sans">
            {lowParItems.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {zeroItems.length > 0 ? `${zeroItems.length} out of stock!` : 'Items below par level'}
          </div>
        </div>

        <div
          onClick={() => navigate('/reporting')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer hover:border-teal-500 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              Daily $/Resident
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 font-sans">
            ${dailyPerRes.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {budgetPct.toFixed(0)}% period budget used
          </div>
        </div>
      </div>

      {/* ── 2-Column Responsive Layout for Tablet Screens ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Column 1: Today's Menu & Tray Service */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Today's Menu ({todayDay})
              </h3>
            </div>
            <Link to="/menu" className="text-xs font-bold text-teal-600 dark:text-teal-400">
              Planner →
            </Link>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 font-mono mb-1">
                Lunch Service
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Option 1: {lunchOpt1.join(', ') || 'Roast Turkey Breast with Herb Gravy'}
              </div>
              {lunchOpt2.length > 0 && (
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Option 2: {lunchOpt2.join(', ')}
                </div>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 font-mono mb-1">
                Dinner Service
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Option 1: {dinnerOpt1.join(', ') || 'Baked Atlantic Cod with Lemon Herb'}
              </div>
              {dinnerOpt2.length > 0 && (
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Option 2: {dinnerOpt2.join(', ')}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link
              to="/kitchen/traycards"
              className="flex-1 mr-2 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold text-center hover:bg-slate-200 transition-colors"
            >
              Tray Tickets
            </Link>
            <Link
              to="/kitchen/dispatch"
              className="flex-1 py-2 px-3 rounded-xl bg-teal-600 text-white text-xs font-bold text-center hover:bg-teal-700 transition-colors"
            >
              Tray Dispatch
            </Link>
          </div>
        </div>

        {/* Column 2: IDDSI Dysphagia & Special Prep Summary */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                IDDSI Textures & Allergies
              </h3>
            </div>
            <Link to="/residents" className="text-xs font-bold text-teal-600 dark:text-teal-400">
              Residents →
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800 text-center">
              <div className="text-xl font-bold text-amber-700 dark:text-amber-400">{cutUp}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mt-0.5">Cut-Up (L6)</div>
            </div>
            <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-800 text-center">
              <div className="text-xl font-bold text-purple-700 dark:text-purple-400">{minced}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mt-0.5">Minced (L5)</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800 text-center">
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{pureed}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mt-0.5">Puree (L4)</div>
            </div>
          </div>

          {/* Key Allergies Chips */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5">
              Active Allergy Exclusions
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(keyAllergyCount).length > 0 ? (
                Object.entries(keyAllergyCount).map(([allergy, count]) => (
                  <span
                    key={allergy}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                  >
                    {allergy}: {count}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">No active allergens flagged.</span>
              )}
            </div>
          </div>

          {/* Quick Supervisory Action Bar */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Dietary Supplements:</span>
            <span className="font-bold text-teal-700 dark:text-teal-400">
              {totalEnsure} Cans Ensure / Day
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
