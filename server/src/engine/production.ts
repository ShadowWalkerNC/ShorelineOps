/**
 * Kitchen Batch Production & Clinical Tray Service Engine
 * 
 * Provides automated recipe batch scaling for line cooks, prep station partitioning,
 * and individualized high-contrast tray card generation with clinical allergy flags.
 */

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
  allergies: string[]
  beverages: string[]
  likes?: string
  dislikes?: string
  specialInstructions?: string
}

export interface ScaledBatchRecipe {
  recipeId: string
  recipeName: string
  station: 'Hot Line' | 'Cold Prep' | 'Puree Station' | 'Bakery' | 'Beverage Station'
  targetPortions: number
  scaleFactor: number
  haccpTargetTempF: number
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
  selectedEntree: string
  selectedSides: string[]
  selectedBeverages: string[]
  adaptiveEquipment?: string
  specialNotes: string
}

export class KitchenProductionEngine {
  /**
   * Determine kitchen prep station based on recipe category & texture
   */
  static determineStation(category: string, texture: string): ScaledBatchRecipe['station'] {
    if (texture === 'Pureed' || texture === 'Mechanical Soft') return 'Puree Station'
    const cat = category.toLowerCase()
    if (['cookies', 'muffins', 'desserts', 'bakery'].includes(cat)) return 'Bakery'
    if (['proteins', 'starches', 'soups', 'hot veggies'].includes(cat)) return 'Hot Line'
    if (['beverages'].includes(cat)) return 'Beverage Station'
    return 'Cold Prep'
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
    targetTexture: string = 'Regular'
  ): ScaledBatchRecipe {
    const base = Math.max(1, recipe.baseServings)
    const factor = targetPortions / base

    const scaledIngredients = recipe.ingredients.map(ing => {
      const parsed = UnitConversionEngine.parseQuantityString(ing.qty)
      const scaledAmount = Math.round(parsed.amount * factor * 100) / 100
      return {
        item: ing.item,
        baseQty: ing.qty,
        scaledQty: `${scaledAmount} ${parsed.unit}`.trim(),
        vendorSku: ing.vendorSku,
      }
    })

    const station = this.determineStation(recipe.category, targetTexture)
    const haccpTargetTempF = station === 'Hot Line' ? 165 : station === 'Cold Prep' ? 41 : 140

    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      station,
      targetPortions,
      scaleFactor: Math.round(factor * 100) / 100,
      haccpTargetTempF,
      scaledIngredients,
      instructions: recipe.steps.map(s => `${s.step}. ${s.instruction}`),
    }
  }

  /**
   * Generate high-contrast clinical tray cards for meal service
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
        let textureBannerColor = '#10b981' // Green for regular
        if (r.texture === 'Pureed') textureBannerColor = '#f59e0b' // Orange for puree
        if (r.texture === 'Mechanical Soft') textureBannerColor = '#8b5cf6' // Purple for mech soft

        let entree = mealInfo.entreeName
        if (r.texture === 'Pureed') {
          entree = `Pureed ${mealInfo.entreeName}`
        } else if (r.texture === 'Mechanical Soft') {
          entree = `Minced & Moist ${mealInfo.entreeName}`
        }

        return {
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
          selectedEntree: entree,
          selectedSides: mealInfo.sideNames,
          selectedBeverages: r.beverages || ['Water'],
          specialNotes: [r.specialInstructions, r.dislikes ? `No: ${r.dislikes}` : '']
            .filter(Boolean)
            .join(' | '),
        }
      })
  }
}
