import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/security/AuthContext'
import { useDevice } from '@/hooks/useDevice'
import {
  X,
  Boxes,
  ShoppingCart,
  Store,
  UserCheck,
  Clock,
  TrendingUp,
  Settings as SettingsIcon,
  Shield,
  FileText,
  LogOut,
  Smartphone,
  Tablet,
  Monitor,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  HeartPulse,
} from 'lucide-react'

interface MobileMoreSheetProps {
  isOpen: boolean
  onClose: () => void
}

export default function MobileMoreSheet({ isOpen, onClose }: MobileMoreSheetProps) {
  const { user, logout, atLeast } = useAuth()
  const { deviceMode, setDeviceMode } = useDevice()
  const navigate = useNavigate()

  if (!isOpen) return null

  const handleLogout = () => {
    logout()
    onClose()
    navigate('/login')
  }

  const roleDisplay = user?.role === 'admin'
    ? 'Director of Dietary'
    : user?.role === 'manager'
    ? 'Registered Dietitian (RD)'
    : user?.role === 'dietary'
    ? 'Dietary Specialist'
    : 'Clinical Staff'

  const secondaryLinks = [
    { label: 'Inventory & Par Levels', to: '/inventory', icon: Boxes, color: 'text-amber-500', minRole: undefined },
    { label: 'Purchasing & Split MRP', to: '/purchasing', icon: ShoppingCart, color: 'text-sky-500', minRole: 'dietary' as const },
    { label: 'Distributor Portal', to: '/distributor', icon: Store, color: 'text-purple-500', minRole: 'dietary' as const },
    { label: 'CMS-2567 & $/CPD Reports', to: '/reporting', icon: TrendingUp, color: 'text-emerald-500', minRole: 'dietary' as const },
    { label: 'Staff Roster & Scheduling', to: '/staff', icon: UserCheck, color: 'text-blue-500', minRole: 'manager' as const },
    { label: 'Staff Timecards', to: '/timecards', icon: Clock, color: 'text-slate-500', minRole: undefined },
    { label: 'Facility Profile & Wings', to: '/settings', icon: SettingsIcon, color: 'text-teal-500', minRole: undefined },
    { label: 'System Admin & Security', to: '/admin', icon: Shield, color: 'text-red-500', minRole: 'admin' as const },
    { label: 'HIPAA Security & BAA', to: '/legal', icon: FileText, color: 'text-slate-400', minRole: undefined },
  ]

  const accessibleLinks = secondaryLinks.filter(item => !item.minRole || atLeast(item.minRole))

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop tap dismiss */}
      <div className="flex-1" onClick={onClose} />

      {/* Sheet Content with Safe Area Bottom */}
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 p-5 shadow-2xl max-h-[85vh] flex flex-col animate-slideUp">
        {/* Grab Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 shrink-0" />

        {/* Sheet Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
              {user?.name?.charAt(0).toUpperCase() || 'C'}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {user?.name || 'Clinician'}
              </div>
              <div className="text-[11px] text-teal-600 dark:text-teal-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>{roleDisplay}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Nav Grid */}
        <div className="overflow-y-auto py-3 space-y-4 flex-1">
          {/* Secondary Operational Modules */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-2 px-1">
              Management & Operations
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {accessibleLinks.map(link => {
                const Icon = link.icon
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center justify-between p-3 rounded-2xl transition-colors ${
                        isActive
                          ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 font-bold border border-teal-200/60 dark:border-teal-800/60'
                          : 'bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl bg-white dark:bg-slate-800 shadow-2xs flex items-center justify-center ${link.color}`}>
                        <Icon size={18} />
                      </div>
                      <span className="text-xs font-semibold">{link.label}</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400" />
                  </NavLink>
                )
              })}
            </div>
          </div>

          {/* Device Experience Simulator (DEV mode only) */}
          {import.meta.env.DEV && (
            <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono mb-2 flex items-center justify-between">
                <span>Device View Preview</span>
                <span className="text-teal-600 dark:text-teal-400 font-bold">{deviceMode.toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-[11px] font-semibold">
                <button
                  onClick={() => setDeviceMode('auto')}
                  className={`py-2 px-1.5 rounded-xl border text-center transition-all ${
                    deviceMode === 'auto'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Auto
                </button>
                <button
                  onClick={() => setDeviceMode('mobile')}
                  className={`py-2 px-1.5 rounded-xl border flex items-center justify-center gap-1 transition-all ${
                    deviceMode === 'mobile'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Smartphone size={13} />
                  <span>Mobile</span>
                </button>
                <button
                  onClick={() => setDeviceMode('tablet')}
                  className={`py-2 px-1.5 rounded-xl border flex items-center justify-center gap-1 transition-all ${
                    deviceMode === 'tablet'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Tablet size={13} />
                  <span>Tablet</span>
                </button>
                <button
                  onClick={() => setDeviceMode('desktop')}
                  className={`py-2 px-1.5 rounded-xl border flex items-center justify-center gap-1 transition-all ${
                    deviceMode === 'desktop'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Monitor size={13} />
                  <span>Desk</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sheet Footer: End Clinician Session */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 pb-[env(safe-area-inset-bottom)] shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold transition-colors"
          >
            <LogOut size={15} />
            <span>End Clinician Session</span>
          </button>
        </div>
      </div>
    </div>
  )
}
