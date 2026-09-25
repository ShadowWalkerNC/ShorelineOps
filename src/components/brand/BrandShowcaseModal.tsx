import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import ConfirmDestructiveDialog from '@/components/ui/ConfirmDestructiveDialog'
import {
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  HeartPulse,
  ChefHat,
  ShieldCheck,
  Eye,
} from 'lucide-react'

interface BrandShowcaseModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Interactive In-App Shoreline Brand & UI Component Guide.
 * Displays all foundational UI blocks, cards, buttons, color tokens,
 * IDDSI clinical badges, and destructive dialog patterns in one place.
 */
export default function BrandShowcaseModal({ open, onClose }: BrandShowcaseModalProps) {
  const [activeTab, setActiveTab] = useState<'buttons' | 'cards' | 'clinical' | 'dialogs'>('buttons')
  const [sampleConfirmOpen, setSampleConfirmOpen] = useState(false)

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-3 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 text-[10px] font-bold tracking-wider uppercase font-mono border border-blue-200/60 dark:border-blue-800/60">
                Design System Showcase
              </span>
            </div>
            <DialogTitle className="text-2xl font-extrabold text-slate-900 dark:text-white font-sans">
              Shoreline Brand &amp; UI System
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Interactive specifications for Apple HIG components, Jakob's Law mobile touch targets, and clinical safety patterns.
            </DialogDescription>
          </DialogHeader>

          {/* Sub-Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-3 mb-6 overflow-x-auto text-xs font-semibold">
            <button
              onClick={() => setActiveTab('buttons')}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'buttons'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Buttons &amp; Touch Targets
            </button>
            <button
              onClick={() => setActiveTab('cards')}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'cards'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Card Architecture
            </button>
            <button
              onClick={() => setActiveTab('clinical')}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'clinical'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Clinical Safety &amp; IDDSI
            </button>
            <button
              onClick={() => setActiveTab('dialogs')}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'dialogs'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Destructive Clarifications
            </button>
          </div>

          {/* Tab 1: Buttons & Touch Targets */}
          {activeTab === 'buttons' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Standard Touch-Target Buttons (≥44px Height)</CardTitle>
                  <CardDescription>
                    All buttons feature tactile press animations (active:scale-[0.98]) and comply with iOS HIG and Material touch-target requirements.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-3">
                  <Button variant="default" className="h-11 px-5">
                    <span>Default Primary</span>
                  </Button>
                  <Button variant="apple" className="h-11 px-5">
                    <span>Apple Action</span>
                  </Button>
                  <Button variant="secondary" className="h-11 px-5">
                    <span>Secondary</span>
                  </Button>
                  <Button variant="outline" className="h-11 px-5">
                    <span>Outline Action</span>
                  </Button>
                  <Button variant="destructive" className="h-11 px-5">
                    <Trash2 className="w-4 h-4 mr-2" />
                    <span>Destructive</span>
                  </Button>
                  <Button variant="ghost" className="h-11 px-4">
                    <span>Ghost Option</span>
                  </Button>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80">
                  <div className="text-[11px] font-mono text-slate-400 uppercase">Touch Standard</div>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-1">44px Height</div>
                  <div className="text-xs text-slate-500 mt-1">Comfortable for gloved kitchen line cooks.</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80">
                  <div className="text-[11px] font-mono text-slate-400 uppercase">Feedback Speed</div>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-1">80ms Tactile</div>
                  <div className="text-xs text-slate-500 mt-1">Instant active-scale response prevents double-taps.</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80">
                  <div className="text-[11px] font-mono text-slate-400 uppercase">Accessibility</div>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-1">WCAG 2.1 AA</div>
                  <div className="text-xs text-slate-500 mt-1">4.5:1 minimum clinical contrast on all text.</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Card Architecture */}
          {activeTab === 'cards' && (
            <div className="space-y-6">
              <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Every record and operational section in Shoreline is enclosed within an outlined, card-based surface. This removes visual noise and prevents content from blending into the background.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold font-mono">
                        ROOM 104 • PINE WING
                      </span>
                      <span className="text-xs text-slate-400 font-mono">Active</span>
                    </div>
                    <CardTitle className="text-base mt-2">Harold Simmons</CardTitle>
                    <CardDescription>Pureed (IDDSI Level 4) • Diabetic Regular</CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-slate-500">Table Assignment:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Table 2 (Dining Room)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-slate-500">Ensure Supplement:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">1x Daily (Lunch)</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-bold font-mono">
                        LINE ITEM MRP SPREAD
                      </span>
                      <span className="text-xs text-emerald-600 font-bold font-mono">-$0.42 / lb</span>
                    </div>
                    <CardTitle className="text-base mt-2">Chicken Breast B/S 4oz</CardTitle>
                    <CardDescription>Dennis DNS-1092 vs Sysco SY-4910</CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-slate-500">Dennis Contract Price:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">$2.15 / lb (Winner)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-slate-500">Sysco Contract Price:</span>
                      <span className="font-semibold text-rose-500">$2.57 / lb (+19.5%)</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Tab 3: Clinical Safety & IDDSI */}
          {activeTab === 'clinical' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">IDDSI 2.0 Dysphagia Standard Badges</CardTitle>
                  <CardDescription>
                    Deterministic, high-contrast badges for swallowing safety levels. Colors follow the International Dysphagia Diet Standardisation Initiative.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2.5">
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-xs border border-emerald-300/80 dark:border-emerald-800/80">
                    IDDSI 7 • Regular Diet
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-bold text-xs border border-blue-300/80 dark:border-blue-800/80">
                    IDDSI 6 • Soft &amp; Bite-Sized
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold text-xs border border-amber-300/80 dark:border-amber-800/80">
                    IDDSI 5 • Minced &amp; Moist
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 font-bold text-xs border border-purple-300/80 dark:border-purple-800/80">
                    IDDSI 4 • Pureed
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 font-bold text-xs border border-rose-300/80 dark:border-rose-800/80">
                    IDDSI 3 • Liquidised / Moderately Thick
                  </span>
                </CardContent>
              </Card>

              <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-rose-900 dark:text-rose-200">Non-Overridable Clinical Hard-Blocks</div>
                  <div className="text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">
                    NPO orders and documented resident allergens (e.g. Shellfish, Peanuts) trigger deterministic blockers in tray dispatch and kitchen sheets. Staff cannot dismiss or bypass these alerts without modifying the clinical EHR record.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Destructive Action Confirmations */}
          {activeTab === 'dialogs' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Explicit Destructive Verification Pattern</CardTitle>
                  <CardDescription>
                    Never show vague prompts like "Are you sure?". Shoreline destructive dialogs clearly explain the item, the resource type, and the cascading consequences.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    variant="destructive"
                    className="h-11 px-5"
                    onClick={() => setSampleConfirmOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    <span>Launch Example Confirmation Dialog</span>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Example Confirm Destructive Dialog */}
      <ConfirmDestructiveDialog
        open={sampleConfirmOpen}
        onClose={() => setSampleConfirmOpen(false)}
        onConfirm={() => {
          alert('Example deletion confirmed.')
        }}
        resourceType="Resident Census Record"
        itemName="Harold Simmons (Room 104)"
        consequences={[
          'Active tray card and meal tickets will be permanently voided.',
          'Associated clinical diet texture orders (Pureed IDDSI 4) will be archived.',
          'Historical HACCP meal delivery logs will be unlinked.',
        ]}
      />
    </>
  )
}
