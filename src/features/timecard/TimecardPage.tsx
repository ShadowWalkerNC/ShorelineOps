import { useEffect, useState, useMemo, useCallback } from 'react'
import { useTimecardStore } from '@/state/timecardStore'
import { useAuth } from '@/security/AuthContext'
import { AppleBadge, AppleButton, AppleCard, AppleSegmentedControl } from '@/apple-ui'
import {
  Clock,
  KeyRound,
  History,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  Search,
  Calendar,
  Sparkles,
  RefreshCw,
  LogOut,
  LogIn,
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────
function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const KIOSK_ID = 'Main Kitchen Kiosk 1'

// ─── Keypad ─────────────────────────────────────────────────
function Keypad({ onPress }: { onPress: (v: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {['1','2','3','4','5','6','7','8','9'].map(v => (
        <button
          key={v}
          onClick={() => onPress(v)}
          className="h-14 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-800 dark:text-slate-100 text-xl font-bold font-mono transition-all duration-150 border border-slate-200/50 dark:border-slate-700/50 shadow-xs"
        >
          {v}
        </button>
      ))}
      <button
        onClick={() => onPress('CLEAR')}
        className="h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 active:scale-95 text-rose-600 dark:text-rose-400 text-sm font-bold transition-all duration-150 border border-rose-200/60 dark:border-rose-800/60"
      >
        CLR
      </button>
      <button
        onClick={() => onPress('0')}
        className="h-14 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-800 dark:text-slate-100 text-xl font-bold font-mono transition-all duration-150 border border-slate-200/50 dark:border-slate-700/50 shadow-xs"
      >
        0
      </button>
      <button
        onClick={() => onPress('BACK')}
        className="h-14 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-600 dark:text-slate-400 text-base font-bold transition-all duration-150 border border-slate-200/50 dark:border-slate-700/50 shadow-xs flex items-center justify-center"
      >
        ⌫
      </button>
    </div>
  )
}

// ─── Kiosk Terminal Tab ─────────────────────────────────────
function KioskTab() {
  const punch       = useTimecardStore(s => s.punch)
  const isPunching  = useTimecardStore(s => s.isPunching)
  const punchSuccess = useTimecardStore(s => s.punchSuccess)
  const punchError  = useTimecardStore(s => s.punchError)
  const clearMessages = useTimecardStore(s => s.clearMessages)
  const getStatusForBadge = useTimecardStore(s => s.getStatusForBadge)
  const fetchAll    = useTimecardStore(s => s.fetchAll)

  const [badgeId, setBadgeId] = useState('')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    fetchAll()
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [fetchAll])

  const status = badgeId.length >= 3 ? getStatusForBadge(badgeId) : 'unknown'
  const nextAction: 'In' | 'Out' | null =
    badgeId.length < 3 ? null
    : status === 'in'  ? 'Out'
    : 'In'

  const handleKeypad = useCallback((v: string) => {
    clearMessages()
    if (v === 'CLEAR')    setBadgeId('')
    else if (v === 'BACK') setBadgeId(p => p.slice(0, -1))
    else if (badgeId.length < 10) setBadgeId(p => p + v)
  }, [badgeId, clearMessages])

  const handlePunch = () => punch(badgeId, KIOSK_ID)

  useEffect(() => {
    if (punchSuccess) {
      setBadgeId('')
      const t = setTimeout(() => clearMessages(), 4000)
      return () => clearTimeout(t)
    }
  }, [punchSuccess, clearMessages])

  return (
    <div className="flex justify-center py-2">
      <AppleCard className="w-full max-w-md p-6 border border-slate-200/80 dark:border-slate-800 rounded-3xl bg-white/90 dark:bg-slate-900/90 shadow-lg relative overflow-hidden backdrop-blur-xl">
        
        {/* Apple Watch style live clock */}
        <div className="text-center mb-6">
          <div className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-xs font-medium text-slate-400 mt-1">
            {now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-500 mt-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {KIOSK_ID} · Ready
          </div>
        </div>

        {/* Badge ID Input Display */}
        <div className="mb-3">
          <div className={`p-4 rounded-2xl text-center font-mono font-bold text-2xl tracking-widest transition-all duration-200 border-2 ${
            badgeId.length === 0
              ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400'
              : status === 'in'
              ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-700 dark:text-emerald-300'
              : 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-500 text-blue-700 dark:text-blue-300'
          }`}>
            {badgeId || 'ENTER BADGE'}
          </div>

          <div className="text-center text-xs font-semibold mt-2 min-h-5">
            {status === 'in' ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Currently Clocked IN · Press to Clock OUT
              </span>
            ) : status === 'out' ? (
              <span className="text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Currently Clocked OUT · Press to Clock IN
              </span>
            ) : badgeId.length >= 3 ? (
              <span className="text-slate-500">Ready for initial shift punch</span>
            ) : (
              <span className="text-slate-400">Enter your Employee ID or Badge #</span>
            )}
          </div>
        </div>

        {/* Message banner */}
        {(punchSuccess || punchError) && (
          <div className={`p-3.5 rounded-2xl text-xs font-semibold text-center mb-4 flex items-center justify-center gap-2 ${
            punchSuccess
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}>
            {punchSuccess ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{punchSuccess ?? punchError}</span>
          </div>
        )}

        {/* Keypad */}
        <div className="mb-5">
          <Keypad onPress={handleKeypad} />
        </div>

        {/* Punch Button */}
        <AppleButton
          size="lg"
          variant={nextAction === 'Out' ? 'destructive' : 'primary'}
          className="w-full text-base font-bold tracking-wide py-4 rounded-2xl shadow-md disabled:opacity-40"
          disabled={isPunching || badgeId.length < 3}
          onClick={handlePunch}
          icon={nextAction === 'Out' ? <LogOut className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
        >
          {isPunching ? 'Verifying Punch…' : nextAction === 'Out' ? 'CLOCK OUT' : 'CLOCK IN'}
        </AppleButton>

      </AppleCard>
    </div>
  )
}

// ─── Manager History Tab ─────────────────────────────────────
function HistoryTab() {
  const { atLeast } = useAuth()
  const fetchAll        = useTimecardStore(s => s.fetchAll)
  const punches         = useTimecardStore(s => s.punches)
  const isLoading       = useTimecardStore(s => s.isLoading)
  const error           = useTimecardStore(s => s.error)
  const getShiftSummaries = useTimecardStore(s => s.getShiftSummaries)

  const [view, setView] = useState<'summary' | 'detail'>('summary')
  const [filterBadge, setFilterBadge] = useState('')
  const [filterDays, setFilterDays]   = useState<7 | 14 | 30 | 0>(7)

  useEffect(() => { fetchAll() }, [fetchAll])

  const isManager = atLeast('manager')

  const cutoff = useMemo(() => {
    if (filterDays === 0) return null
    const d = new Date()
    d.setDate(d.getDate() - filterDays)
    return d
  }, [filterDays])

  const filteredPunches = useMemo(() => {
    return punches.filter(p => {
      const matchBadge = !filterBadge || p.badge_id.toLowerCase().includes(filterBadge.toLowerCase())
      const matchDate  = !cutoff || new Date(p.punched_at) >= cutoff
      return matchBadge && matchDate
    })
  }, [punches, filterBadge, cutoff])

  const summaries = useMemo(() => {
    const all = getShiftSummaries()
    return filterBadge ? all.filter(s => s.badgeId.toLowerCase().includes(filterBadge.toLowerCase())) : all
  }, [getShiftSummaries, filterBadge])

  // Aggregate stats
  const totalClockedIn = useMemo(() => summaries.filter(s => s.currentlyIn).length, [summaries])
  const totalHoursLogged = useMemo(() => {
    const totalMins = summaries.reduce((acc, s) => acc + s.totalMinutes, 0)
    return (totalMins / 60).toFixed(1)
  }, [summaries])
  const overtimeShifts = useMemo(() => summaries.filter(s => s.overtimeMinutes > 0).length, [summaries])

  return (
    <div className="space-y-5">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <AppleCard className="p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">On Shift Now</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-sans">{totalClockedIn}</div>
          <div className="text-xs text-slate-400 mt-0.5">Active badges clocked in</div>
        </AppleCard>

        <AppleCard className="p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">Total Hours</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-sans">{totalHoursLogged} hrs</div>
          <div className="text-xs text-slate-400 mt-0.5">Logged across {summaries.length} staff</div>
        </AppleCard>

        <AppleCard className="p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">Overtime Flags</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-sans">{overtimeShifts}</div>
          <div className="text-xs text-slate-400 mt-0.5">Shifts &gt; 8 hours / day</div>
        </AppleCard>

        <AppleCard className="p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">Total Punches</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600">
              <History className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-sans">{punches.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">Total recorded punches</div>
        </AppleCard>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Search badge ID…"
              value={filterBadge}
              onChange={e => setFilterBadge(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <select
            value={filterDays}
            onChange={e => setFilterDays(Number(e.target.value) as 7|14|30|0)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={0}>All time</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setView('summary')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                view === 'summary'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setView('detail')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                view === 'detail'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Punches
            </button>
          </div>

          <AppleButton
            size="sm"
            variant="secondary"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={() => fetchAll()}
          >
            Refresh
          </AppleButton>
        </div>
      </div>

      {error && (
        <AppleCard className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </AppleCard>
      )}

      {/* SUMMARY TABLE */}
      {view === 'summary' && (
        <AppleCard className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl">
          {summaries.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              {isLoading ? 'Loading records…' : 'No punch records found for this period.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Badge ID</th>
                    <th className="py-3 px-4">Live Status</th>
                    <th className="py-3 px-4">Shifts</th>
                    <th className="py-3 px-4">Total Time</th>
                    <th className="py-3 px-4">Overtime</th>
                    <th className="py-3 px-4">Last Punch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {summaries.map(s => (
                    <tr key={s.badgeId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        #{s.badgeId}
                      </td>
                      <td className="py-3 px-4">
                        <AppleBadge color={s.currentlyIn ? 'green' : 'gray'} dot={s.currentlyIn}>
                          {s.currentlyIn ? 'Clocked In' : 'Clocked Out'}
                        </AppleBadge>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">{s.shiftCount} shifts</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{fmtMins(s.totalMinutes)}</td>
                      <td className="py-3 px-4">
                        {s.overtimeMinutes > 0 ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            ⚠ {fmtMins(s.overtimeMinutes)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {s.lastPunchAt ? fmtDateTime(s.lastPunchAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AppleCard>
      )}

      {/* DETAIL TABLE */}
      {view === 'detail' && (
        <AppleCard className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl">
          {filteredPunches.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              {isLoading ? 'Loading records…' : 'No punch records match this filter.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Badge ID</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Kiosk / Location</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPunches.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        #{p.badge_id}
                      </td>
                      <td className="py-3 px-4">
                        <AppleBadge color={p.operation === 'In' ? 'blue' : 'orange'}>
                          {p.operation === 'In' ? 'CLOCK IN' : 'CLOCK OUT'}
                        </AppleBadge>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{p.kiosk_id}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-mono">
                        {fmtDateTime(p.punched_at)}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{p.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AppleCard>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────
export default function TimecardPage() {
  const [tab, setTab] = useState<'terminal' | 'history'>('terminal')

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-1 sm:px-4 py-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
              Time Clock & Shifts
            </h1>
            <AppleBadge color="blue">
              Digital Kiosk
            </AppleBadge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Institutional time & attendance badge punch station with biometric/PIN authentication.
          </p>
        </div>

        {/* Apple Segmented Switcher */}
        <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
          <button
            onClick={() => setTab('terminal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              tab === 'terminal'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Kiosk Terminal
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              tab === 'history'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Punch History
          </button>
        </div>
      </div>

      {tab === 'terminal' && <KioskTab />}
      {tab === 'history'  && <HistoryTab />}
    </div>
  )
}

