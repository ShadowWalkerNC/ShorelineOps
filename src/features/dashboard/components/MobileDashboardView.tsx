import { Link, useNavigate } from 'react-router-dom'
import { AlertOctagon, CheckCircle2, Thermometer, Truck, Users, Utensils, ChevronRight, Boxes } from 'lucide-react'
import type { Resident } from '@/types/resident'
import type { StockItem } from '@/state/inventoryStore'
import type { BudgetPeriod } from '@/state/budgetStore'
import type { AuthUser } from '@/security/AuthContext'

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
  lowParItems: StockItem[]
  zeroItems: StockItem[]
  totalBudget: number
  totalSpent: number
  dailyPerRes: number
  budgetPct: number
  period: BudgetPeriod
  isManager: boolean
  user: AuthUser | null
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


  return (
    <div className="stitch-dashboard stitch-dashboard-mobile space-y-5 max-w-lg mx-auto pb-4 animate-fadeIn">
      <header className="stitch-dashboard-hero">
        <div><p className="stitch-eyebrow">Clinical dashboard</p><h1>{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {user?.name?.split(' ')[0] ?? 'there'}</h1><p className="stitch-hero-meta">{new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</p><p className="stitch-hero-description">Your census, dietary priorities and meal service in one place.</p></div>
        <Link to="/kitchen/orders" className="stitch-action-primary"><Utensils size={18} /> Meal tally entry</Link>
      </header>
      <ClinicalSafetySummary active={active} loading={loading} />
      <section className="stitch-mobile-census" aria-label="Census summary">
        {[{ label: 'Active census', value: loading ? '…' : active.length }, { label: 'Room trays', value: roomTrays }, { label: 'Dining room', value: diningRoom }, { label: 'Hospital / LOA', value: hospital + loa }].map(metric => <Link to="/residents" key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></Link>)}
      </section>
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

      <section className="stitch-workflow-grid" aria-label="Shift workspaces">
        <Link to="/production" className="stitch-workflow-card"><span className="stitch-eyebrow">Production progress</span><h2>{completedSheets} / {totalSheets} sheets signed</h2><p>{totalSheets ? `${prodPct}% of loaded production sheets signed off.` : 'No production sheets loaded.'}</p><span className="stitch-workflow-cta">Open production<ChevronRight size={18}/></span></Link>
        <Link to="/purchasing" className="stitch-workflow-card"><span className="stitch-eyebrow">Procurement matrix</span><h2>Plan your next purchase</h2><p>{lowParItems.length} items below par · {zeroItems.length} at zero stock</p><span className="stitch-workflow-cta">Open purchasing<ChevronRight size={18}/></span></Link>
        {props.isManager && <Link to="/reporting" className="stitch-workflow-card"><span className="stitch-eyebrow">Budget & reports</span><h2>$ {props.dailyPerRes.toFixed(2)} / resident / day</h2><p>{props.budgetPct.toFixed(0)}% of period budget used. Review source records before reporting.</p><span className="stitch-workflow-cta">Review reports<ChevronRight size={18}/></span></Link>}
      </section>
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
              {lunchOpt1.join(', ') || 'No lunch menu loaded'}
              {lunchOpt2.length > 0 && <p className="mt-2 font-normal whitespace-normal">Alternative: {lunchOpt2.join(', ')}</p>}
              {lunchDessert && <p className="mt-2 font-normal whitespace-normal">Dessert: {lunchDessert}</p>}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 font-mono">
              Dinner Entrée
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate">
              {dinnerOpt1.join(', ') || 'No dinner menu loaded'}
              {dinnerOpt2.length > 0 && <p className="mt-2 font-normal whitespace-normal">Alternative: {dinnerOpt2.join(', ')}</p>}
              {dinnerDessert && <p className="mt-2 font-normal whitespace-normal">Dessert: {dinnerDessert}</p>}
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

      <section className="stitch-workflow-card" aria-label="Dietary preparation requirements"><span className="stitch-eyebrow">Dietary preparation</span><h2>Recorded exclusions</h2><p>{Object.entries(keyAllergyCount).map(([label, count]) => `${label}: ${count}`).join(' · ') || 'No matching exclusions in the loaded census.'}</p><p>{totalEnsure} supplement cans per day recorded.</p><Link to="/residents" className="stitch-workflow-cta">Review dietary orders<ChevronRight size={18}/></Link></section>
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

export function ClinicalSafetySummary({ active, loading }: { active: Resident[]; loading: boolean }) {
  const npo = active.filter(resident => resident.is_npo === true)
  const allergies = active.filter(resident => resident.allergies?.length)
  return <section className="stitch-clinical-summary" aria-label="Clinical safety priorities">
    <AlertOctagon size={26} className="shrink-0" />
    <div className="min-w-0 flex-1"><h2>Clinical safety priorities</h2>
      <p>{loading ? 'Loading resident dietary orders…' : `${npo.length} active NPO orders · ${allergies.length} residents with recorded allergy or dietary exclusions`}</p>
      {npo.length > 0 && <p className="stitch-npo-detail"><strong>NPO hard-block:</strong> No trays or liquids for {npo.map(resident => `${resident.name} (Room ${resident.room})`).join(', ')}.</p>}
      <p className="stitch-safety-note">Review current orders and exclusions before every tray pass. This summary does not authorize dispatch.</p>
    </div><Link to="/residents" className="stitch-safety-action">Review orders<ChevronRight size={18}/></Link>
  </section>
}
