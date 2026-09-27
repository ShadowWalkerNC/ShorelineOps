import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Resident } from '@/types/resident'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import { iddsiForTexture, iddsiChipLabel } from '@/types/resident'
import {
  X,
  User,
  AlertTriangle,
  ShieldAlert,
  Utensils,
  MapPin,
  Heart,
  Droplet,
  FileText,
  Printer,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react'

interface ResidentQuickDrawerProps {
  resident: Resident | null
  isOpen: boolean
  onClose: () => void
}

export default function ResidentQuickDrawer({
  resident,
  isOpen,
  onClose,
}: ResidentQuickDrawerProps) {
  const navigate = useNavigate()

  if (!isOpen || !resident) return null

  const { level, label: iddsiLabel } = iddsiForTexture(resident.texture || 'Regular')
  const allergies = resident.allergies ?? []
  const isNpo = Boolean(resident.is_npo ?? (resident as any).isNpo)
  const npoReason = resident.npo_reason ?? (resident as any).npoReason

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container (Desktop/Tablet: Slide from right; Mobile: Slide from bottom) */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 sm:pl-16">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800/80 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 ease-out">
          
          {/* Header */}
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-slate-850/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-600/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold text-lg font-mono shrink-0 shadow-xs">
                {resident.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Room {resident.room || '—'}
                  </span>
                  <AppleBadge
                    color={
                      resident.status === 'Active'
                        ? 'green'
                        : resident.status === 'Hospital'
                        ? 'orange'
                        : resident.status === 'LOA'
                        ? 'blue'
                        : 'gray'
                    }
                    dot
                  >
                    {resident.status}
                  </AppleBadge>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-sans mt-0.5">
                  {resident.name}
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Non-Overridable NPO Hard-Block Alert */}
            {isNpo && (
              <div className="p-4 rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-600/20 space-y-1">
                <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wide">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span>NPO Hard-Block Active</span>
                </div>
                <p className="text-xs text-rose-100 leading-relaxed">
                  Strictly nothing by mouth. No food, liquids, or oral supplements may be served.
                  {npoReason ? ` Reason: ${npoReason}` : ''}
                </p>
              </div>
            )}

            {/* IDDSI 2.0 & Texture Specification Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                IDDSI 2.0 Swallowing &amp; Texture
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Food Texture:</span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-black font-mono bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                  {iddsiChipLabel(resident.texture || 'Regular')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Liquid Consistency:</span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {resident.fluidConsistency || (resident as any).liquidConsistency || 'Thin'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Diet Order:</span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {resident.dietType || 'Regular'}
                </span>
              </div>
            </div>

            {/* Clinical Allergies & Exclusions Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Allergen Profile
              </div>
              {allergies.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {allergies.map(a => (
                    <span
                      key={a}
                      className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 inline-flex items-center gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>NKDA — No Known Drug or Food Allergies</span>
                </div>
              )}
            </div>

            {/* Dining Logistics & Portions Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Dining Logistics &amp; Supplements
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-bold uppercase">Location</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {resident.servingLocation === 'Room' ? 'In-Room Tray' : 'Main Dining Room'}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-bold uppercase">Ensure / Day</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {resident.ensurePerDay ? `${resident.ensurePerDay} Cans` : 'None'}
                  </div>
                </div>
              </div>

              {/* Likes & Dislikes */}
              {resident.dislikes && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs">
                  <span className="font-bold text-slate-500">Exclusions / Dislikes: </span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">{resident.dislikes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Footer */}
          <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-850/80 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <AppleButton
                variant="secondary"
                size="md"
                className="w-full min-h-[44px] text-xs font-bold justify-center"
                icon={<Printer className="w-4 h-4" />}
                onClick={() => {
                  onClose()
                  navigate(`/kitchen/traycards?residentId=${resident.id}`)
                }}
              >
                Print Tray Card
              </AppleButton>

              <AppleButton
                variant="primary"
                size="md"
                className="w-full min-h-[44px] text-xs font-bold justify-center"
                icon={<ExternalLink className="w-4 h-4" />}
                onClick={() => {
                  onClose()
                  navigate(`/residents/${resident.id}`)
                }}
              >
                Full EMR Chart
              </AppleButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
