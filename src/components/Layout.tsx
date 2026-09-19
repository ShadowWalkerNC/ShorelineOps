import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../security/AuthContext'
import { LicenseManager } from '../security/license'
import NotificationBell from './NotificationBell'
import InstallDesktopModal from './InstallDesktopModal'
import { AppleBadge, AppleButton } from '@/apple-ui'
import {
  LayoutDashboard,
  Users,
  Calendar,
  ChefHat,
  Receipt,
  BookOpen,
  ClipboardList,
  CheckSquare,
  ShoppingCart,
  TrendingUp,
  Boxes,
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
  Activity,
  Truck,
  HeartPulse,
  Stethoscope,
  ShieldCheck,
  Lock,
  Sparkles,
  Download,
  CreditCard,
  Store,
  Smartphone,
  Tablet,
  Monitor,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { useDevice } from '@/hooks/useDevice'
import MobileMoreSheet from './MobileMoreSheet'

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
      { label: 'Resident Census & Diets', to: '/residents', color: '#0284c7', icon: Users },
    ],
  },
  {
    title: 'IDDSI 2.0 & Kitchen Production',
    items: [
      { label: 'Seasonal Cycle Planner', to: '/menu', color: '#f59e0b', icon: Calendar, minRole: 'dietary', end: true },
      { label: 'Daily Cook Worksheet', to: '/kitchen/sheet', color: '#f59e0b', icon: ChefHat, minRole: 'dietary' },
      { label: '4x6 Tray Cards & Tickets', to: '/kitchen/traycards', color: '#ec4899', icon: Receipt, minRole: 'dietary' },
      { label: 'Tray Dispatch & Tracking', to: '/kitchen/dispatch', color: '#0d9488', icon: Truck, minRole: 'dietary' },
      { label: 'Standardized Recipes', to: '/recipes', color: '#6366f1', icon: BookOpen },
      { label: 'Batch Cook Production', to: '/production', color: '#14b8a6', icon: ClipboardList },
      { label: 'Meal Selection Tally', to: '/kitchen/orders', color: '#06b6d4', icon: CheckSquare, minRole: 'dietary' },
    ],
  },
  {
    title: 'Supply Chain & Split MRP',
    items: [
      { label: 'Purchasing & Split Orders', to: '/purchasing', color: '#0284c7', icon: ShoppingCart, minRole: 'dietary' },
      { label: 'Distributor Portal & SKUs', to: '/distributor', color: '#8b5cf6', icon: Store, minRole: 'dietary' },
      { label: 'CMS-2567 & $/CPD Auditing', to: '/reporting', color: '#10b981', icon: TrendingUp, minRole: 'dietary' },
      { label: 'Inventory & Par Levels', to: '/inventory', color: '#f59e0b', icon: Boxes },
    ],
  },
  {
    title: 'Facility & Governance',
    items: [
      { label: 'Facility Profile & Wings', to: '/settings', color: '#0f766e', icon: SettingsIcon },
      { label: 'Clinical Staff Roster', to: '/staff', color: '#0284c7', icon: UserCheck, minRole: 'manager' },
      { label: 'Staff Timecard Clock', to: '/timecards', color: '#64748b', icon: Clock },
    ],
  },
]

const NAV_ADMIN: NavItemDef = {
  label: 'System Admin',
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
  const { isMobile, isTablet, isDesktop, deviceMode, setDeviceMode } = useDevice()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const [installModalOpen, setInstallModalOpen] = useState(false)
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

  const TABLET_RAIL_ITEMS: { to: string; label: string; icon: LucideIcon; minRole?: 'dietary' | 'manager' }[] = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/residents', label: 'Census', icon: Users },
    { to: '/menu', label: 'Menu', icon: Calendar, minRole: 'dietary' },
    { to: '/kitchen/sheet', label: 'Kitchen', icon: ChefHat, minRole: 'dietary' },
    { to: '/production', label: 'Cook', icon: ClipboardList },
    { to: '/kitchen/dispatch', label: 'Trays', icon: Truck, minRole: 'dietary' },
    { to: '/inventory', label: 'Stock', icon: Boxes },
    { to: '/reporting', label: 'Reports', icon: TrendingUp, minRole: 'dietary' },
    { to: '/settings', label: 'Setup', icon: SettingsIcon },
  ]

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-slate-100 overflow-hidden">
      
      {/* ── MOBILE TOP APP BAR ────────────────────────────────────── */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3.5 z-40">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Shoreline Care OS" className="h-7 w-auto object-contain" />
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/50 border border-teal-200/60 dark:border-teal-800/50 text-[10px] font-bold text-teal-700 dark:text-teal-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>EHR Sync</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Device Switcher for Testing / Preview */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
              <button
                onClick={() => setDeviceMode('auto')}
                className={`px-1.5 py-0.5 rounded ${deviceMode === 'auto' ? 'bg-white dark:bg-slate-900 text-teal-700 font-bold shadow-2xs' : 'text-slate-500'}`}
                title="Auto device breakpoint"
              >
                Auto
              </button>
              <button
                onClick={() => setDeviceMode('tablet')}
                className={`px-1.5 py-0.5 rounded ${deviceMode === 'tablet' ? 'bg-white dark:bg-slate-900 text-teal-700 font-bold shadow-2xs' : 'text-slate-500'}`}
                title="Switch to Tablet view"
              >
                Tab
              </button>
              <button
                onClick={() => setDeviceMode('desktop')}
                className={`px-1.5 py-0.5 rounded ${deviceMode === 'desktop' ? 'bg-white dark:bg-slate-900 text-teal-700 font-bold shadow-2xs' : 'text-slate-500'}`}
                title="Switch to Desktop view"
              >
                Desk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE FULL DRAWER ────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex animate-fadeIn">
          <div className="w-72 bg-white dark:bg-slate-900 h-full flex flex-col p-4 shadow-2xl border-r border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-3">
              <img src="/logo.png" alt="Shoreline Care OS" className="h-8 w-auto object-contain" />
              <button onClick={() => setMobileOpen(false)} className="text-slate-400 p-1.5 rounded-lg hover:bg-slate-100">
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

      {/* ── TABLET ADAPTIVE COMPACT TOUCH RAIL (768px – 1023px) ──── */}
      {isTablet && (
        <aside className="w-[72px] h-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center justify-between py-3 shrink-0 z-30">
          <div className="flex flex-col items-center gap-4 w-full">
            {/* Tablet Brand Icon */}
            <div className="p-2 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200/60 dark:border-teal-800/60 shadow-2xs">
              <img src="/logo.png" alt="Care OS" className="h-6 w-6 object-contain" />
            </div>

            {/* Tablet Touch Rail Items (Touch Target >= 48px) */}
            <nav className="flex flex-col items-center gap-1.5 w-full px-1.5">
              {TABLET_RAIL_ITEMS.filter(item => !item.minRole || atLeast(item.minRole)).map(item => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all ${
                        isActive
                          ? 'bg-teal-600 text-white shadow-xs font-bold'
                          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`
                    }
                    title={item.label}
                  >
                    <Icon size={20} />
                    <span className="text-[9px] mt-0.5 font-semibold tracking-tight">{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>
          </div>

          {/* Bottom Drawer Opener & User Avatar */}
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/70 w-full px-1.5">
            <button
              onClick={() => setMobileOpen(true)}
              className="w-12 h-11 rounded-2xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center transition-colors"
              title="All Navigation Modules"
            >
              <MenuIcon size={18} />
              <span className="text-[9px] font-semibold">More</span>
            </button>

            {user && (
              <div
                onClick={() => navigate('/settings')}
                className="w-10 h-10 rounded-2xl bg-teal-600 text-white font-bold text-xs flex items-center justify-center cursor-pointer shadow-xs"
                title={`${user.name} (${roleDisplay})`}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ── DESKTOP CLINICAL ADMINISTRATIVE SIDEBAR (>= 1024px) ───── */}
      {isDesktop && (
        <aside className="w-64 h-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col shrink-0 z-30">
          
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
      )}

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Streamlined Medical Top Header (Desktop & Tablet) */}
        {!isMobile && (
          <header className="h-14 px-4 sm:px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between z-20 shrink-0">
            
            {/* Left: Clean Clinical Search */}
            <div className="flex items-center gap-3">
              <div className="relative w-64 lg:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search residents, diets, orders…"
                  className="w-full pl-8.5 pr-3 py-1.5 bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  onClick={() => navigate('/residents')}
                />
              </div>
            </div>

            {/* Right: Telemetry & Device View Controls */}
            <div className="flex items-center gap-2.5">
              
              {/* Responsive Device Experience Switcher */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/70 dark:border-slate-700/70 text-[11px] font-semibold">
                <button
                  onClick={() => setDeviceMode('auto')}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    deviceMode === 'auto'
                      ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 font-bold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Automatic responsive mode"
                >
                  Auto
                </button>
                <button
                  onClick={() => setDeviceMode('desktop')}
                  className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-all ${
                    deviceMode === 'desktop'
                      ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 font-bold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Force Desktop Administrative Workspace"
                >
                  <Monitor size={12} />
                  <span className="hidden xl:inline">Desk</span>
                </button>
                <button
                  onClick={() => setDeviceMode('tablet')}
                  className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-all ${
                    deviceMode === 'tablet'
                      ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 font-bold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Force Tablet Supervisory Touch Rail"
                >
                  <Tablet size={12} />
                  <span className="hidden xl:inline">Tab</span>
                </button>
                <button
                  onClick={() => setDeviceMode('mobile')}
                  className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-all ${
                    deviceMode === 'mobile'
                      ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 font-bold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Force Mobile Floor Operational Hub"
                >
                  <Smartphone size={12} />
                  <span className="hidden xl:inline">Phone</span>
                </button>
              </div>

              {/* Live EHR Sync Status */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/50 border border-teal-200/60 dark:border-teal-800/50 text-[11px] font-medium text-teal-700 dark:text-teal-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>EHR Sync</span>
              </div>

              {/* Live Time */}
              <div className="hidden lg:block text-xs font-mono text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-lg bg-slate-100/60 dark:bg-slate-800/60">
                {timeStr}
              </div>

              {/* 1-Click Install Desktop App Button */}
              {isDesktop && (
                <button
                  onClick={() => setInstallModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200/80 dark:border-teal-800/60 text-teal-700 dark:text-teal-300 text-xs font-bold transition-colors shadow-2xs"
                  title="Install Shoreline Care OS to your desktop or tablet"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install App</span>
                </button>
              )}

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
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[100px] truncate">
                    {user.name.split(' ')[0]}
                  </span>
                </div>
              )}
            </div>
          </header>
        )}

        {/* Page Viewport */}
        <main className={`flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-6 ${isMobile ? 'mt-14 pb-20' : 'pb-6'}`}>
          {/* Administrative Dunning Grace Notice */}
          {user && (user.role === 'admin' || user.role === 'manager') && (
            <div className="hidden data-[dunning=true]:flex items-center justify-between px-4 py-2.5 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
              <div className="flex items-center gap-2 font-medium">
                <CreditCard className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Billing Notice:</strong> Automatic SaaS payment processing requires attention. Resident meal services & EHR sync remain <strong>100% active</strong> under clinical grace period.
                </span>
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="px-3 py-1 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 transition-colors text-xs shrink-0"
              >
                Update Payment Method
              </button>
            </div>
          )}
          {children}
        </main>

        {/* ── MOBILE BOTTOM NAVIGATION (Jakob's Law Thumb-Zone Ergonomics) ── */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-200/80 dark:border-slate-800/80 z-40 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] shadow-lg">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] h-12 py-1 transition-colors ${
                  isActive ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <LayoutDashboard className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-tight">Dashboard</span>
            </NavLink>

            <NavLink
              to="/residents"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] h-12 py-1 transition-colors ${
                  isActive ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-tight">Census</span>
            </NavLink>

            <NavLink
              to="/kitchen/sheet"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] h-12 py-1 transition-colors ${
                  isActive ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <ChefHat className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-tight">Kitchen</span>
            </NavLink>

            <NavLink
              to="/tasks"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] h-12 py-1 transition-colors ${
                  isActive ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <CheckSquare className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-tight">Tasks</span>
            </NavLink>

            <button
              onClick={() => setMoreSheetOpen(true)}
              className="flex flex-col items-center justify-center min-w-[56px] h-12 py-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <MenuIcon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-tight">More</span>
            </button>
          </nav>
        )}

        {/* Mobile More Sheet */}
        <MobileMoreSheet
          isOpen={moreSheetOpen}
          onClose={() => setMoreSheetOpen(false)}
        />

        {/* 1-Click Non-Tech Desktop Installation Modal */}
        <InstallDesktopModal
          open={installModalOpen}
          onClose={() => setInstallModalOpen(false)}
        />
      </div>
    </div>
  )
}

