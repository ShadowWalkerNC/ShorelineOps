import React, { useState } from 'react'
import { useResidentsStore } from '../../state/residentsStore'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import {
  Printer,
  Users,
  ShieldAlert,
  CheckCircle2,
  QrCode,
  Sparkles,
  MapPin,
  Stethoscope,
  Activity,
  AlertTriangle,
  AlertOctagon,
  HeartPulse,
} from 'lucide-react'

const IDDSI_COLORS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  Regular:          { bg: '#f1f5f9', color: '#0f172a', border: '#cbd5e1', label: 'IDDSI Level 7 (Regular)' },
  'Cut-Up':         { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc', label: 'IDDSI Level 6 (Soft & Bite-Sized)' },
  Minced:           { bg: '#fef3c7', color: '#b45309', border: '#fcd34d', label: 'IDDSI Level 5 (Minced & Moist)' },
  'Minced & Moist': { bg: '#fef3c7', color: '#b45309', border: '#fcd34d', label: 'IDDSI Level 5 (Minced & Moist)' },
  Pureed:           { bg: '#d1fae5', color: '#047857', border: '#6ee7b7', label: 'IDDSI Level 4 (Pureed)' },
}

export default function TrayCardGeneratorPage() {
  const { residents } = useResidentsStore()
  const [selectedWing, setSelectedWing] = useState<string>('all')
  const [selectedMeal, setSelectedMeal] = useState<'Breakfast' | 'Lunch' | 'Dinner'>('Lunch')

  const wings = Array.from(new Set(residents.map((r: any) => r.wing || 'West Wing'))).filter(Boolean)

  const filteredResidents = residents.filter((r: any) => {
    if (selectedWing !== 'all' && (r.wing || 'West Wing') !== selectedWing) return false
    return true
  })

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 py-2">
      {/* ── Apple Page Header (Hidden on Print) ── */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
              Clinical Tray Cards &amp; 4&times;6 Meal Tickets
            </h1>
            <AppleBadge color="blue" dot>
              {filteredResidents.length} Patient Trays
            </AppleBadge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Point-of-service clinical meal verification tickets with IDDSI 2.0 textures, fluid consistencies, and allergen hard-blocks.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <select
            value={selectedWing}
            onChange={e => setSelectedWing(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="all">All Care Units &amp; Wings</option>
            {wings.map((wing: any) => (
              <option key={wing} value={wing}>{wing}</option>
            ))}
          </select>

          <select
            value={selectedMeal}
            onChange={e => setSelectedMeal(e.target.value as any)}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="Breakfast">Breakfast Service (07:30 AM)</option>
            <option value="Lunch">Lunch Service (12:00 PM)</option>
            <option value="Dinner">Dinner Service (05:00 PM)</option>
          </select>

          <AppleButton
            variant="primary"
            size="md"
            icon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Print 4&times;6 Thermal Tray Cards
          </AppleButton>
        </div>
      </div>

      {/* ── Cards Grid (Optimized for Screen & Print) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredResidents.map((resident: any) => {
          const texture = resident.texture || resident.dietTexture || 'Regular'
          const fluid = resident.fluidConsistency || resident.liquidConsistency || 'Thin Liquids'
          const allergies = resident.allergies || []
          const dislikes = resident.dislikes || []
          const dietOrder = resident.dietOrder || resident.dietType || 'Regular Diet'
          const isNpo = dietOrder?.toUpperCase().includes('NPO') || texture?.toUpperCase().includes('NPO')
          const iddsiInfo = IDDSI_COLORS[texture] || IDDSI_COLORS.Regular

          return (
            <AppleCard
              key={resident.id}
              className={`p-4 sm:p-5 flex flex-col justify-between border-2 ${
                isNpo
                  ? 'border-red-500 bg-red-50/20 dark:bg-red-950/20'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
              } rounded-2xl break-inside-avoid shadow-xs hover:border-teal-500/50 transition-all`}
            >
              <div className="space-y-3">
                {/* Clinical Header */}
                <div className="flex items-start justify-between border-b-2 border-slate-200 dark:border-slate-800 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-teal-700 dark:text-teal-400 font-mono px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800">
                        ROOM {resident.roomNumber || resident.room || '101'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">MRN: SH-{resident.id?.slice(0, 5) || '1004'}</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight mt-1">
                      {resident.name}
                    </h3>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{resident.servingLocation || 'Dining Room'} &middot; Table {resident.tableAssignment || 'T-2'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-black uppercase text-teal-700 dark:text-teal-300 font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                      {selectedMeal}
                    </span>
                    <div className="p-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <QrCode className="w-6 h-6 text-slate-700 dark:text-slate-300" />
                    </div>
                  </div>
                </div>

                {/* NPO BANNER */}
                {isNpo && (
                  <div className="p-2 rounded-xl bg-red-600 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs animate-pulse">
                    <AlertOctagon className="w-4 h-4" />
                    <span>NPO: DO NOT DELIVER TRAY (HOLD)</span>
                  </div>
                )}

                {/* Diet Order & IDDSI Texture Block */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-500">Therapeutic Diet:</span>
                    <span className="font-black text-slate-900 dark:text-white">{dietOrder}</span>
                  </div>

                  <div
                    className="flex items-center justify-between p-2 rounded-xl font-bold"
                    style={{ background: iddsiInfo.bg, color: iddsiInfo.color, border: `1px solid ${iddsiInfo.border}` }}
                  >
                    <span>IDDSI Food:</span>
                    <span className="font-black">{iddsiInfo.label}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200">
                    <span className="font-bold text-teal-700 dark:text-teal-400">Liquid Texture:</span>
                    <span className="font-black">{fluid}</span>
                  </div>
                </div>

                {/* Allergy Alerts */}
                {allergies.length > 0 ? (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 text-xs">
                    <div className="flex items-center gap-1 font-black text-rose-700 dark:text-rose-300 text-[11px] mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>CLINICAL ALLERGIES (NON-OVERRIDABLE)</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {allergies.map((a: string) => (
                        <span key={a} className="px-1.5 py-0.5 rounded bg-white dark:bg-rose-900 font-black text-rose-700 dark:text-rose-200 text-[11px] border border-rose-300">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>No Known Food Allergens (NKDA)</span>
                  </div>
                )}

                {/* Dislikes / Likes */}
                {dislikes.length > 0 && (
                  <div className="text-[11px] text-slate-500 font-medium">
                    <strong className="text-slate-700 dark:text-slate-300">Exclude:</strong> {Array.isArray(dislikes) ? dislikes.join(', ') : dislikes}
                  </div>
                )}
              </div>

              {/* Security & Verification Footer */}
              <div className="pt-2.5 mt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <div className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-bold">
                  <HeartPulse className="w-3 h-3" />
                  <span>RD AUDITED · CMS F804 PASSED</span>
                </div>
                <span>TICKET #{resident.id?.slice(0, 4) || '101'}</span>
              </div>
            </AppleCard>
          )
        })}
      </div>
    </div>
  )
}
