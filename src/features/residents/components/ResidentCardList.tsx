import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import type { Resident } from '@/types/resident'
import {
  User,
  Heart,
  AlertTriangle,
  MapPin,
  Coffee,
  Calendar,
  ChevronRight,
  ShieldCheck,
  LayoutGrid,
  List as ListIcon,
  Flame,
  Sparkles,
  Stethoscope,
  Activity,
  FileCheck2,
  AlertOctagon,
  Eye,
  Edit2,
  Trash2,
} from 'lucide-react'

type Props = {
  residents: Resident[]
  onEdit: (r: Resident) => void
  onDelete: (id: string) => void
}

const TEXTURE_COLORS: Record<string, { bg: string; color: string; border: string; iddsi: string }> = {
  Regular:          { bg: 'rgba(15,23,42,0.06)',    color: '#334155', border: 'rgba(15,23,42,0.2)',    iddsi: 'IDDSI Level 7' },
  'Cut-Up':         { bg: 'rgba(2,132,199,0.1)',    color: '#0284c7', border: 'rgba(2,132,199,0.3)',   iddsi: 'IDDSI Level 6' },
  Minced:           { bg: 'rgba(245,158,11,0.12)',  color: '#b45309', border: 'rgba(245,158,11,0.35)', iddsi: 'IDDSI Level 5' },
  'Minced & Moist': { bg: 'rgba(245,158,11,0.12)',  color: '#b45309', border: 'rgba(245,158,11,0.35)', iddsi: 'IDDSI Level 5' },
  Pureed:           { bg: 'rgba(16,185,129,0.12)',  color: '#047857', border: 'rgba(16,185,129,0.35)', iddsi: 'IDDSI Level 4' },
}

const STATUS_COLORS: Record<Resident['status'], 'green' | 'orange' | 'blue' | 'gray'> = {
  Active: 'green',
  Hospital: 'orange',
  LOA: 'blue',
  'Passed Away': 'gray',
}

function ResidentAppleCard({ r, onEdit, onDelete }: { r: Resident; onEdit: (r: Resident) => void; onDelete: (id: string) => void }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const textureInfo = TEXTURE_COLORS[r.texture] || TEXTURE_COLORS.Regular

  // Avatar initial color
  const avatarColors = ['#0d9488', '#0284c7', '#8b5cf6', '#f59e0b', '#6366f1', '#10b981']
  const colorIndex = (r.name.charCodeAt(0) + (r.room.charCodeAt(0) || 0)) % avatarColors.length
  const avatarBg = avatarColors[colorIndex]

  const isNpo = r.dietType?.toUpperCase().includes('NPO') || r.texture?.toUpperCase().includes('NPO')

  return (
    <AppleCard
      className={`flex flex-col justify-between transition-all duration-200 relative group overflow-hidden border ${
        isNpo
          ? 'border-red-500 bg-red-950/10 dark:bg-red-950/20'
          : 'border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900/95'
      } rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-teal-500/40`}
    >
      <div>
        {/* Clinical Chart MRN & Bed Ribbon */}
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 dark:border-slate-800 text-[10px] font-mono font-bold text-slate-400">
          <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400">
            <Activity className="w-3 h-3 text-teal-600" />
            <span>MRN: SH-{r.id?.slice(0, 5) || '1004'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>UNIT: {r.room?.charAt(0) ? `WING ${r.room.charAt(0).toUpperCase()}` : 'MAIN'}</span>
            <span className="text-slate-300 dark:text-slate-700">&bull;</span>
            <span className="text-slate-500">v{(r as any).profile_version || 1}.0</span>
          </div>
        </div>

        {/* Card Header: Room + Patient Name + Status */}
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-base shadow-xs shrink-0 font-sans"
              style={{ background: avatarBg }}
            >
              {r.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight truncate font-sans">
                  {r.name}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                  Room {r.room}
                </span>
                <AppleBadge color={STATUS_COLORS[r.status]} dot={r.status === 'Active'}>
                  {r.status}
                </AppleBadge>
              </div>
            </div>
          </div>
        </div>

        {/* NPO HARD ALERT BANNER */}
        {isNpo && (
          <div className="p-2.5 rounded-xl bg-red-600 text-white font-black text-xs flex items-center gap-2 mb-3 shadow-sm animate-pulse">
            <AlertOctagon className="w-4 h-4 shrink-0" />
            <span>NPO HARD-BLOCK: NIL PER OS (NO FOOD/LIQUIDS)</span>
          </div>
        )}

        {/* Clinical Diet & Texture Section */}
        <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-850 border border-slate-200/70 dark:border-slate-800 mb-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Physician Diet Order
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {r.dietType}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              IDDSI Texture
            </span>
            <span
              className="font-bold px-2 py-0.5 rounded-md text-[11px]"
              style={{ background: textureInfo.bg, color: textureInfo.color, border: `1px solid ${textureInfo.border}` }}
            >
              {r.texture} &middot; {textureInfo.iddsi}
            </span>
          </div>

          {(r as any).fluidConsistency && (r as any).fluidConsistency !== 'Thin' && (
            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50">
              <span className="text-slate-500 font-medium">Liquid Consistency</span>
              <span className="font-bold text-teal-700 dark:text-teal-300 font-mono text-[11px]">
                {(r as any).fluidConsistency}
              </span>
            </div>
          )}
        </div>

        {/* Allergen Alerts Block */}
        {r.allergies && r.allergies.length > 0 ? (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-300 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>CLINICAL ALLERGY EXCLUSIONS ({r.allergies.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.allergies.map(a => (
                <span
                  key={a}
                  className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-3 p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>No Known Drug or Food Allergies (NKDA)</span>
          </div>
        )}

        {/* Location & Nutrition Supplement */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>{r.servingLocation}</span>
            {r.tableAssignment && <span className="font-mono text-slate-700 dark:text-slate-300">({r.tableAssignment})</span>}
          </div>
          {r.ensurePerDay > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 text-[11px] font-bold">
              {r.ensurePerDay} Ensure/day
            </span>
          )}
        </div>

        {/* Expanded Clinical Chart Accordion */}
        {expanded && (
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 animate-fadeIn">
            {r.beverages && r.beverages.length > 0 && (
              <div>
                <span className="font-bold text-slate-400 uppercase text-[10px] block">Prescribed Beverages</span>
                <span>{r.beverages.join(', ')}</span>
              </div>
            )}
            {r.likes && (
              <div>
                <span className="font-bold text-slate-400 uppercase text-[10px] block">Patient Preferences</span>
                <span className="text-emerald-700 dark:text-emerald-300">{r.likes}</span>
              </div>
            )}
            {r.dislikes && (
              <div>
                <span className="font-bold text-slate-400 uppercase text-[10px] block">Refusals / Dislikes</span>
                <span className="text-rose-700 dark:text-rose-300">{r.dislikes}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clinical Card Action Bar */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-semibold text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        >
          {expanded ? '▲ Collapse Chart' : '▼ View Chart'}
        </button>

        <div className="flex items-center gap-1.5">
          <AppleButton
            variant="secondary"
            size="sm"
            icon={<Edit2 className="w-3.5 h-3.5" />}
            onClick={() => onEdit(r)}
          >
            Edit Order
          </AppleButton>
          <button
            onClick={() => onDelete(r.id)}
            className="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
            title="Archive Patient Record"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </AppleCard>
  )
}

export default function ResidentCardList({ residents, onEdit, onDelete }: Props) {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  return (
    <div className="space-y-4">
      {/* View Switcher */}
      <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
        <span>Showing <strong className="text-slate-900 dark:text-white font-mono">{residents.length}</strong> Clinical Patient Profiles</span>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`py-1 px-2.5 rounded-lg flex items-center gap-1.5 transition-all ${
              viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 font-bold shadow-xs' : 'text-slate-400'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Chart Cards</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`py-1 px-2.5 rounded-lg flex items-center gap-1.5 transition-all ${
              viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 font-bold shadow-xs' : 'text-slate-400'
            }`}
          >
            <ListIcon className="w-3.5 h-3.5" />
            <span>EMR Census Table</span>
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {residents.map(r => (
            <ResidentAppleCard key={r.id} r={r} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <AppleCard className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-850 text-[10px] font-mono uppercase font-bold text-slate-400">
                <tr>
                  <th className="p-3">MRN / Room</th>
                  <th className="p-3">Resident Patient Name</th>
                  <th className="p-3">Physician Diet Order</th>
                  <th className="p-3">IDDSI Texture</th>
                  <th className="p-3">Allergy Exclusions</th>
                  <th className="p-3">Tray Location</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {residents.map(r => {
                  const textureInfo = TEXTURE_COLORS[r.texture] || TEXTURE_COLORS.Regular
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        Room {r.room}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">
                        {r.name}
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">
                        {r.dietType}
                      </td>
                      <td className="p-3">
                        <span
                          className="font-bold px-2 py-0.5 rounded-md text-[11px]"
                          style={{ background: textureInfo.bg, color: textureInfo.color, border: `1px solid ${textureInfo.border}` }}
                        >
                          {r.texture} &middot; {textureInfo.iddsi}
                        </span>
                      </td>
                      <td className="p-3">
                        {r.allergies && r.allergies.length > 0 ? (
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            ⚠️ {r.allergies.join(', ')}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">NKDA</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-500">
                        {r.servingLocation} {r.tableAssignment && `(${r.tableAssignment})`}
                      </td>
                      <td className="p-3 text-right">
                        <AppleButton variant="secondary" size="sm" onClick={() => onEdit(r)}>
                          Edit
                        </AppleButton>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </AppleCard>
      )}
    </div>
  )
}
