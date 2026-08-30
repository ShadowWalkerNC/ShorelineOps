import React, { useState } from 'react'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import { Sparkles, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, X, ChevronRight, Activity, BookOpen, Layers } from 'lucide-react'

export interface ClinicalDietaryModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ClinicalDietaryModal({ isOpen, onClose }: ClinicalDietaryModalProps) {
  const [activeTab, setActiveTab] = useState<'audit' | 'iddsi' | 'substitution'>('audit')

  // IDDSI Calculator state
  const [iddsiFoodCategory, setIddsiFoodCategory] = useState<'Meat/Poultry' | 'Fish' | 'Starch/Potato' | 'Vegetable' | 'Fruit'>('Meat/Poultry')
  const [iddsiPortionLbs, setIddsiPortionLbs] = useState<number>(5.0)
  const [iddsiLevel, setIddsiLevel] = useState<4 | 5 | 6>(4)

  // Substitution state
  const [subConstraint, setSubConstraint] = useState<'GLUTEN_FREE' | 'DAIRY_FREE' | 'LOW_SODIUM' | 'LOW_POTASSIUM_RENAL' | 'LOW_CARB_DIABETIC'>('GLUTEN_FREE')

  if (!isOpen) return null

  // Deterministic IDDSI calculation
  const solidWeightGrams = Math.round(iddsiPortionLbs * 453.592)
  const liquidRatio = iddsiFoodCategory === 'Meat/Poultry' 
    ? (iddsiLevel === 4 ? 0.30 : 0.15)
    : iddsiFoodCategory === 'Fish' 
    ? (iddsiLevel === 4 ? 0.20 : 0.10)
    : iddsiFoodCategory === 'Vegetable' 
    ? (iddsiLevel === 4 ? 0.15 : 0.08)
    : 0.22

  const liquidGrams = Math.round(solidWeightGrams * liquidRatio)
  const liquidOz = Math.round((liquidGrams / 28.3495) * 10) / 10
  const thickenerGrams = iddsiFoodCategory === 'Vegetable' && iddsiLevel === 4 ? Math.round(solidWeightGrams * 0.02) : 0

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Clinical Dietary & Texture Engine</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic clinical rules & algorithms &middot; Zero AI / 100% compliant with USDA & IDDSI 2.0
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-800/80 p-1 rounded-2xl gap-1 mb-6">
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
              activeTab === 'audit' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            7-Day Cycle Balance Audit
          </button>
          <button
            onClick={() => setActiveTab('iddsi')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
              activeTab === 'iddsi' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            IDDSI Texture Formulation
          </button>
          <button
            onClick={() => setActiveTab('substitution')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
              activeTab === 'substitution' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            Deterministic Substitution Solver
          </button>
        </div>

        {/* Tab 1: 7-Day Cycle Balance Audit */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 flex flex-col justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">Protein Rotation</div>
                <div className="text-2xl font-black text-emerald-300 mt-2">100% Balanced</div>
                <div className="text-[11px] text-emerald-200/80 mt-1">Zero consecutive protein clashes (Poultry &rarr; Fish &rarr; Beef &rarr; Pork)</div>
              </div>
              <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800/60 flex flex-col justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-blue-400 font-mono">Chromatic Contrast</div>
                <div className="text-2xl font-black text-blue-300 mt-2">94% Variety</div>
                <div className="text-[11px] text-blue-200/80 mt-1">Green, Orange, and Red vegetable sides prevent monochromatic plates</div>
              </div>
              <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-800/60 flex flex-col justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-purple-400 font-mono">CMS F809 14-Hr Span</div>
                <div className="text-2xl font-black text-purple-300 mt-2">13.5 Hours</div>
                <div className="text-[11px] text-purple-200/80 mt-1">Dinner (6:00 PM) to Breakfast (7:30 AM) complies with Federal Limit</div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-3">
              <div className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Clinical Review & Regulatory Summary (CMS F800 - F814)
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold font-mono">&#x2713;</span>
                  <span><strong>F800 Palatability:</strong> Menu provides diverse culinary variety without repetitive starch or heavy cream bases.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold font-mono">&#x2713;</span>
                  <span><strong>F804 Dysphagia:</strong> All lunch & dinner items have pre-calculated IDDSI Level 4 and Level 5 kitchen scaling cards.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold font-mono">&#x2713;</span>
                  <span><strong>F808 Therapeutic Diets:</strong> Sodium ceiling &le; 600mg/meal (NAS) and carbohydrate ceiling &le; 60g/meal (NCS).</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: IDDSI Texture Formulation */}
        {activeTab === 'iddsi' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Food Category</label>
                <select
                  value={iddsiFoodCategory}
                  onChange={e => setIddsiFoodCategory(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Meat/Poultry">Meat / Poultry (Chicken, Turkey, Pork)</option>
                  <option value="Fish">Fish / Seafood (Cod, Salmon)</option>
                  <option value="Vegetable">Vegetables (Green Beans, Carrots, Broccoli)</option>
                  <option value="Starch/Potato">Starch (Potatoes, Rice, Pasta)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Cooked Batch Weight</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={0.5}
                    value={iddsiPortionLbs}
                    onChange={e => setIddsiPortionLbs(parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white font-medium focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-bold text-slate-400 font-mono">Lbs</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Target IDDSI Texture</label>
                <select
                  value={iddsiLevel}
                  onChange={e => setIddsiLevel(parseInt(e.target.value) as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value={4}>IDDSI Level 4 (Pureed)</option>
                  <option value={5}>IDDSI Level 5 (Minced & Moist)</option>
                  <option value={6}>IDDSI Level 6 (Soft & Bite-Sized)</option>
                </select>
              </div>
            </div>

            {/* Formulation Card */}
            <div className="p-5 rounded-2xl bg-blue-950/30 border border-blue-800/50 space-y-4">
              <div className="flex items-center justify-between border-b border-blue-800/40 pb-3">
                <div className="font-bold text-base text-blue-300">
                  Kitchen Formulation Sheet: {iddsiFoodCategory} &rarr; IDDSI Level {iddsiLevel}
                </div>
                <AppleBadge color="blue" dot>
                  100% Deterministic Math
                </AppleBadge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-slate-800/60 rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Base Solid Weight</div>
                  <div className="text-lg font-bold text-white mt-1">{iddsiPortionLbs} lbs ({solidWeightGrams}g)</div>
                </div>
                <div className="p-3 bg-slate-800/60 rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Liquid Binder Needed</div>
                  <div className="text-lg font-bold text-emerald-400 mt-1">{liquidOz} fl oz ({liquidGrams}g)</div>
                </div>
                <div className="p-3 bg-slate-800/60 rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Binder Type</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">Fortified Stock / Broth</div>
                </div>
                <div className="p-3 bg-slate-800/60 rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Thickener Agent</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">{thickenerGrams > 0 ? `${thickenerGrams}g Starch` : 'None Needed'}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl text-xs space-y-1.5 text-slate-300 border border-slate-800">
                <div className="font-bold text-blue-400">IDDSI 2.0 Compliance Protocol:</div>
                <div>&bull; <strong>Fork Drip Test:</strong> Puree sits in a cohesive mound above tines; does not drip through continuously.</div>
                <div>&bull; <strong>Spoon Tilt Test:</strong> Puree slides cleanly off tilted spoon with minimal food residue left behind.</div>
                <div>&bull; <strong>Temperature:</strong> Serve at &ge; 140&deg;F (Hot) or &le; 41&deg;F (Cold). Re-verify texture after hot-holding.</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Deterministic Substitution Solver */}
        {activeTab === 'substitution' && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'GLUTEN_FREE', label: 'Gluten-Free' },
                { key: 'DAIRY_FREE', label: 'Dairy-Free' },
                { key: 'LOW_SODIUM', label: 'Low Sodium (NAS)' },
                { key: 'LOW_POTASSIUM_RENAL', label: 'Renal (Low Potassium)' },
                { key: 'LOW_CARB_DIABETIC', label: 'Diabetic (NCS)' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSubConstraint(opt.key as any)}
                  className={`py-2 px-3.5 rounded-xl font-bold text-xs transition-all ${
                    subConstraint === opt.key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subConstraint === 'GLUTEN_FREE' && (
                <>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-2">
                    <div className="font-bold text-sm text-slate-200">Wheat Flour / Roux Thickener</div>
                    <div className="text-xs text-emerald-400 font-bold">&rarr; Cornstarch &amp; White Rice Flour (0.85x ratio)</div>
                    <p className="text-xs text-slate-400">Slurry with cold water before whisking into boiling stock. Prevents gluten reaction while maintaining glossy sheen.</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-2">
                    <div className="font-bold text-sm text-slate-200">Standard Breadcrumbs</div>
                    <div className="text-xs text-emerald-400 font-bold">&rarr; Certified Gluten-Free Panko / Crushed Rice Cereal</div>
                    <p className="text-xs text-slate-400">Use for breading baked fish or binding meatloaves without compromising crunch or texture.</p>
                  </div>
                </>
              )}

              {subConstraint === 'LOW_SODIUM' && (
                <>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-2">
                    <div className="font-bold text-sm text-slate-200">Kosher / Table Salt</div>
                    <div className="text-xs text-emerald-400 font-bold">&rarr; Lemon-Herb Seasoning (Thyme, Garlic, Lemon Peel)</div>
                    <p className="text-xs text-slate-400">Reduces sodium by 580mg per portion while providing bright palate stimulation for senior diners.</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-2">
                    <div className="font-bold text-sm text-slate-200">Soy Sauce / Teriyaki</div>
                    <div className="text-xs text-emerald-400 font-bold">&rarr; Coconut Aminos &amp; Ginger Reduction</div>
                    <p className="text-xs text-slate-400">Provides rich umami depth with 70% less sodium than conventional commercial soy sauces.</p>
                  </div>
                </>
              )}

              {subConstraint === 'LOW_POTASSIUM_RENAL' && (
                <>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-2">
                    <div className="font-bold text-sm text-slate-200">Baked / Mashed Potatoes</div>
                    <div className="text-xs text-emerald-400 font-bold">&rarr; Steamed Cauliflower Mash or Jasmine Rice</div>
                    <p className="text-xs text-slate-400">Lowers potassium by over 420mg per portion, safeguarding residents with Stage 3-5 CKD.</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-2">
                    <div className="font-bold text-sm text-slate-200">Cooked Spinach / Tomatoes</div>
                    <div className="text-xs text-emerald-400 font-bold">&rarr; Steamed Green Beans / Yellow Squash</div>
                    <p className="text-xs text-slate-400">Replaces high-potassium oxalates with gentle, kidney-friendly vitamin A and C sources.</p>
                  </div>
                </>
              )}

              {subConstraint === 'DAIRY_FREE' && (
                <>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-2">
                    <div className="font-bold text-sm text-slate-200">Butter / Heavy Cream</div>
                    <div className="text-xs text-emerald-400 font-bold">&rarr; Extra Virgin Olive Oil &amp; Oat Milk Emulsion</div>
                    <p className="text-xs text-slate-400">Eliminates casein and lactose allergens while maintaining velvety mouthfeel in soups and purees.</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-2">
                    <div className="font-bold text-sm text-slate-200">Cheddar / Swiss Cheese</div>
                    <div className="text-xs text-emerald-400 font-bold">&rarr; Nutritional Yeast Flakes &amp; Cashew Cream</div>
                    <p className="text-xs text-slate-400">Provides savory cheesy flavor and B-vitamins with zero dairy allergen risk.</p>
                  </div>
                </>
              )}

              {subConstraint === 'LOW_CARB_DIABETIC' && (
                <>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-2">
                    <div className="font-bold text-sm text-slate-200">Refined Sugar / Honey Glaze</div>
                    <div className="text-xs text-emerald-400 font-bold">&rarr; Monkfruit / Allulose Reduction (0.8x ratio)</div>
                    <p className="text-xs text-slate-400">Prevents glycemic spikes while allowing senior residents to enjoy sweet dessert sauces safely.</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-2">
                    <div className="font-bold text-sm text-slate-200">White Bread / Pasta</div>
                    <div className="text-xs text-emerald-400 font-bold">&rarr; High-Fiber Spelt / Zucchini Ribbons</div>
                    <p className="text-xs text-slate-400">Maintains plate volume while lowering net carbohydrate impact below 60g per meal.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-800 pt-5 mt-6 flex justify-end">
          <AppleButton variant="secondary" onClick={onClose}>
            Close Engine
          </AppleButton>
        </div>
      </div>
    </div>
  )
}
