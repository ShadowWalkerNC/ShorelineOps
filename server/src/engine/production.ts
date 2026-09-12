/**
 * Kitchen Batch Production & Clinical Tray Service Engine
 * FOOD-TRAK / MealSuite KMS Parity
 * 
 * Provides:
 * - Recipe Variant Graph Explosion (Regular, Pureed L4, Minced & Moist L5, NAS, NCS)
 * - Prep station partitioning (Hot Line, Cold Prep, Puree Station, Bakery)
 * - Pan yield scaling (2" hotel pans, sheet pans) & HACCP 165°F temp monitoring
 * - Signed QR verification tokens on individualized tray cards
 */

import crypto from 'crypto'
import { UnitConversionEngine } from './units'
import { activeCensus } from '../db/census'

export interface ResidentServiceProfile {
  id: string
  name: string
  room: string
  tableAssignment?: string
  servingLocation: string
  dietType: string
  texture: string
  portionSize: 'Small' | 'Regular' | 'Large'
  profileVersion?: number
  isNpo?: boolean
  npoReason?: string
  fluidRestrictionMl?: number
  status?: string // Resident status (Active/Hospital/LOA/Passed Away).
  // B03: census filtering is on `status` — never on `servingLocation`.
  // Absent status is treated as Active (the residents.status DB default),
  // so legacy callers that omit it keep working.
  allergies: string[]
  beverages: string[]
  likes?: string
  dislikes?: string
  specialInstructions?: string
}

export interface ScaledBatchRecipe {
  recipeId: string
  recipeName: string
  variantType: 'Regular' | 'Pureed' | 'Minced & Moist' | 'Low Sodium' | 'Carb-Controlled'
  iddsiLevel?: string
  station: 'Hot Line' | 'Cold Prep' | 'Puree Station' | 'Bakery' | 'Beverage Station'
  targetPortions: number
  scaleFactor: number
  haccpTargetTempF: number
  panRequirement?: string // e.g. "2 x Full 2-inch Hotel Pans"
  scaledIngredients: Array<{
    item: string
    baseQty: string
    scaledQty: string
    vendorSku?: string
    notes?: string
  }>
  instructions: string[]
}

export interface PrintableTrayCard {
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
  qrToken: string // "ticketId:profileVersion:hash"
  selectedEntree: string
  selectedSides: string[]
  selectedBeverages: string[]
  specialNotes: string
}

export interface RecipeVariantGraphResult {
  baseRecipeName: string
  variants: ScaledBatchRecipe[]
  totalPortions: number
  stationSummary: Record<string, number>
}

// ── B07: server-side mirror of B02's IDDSI texture mapping ───────────────────
// Canonical mapping lives in the frontend type layer:
//   src/types/resident.ts → IDDSI_TEXTURE_LEVELS / iddsiForTexture (B02).
// It is mirrored here because the server engine cannot import the Vite
// frontend bundle. Keep the two tables in sync.
// IDDSI food levels: 7 Regular · 6 Soft & Bite-Sized · 5 Minced & Moist ·
// 4 Pureed · 3 Liquidised (drink levels 0–4 are a separate scale).
const IDDSI_FOOD_LEVEL_FOR_TEXTURE: Record<string, 3 | 4 | 5 | 6 | 7> = {
  'Regular': 7,
  'Cut-Up': 6,
  'Minced': 5,
  'Minced & Moist': 5,
  'Pureed': 4,
  'Liquid': 3,
}

/** Server-side mirror of B02's iddsiForTexture. Unknown texture → 7 (Regular). */
function iddsiFoodLevelForTexture(texture: string | null | undefined): 3 | 4 | 5 | 6 | 7 {
  const key = (texture ?? '').trim()
  return IDDSI_FOOD_LEVEL_FOR_TEXTURE[key] ?? 7
}

// ── B07: therapeutic diet → variant bucket mapping ───────────────────────────
// Canonical diet vocabulary: src/types/resident.ts → DIET_TYPES.
// Assumption (documented in the response payload): sodium-restricted orders
// (Low Sodium, Cardiac, Renal) batch under the Low-Sodium (NAS) variant;
// carbohydrate-restricted orders (Diabetic) batch under the Carb-Controlled
// (NCS) variant. 'Regular' and 'Mechanical Soft' map to no diet bucket — they
// are texture assignments, handled by the texture buckets instead.
const NAS_DIET_TYPES = new Set(['Low Sodium', 'Cardiac', 'Renal'])
const NCS_DIET_TYPES = new Set(['Diabetic'])

/** Census-derived therapeutic variant headcounts (B07), with provenance. */
export interface VariantHeadcountBreakdown {
  mealSlot: string
  regularCount: number
  pureedCount: number
  mincedCount: number
  nasCount: number
  ncsCount: number
  /** Active census residents included in the derivation (non-NPO). */
  censusCounted: number
  /** Active NPO residents excluded — NPO is a non-overridable hard block. */
  npoExcluded: number
  /** L3/L6/unknown textures folded into the Regular base batch. */
  otherTextureCount: number
  /** UI-ready display: "12 Regular · 3 Pureed L4 · 2 Minced L5 · 4 NAS · 2 NCS". */
  breakdownDisplay: string
  /** Mapping assumptions so the cook can audit the derivation. */
  mappingNotes: string[]
}

export class KitchenProductionEngine {
  /**
   * Determine kitchen prep station based on recipe category & texture
   */
  static determineStation(category: string, texture: string): ScaledBatchRecipe['station'] {
    const tex = texture.toLowerCase()
    if (tex.includes('puree') || tex.includes('level 4') || tex.includes('minced') || tex.includes('level 5')) {
      return 'Puree Station'
    }
    const cat = category.toLowerCase()
    if (['cookies', 'muffins', 'desserts', 'bakery', 'pies', 'cakes'].includes(cat)) return 'Bakery'
    if (['proteins', 'starches', 'soups', 'hot veggies', 'entrees', 'main'].includes(cat)) return 'Hot Line'
    if (['beverages'].includes(cat)) return 'Beverage Station'
    return 'Cold Prep'
  }

  /**
   * Calculate hotel pan requirements based on portions and category
   */
  static calculatePanLayout(portions: number, category: string): string {
    const cat = category.toLowerCase()
    if (cat.includes('protein') || cat.includes('entree')) {
      const pans = Math.ceil(portions / 25)
      return `${pans} x Full 2-inch Hotel Pan${pans > 1 ? 's' : ''}`
    }
    if (cat.includes('starch') || cat.includes('soup') || cat.includes('veggie')) {
      const pans = Math.ceil(portions / 30)
      return `${pans} x Full 4-inch Hotel Pan${pans > 1 ? 's' : ''}`
    }
    const sheetPans = Math.ceil(portions / 24)
    return `${sheetPans} x Full Sheet Pan${sheetPans > 1 ? 's' : ''}`
  }

  /**
   * Scale a master recipe to an exact target portion count for daily kitchen production
   */
  static scaleRecipeForBatch(
    recipe: {
      id: string
      name: string
      category: string
      baseServings: number
      ingredients: Array<{ item: string; qty: string; vendorSku?: string }>
      steps: Array<{ step: number; instruction: string }>
    },
    targetPortions: number,
    targetTexture: string = 'Regular',
    variantType: ScaledBatchRecipe['variantType'] = 'Regular'
  ): ScaledBatchRecipe {
    const base = Math.max(1, recipe.baseServings)
    const factor = targetPortions / base

    const scaledIngredients: ScaledBatchRecipe['scaledIngredients'] = recipe.ingredients.map(ing => {
      let item = ing.item
      let qty = ing.qty

      // Therapeutic substitutions
      if (variantType === 'Low Sodium' && (item.toLowerCase().includes('salt') || item.toLowerCase().includes('seasoning salt'))) {
        item = `${item} (REPLACED with Salt-Free Garlic & Herb Blend)`
      }
      if (variantType === 'Carb-Controlled' && item.toLowerCase().includes('sugar')) {
        item = `${item} (REPLACED with Splenda / Stevia sweetener)`
      }

      const parsed = UnitConversionEngine.parseQuantityString(qty)
      const scaledAmount = Math.round(parsed.amount * factor * 100) / 100

      return {
        item,
        baseQty: qty,
        scaledQty: `${scaledAmount} ${parsed.unit}`.trim(),
        vendorSku: ing.vendorSku,
      }
    })

    // Pureed & Minced specific additions
    if (variantType === 'Pureed') {
      const liquidRatio = Math.round(targetPortions * 0.25 * 10) / 10
      scaledIngredients.push({
        item: 'Nutrient-Dense Chicken/Vegetable Broth or Puree Slurry',
        baseQty: '0.25 cups / portion',
        scaledQty: `${liquidRatio} cups`,
        notes: 'Add to commercial food processor to achieve cohesive IDDSI Level 4 Pudding texture.',
      })
    } else if (variantType === 'Minced & Moist') {
      const gravyRatio = Math.round(targetPortions * 0.2 * 10) / 10
      scaledIngredients.push({
        item: 'Thickened Pan Gravy / Sauce',
        baseQty: '0.2 cups / portion',
        scaledQty: `${gravyRatio} cups`,
        notes: 'Moisten 4mm minced particles to meet IDDSI Level 5 standard without excess free liquid.',
      })
    }

    const station = this.determineStation(recipe.category, targetTexture)
    const haccpTargetTempF = station === 'Hot Line' ? 165 : station === 'Cold Prep' ? 41 : 140
    const panRequirement = this.calculatePanLayout(targetPortions, recipe.category)

    const instructions = recipe.steps.map(s => `${s.step}. ${s.instruction}`)
    if (variantType === 'Pureed') {
      instructions.push('IDDSI Level 4 Puree Step: Process cooked batch in Robot Coupe until smooth. Fork drip test: must hold shape on spoon without pouring off.')
    } else if (variantType === 'Minced & Moist') {
      instructions.push('IDDSI Level 5 Minced Step: Chop or pulse to 4mm particle size (space between fork tines). Mix with warm moistening agent.')
    }

    return {
      recipeId: recipe.id,
      recipeName: `${recipe.name}${variantType !== 'Regular' ? ` (${variantType})` : ''}`,
      variantType,
      iddsiLevel: variantType === 'Pureed' ? 'IDDSI Level 4' : variantType === 'Minced & Moist' ? 'IDDSI Level 5' : 'IDDSI Level 7',
      station,
      targetPortions,
      scaleFactor: Math.round(factor * 100) / 100,
      haccpTargetTempF,
      panRequirement,
      scaledIngredients,
      instructions,
    }
  }

  /**
   * Recipe Variant Graph Explosion:
   * Explodes a single base recipe into discrete production sheets for Regular, Pureed, Minced, and Diet variations.
   */
  static explodeRecipeVariants(
    baseRecipe: {
      id: string
      name: string
      category: string
      baseServings: number
      ingredients: Array<{ item: string; qty: string; vendorSku?: string }>
      steps: Array<{ step: number; instruction: string }>
    },
    censusHeadcounts: {
      regularCount: number
      pureedCount: number
      mincedCount: number
      nasCount: number
      ncsCount: number
    }
  ): RecipeVariantGraphResult {
    const variants: ScaledBatchRecipe[] = []
    const stationSummary: Record<string, number> = {}

    if (censusHeadcounts.regularCount > 0) {
      const reg = this.scaleRecipeForBatch(baseRecipe, censusHeadcounts.regularCount, 'Regular', 'Regular')
      variants.push(reg)
      stationSummary[reg.station] = (stationSummary[reg.station] || 0) + reg.targetPortions
    }

    if (censusHeadcounts.pureedCount > 0) {
      const pur = this.scaleRecipeForBatch(baseRecipe, censusHeadcounts.pureedCount, 'Pureed', 'Pureed')
      variants.push(pur)
      stationSummary[pur.station] = (stationSummary[pur.station] || 0) + pur.targetPortions
    }

    if (censusHeadcounts.mincedCount > 0) {
      const min = this.scaleRecipeForBatch(baseRecipe, censusHeadcounts.mincedCount, 'Mechanical Soft', 'Minced & Moist')
      variants.push(min)
      stationSummary[min.station] = (stationSummary[min.station] || 0) + min.targetPortions
    }

    if (censusHeadcounts.nasCount > 0) {
      const nas = this.scaleRecipeForBatch(baseRecipe, censusHeadcounts.nasCount, 'Regular', 'Low Sodium')
      variants.push(nas)
      stationSummary[nas.station] = (stationSummary[nas.station] || 0) + nas.targetPortions
    }

    if (censusHeadcounts.ncsCount > 0) {
      const ncs = this.scaleRecipeForBatch(baseRecipe, censusHeadcounts.ncsCount, 'Regular', 'Carb-Controlled')
      variants.push(ncs)
      stationSummary[ncs.station] = (stationSummary[ncs.station] || 0) + ncs.targetPortions
    }

    const totalPortions = variants.reduce((sum, v) => sum + v.targetPortions, 0)

    return {
      baseRecipeName: baseRecipe.name,
      variants,
      totalPortions,
      stationSummary,
    }
  }

  /**
   * B07: derive therapeutic variant headcounts from the active census × diet
   * orders. Uses B03's canonical activeCensus() (status='Active' only) unless
   * an explicit census row set is supplied (fixture / testing seam).
   *
   * Texture → bucket (B02 IDDSI mapping, mirrored server-side): L4 → Pureed,
   * L5 → Minced & Moist; everything else (L7 Regular, L6 Soft & Bite-Sized,
   * L3 Liquidised, unknowns) → Regular base batch.
   *
   * diet_type → bucket: Low Sodium / Cardiac / Renal → NAS; Diabetic → NCS.
   * Texture and diet buckets are independent — a resident can contribute to
   * both a texture bucket and a diet bucket (separate batch sheets).
   *
   * NPO residents are excluded from every bucket. NPO is a non-overridable
   * clinical hard block: nothing the caller supplies can re-add them.
   */
  static async deriveVariantHeadcounts(
    mealSlot: string,
    census?: Array<Record<string, any>>
  ): Promise<VariantHeadcountBreakdown> {
    const rows = census ?? await activeCensus({
      columns: 'diet_type, texture, is_npo, status',
    })

    let regularCount = 0
    let pureedCount = 0
    let mincedCount = 0
    let nasCount = 0
    let ncsCount = 0
    let censusCounted = 0
    let npoExcluded = 0
    let otherTextureCount = 0

    for (const r of rows ?? []) {
      // NPO hard block: NPO residents never appear in batch headcounts.
      const isNpo = Boolean(r.is_npo ?? r.isNpo)
      if (isNpo) { npoExcluded += 1; continue }

      const texture = String(r.texture ?? 'Regular')
      const dietType = String(r.diet_type ?? r.dietType ?? 'Regular')

      // Texture bucket — each resident counts exactly once here.
      const level = iddsiFoodLevelForTexture(texture)
      if (level === 4) {
        pureedCount += 1
      } else if (level === 5) {
        mincedCount += 1
      } else {
        // L7/L6/L3/unknown: the base Regular batch covers them; the kitchen
        // adapts at plating/processing (cut up, liquidise, substitute).
        regularCount += 1
        if (texture.trim() !== 'Regular') otherTextureCount += 1
      }

      // Diet bucket — independent of texture (separate batch sheets).
      const dietKey = dietType.trim()
      if (NAS_DIET_TYPES.has(dietKey)) nasCount += 1
      else if (NCS_DIET_TYPES.has(dietKey)) ncsCount += 1

      censusCounted += 1
    }

    const displayParts: string[] = []
    if (regularCount > 0) displayParts.push(`${regularCount} Regular`)
    if (pureedCount > 0) displayParts.push(`${pureedCount} Pureed L4`)
    if (mincedCount > 0) displayParts.push(`${mincedCount} Minced L5`)
    if (nasCount > 0) displayParts.push(`${nasCount} NAS`)
    if (ncsCount > 0) displayParts.push(`${ncsCount} NCS`)
    let breakdownDisplay = displayParts.length > 0 ? displayParts.join(' · ') : '0 residents'
    if (npoExcluded > 0) breakdownDisplay += ` · ${npoExcluded} NPO excluded`

    const mappingNotes = [
      'Texture → bucket uses the B02 IDDSI mapping (mirrored server-side): Pureed → L4, Minced / Minced & Moist → L5.',
      'Regular, Cut-Up (L6 Soft & Bite-Sized), Liquid (L3 Liquidised) and unknown textures fold into the Regular base batch; the kitchen adapts at plating.',
      'diet_type → NAS: Low Sodium, Cardiac, Renal. → NCS: Diabetic. Regular / Mechanical Soft → no diet bucket.',
      'Texture and diet buckets are independent — one resident can count in both.',
      'NPO residents are excluded from all buckets (non-overridable hard block).',
    ]

    return {
      mealSlot,
      regularCount,
      pureedCount,
      mincedCount,
      nasCount,
      ncsCount,
      censusCounted,
      npoExcluded,
      otherTextureCount,
      breakdownDisplay,
      mappingNotes,
    }
  }

  /**
   * Generate high-contrast clinical tray cards with signed QR tokens
   */
  static generateTrayCards(
    residents: ResidentServiceProfile[],
    mealInfo: {
      mealSlot: string
      serviceDate: string
      entreeName: string
      sideNames: string[]
    }
  ): PrintableTrayCard[] {
    // B03: census filter is on `status` (Active/Hospital/LOA/Passed Away).
    // `servingLocation` is service routing (Dining Room / Room Tray / …),
    // NOT census — it must never be used to exclude residents. Absent status
    // is treated as Active (the residents.status DB default).
    return residents
      .filter(r => r.status == null || r.status === 'Active')
      .map(r => {
        const ticketId = `TKT-${r.id.slice(0, 8)}-${Date.now().toString(36).slice(-4)}`
        const profileVersion = r.profileVersion || 1

        let textureBannerColor = '#10b981' // Green for regular
        if (r.texture === 'Pureed') textureBannerColor = '#f59e0b' // Orange for puree
        if (r.texture === 'Mechanical Soft') textureBannerColor = '#8b5cf6' // Purple for mech soft

        let entree = mealInfo.entreeName
        if (r.isNpo) {
          entree = '⛔ NPO - DO NOT SERVE (ORAL INTAKE PROHIBITED)'
        } else if (r.texture === 'Pureed') {
          entree = `Pureed ${mealInfo.entreeName}`
        } else if (r.texture === 'Mechanical Soft') {
          entree = `Minced & Moist ${mealInfo.entreeName}`
        }

        // Cryptographic QR Token: "ticketId:profileVersion:hash"
        const hashPayload = `${r.id}:${profileVersion}:${r.dietType}:${r.texture}:${r.isNpo ? 'NPO' : 'ORAL'}`
        const hash = crypto.createHash('sha256').update(hashPayload).digest('hex').slice(0, 12)
        const qrToken = `${ticketId}:${profileVersion}:${hash}`

        return {
          ticketId,
          residentId: r.id,
          residentName: r.name,
          room: r.room,
          table: r.tableAssignment || 'Dining Room',
          mealSlot: mealInfo.mealSlot,
          serviceDate: mealInfo.serviceDate,
          dietOrder: r.dietType,
          iddsiTexture: r.texture,
          textureBannerColor,
          hasCriticalAllergies: (r.allergies || []).length > 0,
          allergenList: r.allergies || [],
          portionSize: r.portionSize,
          isNpo: !!r.isNpo,
          npoReason: r.npoReason,
          fluidRestrictionMl: r.fluidRestrictionMl,
          profileVersion,
          qrToken,
          selectedEntree: entree,
          selectedSides: r.isNpo ? [] : mealInfo.sideNames,
          selectedBeverages: r.isNpo ? [] : (r.beverages || ['Water']),
          specialNotes: [
            r.isNpo ? '⛔ STRICT NPO' : '',
            r.fluidRestrictionMl ? `💧 Fluid Limit: ${r.fluidRestrictionMl}ml/day` : '',
            r.specialInstructions,
            r.dislikes ? `No: ${r.dislikes}` : '',
          ]
            .filter(Boolean)
            .join(' | '),
        }
      })
  }
}
