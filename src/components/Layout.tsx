import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../security/AuthContext'
import { LicenseManager } from '../security/license'
import NotificationBell from './NotificationBell'
import { AppleBadge, AppleButton } from '@/apple-ui'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Tablet,
  Calendar,
  ChefHat,
  Receipt,
  BookOpen,
  ClipboardList,
  CheckSquare,
  ShoppingCart,
  Truck,
  TrendingUp,
  Boxes,
  DollarSign,
  UserCheck,
  Clock,
  Shield,
  FileText,
  LogOut,
  Menu as MenuIcon,
  X as CloseIcon,
  Search,
  CheckCircle2,
  Settings as SettingsIcon,
  Building2,
  Activity,
  HeartPulse,
  Stethoscope,
  ShieldCheck,
  Lock,
  Sparkles,
  Download,
  type LucideIcon,
} from 'lucide-react'

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

interface NavItemDef {
  label: string
  to: string
  color: string
  icon: LucideIcon
  end?: boolean
  minRole?: 'dietary' | 'manager'
  badge?: string
}

interface NavSection {
  title: string
  items: NavItemDef[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Clinical & Resident EMR',
    items: [
      { label: 'Clinical Dashboard', to: '/', color: '#0d9488', icon: LayoutDashboard, end: true },
      { label: 'Resident Census & Diets', to: '/residents', color: '#0284c7', icon: Users, badge: '60 Beds' },
      { label: 'Clinical Triage & Comms', to: '/communications', color: '#8b5cf6', icon: MessageSquare },
    ],
  },
  {
    title: 'IDDSI 2.0 & Kitchen Production',
    items: [
      { label: 'Kitchen Tablet Kiosk', to: '/kitchen/tablet', color: '#ef4444', icon: Tablet, minRole: 'dietary', badge: 'Touch' },
      { label: 'Seasonal Cycle Planner', to: '/menu', color: '#f59e0b', icon: Calendar, minRole: 'dietary', end: true },
      { label: 'Daily Cook Worksheet', to: '/kitchen/sheet', color: '#f59e0b', icon: ChefHat, minRole: 'dietary' },
      { label: '4x6 Tray Cards & Tickets', to: '/kitchen/traycards', color: '#ec4899', icon: Receipt, minRole: 'dietary' },
      { label: 'Standardized Recipes', to: '/recipes', color: '#6366f1', icon: BookOpen },
      { label: 'Batch Cook Production', to: '/production', color: '#14b8a6', icon: ClipboardList },
      { label: 'Meal Selection Tally', to: '/kitchen/orders', color: '#06b6d4', icon: CheckSquare, minRole: 'dietary' },
    ],
  },
  {
    title: 'Supply Chain & Split MRP',
    items: [
      { label: 'Purchasing & Split Orders', to: '/purchasing', color: '#0284c7', icon: ShoppingCart, minRole: 'dietary' },
      { label: 'Distributor Portal (Dennis/Sysco)', to: '/distributor', color: '#8b5cf6', icon: Truck },
      { label: 'CMS-2567 & $/CPD Auditing', to: '/reporting', color: '#10b981', icon: TrendingUp, minRole: 'dietary' },
      { label: 'Inventory & Par Levels', to: '/inventory', color: '#f59e0b', icon: Boxes },
      { label: 'Department Budget & Spend', to: '/budget', color: '#6366f1', icon: DollarSign, minRole: 'manager' },
    ],
  },
  {
    title: 'Facility & Governance',
    items: [
      { label: 'Facility Profile & Wings', to: '/settings', color: '#0f766e', icon: SettingsIcon },
      { label: 'Corporate HQ Multi-Site', to: '/enterprise', color: '#8b5cf6', icon: Building2, minRole: 'manager' },
      { label: 'Clinical Staff Roster', to: '/staff', color: '#0284c7', icon: UserCheck, minRole: 'manager' },
      { label: 'Staff Timecard Clock', to: '/timecards', color: '#64748b', icon: Clock },
    ],
  },
]

const NAV_ADMIN: NavItemDef = {
  label: 'System Admin & HealerBot',
  to: '/admin',
  color: '#ef4444',
  icon: Shield,
}

const NAV_LEGAL: NavItemDef = {
  label: 'HIPAA Security & BAA',
  to: '/legal',
  color: '#64748b',
  icon: FileText,
}

function NavItem({ to, color, label, icon: Icon, end: endProp, badge, onClick }: { to: string; color: string; label: string; icon: LucideIcon; end?: boolean; badge?: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={endProp !== undefined ? endProp : to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 group ${
          isActive
            ? 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold border border-teal-500/30 shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${
              isActive ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 dark:text-slate-400'
            }`}
            style={!isActive ? { color } : undefined}
          >
            <Icon size={14} />
          </div>
          <span className="flex-1 truncate tracking-tight">{label}</span>
          {badge && !isActive && (
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
              {badge}
            </span>
          )}
          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 shadow-xs" />}
        </>
      )}
    </NavLink>
  )
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, atLeast } = useAuth()
  const license = LicenseManager.getLicense()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const now = useClock()

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const roleDisplay = user?.role === 'admin'
    ? 'Director of Dietary'
    : user?.role === 'manager'
    ? 'Registered Dietitian (RD)'
    : user?.role === 'dietary'
    ? 'Dietary Specialist'
    : 'Clinical Staff'

  const isAdmin = user?.role === 'admin'

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-slate-100 overflow-hidden">
      
      {/* MOBILE TOP BAR */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {mobileOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
          </button>
          <img src="/logo.png" alt="Shoreline Care OS" className="h-7 w-auto object-contain" />
        </div>

        <div className="flex items-center gap-2">
          <AppleBadge color="green" dot>
            Clinical
          </AppleBadge>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex">
          <div className="w-72 bg-white dark:bg-slate-900 h-full flex flex-col p-4 shadow-2xl border-r border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-3">
              <img src="/logo.png" alt="Shoreline Care OS" className="h-8 w-auto object-contain" />
              <button onClick={() => setMobileOpen(false)} className="text-slate-400 p-1">
                <CloseIcon size={18} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto space-y-4 pr-1">
              {NAV_SECTIONS.map((section, sIdx) => (
                <div key={sIdx} className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 font-mono">
                    {section.title}
                  </div>
                  {section.items.map(item => (
                    <NavItem key={item.to} {...item} onClick={() => setMobileOpen(false)} />
                  ))}
                </div>
              ))}
            </nav>
          </div>
          <div className="flex-1" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* DESKTOP CLINICAL SIDEBAR */}
      <aside className="hidden md:flex w-64 h-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-r border-slate-200/80 dark:border-slate-800/80 flex-col shrink-0 z-30">
        
        {/* Medical Brand & Clinical Facility Header */}
        <div className="p-4 border-b border-slate-200/70 dark:border-slate-800/70 space-y-2">
          <div className="flex items-center justify-between">
            <img src="/logo.png" alt="Shoreline Care OS" className="h-8 w-auto object-contain" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/80 px-2 py-0.5 rounded-md border border-teal-200/60 dark:border-teal-800/60 font-mono">
              v5.0
            </span>
          </div>

          {/* Facility Location Ribbon */}
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-bold truncate">Shoreline Care Center</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">60 Beds</span>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {NAV_SECTIONS.map((section, sIdx) => {
            const items = section.items.filter(item => !item.minRole || atLeast(item.minRole))
            if (items.length === 0) return null
            return (
              <div key={sIdx} className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 font-mono">
                  {section.title}
                </div>
                {items.map(item => (
                  <NavItem key={item.to} {...item} />
                ))}
              </div>
            )
          })}

          {isAdmin && (
            <div className="space-y-0.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 font-mono">System &amp; Safety</div>
              <NavItem {...NAV_ADMIN} />
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <NavItem {...NAV_LEGAL} />
          </div>
        </nav>

        {/* User Credential & Clinician Session Footer */}
        <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/70 space-y-2 bg-slate-50/50 dark:bg-slate-900/50">
          {user && (
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name}</div>
                <div className="text-[10px] text-teal-600 dark:text-teal-400 font-medium truncate flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>{roleDisplay}</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <LogOut size={13} />
            <span>End Clinician Session</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Streamlined Medical Top Header */}
        <header className="hidden md:flex h-14 px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 items-center justify-between z-20 shrink-0">
          
          {/* Left: Clean Clinical Search */}
          <div className="flex items-center gap-3">
            <div className="relative w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search residents, diets, orders, recipes…"
                className="w-full pl-8.5 pr-3 py-1.5 bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                onClick={() => navigate('/residents')}
              />
            </div>
          </div>

          {/* Right: Essential Clinical Telemetry & Controls */}
          <div className="flex items-center gap-3">
            
            {/* Live EHR Sync Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/50 border border-teal-200/60 dark:border-teal-800/50 text-[11px] font-medium text-teal-700 dark:text-teal-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>EHR Sync Active</span>
            </div>

            {/* Live Time */}
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-lg bg-slate-100/60 dark:bg-slate-800/60">
              {timeStr}
            </div>

            <NotificationBell />

            {/* User Session Pill */}
            {user && (
              <div
                onClick={() => navigate('/settings')}
                className="cursor-pointer flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 border border-slate-200/60 dark:border-slate-700/60 transition-colors"
                title="View Profile & Facility Settings"
              >
                <div className="w-6 h-6 rounded-full bg-teal-600 text-white font-bold text-[10px] flex items-center justify-center">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
                  {user.name.split(' ')[0]}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 mt-14 md:mt-0">
          {children}
        </main>
      </div>
    </div>
  )
}
