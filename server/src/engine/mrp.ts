/**
 * Material Requirements Planning (MRP) & Bill of Materials (BOM) Demand Engine
 * 
 * Explodes scheduled multi-week cycle menus across the active resident census,
 * calculates net raw ingredient requirements, evaluates on-hand inventory levels,
 * and generates optimized purchase orders packed in distributor case sizes.
 */

import { UnitConversionEngine, CulinaryUnit } from './units'

export interface ResidentDemandCensus {
  totalCensus: number
  dietBreakdown: Record<string, number>
  textureBreakdown: Record<string, number>
}

export interface MenuItemRecipeLink {
  menuItemId: string
  menuItemName: string
  recipeId: string
  recipeName: string
  baseServings: number
  portionMultiplier: number
  ingredients: Array<{
    item: string
    qty: string
    vendorSku?: string
    unitCost?: number
  }>
}

export interface ScheduledMealDemand {
  dayOfWeek: string
  mealSlot: string
  recipeLink: MenuItemRecipeLink
  projectedPortions: number
}

export interface InventoryItemStock {
  vendorSku: string
  itemName: string
  category: string
  onHandGrams: number
  parLevelGrams: number
  packSizeDesc: string
  packUnitGrams: number // e.g. 1 case = 6 x 104 oz = ~17,690g
  unitCostPerPack: number
  vendorName: string
}

export interface BomExplodedIngredientDemand {
  ingredientName: string
  vendorSku?: string
  totalRequiredGrams: number
  totalRequiredDisplay: string
  contributingRecipes: Array<{
    recipeName: string
    daySlot: string
    portions: number
    ingredientGrams: number
  }>
}

export interface MrpPurchaseOrderRecommendation {
  vendorName: string
  vendorSku: string
  itemName: string
  category: string
  packSizeDesc: string
  packUnitGrams: number
  unitCostPerPack: number
  currentOnHandGrams: number
  totalCycleDemandGrams: number
  projectedEndingStockGrams: number
  parLevelGrams: number
  netDeficitGrams: number
  recommendedCasesToOrder: number
  estimatedTotalCost: number
  urgency: 'CRITICAL_STOCKOUT' | 'REORDER_REQUIRED' | 'HEALTHY_STOCK'
}

export class MrpDemandForecastEngine {
  /**
   * Explode scheduled cycle meals into consolidated raw ingredient demands (BOM explosion)
   */
  static explodeBillOfMaterials(
    scheduledMeals: ScheduledMealDemand[]
  ): Record<string, BomExplodedIngredientDemand> {
    const demandMap: Record<string, BomExplodedIngredientDemand> = {}

    for (const meal of scheduledMeals) {
      const { recipeLink, projectedPortions, dayOfWeek, mealSlot } = meal
      const scaleFactor = (projectedPortions * recipeLink.portionMultiplier) / (recipeLink.baseServings || 1)

      for (const ing of recipeLink.ingredients) {
        const key = ing.vendorSku || ing.item.toLowerCase().trim()
        const parsed = UnitConversionEngine.parseQuantityString(ing.qty)
        const converted = UnitConversionEngine.convert(parsed.amount, parsed.unit, 'g', ing.item)
        const ingredientTotalGrams = converted.convertedAmount * scaleFactor

        if (!demandMap[key]) {
          demandMap[key] = {
            ingredientName: ing.item,
            vendorSku: ing.vendorSku,
            totalRequiredGrams: 0,
            totalRequiredDisplay: '',
            contributingRecipes: [],
          }
        }

        demandMap[key].totalRequiredGrams += ingredientTotalGrams
        demandMap[key].contributingRecipes.push({
          recipeName: recipeLink.recipeName,
          daySlot: `${dayOfWeek} ${mealSlot}`,
          portions: projectedPortions,
          ingredientGrams: Math.round(ingredientTotalGrams * 10) / 10,
        })
      }
    }

    // Format display string
    for (const key of Object.keys(demandMap)) {
      const totalG = demandMap[key].totalRequiredGrams
      if (totalG >= 453.592) {
        const lbs = Math.round((totalG / 453.592) * 10) / 10
        demandMap[key].totalRequiredDisplay = `${lbs} lbs (${Math.round(totalG)} g)`
      } else {
        demandMap[key].totalRequiredDisplay = `${Math.round(totalG)} g`
      }
    }

    return demandMap
  }

  /**
   * Run full MRP calculation against current inventory stock to generate distributor POs
   */
  static calculateMaterialRequirements(
    explodedDemands: Record<string, BomExplodedIngredientDemand>,
    inventoryStock: InventoryItemStock[]
  ): MrpPurchaseOrderRecommendation[] {
    const recommendations: MrpPurchaseOrderRecommendation[] = []

    for (const stock of inventoryStock) {
      const demand = explodedDemands[stock.vendorSku] || explodedDemands[stock.itemName.toLowerCase().trim()]
      const demandGrams = demand ? demand.totalRequiredGrams : 0

      const projectedEndingStock = stock.onHandGrams - demandGrams
      const deficit = stock.parLevelGrams - projectedEndingStock

      let casesToOrder = 0
      let urgency: MrpPurchaseOrderRecommendation['urgency'] = 'HEALTHY_STOCK'

      if (projectedEndingStock < 0) {
        urgency = 'CRITICAL_STOCKOUT'
      } else if (projectedEndingStock < stock.parLevelGrams) {
        urgency = 'REORDER_REQUIRED'
      }

      if (deficit > 0) {
        const packGrams = stock.packUnitGrams > 0 ? stock.packUnitGrams : 453.592 // default 1 lb
        casesToOrder = Math.ceil(deficit / packGrams)
      }

      recommendations.push({
        vendorName: stock.vendorName,
        vendorSku: stock.vendorSku,
        itemName: stock.itemName,
        category: stock.category,
        packSizeDesc: stock.packSizeDesc,
        packUnitGrams: stock.packUnitGrams,
        unitCostPerPack: stock.unitCostPerPack,
        currentOnHandGrams: Math.round(stock.onHandGrams),
        totalCycleDemandGrams: Math.round(demandGrams),
        projectedEndingStockGrams: Math.round(projectedEndingStock),
        parLevelGrams: Math.round(stock.parLevelGrams),
        netDeficitGrams: Math.round(Math.max(0, deficit)),
        recommendedCasesToOrder: casesToOrder,
        estimatedTotalCost: Math.round(casesToOrder * stock.unitCostPerPack * 100) / 100,
        urgency,
      })
    }

    return recommendations.sort((a, b) => {
      const priority = { CRITICAL_STOCKOUT: 0, REORDER_REQUIRED: 1, HEALTHY_STOCK: 2 }
      return priority[a.urgency] - priority[b.urgency]
    })
  }
}
