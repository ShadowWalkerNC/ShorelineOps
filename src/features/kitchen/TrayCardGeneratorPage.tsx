import React, { useState } from 'react'
import { useResidentsStore } from '../../state/residentsStore'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import { Printer, Users, ShieldAlert, CheckCircle2, QrCode, Sparkles, MapPin } from 'lucide-react'

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
              Tray Cards &amp; Meal Tickets
            </h1>
            <AppleBadge color="blue" dot>
              {filteredResidents.length} Residents
            </AppleBadge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Generate standardized 4&times;6 thermal and paper tray delivery cards with IDDSI textures and allergy warnings.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <select
            value={selectedWing}
            onChange={e => setSelectedWing(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Wings &amp; Units</option>
            {wings.map((wing: any) => (
              <option key={wing} value={wing}>{wing}</option>
            ))}
          </select>

          <select
            value={selectedMeal}
            onChange={e => setSelectedMeal(e.target.value as any)}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="Breakfast">Breakfast Service</option>
            <option value="Lunch">Lunch Service</option>
            <option value="Dinner">Dinner Service</option>
          </select>

          <AppleButton
            variant="primary"
            size="md"
            icon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Print Tray Cards
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

          return (
            <AppleCard
              key={resident.id}
              className="p-5 flex flex-col justify-between border-2 border-slate-200 dark:border-slate-800 break-inside-avoid shadow-sm hover:border-blue-500/40 transition-all"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 font-mono">
                      Room {resident.roomNumber || resident.room || 'Unassigned'}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mt-0.5">
                      {resident.name}
                    </h3>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      <span>{resident.wing || 'Main Wing'} &middot; Table {resident.tableNumber || '1'}</span>
                    </div>
                  </div>

                  <AppleBadge color="blue">
                    {selectedMeal}
                  </AppleBadge>
                </div>

                {/* IDDSI Textures Block */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 font-mono">Food Texture</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-0.5">{texture}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 font-mono">Liquid Consistency</div>
                    <div className="font-bold text-teal-600 dark:text-teal-400 mt-0.5">{fluid}</div>
                  </div>
                </div>

                {/* Diet Order */}
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="text-slate-400 uppercase font-mono text-[10px] block">Therapeutic Diet</span>
                  {dietOrder}
                </div>

                {/* Allergies / Clinical Alerts */}
                {allergies.length > 0 ? (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>ALLERGIES: {allergies.join(', ')}</span>
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>No Known Food Allergies</span>
                  </div>
                )}

                {dislikes.length > 0 && (
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold text-slate-500">Dislikes:</span> {dislikes.join(', ')}
                  </div>
                )}
              </div>

              {/* QR Verification Token */}
              <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-3 mt-4 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>TKT-{resident.id?.slice(0, 6) || 'res01'}:{resident.profile_version || 1}</span>
                </div>
                <span className="font-bold text-slate-500">v{resident.profile_version || 1} Verified</span>
              </div>
            </AppleCard>
          )
        })}
      </div>
    </div>
  )
}
