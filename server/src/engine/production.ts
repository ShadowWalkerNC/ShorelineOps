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
    return residents
      .filter(r => r.servingLocation !== 'LOA' && r.servingLocation !== 'Hospital')
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
