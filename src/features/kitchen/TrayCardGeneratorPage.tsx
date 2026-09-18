import React, { useState, useEffect, useMemo } from 'react'
import { useResidentsStore } from '../../state/residentsStore'
import { tokenManager } from '@/security/tokenManager'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import { KitchenModeProvider, KitchenFitShell, KitchenModeToggle } from './KitchenModeContext'
import ClinicalSafetyStrip from './ClinicalSafetyStrip'
import {
  Printer,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  MapPin,
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

/** Engine-generated tray card (server/src/engine/production.ts PrintableTrayCard). */
interface TrayCard {
  ticketId: string
  residentId: string
  residentName: string
  room: string
  table: string
  mealSlot: string
  serviceDate: string
  dietOrder: string
  iddsiTexture: string
  textureBannerColor: string
  hasCriticalAllergies: boolean
  allergenList: string[]
  portionSize: string
  isNpo: boolean
  npoReason?: string
  fluidRestrictionMl?: number
  profileVersion: number
  qrToken: string
  selectedEntree: string
  selectedSides: string[]
  selectedBeverages: string[]
  specialNotes: string
}

function TrayCardGeneratorPageInner() {
  const { residents } = useResidentsStore()
  const [selectedWing, setSelectedWing] = useState<string>('all')
  const [selectedMeal, setSelectedMeal] = useState<'Breakfast' | 'Lunch' | 'Dinner'>('Lunch')
  const [cards, setCards] = useState<TrayCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const wings = Array.from(new Set(residents.map((r: any) => r.wing || 'West Wing'))).filter(Boolean)
  const wingByResidentId = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of residents as any[]) m.set(r.id, r.wing || 'West Wing')
    return m
  }, [residents])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const token = tokenManager.getAccessToken()
        const res = await fetch(
          `/api/kitchen/traycards-generated?mealSlot=${encodeURIComponent(selectedMeal)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        )
        if (!res.ok) throw new Error(`Tray card service returned ${res.status}`)
        const data = await res.json()
        if (!cancelled) setCards(Array.isArray(data.trayCards) ? data.trayCards : [])
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load tray cards')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedMeal])

  const filteredCards = cards.filter(c => {
    if (selectedWing !== 'all' && (wingByResidentId.get(c.residentId) || 'West Wing') !== selectedWing) return false
    return true
  })

  const handlePrint = () => {
    window.print()
  }

  return (
    <KitchenFitShell className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 py-2">
      {/* ── Apple Page Header (Hidden on Print) ── */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
              Clinical Tray Cards &amp; 4&times;6 Meal Tickets
            </h1>
            <AppleBadge color="blue" dot className="text-sm">
              {filteredCards.length} Patient Trays
            </AppleBadge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Point-of-service clinical meal verification tickets with IDDSI 2.0 textures, fluid consistencies, and allergen hard-blocks.
            Formatted with high-contrast human typography for 4&times;6 direct thermal card printing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <select
            value={selectedWing}
            onChange={e => setSelectedWing(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="all">All Care Units &amp; Wings</option>
            {wings.map((wing: any) => (
              <option key={wing} value={wing}>{wing}</option>
            ))}
          </select>

          <select
            value={selectedMeal}
            onChange={e => setSelectedMeal(e.target.value as any)}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="Breakfast">Breakfast Service (07:30 AM)</option>
            <option value="Lunch">Lunch Service (12:00 PM)</option>
            <option value="Dinner">Dinner Service (05:00 PM)</option>
          </select>

          <KitchenModeToggle />
          <AppleButton
            variant="primary"
            size="md"
            className="min-h-[44px]"
            icon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
            disabled={loading || filteredCards.length === 0}
          >
            Print 4&times;6 Thermal Tray Cards
          </AppleButton>
        </div>
      </div>

      {/* ── C02 clinical safety strip: current meal + live allergy/NPO counts ── */}
      <div className="no-print">
        <ClinicalSafetyStrip residents={residents as any[]} meal={selectedMeal} />
      </div>

      {loading && (
        <div className="no-print flex items-center gap-2 text-sm text-slate-500">
          <Sparkles className="w-4 h-4 animate-pulse" />
          Generating signed tray cards…
        </div>
      )}

      {error && !loading && (
        <div className="no-print p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border-2 border-red-300 text-sm font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>Could not load tray cards: {error}. Cards are not printed without a signed verification token.</span>
        </div>
      )}

      {/* ── 4x6 Thermal Print Styles ── */}
      <style>{`
        @media print {
          @page {
            size: 4in 6in;
            margin: 0.1in;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .tray-cards-container {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .tray-card-print {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: 3.8in !important;
            height: 5.8in !important;
            max-height: 5.8in !important;
            box-sizing: border-box !important;
            margin: 0 auto 0.2in auto !important;
            border: 2px solid #0f172a !important;
            box-shadow: none !important;
            overflow: hidden !important;
          }
        }
      `}</style>

      {/* ── Cards Grid (Optimized for Screen & Print) ── */}
      <div className="tray-cards-container grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCards.map(card => {
          const iddsiInfo = IDDSI_COLORS[card.iddsiTexture] || IDDSI_COLORS.Regular
          const allergies = card.allergenList || []

          return (
            <AppleCard
              key={card.ticketId}
              className={`tray-card-print p-4 sm:p-5 flex flex-col justify-between border-2 ${
                card.isNpo
                  ? 'border-red-500 bg-red-50/20 dark:bg-red-950/20'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
              } rounded-2xl break-inside-avoid shadow-xs hover:border-teal-500/50 transition-all`}
            >
              <div className="space-y-3">
                {/* Clinical Header */}
                <div className="flex items-start justify-between border-b-2 border-slate-200 dark:border-slate-800 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black uppercase tracking-wider text-teal-700 dark:text-teal-400 font-mono px-2 py-1 rounded bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800">
                        ROOM {card.room || '—'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">v{card.profileVersion}</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight mt-1">
                      {card.residentName}
                    </h3>
                    <div className="text-sm text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{card.table || 'Dining Room'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 text-right">
                    <span className="text-sm font-black uppercase text-teal-700 dark:text-teal-300 font-mono px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      {card.mealSlot}
                    </span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Portion: <strong className="text-slate-900 dark:text-white">{card.portionSize || 'Regular'}</strong>
                    </span>
                  </div>
                </div>

                {/* NPO BANNER — driven by the real is_npo flag, with reason */}
                {card.isNpo && (
                  <div className="p-2 rounded-xl bg-red-600 text-white font-black text-sm flex items-center justify-center gap-1.5 shadow-xs animate-pulse">
                    <AlertOctagon className="w-4 h-4" />
                    <span>NPO: DO NOT DELIVER TRAY (HOLD){card.npoReason ? ` — ${card.npoReason}` : ''}</span>
                  </div>
                )}

                {/* Diet Order & IDDSI Texture Block */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-500">Therapeutic Diet:</span>
                    <span className="font-black text-slate-900 dark:text-white">{card.dietOrder}</span>
                  </div>

                  <div
                    className="flex items-center justify-between p-2 rounded-xl font-bold"
                    style={{ background: iddsiInfo.bg, color: iddsiInfo.color, border: `1px solid ${iddsiInfo.border}` }}
                  >
                    <span>IDDSI Food:</span>
                    <span className="font-black">{iddsiInfo.label}</span>
                  </div>

                  {card.fluidRestrictionMl ? (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200">
                      <span className="font-bold text-teal-700 dark:text-teal-400">Fluid Limit:</span>
                      <span className="font-black">{card.fluidRestrictionMl} ml/day</span>
                    </div>
                  ) : null}
                </div>

                {/* Entrée (NPO lockout text comes from the engine) */}
                <div className={`p-2 rounded-xl text-sm font-black ${card.isNpo ? 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-200 border border-red-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'}`}>
                  {card.selectedEntree}
                </div>

                {/* Allergy Alerts */}
                {allergies.length > 0 ? (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 text-sm">
                    <div className="flex items-center gap-1 font-black text-rose-700 dark:text-rose-300 text-sm mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>CLINICAL ALLERGIES (NON-OVERRIDABLE)</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {allergies.map((a: string) => (
                        <span key={a} className="px-2 py-1 rounded bg-white dark:bg-rose-900 font-black text-rose-700 dark:text-rose-200 text-sm border border-rose-300">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>No Known Food Allergens (NKDA)</span>
                  </div>
                )}

                {card.specialNotes && (
                  <div className="text-sm text-slate-500 font-medium">
                    <strong className="text-slate-700 dark:text-slate-300">Notes:</strong> {card.specialNotes}
                  </div>
                )}
              </div>

              {/* Security & Verification Footer */}
              <div className="pt-2.5 mt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                <div className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-bold">
                  <HeartPulse className="w-3 h-3" />
                  <span>SIGNED v{card.profileVersion}</span>
                </div>
                <span className="truncate max-w-[55%]" title={card.qrToken}>{card.ticketId}</span>
              </div>
            </AppleCard>
          )
        })}
      </div>
    </KitchenFitShell>
  )
}

/** C02: each kitchen page mounts its own provider so the per-device
 *  kitchen-mode preference applies to this page's subtree. */
export default function TrayCardGeneratorPage() {
  return (
    <KitchenModeProvider>
      <TrayCardGeneratorPageInner />
    </KitchenModeProvider>
  )
}
