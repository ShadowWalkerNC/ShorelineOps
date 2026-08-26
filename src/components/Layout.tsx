import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../security/AuthContext'
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
}

interface NavSection {
  title: string
  items: NavItemDef[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Core Operations',
    items: [
      { label: 'Dashboard', to: '/', color: '#0071e3', icon: LayoutDashboard, end: true },
      { label: 'Residents & Diets', to: '/residents', color: '#34c759', icon: Users },
      { label: 'Communications', to: '/communications', color: '#af52de', icon: MessageSquare },
    ],
  },
  {
    title: 'Dietary & Kitchen',
    items: [
      { label: 'Kitchen Tablet Mode', to: '/kitchen/tablet', color: '#ff3b30', icon: Tablet, minRole: 'dietary' },
      { label: 'Menu Planner', to: '/menu', color: '#ff9500', icon: Calendar, minRole: 'dietary', end: true },
      { label: 'Daily Cook Sheet', to: '/kitchen/sheet', color: '#ff9500', icon: ChefHat, minRole: 'dietary' },
      { label: 'Tray Cards', to: '/kitchen/traycards', color: '#ff2d55', icon: Receipt, minRole: 'dietary' },
      { label: 'Recipe Book', to: '/recipes', color: '#5856d6', icon: BookOpen },
      { label: 'Production Sheets', to: '/production', color: '#00c7be', icon: ClipboardList },
      { label: 'Meal Tally Entry', to: '/kitchen/orders', color: '#30b0c7', icon: CheckSquare, minRole: 'dietary' },
    ],
  },
  {
    title: 'Purchasing & Cost',
    items: [
      { label: 'Purchasing & Orders', to: '/purchasing', color: '#0071e3', icon: ShoppingCart, minRole: 'dietary' },
      { label: 'Distributor Portal', to: '/distributor', color: '#af52de', icon: Truck },
      { label: 'Cost & Compliance', to: '/reporting', color: '#34c759', icon: TrendingUp, minRole: 'dietary' },
      { label: 'Inventory & Stock', to: '/inventory', color: '#ff9500', icon: Boxes },
      { label: 'Budget & Spend', to: '/budget', color: '#5856d6', icon: DollarSign, minRole: 'manager' },
    ],
  },
  {
    title: 'Facility & Settings',
    items: [
      { label: 'Facility Settings', to: '/settings', color: '#0f766e', icon: SettingsIcon },
      { label: 'Corporate HQ', to: '/enterprise', color: '#af52de', icon: Building2, minRole: 'manager' },
      { label: 'Staff Roster', to: '/staff', color: '#0071e3', icon: UserCheck, minRole: 'manager' },
      { label: 'Timecard Clock', to: '/timecards', color: '#8e8e93', icon: Clock },
    ],
  },
]

const NAV_ADMIN: NavItemDef = {
  label: 'Administration',
  to: '/admin',
  color: '#ff3b30',
  icon: Shield,
}

const NAV_LEGAL: NavItemDef = {
  label: 'Legal & BAA',
  to: '/legal',
  color: '#8e8e93',
  icon: FileText,
}

function NavItem({ to, color, label, icon: Icon, end: endProp, onClick }: { to: string; color: string; label: string; icon: LucideIcon; end?: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={endProp !== undefined ? endProp : to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-xl text-[13.5px] font-medium transition-all duration-150 group ${
          isActive
            ? 'bg-blue-50/90 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${
              isActive ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'
            }`}
            style={!isActive ? { color } : undefined}
          >
            <Icon size={15} />
          </div>
          <span className="flex-1 truncate tracking-tight">{label}</span>
          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
        </>
      )}
    </NavLink>
  )
}

import { LicenseManager } from '@/security/license'
import { Sparkles } from 'lucide-react'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, atLeast } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const now       = useClock()
  const [navOpen, setNavOpen] = useState(false)
  const license   = LicenseManager.getLicense()

  const isAdmin = user?.role === 'admin'

  useEffect(() => { setNavOpen(false) }, [location.pathname])
  useEffect(() => {
    document.body.classList.toggle('nav-open', navOpen)
    return () => document.body.classList.remove('nav-open')
  }, [navOpen])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  const roleDisplay =
    user?.role === 'admin'       ? 'Administrator' :
    user?.role === 'manager'     ? 'Executive Chef / Manager' :
    user?.role === 'dietitian'   ? 'Lead Dietitian (RD)' :
    user?.role === 'frontdesk'   ? 'Operations Lead' :
    user?.role === 'dietary'     ? 'Dietary Specialist' :
    user?.role === 'distributor' ? 'Distributor Partner' :
    user?.role === 'activities'  ? 'Activities Dir.' :
    user?.role === 'server'      ? 'Server' :
    user?.role === 'staff'       ? 'Staff' : 'Read-Only'

  return (
    <div className="flex h-[100dvh] w-full bg-[#f5f5f7] dark:bg-[#000000] overflow-hidden font-sans text-slate-900 dark:text-slate-100">
      
      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* MOBILE HEADER */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setNavOpen(v => !v)}
            aria-label="Toggle navigation"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {navOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
          </button>
          <img src="/icon-192.png" alt="Shoreline" className="w-7 h-7 rounded-lg object-contain" />
          <span className="font-bold text-slate-900 dark:text-white tracking-tight">Shoreline</span>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          {user && (
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </header>

      {/* MOBILE NAV DRAWER */}
      <div className={`md:hidden fixed top-14 left-0 right-0 bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl z-50 p-4 overflow-y-auto transform transition-transform duration-250 ease-in-out ${
        navOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="space-y-4">
          {NAV_SECTIONS.map((section, sIdx) => {
            const items = section.items.filter(item => !item.minRole || atLeast(item.minRole))
            if (items.length === 0) return null
            return (
              <div key={sIdx} className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 font-mono">
                  {section.title}
                </div>
                {items.map(item => (
                  <NavItem key={item.to} {...item} onClick={() => setNavOpen(false)} />
                ))}
              </div>
            )
          })}
          {isAdmin && (
            <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
              <NavItem {...NAV_ADMIN} onClick={() => setNavOpen(false)} />
            </div>
          )}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <NavItem {...NAV_LEGAL} onClick={() => setNavOpen(false)} />
          </div>
        </div>
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-64 h-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-r border-slate-200/80 dark:border-slate-800/80 flex-col shrink-0 z-30">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between">
          <img src="/logo.png" alt="Shoreline Care OS" className="h-8 w-auto object-contain" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/60 font-mono">
            v5.0
          </span>
        </div>

        {/* Navigation List */}
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
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 font-mono">System</div>
              <NavItem {...NAV_ADMIN} />
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <NavItem {...NAV_LEGAL} />
          </div>
        </nav>

        {/* User Card & Logout Footer */}
        <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/70 space-y-2">
          {user && (
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{roleDisplay}</div>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Desktop Glass Header */}
        <header className="hidden md:flex h-14 px-6 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Global search (residents, items, recipes)…"
                className="w-full pl-8 pr-3 py-1.5 bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                onClick={() => navigate('/residents')}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Link to Marketing Site */}
            <a
              href="https://shoreline-marketing.onrender.com"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/40 transition-colors flex items-center gap-1.5"
            >
              <span>🌐 Marketing & Docs</span>
            </a>

            {/* License Tier Pill */}
            <div
              onClick={() => navigate('/settings')}
              className="cursor-pointer flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors"
              title="Click to view License & Settings"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>{license.tier === 'demo' ? 'Enterprise Demo Unlocked' : `${license.tier.toUpperCase()} Tier`}</span>
            </div>

            {/* Live Clock Pill */}
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full bg-slate-100/70 dark:bg-slate-800/70">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{timeStr}</span>
            </div>

            <NotificationBell />

            {user && (
              <AppleBadge color="blue">
                {user.name} · {user.role.toUpperCase()}
              </AppleBadge>
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

