import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '../security/AuthContext';
import InstallDesktopModal from './InstallDesktopModal';
import MobileMoreSheet from './MobileMoreSheet';
import BrandShowcaseModal from './brand/BrandShowcaseModal';
import { useDevice } from '@/hooks/useDevice';
import { LayoutDashboard, Users, Calendar, ChefHat, Receipt, BookOpen, ClipboardList, CheckSquare, ShoppingCart, TrendingUp, Boxes, UserCheck, Clock, Shield, FileText, LogOut, Menu as MenuIcon, Search, Settings as SettingsIcon, Truck, Store, Download, type LucideIcon } from 'lucide-react';
import './stitch-shell.css';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
interface NavItemDef {
    label: string;
    to: string;
    color: string;
    icon: LucideIcon;
    end?: boolean;
    minRole?: 'dietary' | 'manager';
    badge?: string;
}
interface NavSection {
    title: string;
    items: NavItemDef[];
}
const NAV_SECTIONS: NavSection[] = [
    {
        title: 'Clinical care',
        items: [
            { label: 'Clinical Dashboard', to: '/', color: '#0d9488', icon: LayoutDashboard, end: true },
            { label: 'Resident Census & Diets', to: '/residents', color: '#0284c7', icon: Users },
        ],
    },
    {
        title: 'Kitchen operations',
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
        title: 'Supply & reporting',
        items: [
            { label: 'Purchasing & Split Orders', to: '/purchasing', color: '#0284c7', icon: ShoppingCart, minRole: 'dietary' },
            { label: 'Distributor Portal & SKUs', to: '/distributor', color: '#8b5cf6', icon: Store, minRole: 'dietary' },
            { label: 'CMS-2567 & $/CPD Auditing', to: '/reporting', color: '#10b981', icon: TrendingUp, minRole: 'dietary' },
            { label: 'Inventory & Par Levels', to: '/inventory', color: '#f59e0b', icon: Boxes },
        ],
    },
    {
        title: 'Facility',
        items: [
            { label: 'Facility Profile & Wings', to: '/settings', color: '#0f766e', icon: SettingsIcon },
            { label: 'Clinical Staff Roster', to: '/staff', color: '#0284c7', icon: UserCheck, minRole: 'manager' },
            { label: 'Staff Timecard Clock', to: '/timecards', color: '#64748b', icon: Clock },
        ],
    },
];
const NAV_ADMIN: NavItemDef = {
    label: 'System Admin',
    to: '/admin',
    color: '#ef4444',
    icon: Shield,
};
const NAV_LEGAL: NavItemDef = {
    label: 'Security & legal',
    to: '/legal',
    color: '#64748b',
    icon: FileText,
};
function NavItem({ to, color, label, icon: Icon, end: endProp, badge, onClick }: {
    to: string;
    color: string;
    label: string;
    icon: LucideIcon;
    end?: boolean;
    badge?: string;
    onClick?: () => void;
}) {
    return (<NavLink to={to} end={endProp !== undefined ? endProp : to === '/'} onClick={onClick} className={({ isActive }) => `clinical-nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150 group ${isActive
            ? 'bg-[#008272] text-white font-bold border border-transparent shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'}`}>
      {({ isActive }) => (<>
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-400'}`}>
            <Icon size={20}/>
          </div>
          <span className="flex-1 truncate tracking-tight">{label}</span>
          {badge && !isActive && (<span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
              {badge}
            </span>)}
          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
        </>)}
    </NavLink>);
}
export default function Layout({ children }: {
    children: React.ReactNode;
}) {
    const { user, logout, atLeast } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { isMobile, isTablet, isDesktop, deviceMode, setDeviceMode } = useDevice();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [moreSheetOpen, setMoreSheetOpen] = useState(false);
    const [installModalOpen, setInstallModalOpen] = useState(false);
    const [brandGuideOpen, setBrandGuideOpen] = useState(false);
    const roleNames: Record<UserRole, string> = { admin: 'Facility Administrator', manager: 'Dietary Manager', dietitian: 'Registered Dietitian', frontdesk: 'Office Assistant', dietary: 'Dietary Specialist', distributor: 'Distributor Partner', activities: 'Activities Staff', server: 'Dining Server', staff: 'Staff', readonly: 'Read-only Staff' };
    const roleDisplay = user?.platformAdmin ? 'ShorelineOps Platform Owner' : user ? roleNames[user.role] : '';
    const demo = import.meta.env.VITE_DEMO_MODE === 'true';
    const activeItem = [...NAV_SECTIONS.flatMap(section => section.items), NAV_ADMIN, NAV_LEGAL].find(item => item.to === location.pathname);
    const handleLogout = () => { logout(); navigate('/login'); };
    const brand = <div className="stitch-shell-brand"><img src="/brand/shorelineops-icon.svg" alt=""/><div><strong>Shoreline<span>Ops</span></strong><small>Clinical Nutrition OS</small></div></div>;
    const navigation = <nav aria-label="Application navigation" className="stitch-shell-navigation">{NAV_SECTIONS.map(section => {
            const items = section.items.filter(item => !item.minRole || atLeast(item.minRole));
            if (!items.length)
                return null;
            return <div className="stitch-shell-group" key={section.title}><p>{section.title}</p>{items.map(item => <NavItem key={item.to} {...item} onClick={() => setMobileOpen(false)}/>)}</div>;
        })}{user?.role === 'admin' && <NavItem {...NAV_ADMIN} onClick={() => setMobileOpen(false)}/>}<NavItem {...NAV_LEGAL} onClick={() => setMobileOpen(false)}/></nav>;
    return <div className="shoreline-workspace stitch-shell">
    {isDesktop && <aside className="stitch-shell-sidebar">{brand}<button className="stitch-shell-search" onClick={() => navigate('/residents')}><Search size={18}/><span>Find a resident</span></button>{navigation}<div className="stitch-shell-session"><div className="stitch-shell-avatar">{user?.name.charAt(0).toUpperCase()}</div><div><strong>{user?.name}</strong><small>{roleDisplay}</small></div><button onClick={handleLogout} aria-label="End clinician session" title="End clinician session"><LogOut size={19}/></button></div></aside>}
    {isTablet && <aside className="stitch-shell-rail"><img src="/brand/shorelineops-icon.svg" alt="ShorelineOps"/>{NAV_SECTIONS.flatMap(section => section.items).filter(item => !item.minRole || atLeast(item.minRole)).slice(0, 6).map(item => <NavLink key={item.to} to={item.to} end={item.end} title={item.label} aria-label={item.label}><item.icon size={22}/></NavLink>)}<button aria-label="All navigation" onClick={() => setMobileOpen(true)}><MenuIcon size={22}/></button></aside>}
    <div className="stitch-shell-body"><header className="stitch-shell-header">{isMobile ? brand : <div className="stitch-shell-context"><span>Clinical workspace</span><strong>{activeItem?.label ?? 'Care operations'}</strong></div>}<div className="stitch-shell-header-actions">{isMobile && <button className="stitch-shell-mobile-drawer-button" aria-label="All navigation modules" onClick={() => setMobileOpen(true)}><MenuIcon size={21}/></button>}<span className="stitch-shell-mode">{demo ? 'Demo workspace' : 'Staff workspace'}</span>{import.meta.env.DEV && <select aria-label="Preview device" value={deviceMode} onChange={event => setDeviceMode(event.target.value as typeof deviceMode)}><option value="auto">Auto</option><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select>}<details className="stitch-shell-tools"><summary>More</summary><div><button onClick={() => setInstallModalOpen(true)}><Download size={17}/>Install app</button><button onClick={() => setBrandGuideOpen(true)}>Brand guide</button><a href="https://shorelineops.up.railway.app/">Public website</a><a href="https://shorelineops.up.railway.app/pricing">Pricing</a><a href="https://shorelineops.up.railway.app/distributors">Distributor information</a><button onClick={handleLogout}>End session</button></div></details></div></header><main className="stitch-shell-main">{children}</main></div>
    {isMobile && <nav className="stitch-shell-bottom" aria-label="Primary navigation"><NavLink to="/" end><LayoutDashboard size={21}/><span>Dashboard</span></NavLink><NavLink to="/residents"><Users size={21}/><span>Residents</span></NavLink>{atLeast('dietary') ? <NavLink to="/menu"><Calendar size={21}/><span>Menu</span></NavLink> : <NavLink to="/recipes"><BookOpen size={21}/><span>Recipes</span></NavLink>}{atLeast('dietary') ? <NavLink to="/kitchen/sheet"><ChefHat size={21}/><span>Kitchen</span></NavLink> : <NavLink to="/tasks"><CheckSquare size={21}/><span>Tasks</span></NavLink>}<button onClick={() => setMoreSheetOpen(true)}><MenuIcon size={21}/><span>More</span></button></nav>}
    <Dialog open={mobileOpen} onOpenChange={setMobileOpen}><DialogContent aria-describedby={undefined} className="stitch-shell-drawer-dialog"><DialogTitle className="sr-only">All application navigation</DialogTitle>{brand}{navigation}<NavItem label="Tasks" to="/tasks" color="#00675a" icon={CheckSquare} onClick={() => setMobileOpen(false)}/><button onClick={handleLogout}>End clinician session</button></DialogContent></Dialog>
    <MobileMoreSheet isOpen={moreSheetOpen} onClose={() => setMoreSheetOpen(false)} onOpenBrandGuide={() => setBrandGuideOpen(true)}/><BrandShowcaseModal open={brandGuideOpen} onClose={() => setBrandGuideOpen(false)}/><InstallDesktopModal open={installModalOpen} onClose={() => setInstallModalOpen(false)}/>
  </div>;
}
