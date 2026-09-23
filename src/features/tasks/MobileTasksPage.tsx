import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/security/AuthContext'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import {
  CheckCircle2,
  Circle,
  Thermometer,
  Truck,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChefHat,
  Users,
  QrCode,
  FileCheck,
  ChevronRight,
  Flame,
  AlertOctagon,
  Sparkles,
} from 'lucide-react'

interface ShiftTask {
  id: string
  title: string
  subtitle: string
  category: 'clinical' | 'haccp' | 'dispatch' | 'sanitation'
  completed: boolean
  urgent?: boolean
  route?: string
}

const INITIAL_TASKS: ShiftTask[] = [
  {
    id: 't-1',
    title: 'HACCP 165°F Cook & Hold Temp Log',
    subtitle: 'Log internal temperature for noon batch protein prior to service',
    category: 'haccp',
    completed: false,
    route: '/kitchen/sheet',
  },
  {
    id: 't-2',
    title: 'Verify NPO Hard-Blocks & Active Allergies',
    subtitle: '3 residents marked NPO. Confirm tickets excluded from tray line',
    category: 'clinical',
    completed: false,
    urgent: true,
    route: '/residents',
  },
  {
    id: 't-3',
    title: 'Lunch Tray Cart Assembly & QR Scan',
    subtitle: 'Dispatch East Wing cart A (18 trays) within 30-min SLA',
    category: 'dispatch',
    completed: false,
    route: '/kitchen/dispatch',
  },
  {
    id: 't-4',
    title: 'Pureed & Minced IDDSI Texture Test',
    subtitle: 'Fork drip and spoon tilt test for Level 4 Pureed beef & potatoes',
    category: 'clinical',
    completed: false,
    route: '/production',
  },
  {
    id: 't-5',
    title: 'Walk-In Cooler & Freezer Temp Check',
    subtitle: 'Ensure walk-in <= 40°F, reach-in freezer <= 0°F',
    category: 'haccp',
    completed: false,
  },
  {
    id: 't-6',
    title: 'Dishmachine Sanitizer PPM Titration',
    subtitle: 'Verify rinse temperature >= 180°F or chemical chlorine >= 50 PPM',
    category: 'sanitation',
    completed: false,
  },
]

export default function MobileTasksPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<ShiftTask[]>(INITIAL_TASKS)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')

  const toggleTask = (id: string) => {
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }

  const completedCount = tasks.filter(t => t.completed).length
  const totalCount = tasks.length
  const pct = Math.round((completedCount / totalCount) * 100)

  const filteredTasks = tasks.filter(t => {
    if (filter === 'pending') return !t.completed
    if (filter === 'completed') return t.completed
    return true
  })

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-6 animate-fadeIn">
      {/* Shift Header & Progress */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-teal-600 to-emerald-700 text-white shadow-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-100">
            <Clock className="w-3.5 h-3.5" />
            <span>Today's Shift Tasks & Checklists</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-mono text-xs font-bold">
            {completedCount}/{totalCount} Done
          </span>
        </div>

        <h1 className='text-xl font-bold tracking-tight mb-2'>
          Shift Operations & Safety
        </h1>
        <p className='text-[11px] text-teal-100/90 mb-2'>
          Sample checklist — toggles are local and reset on reload; completion is not recorded.
        </p>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-medium text-teal-100">
            <span>{pct}% Shift Completion</span>
            <span>{totalCount - completedCount} Pending Steps</span>
          </div>
        </div>
      </div>

      {/* Quick Floor Action Strip */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => navigate('/kitchen/sheet')}
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3 shadow-xs hover:border-teal-500 transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 shrink-0">
            <Thermometer className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">Log Temp</div>
            <div className="text-[10px] text-slate-500">165°F HACCP</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/kitchen/dispatch')}
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3 shadow-xs hover:border-teal-500 transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">Dispatch Cart</div>
            <div className="text-[10px] text-slate-500">Tray Line Scan</div>
          </div>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800/70 p-1 rounded-2xl gap-1 text-xs font-semibold">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            filter === 'all'
              ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 font-bold shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          All ({totalCount})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            filter === 'pending'
              ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 font-bold shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Pending ({totalCount - completedCount})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            filter === 'completed'
              ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 font-bold shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Completed ({completedCount})
        </button>
      </div>

      {/* Task Checklist Items */}
      <div className="space-y-2.5">
        {filteredTasks.map(task => (
          <div
            key={task.id}
            className={`p-3.5 rounded-2xl border transition-all ${
              task.completed
                ? 'bg-slate-50/80 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/50 opacity-75'
                : task.urgent
                ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300/80 dark:border-rose-900/60 shadow-xs'
                : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-xs'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox Tap Target >= 44px */}
              <button
                onClick={() => toggleTask(task.id)}
                className="w-10 h-10 -ml-1 -mt-1 flex items-center justify-center shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
              >
                {task.completed ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950/50" />
                ) : (
                  <Circle className="w-6 h-6 text-slate-300 dark:text-slate-600 hover:text-teal-600" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs font-bold tracking-tight ${
                      task.completed
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {task.title}
                  </span>
                  {task.urgent && !task.completed && (
                    <span className="px-1.5 py-0.2 text-[10px] font-black uppercase tracking-wider rounded bg-rose-500 text-white animate-pulse">
                      Urgent Safety
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  {task.subtitle}
                </p>

                {task.route && (
                  <div className="mt-2 flex items-center">
                    <Link
                      to={task.route}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      <span>Open operational tool</span>
                      <ChevronRight size={12} />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
