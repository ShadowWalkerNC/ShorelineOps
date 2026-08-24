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
} from 'lucide-react'

type Props = {
  residents: Resident[]
  onEdit: (r: Resident) => void
  onDelete: (id: string) => void
}

const TEXTURE_COLORS: Record<string, { bg: string; color: string; border: string; iddsi: string }> = {
  Regular:          { bg: 'rgba(0,113,227,0.08)',   color: '#0071e3', border: 'rgba(0,113,227,0.2)',   iddsi: 'Level 7' },
  'Cut-Up':         { bg: 'rgba(255,149,0,0.1)',    color: '#d97706', border: 'rgba(255,149,0,0.3)',   iddsi: 'Level 6' },
  Minced:           { bg: 'rgba(175,82,222,0.1)',   color: '#8944ab', border: 'rgba(175,82,222,0.3)',  iddsi: 'Level 5' },
  'Minced & Moist': { bg: 'rgba(175,82,222,0.1)',   color: '#8944ab', border: 'rgba(175,82,222,0.3)',  iddsi: 'Level 5' },
  Pureed:           { bg: 'rgba(52,199,89,0.12)',   color: '#248a3d', border: 'rgba(52,199,89,0.35)',  iddsi: 'Level 4' },
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
  const avatarColors = ['#0071e3', '#34c759', '#af52de', '#ff9500', '#5856d6', '#00c7be']
  const colorIndex = (r.name.charCodeAt(0) + (r.room.charCodeAt(0) || 0)) % avatarColors.length
  const avatarBg = avatarColors[colorIndex]

  return (
    <AppleCard
      className="flex flex-col justify-between transition-all duration-200 relative group overflow-hidden border border-slate-200/80 dark:border-slate-800/80 rounded-2xl bg-white/90 dark:bg-slate-900/90 shadow-sm hover:shadow-md"
    >
      <div>
        {/* Card Header: Room Pill + Avatar + Name + Status */}
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0 font-sans"
              style={{ background: avatarBg }}
            >
              {r.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-white text-base tracking-tight truncate font-sans">
                  {r.name}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                  Room {r.room}
                </span>
                <AppleBadge color={STATUS_COLORS[r.status]} dot={r.status === 'Active'}>
                  {r.status}
                </AppleBadge>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Diet & Texture Section */}
        <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 mb-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              Diet Order
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {r.dietType}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Texture (IDDSI)
            </span>
            <span
              className="font-semibold px-2 py-0.5 rounded-md text-[11px]"
              style={{ background: textureInfo.bg, color: textureInfo.color, border: `1px solid ${textureInfo.border}` }}
            >
              {r.texture} · {textureInfo.iddsi}
            </span>
          </div>

          {r.portionSize !== 'Regular' && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
              <span className="text-slate-500 font-medium">Portion Size</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{r.portionSize}</span>
            </div>
          )}
        </div>

        {/* Allergen Alerts */}
        {r.allergies && r.allergies.length > 0 ? (
          <div className="mb-3">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Allergies ({r.allergies.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.allergies.map(a => (
                <span
                  key={a}
                  className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-3 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>No Known Food Allergies (NKDA)</span>
          </div>
        )}

        {/* Location & Supplement Info */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>{r.servingLocation}</span>
            {r.tableAssignment && <span className="font-mono text-slate-700 dark:text-slate-300">({r.tableAssignment})</span>}
          </div>
          {r.ensurePerDay > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 text-[11px] font-semibold">
              {r.ensurePerDay} Ensure/day
            </span>
          )}
        </div>

        {/* Expanded Details Accordion */}
        {expanded && (
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 animate-fadeIn">
            {r.beverages && r.beverages.length > 0 && (
              <div>
                <span className="font-semibold text-slate-400 uppercase text-[10px] block">Beverages</span>
                <span>{r.beverages.join(', ')}</span>
              </div>
            )}
            {r.birthdayMonth && r.birthdayDay && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Birthday: {r.birthdayMonth} {r.birthdayDay}</span>
              </div>
            )}
            {r.likes && (
              <div>
                <span className="font-semibold text-slate-400 uppercase text-[10px] block">Likes</span>
                <span className="text-emerald-700 dark:text-emerald-300">{r.likes}</span>
              </div>
            )}
            {r.dislikes && (
              <div>
                <span className="font-semibold text-slate-400 uppercase text-[10px] block">Dislikes</span>
                <span className="text-rose-700 dark:text-rose-300">{r.dislikes}</span>
              </div>
            )}
            {r.specialInstructions && (
              <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 text-amber-800 dark:text-amber-200">
                <span className="font-semibold block text-[10px] uppercase">Special Instructions</span>
                <span>{r.specialInstructions}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Action Sheet Bar */}
      <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <AppleButton
          size="sm"
          variant="secondary"
          className="flex-1 text-xs font-semibold"
          onClick={() => navigate(`/residents/${r.id}`)}
        >
          View Chart
        </AppleButton>

        <AppleButton
          size="sm"
          variant="tinted"
          className="text-xs font-semibold px-3"
          onClick={() => onEdit(r)}
        >
          Edit
        </AppleButton>

        <button
          onClick={() => setExpanded(v => !v)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={expanded ? 'Collapse' : 'Expand details'}
        >
          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>
    </AppleCard>
  )
}

export default function ResidentCardList({ residents, onEdit, onDelete }: Props) {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const navigate = useNavigate()

  if (residents.length === 0) {
    return (
      <AppleCard className="text-center py-16 text-slate-500 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-2xl">
          👤
        </div>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No resident profiles match this filter</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
          Try clearing your search query or selecting a different dietary filter above.
        </p>
      </AppleCard>
    )
  }

  const sorted = [...residents].sort((a, b) => {
    const an = parseInt(a.room) || 0
    const bn = parseInt(b.room) || 0
    return an !== bn ? an - bn : a.room.localeCompare(b.room)
  })

  return (
    <div className="space-y-4">
      {/* View Switcher Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
          Showing {sorted.length} Resident{sorted.length === 1 ? '' : 's'}
        </div>

        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Card Grid
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'table'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <ListIcon className="w-3.5 h-3.5" />
            List Table
          </button>
        </div>
      </div>

      {/* Grid Mode */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(r => (
            <ResidentAppleCard key={r.id} r={r} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        /* Table Mode */
        <AppleCard className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 text-xs font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4">Resident</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Diet Type</th>
                  <th className="py-3 px-4">Texture (IDDSI)</th>
                  <th className="py-3 px-4">Allergies</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sorted.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">{r.room}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{r.name}</td>
                    <td className="py-3 px-4">
                      <AppleBadge color={STATUS_COLORS[r.status]}>
                        {r.status}
                      </AppleBadge>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">{r.dietType}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-xs px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        {r.texture}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {r.allergies && r.allergies.length > 0 ? (
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                          {r.allergies.join(', ')}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{r.servingLocation}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => navigate(`/residents/${r.id}`)}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Chart
                      </button>
                      <button
                        onClick={() => onEdit(r)}
                        className="text-xs font-semibold text-slate-600 hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppleCard>
      )}
    </div>
  )
}

