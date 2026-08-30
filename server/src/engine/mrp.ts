/**
 * Material Requirements Planning (MRP) & Multi-Distributor Procurement Engine
 * Sysco IMPAC / FOOD-TRAK Parity
 * 
 * Explodes scheduled multi-week cycle menus across the active resident census,
 * calculates net raw ingredient requirements, evaluates on-hand inventory levels,
 * compares multi-distributor quotes (Dennis vs Sysco vs US Foods) to select lowest-cost offers,
 * and generates optimized purchase orders packed in distributor case sizes.
 */

import { UnitConversionEngine } from './units'

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
    yieldPct?: number // e.g. 75 for 75% yield (shrinkage / trim loss)
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

export interface DistributorOffer {
  vendorName: string
  vendorSku: string
  packSizeDesc: string
  packUnitGrams: number
  pricePerPack: number
  deliveryDays: string[] // e.g. ['Monday', 'Thursday']
  orderCutoffLeadDays: number
}

export interface LowestCostSplitOrderProposal {
  ingredientName: string
  requiredGrams: number
  optimalVendor: string
  selectedOffer: DistributorOffer
  packsToOrder: number
  totalCost: number
  unitCostPerPound: number
  alternativeOffers: Array<{
    vendorName: string
    pricePerPack: number
    totalCost: number
    priceVariancePercent: number
  }>
  costSavings: number
  nextAvailableDelivery: string
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
        const yieldFactor = (ing.yieldPct && ing.yieldPct > 0 && ing.yieldPct <= 100) ? (ing.yieldPct / 100) : 1.0
        const ingredientTotalGrams = (converted.convertedAmount * scaleFactor) / yieldFactor

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
   * Compare multi-distributor quotes to select lowest-cost supplier for an ingredient demand
   */
  static evaluateMultiDistributorLowestCost(
    ingredientName: string,
    netDemandGrams: number,
    offers: DistributorOffer[],
    targetServiceDay: string = 'Monday'
  ): LowestCostSplitOrderProposal {
    if (!offers || offers.length === 0) {
      throw new Error(`No distributor offers provided for ${ingredientName}`)
    }

    // Calculate total cost for each offer
    const evaluatedOffers = offers.map(offer => {
      const packGrams = offer.packUnitGrams > 0 ? offer.packUnitGrams : 453.592
      const packsNeeded = Math.ceil(netDemandGrams / packGrams)
      const totalCost = Math.round(packsNeeded * offer.pricePerPack * 100) / 100
      const unitCostPerGram = offer.pricePerPack / packGrams
      const unitCostPerLb = Math.round(unitCostPerGram * 453.592 * 100) / 100

      // Match delivery schedule
      const hasDirectDelivery = offer.deliveryDays.some(
        d => d.toLowerCase() === targetServiceDay.toLowerCase()
      )
      const nextDelivery = hasDirectDelivery ? targetServiceDay : offer.deliveryDays[0] || 'Standard Route'

      return {
        offer,
        packsNeeded,
        totalCost,
        unitCostPerLb,
        nextDelivery,
      }
    })

    // Sort by lowest total cost
    evaluatedOffers.sort((a, b) => a.totalCost - b.totalCost)
    const winning = evaluatedOffers[0]
    const nextBest = evaluatedOffers[1] || winning

    const costSavings = Math.round((nextBest.totalCost - winning.totalCost) * 100) / 100

    const alternativeOffers = evaluatedOffers.slice(1).map(alt => ({
      vendorName: alt.offer.vendorName,
      pricePerPack: alt.offer.pricePerPack,
      totalCost: alt.totalCost,
      priceVariancePercent: Math.round(((alt.totalCost - winning.totalCost) / winning.totalCost) * 1000) / 10,
    }))

    return {
      ingredientName,
      requiredGrams: Math.round(netDemandGrams),
      optimalVendor: winning.offer.vendorName,
      selectedOffer: winning.offer,
      packsToOrder: winning.packsNeeded,
      totalCost: winning.totalCost,
      unitCostPerPound: winning.unitCostPerLb,
      alternativeOffers,
      costSavings,
      nextAvailableDelivery: winning.nextDelivery,
    }
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

  /**
   * Calculate As-Purchased (AP) vs Edible Portion (EP) unit costing
   */
  static calculateEdibleVsPurchasedCost(
    asPurchasedUnitCost: number,
    yieldPercentage: number = 100
  ): {
    asPurchasedCost: number
    yieldPercent: number
    ediblePortionCost: number
    shrinkageTrimLossPct: number
  } {
    const validYield = Math.max(1, Math.min(100, yieldPercentage))
    const epCost = asPurchasedUnitCost / (validYield / 100)
    return {
      asPurchasedCost: Math.round(asPurchasedUnitCost * 100) / 100,
      yieldPercent: validYield,
      ediblePortionCost: Math.round(epCost * 100) / 100,
      shrinkageTrimLossPct: Math.round((100 - validYield) * 10) / 10,
    }
  }
}
