import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useResidentsStore } from '@/state/residentsStore'
import { useMenuStore } from '@/state/menuStore'
import { useCommunicationsStore } from '@/state/communicationsStore'
import { useProductionStore } from '@/state/productionStore'
import { useInventoryStore } from '@/state/inventoryStore'
import { useBudgetStore } from '@/state/budgetStore'
import { useAuth } from '@/security/AuthContext'
import { useDevice } from '@/hooks/useDevice'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import {
  Zap,
  ClipboardList,
  AlertOctagon,
  AlertTriangle,
  Utensils,
  Calendar,
  CheckCircle2,
  Store,
  ArrowUpDown,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Boxes,
  Users,
  Clock,
  ExternalLink,
  ChefHat,
  Heart,
  Droplet,
} from 'lucide-react'
import type { DayOfWeek } from '@/types'
import type { Resident } from '@/types/resident'
import MobileDashboardView from './components/MobileDashboardView'
import TabletDashboardView from './components/TabletDashboardView'
import ResidentQuickDrawer from '@/features/residents/components/ResidentQuickDrawer'
import PageTransition from '@/components/ui/PageTransition'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES: DayOfWeek[] = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const KEY_ALLERGIES = ['Gluten-Free','Dairy-Free','Nut Allergy','Egg Allergy','Shellfish','Soy-Free','Vegan','Vegetarian','Kosher','Halal']

function MetricCard({
  label,
  value,
  sub,
  iconBg,
  icon,
  to,
  alertType,
}: {
  label: string
  value: string | number
  sub?: string
  iconBg: string
  icon: React.ReactNode
  to?: string
  alertType?: 'danger' | 'warning'
}) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => to && navigate(to)}
      role={to ? 'link' : undefined}
      className={`group p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center gap-3.5 shadow-xs hover:shadow-md ${
        alertType === 'danger'
          ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/60 hover:border-rose-400'
          : alertType === 'warning'
          ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/60 hover:border-amber-400'
          : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200/80 dark:border-slate-800/80 hover:border-teal-500/40'
      }`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono truncate">
          {label}
        </div>
        <div className="text-2xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
          {value}
        </div>
        {sub && (
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}

function PrepPill({
  label,
  count,
  bgClass,
  textClass,
  borderClass,
  onClick,
}: {
  label: string
  count: number
  bgClass: string
  textClass: string
  borderClass: string
  onClick?: () => void
}) {
  if (count === 0) return null
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-[0.97] ${bgClass} ${textClass} ${borderClass} hover:opacity-90 shadow-xs`}
    >
      <span className="font-mono text-sm font-black">{count}</span>
      <span>{label}</span>
    </button>
  )
}

function SectionCard({
  title,
  children,
  action,
  icon,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <AppleCard className="p-0 overflow-hidden border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xs">
      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white font-sans flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </AppleCard>
  )
}

function QuickLink({
  to,
  label,
  desc,
  iconColor,
  icon,
  badge,
}: {
  to: string
  label: string
  desc: string
  iconColor: string
  icon: React.ReactNode
  badge?: number
}) {
  return (
    <Link
      to={to}
      className="group p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:shadow-md hover:border-teal-500/40 transition-all duration-200 flex items-center gap-3.5 no-underline active:scale-[0.98]"
    >
      <div className={`w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center shrink-0 relative shadow-xs`}>
        {icon}
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black font-mono rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-xs animate-pulse">
            {badge}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-slate-900 dark:text-white font-sans group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors truncate">
          {label}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {desc}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all shrink-0" />
    </Link>
  )
}

function MealColumn({
  mealLabel,
  opt1Names,
  opt2Names,
}: {
  mealLabel: string
  opt1Names: string[]
  opt2Names: string[]
}) {
  return (
    <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-850/70 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
        {mealLabel} Service
      </div>
      {[{ label: 'Option 1', names: opt1Names }, { label: 'Option 2', names: opt2Names }].map(
        ({ label, names }) => (
          <div key={label} className="space-y-1">
            <div className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider font-mono">
              {label}
            </div>
            {names.length ? (
              <ul className="space-y-1">
                {names.map(n => (
                  <li
                    key={n}
                    className="text-xs text-slate-800 dark:text-slate-200 font-medium flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-slate-400 italic">None planned</span>
            )}
          </div>
        )
      )}
    </div>
  )
}

function BudgetStrip() {
  const fetch = useBudgetStore(s => s.fetch)
  const period = useBudgetStore(s => s.period)
  const getTotalBudget = useBudgetStore(s => s.getTotalBudget)
  const getTotalSpent = useBudgetStore(s => s.getTotalSpent)
  const getProjected = useBudgetStore(s => s.getProjected)

  useEffect(() => {
    fetch()
  }, [fetch])

  const totalBudget = getTotalBudget()
  const totalSpent = getTotalSpent()
  const projected = getProjected()
  const pct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0
  const isHigh = pct > 90
  const isWarn = pct > 75
  const barColor = isHigh ? 'bg-rose-500' : isWarn ? 'bg-amber-500' : 'bg-emerald-500'
  const textColor = isHigh
    ? 'text-rose-600 dark:text-rose-400'
    : isWarn
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400'
  const fmt = (n: number) => `$${n.toFixed(2)}`

  return (
    <Link to="/reporting" className="block mb-4 group text-inherit no-underline">
      <AppleCard className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 hover:border-teal-500/40 transition-all duration-200 shadow-xs hover:shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900 dark:text-white font-sans">
              {period.label} Dietary Operating Budget
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                isHigh
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                  : isWarn
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}
            >
              {pct.toFixed(1)}% used
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400 flex-wrap">
            <span>
              Spent: <strong className="text-slate-900 dark:text-white font-mono">{fmt(totalSpent)}</strong>
            </span>
            <span>
              Budget: <strong className="text-slate-900 dark:text-white font-mono">{fmt(totalBudget)}</strong>
            </span>
            <span>
              Projected: <strong className={`font-mono ${textColor}`}>{fmt(projected)}</strong>
            </span>
          </div>
        </div>
        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/60 dark:border-slate-700/60">
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </AppleCard>
    </Link>
  )
}

export default function DashboardPage() {
  const { user, atLeast } = useAuth()
  const { residents, loading, fetch } = useResidentsStore()
  const { weeks, items, fetchWeeks, fetchItems } = useMenuStore()
  const { threads, fetch: fetchThreads } = useCommunicationsStore()
  const { sheets, fetchSheets } = useProductionStore()
  const { fetch: fetchInventory, getLowParItems, getZeroItems } = useInventoryStore()

  const budgetFetch = useBudgetStore(s => s.fetch)
  const period = useBudgetStore(s => s.period)
  const getTotalBudget = useBudgetStore(s => s.getTotalBudget)
  const getTotalSpent = useBudgetStore(s => s.getTotalSpent)
  const getDailyPerRes = useBudgetStore(s => s.getDailyPerRes)

  const [selectedResident, setSelectedResident] = useState<Resident | null>(null)

  useEffect(() => { fetch() }, [])
  useEffect(() => { fetchWeeks() }, [])
  useEffect(() => { fetchItems() }, [])
  useEffect(() => { fetchThreads() }, [])
  useEffect(() => { fetchSheets() }, [])
  useEffect(() => { fetchInventory() }, [])
  useEffect(() => { budgetFetch() }, [budgetFetch])

  const totalBudget = getTotalBudget()
  const totalSpent = getTotalSpent()
  const dailyPerRes = getDailyPerRes()
  const budgetPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  const lowParItems = getLowParItems()
  const zeroItems = getZeroItems()

  const active = useMemo(() => residents.filter(r => r.status === 'Active'), [residents])
  const hospital = useMemo(() => residents.filter(r => r.status === 'Hospital').length, [residents])
  const loa = useMemo(() => residents.filter(r => r.status === 'LOA').length, [residents])
  const totalEnsure = useMemo(() => residents.reduce((s, r) => s + (r.ensurePerDay ?? 0), 0), [residents])
  const roomTrays = useMemo(() => residents.filter(r => r.status === 'Active' && r.servingLocation === 'Room').length, [residents])
  const diningRoom = useMemo(() => residents.filter(r => r.status === 'Active' && r.servingLocation !== 'Room').length, [residents])

  const cutUp = useMemo(() => residents.filter(r => r.status === 'Active' && r.texture === 'Cut-Up').length, [residents])
  const minced = useMemo(() => residents.filter(r => r.status === 'Active' && (r.texture === 'Minced' || r.texture === 'Minced & Moist')).length, [residents])
  const pureed = useMemo(() => residents.filter(r => r.status === 'Active' && r.texture === 'Pureed').length, [residents])

  const keyAllergyCount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const allergy of KEY_ALLERGIES) {
      const c = residents.filter(r => r.status === 'Active' && r.allergies?.includes(allergy)).length
      if (c > 0) counts[allergy] = c
    }
    return counts
  }, [residents])

  const upcomingBirthdays = useMemo(() => {
    const today = new Date()
    const results: { resident: Resident; name: string; room: string; monthDay: string; daysUntil: number }[] = []
    residents.forEach(r => {
      if (!r.birthdayMonth || !r.birthdayDay) return
      const monthIdx = MONTH_NAMES.indexOf(r.birthdayMonth)
      if (monthIdx === -1) return
      const bday = new Date(today.getFullYear(), monthIdx, r.birthdayDay)
      if (bday < new Date(today.getFullYear(), today.getMonth(), today.getDate())) bday.setFullYear(today.getFullYear() + 1)
      const diff = Math.round((bday.getTime() - today.getTime()) / 86400000)
      if (diff <= 30) results.push({ resident: r, name: r.name, room: r.room, monthDay: `${r.birthdayMonth.slice(0, 3)} ${r.birthdayDay}`, daysUntil: diff })
    })
    return results.sort((a, b) => a.daysUntil - b.daysUntil)
  }, [residents])

  const todayDay = DAY_NAMES[new Date().getDay()]
  const activeWeek = useMemo(() => weeks.find(w => w.active) ?? weeks[0] ?? null, [weeks])
  const todayMenu = useMemo(() => activeWeek?.days?.[todayDay] ?? null, [activeWeek, todayDay])
  const itemMap = useMemo(() => Object.fromEntries(items.map(i => [i.id, i.name])), [items])

  function resolveNames(ids: string[] = []) {
    return ids.map(id => itemMap[id] ?? id).filter(Boolean)
  }

  const lunchOpt1 = todayMenu ? resolveNames([...(todayMenu.lunchOpt1Meat?.itemIds ?? []), ...(todayMenu.lunchOpt1Veggie?.itemIds ?? []), ...(todayMenu.lunchOpt1Starch?.itemIds ?? [])]) : []
  const lunchOpt2 = todayMenu ? resolveNames([...(todayMenu.lunchOpt2Meat?.itemIds ?? []), ...(todayMenu.lunchOpt2Veggie?.itemIds ?? []), ...(todayMenu.lunchOpt2Starch?.itemIds ?? [])]) : []
  const dinnerOpt1 = todayMenu ? resolveNames([...(todayMenu.dinnerOpt1Meat?.itemIds ?? []), ...(todayMenu.dinnerOpt1Veggie?.itemIds ?? []), ...(todayMenu.dinnerOpt1Starch?.itemIds ?? [])]) : []
  const dinnerOpt2 = todayMenu ? resolveNames([...(todayMenu.dinnerOpt2Meat?.itemIds ?? []), ...(todayMenu.dinnerOpt2Veggie?.itemIds ?? []), ...(todayMenu.dinnerOpt2Starch?.itemIds ?? [])]) : []
  const lunchDessert = todayMenu ? resolveNames(todayMenu.lunchDessert?.itemIds ?? []).join(', ') : ''
  const dinnerDessert = todayMenu ? resolveNames(todayMenu.dinnerDessert?.itemIds ?? []).join(', ') : ''

  const pendingApprovals = useMemo(() => threads.filter(t => t.status === 'Pending Review').length, [threads])
  const unreadThreads = useMemo(() => threads.filter(t => t.status === 'Draft' || t.status === 'Pending Review').length, [threads])
  const completedSheets = useMemo(() => sheets.filter(s => !!s.signedOffAt).length, [sheets])
  const totalSheets = sheets.length
  const prodPct = totalSheets > 0 ? Math.round((completedSheets / totalSheets) * 100) : 0

  const hasAnyPrep = cutUp > 0 || minced > 0 || pureed > 0 || Object.keys(keyAllergyCount).length > 0
  const todayStr = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const isManager = atLeast('manager')
  const { isMobile, isTablet } = useDevice()

  const dashboardProps = {
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
    lunchDessert,
    dinnerDessert,
    pendingApprovals,
    unreadThreads,
    completedSheets,
    totalSheets,
    prodPct,
    lowParItems,
    zeroItems,
    totalBudget,
    totalSpent,
    dailyPerRes,
    budgetPct,
    period,
    isManager,
    user,
  }

  if (isMobile) {
    return <MobileDashboardView {...dashboardProps} />
  }

  if (isTablet) {
    return <TabletDashboardView {...dashboardProps} />
  }

  return (
    <PageTransition className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 py-2">
      {/* ── Page Header Card ── */}
      <AppleCard className="p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
                {getGreeting()}, {user?.name?.split(' ')[0] ?? 'there'}
              </h1>
              <AppleBadge color="green" dot className="text-xs">
                {loading ? '…' : active.length} Active Residents
              </AppleBadge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{todayStr} &bull; Clinical Nutrition &amp; Production Command Center</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <Link to="/kitchen/orders">
              <AppleButton variant="primary" size="md" icon={<Utensils className="w-4 h-4" />}>
                Meal Tally Entry
              </AppleButton>
            </Link>
          </div>
        </div>
      </AppleCard>

      {/* ── Precision Command Surface (Unified Grid, Zero Clutter) ── */}
      <div className="border border-slate-200/90 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-2xs divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-slate-800 grid grid-cols-1 sm:grid-cols-3">
        <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">PROCUREMENT MATRIX</div>
            <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">Multi-Distributor Split MRP</div>
            <div className="text-[11px] text-slate-500">Dennis vs. Sysco $/lb optimizer</div>
          </div>
          <Link to="/purchasing">
            <AppleButton size="sm" variant="primary">Optimize PO</AppleButton>
          </Link>
        </div>

        <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">SURVEY READINESS</div>
            <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">CMS-2567 Defense Binder</div>
            <div className="text-[11px] text-slate-500">90-Day HACCP &amp; F-Tag audit logs</div>
          </div>
          <Link to="/reporting">
            <AppleButton size="sm" variant="tinted">Survey Pack</AppleButton>
          </Link>
        </div>

        <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">VENDOR PORTAL</div>
            <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">Distributor SKU Matcher</div>
            <div className="text-[11px] text-slate-500">Cut+Dry canonical pack converter</div>
          </div>
          <Link to="/distributor">
            <AppleButton size="sm" variant="tinted">Open Portal</AppleButton>
          </Link>
        </div>
      </div>

      {/* ── Row 1: Clinical Census Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Total Residents"
          value={loading ? '…' : residents.length}
          sub={`${active.length} active · ${hospital + loa} away`}
          iconBg="bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400"
          to="/residents"
          icon={<Users className="w-5 h-5" />}
        />
        <MetricCard
          label="Hosp / LOA"
          value={hospital + loa}
          sub={`${hospital} hosp · ${loa} LOA`}
          iconBg="bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
          to="/residents"
          alertType={hospital > 0 ? 'warning' : undefined}
          icon={<Clock className="w-5 h-5" />}
        />
        <MetricCard
          label="Ensure / Day"
          value={totalEnsure}
          sub="supplement cans"
          iconBg="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
          to="/residents"
          icon={<Heart className="w-5 h-5" />}
        />
        <MetricCard
          label="Room Trays"
          value={roomTrays}
          sub={`${diningRoom} in dining room`}
          iconBg="bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400"
          to="/residents"
          icon={<Utensils className="w-5 h-5" />}
        />
      </div>

      {/* ── Row 2: Operational & Budget Metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <MetricCard
          label="Inventory Alerts"
          value={lowParItems.length}
          sub={zeroItems.length > 0 ? `${zeroItems.length} at zero!` : 'items below par'}
          iconBg={lowParItems.length > 0 ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'}
          to="/inventory"
          alertType={zeroItems.length > 0 ? 'danger' : lowParItems.length > 3 ? 'warning' : undefined}
          icon={<Boxes className="w-5 h-5" />}
        />
        <MetricCard
          label="Pending Approvals"
          value={pendingApprovals}
          sub="awaiting review"
          iconBg={pendingApprovals > 0 ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'}
          to="/residents"
          alertType={pendingApprovals > 0 ? 'warning' : undefined}
          icon={<ClipboardList className="w-5 h-5" />}
        />
        <MetricCard
          label="Active Threads"
          value={unreadThreads}
          sub="unresolved shifts"
          iconBg={unreadThreads > 0 ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}
          to="/timecards"
          icon={<Clock className="w-5 h-5" />}
        />
        <MetricCard
          label="Production Sheets"
          value={`${prodPct}%`}
          sub={`${completedSheets}/${totalSheets} signed`}
          iconBg={prodPct === 100 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400'}
          to="/production"
          icon={<ChefHat className="w-5 h-5" />}
        />
        {isManager && (
          <>
            <MetricCard
              label="Budget (MTD)"
              value={`${budgetPct.toFixed(0)}%`}
              sub={`$${totalSpent.toFixed(0)} of $${totalBudget.toFixed(0)}`}
              iconBg="bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400"
              to="/reporting"
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <MetricCard
              label="$/Resident/Day"
              value={`$${dailyPerRes.toFixed(2)}`}
              sub={`Target $${period.budgetPerResidentPerDay.toFixed(2)}`}
              iconBg="bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400"
              to="/reporting"
              icon={<Store className="w-5 h-5" />}
            />
          </>
        )}
      </div>

      {/* ── Budget strip (managers only) ── */}
      {isManager && <BudgetStrip />}

      {/* ── Inventory Alerts Callout Banner ── */}
      {lowParItems.length > 0 && (
        <Link to="/inventory" className="block text-inherit no-underline">
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all ${zeroItems.length > 0 ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/60 text-rose-900 dark:text-rose-200' : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'}`}>
            <div className="flex items-center gap-2.5">
              {zeroItems.length > 0 ? (
                <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              )}
              <span className="text-xs font-bold leading-snug">
                {zeroItems.length > 0 ? `${zeroItems.length} item(s) completely out of stock! ` : ''}
                {lowParItems.length} item(s) below par level:
                {' '}{lowParItems.slice(0, 4).map(i => i.item).join(', ')}
                {lowParItems.length > 4 ? ` +${lowParItems.length - 4} more` : ''}
              </span>
            </div>
            <span className="text-xs font-bold text-teal-700 dark:text-teal-400 whitespace-nowrap flex items-center gap-1">
              View Inventory <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>
      )}

      {/* ── Special Prep Today Card ── */}
      {hasAnyPrep && (
        <SectionCard
          title="Special Prep & Dysphagia Today"
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          action={
            <Link to="/residents" className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline">
              View Census →
            </Link>
          }
        >
          <div className="flex flex-wrap gap-2">
            <PrepPill
              label="Cut-Up"
              count={cutUp}
              bgClass="bg-sky-50 dark:bg-sky-950/50"
              textClass="text-sky-800 dark:text-sky-300"
              borderClass="border-sky-300 dark:border-sky-800"
            />
            <PrepPill
              label="Minced & Moist"
              count={minced}
              bgClass="bg-amber-50 dark:bg-amber-950/50"
              textClass="text-amber-800 dark:text-amber-300"
              borderClass="border-amber-300 dark:border-amber-800"
            />
            <PrepPill
              label="Puréed (L4)"
              count={pureed}
              bgClass="bg-emerald-50 dark:bg-emerald-950/50"
              textClass="text-emerald-800 dark:text-emerald-300"
              borderClass="border-emerald-300 dark:border-emerald-800"
            />
            {Object.entries(keyAllergyCount)
              .sort((a, b) => b[1] - a[1])
              .map(([allergy, count]) => (
                <PrepPill
                  key={allergy}
                  label={allergy}
                  count={count}
                  bgClass="bg-rose-50 dark:bg-rose-950/50"
                  textClass="text-rose-800 dark:text-rose-300"
                  borderClass="border-rose-300 dark:border-rose-800"
                />
              ))}
          </div>
        </SectionCard>
      )}

      {/* ── Today's Menu Card ── */}
      <SectionCard
        title={`Today's Cycle Menu — ${todayDay}`}
        icon={<Utensils className="w-4 h-4 text-teal-600" />}
        action={
          <Link to="/menu" className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline">
            Edit Menu Planner →
          </Link>
        }
      >
        {!activeWeek ? (
          <p className="text-xs text-slate-500 italic">No active menu week configured.</p>
        ) : !todayMenu ? (
          <p className="text-xs text-slate-500 italic">No menu entries for {todayDay} yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <MealColumn mealLabel="Lunch" opt1Names={lunchOpt1} opt2Names={lunchOpt2} />
            <MealColumn mealLabel="Dinner" opt1Names={dinnerOpt1} opt2Names={dinnerOpt2} />
          </div>
        )}
        {(lunchDessert || dinnerDessert) && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center gap-4 flex-wrap text-xs text-slate-700 dark:text-slate-300 font-medium">
            {lunchDessert && (
              <span>
                <strong>Lunch Dessert:</strong> {lunchDessert}
              </span>
            )}
            {dinnerDessert && (
              <span>
                <strong>Dinner Dessert:</strong> {dinnerDessert}
              </span>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Three-Column Operations Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upcoming Birthdays Card */}
        <SectionCard
          title="Upcoming Birthdays"
          icon={<Calendar className="w-4 h-4 text-teal-600" />}
          action={
            upcomingBirthdays.length > 3 ? (
              <Link to="/residents" className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline">
                See all →
              </Link>
            ) : undefined
          }
        >
          {upcomingBirthdays.length === 0 ? (
            <p className="text-xs text-slate-400 italic">None in the next 30 days.</p>
          ) : (
            <div className="space-y-2">
              {upcomingBirthdays.slice(0, 4).map((b, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedResident(b.resident)}
                  className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 hover:border-teal-500/40 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-600 flex items-center justify-center font-bold text-xs shrink-0">
                      {b.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {b.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        Room {b.room} &bull; {b.monthDay}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono shrink-0 ${
                      b.daysUntil === 0
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : b.daysUntil <= 7
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {b.daysUntil === 0 ? 'Today!' : `${b.daysUntil}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Active Dietary Breakdown Card */}
        <SectionCard
          title="Active Dietary Breakdown"
          icon={<Heart className="w-4 h-4 text-teal-600" />}
        >
          {loading ? (
            <p className="text-xs text-slate-400 italic">Loading…</p>
          ) : (
            <div className="space-y-2.5">
              {[
                { label: 'Regular', count: active.filter(r => r.dietType === 'Regular').length, color: 'bg-teal-500' },
                { label: 'Diabetic', count: active.filter(r => r.dietType === 'Diabetic').length, color: 'bg-amber-500' },
                { label: 'Cardiac', count: active.filter(r => r.dietType === 'Cardiac').length, color: 'bg-rose-500' },
                { label: 'Low Sodium', count: active.filter(r => r.dietType === 'Low Sodium').length, color: 'bg-sky-500' },
                { label: 'Renal', count: active.filter(r => r.dietType === 'Renal').length, color: 'bg-purple-500' },
                { label: 'Mechanical Soft', count: active.filter(r => r.dietType === 'Mechanical Soft').length, color: 'bg-emerald-500' },
              ]
                .filter(d => d.count > 0)
                .map(d => (
                  <div key={d.label} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-600 dark:text-slate-300">{d.label}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{d.count}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${d.color} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.round((d.count / (active.length || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </SectionCard>

        {/* Production Status Card */}
        <SectionCard
          title="Production Status"
          icon={<ChefHat className="w-4 h-4 text-teal-600" />}
          action={
            <Link to="/production" className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline">
              Open →
            </Link>
          }
        >
          {totalSheets === 0 ? (
            <p className="text-xs text-slate-400 italic">No production sheets loaded for today.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600 dark:text-slate-400">Sheet Sign-Offs:</span>
                <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{prodPct}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/60 dark:border-slate-700/60">
                <div
                  className={`h-full ${prodPct === 100 ? 'bg-emerald-500' : 'bg-teal-500'} rounded-full transition-all duration-500`}
                  style={{ width: `${prodPct}%` }}
                />
              </div>
              <div className="text-xs text-slate-500">
                {completedSheets} of {totalSheets} daily sheets signed off
              </div>
              {prodPct === 100 && (
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>All sheets complete!</span>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Quick Access Hub ── */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
          Quick Access Operations Hub
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickLink
            to="/residents"
            label="Residents & Diets"
            desc="Diet orders, textures & EMR charts"
            iconColor="bg-teal-50 dark:bg-teal-950 text-teal-600"
            icon={<Users className="w-5 h-5" />}
          />
          <QuickLink
            to="/menu"
            label="Menu Planner"
            desc="Plan 4-week seasonal cycle menus"
            iconColor="bg-sky-50 dark:bg-sky-950 text-sky-600"
            icon={<Calendar className="w-5 h-5" />}
          />
          <QuickLink
            to="/production"
            label="Production Sheets"
            desc="Station scaling & HACCP temp logs"
            iconColor="bg-emerald-50 dark:bg-emerald-950 text-emerald-600"
            icon={<ChefHat className="w-5 h-5" />}
          />
          <QuickLink
            to="/inventory"
            label="Inventory & Stock"
            desc="Par levels, stock counts & MRP"
            iconColor="bg-amber-50 dark:bg-amber-950 text-amber-600"
            icon={<Boxes className="w-5 h-5" />}
            badge={lowParItems.length}
          />
          <QuickLink
            to="/recipes"
            label="Master Recipe Book"
            desc="Yield scaler & USDA solver"
            iconColor="bg-purple-50 dark:bg-purple-950 text-purple-600"
            icon={<Utensils className="w-5 h-5" />}
          />
          {isManager && (
            <>
              <QuickLink
                to="/reporting"
                label="Budget & $/CPD"
                desc="Per-resident daily cost & audit binder"
                iconColor="bg-emerald-50 dark:bg-emerald-950 text-emerald-600"
                icon={<TrendingUp className="w-5 h-5" />}
              />
              <QuickLink
                to="/staff"
                label="Staff & Schedules"
                desc="Shift roster & credential check"
                iconColor="bg-violet-50 dark:bg-violet-950 text-violet-600"
                icon={<Clock className="w-5 h-5" />}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Slide-Out Quick Inspection Drawer ── */}
      <ResidentQuickDrawer
        resident={selectedResident}
        isOpen={Boolean(selectedResident)}
        onClose={() => setSelectedResident(null)}
      />
    </PageTransition>
  )
}
