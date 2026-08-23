/**
 * Advanced Dietary Forecast & Recipe Scaling Demand Engine
 * 
 * Bridges clinical resident census & diet orders directly into purchasing requirements:
 * 1. Resident Census & Diet Profile breakdown (Regular, NAS, NCS, Renal, Pureed, Mech Soft, Thickened liquids)
 * 2. Cycle Menu Demand Forecasting (Meal tallies x cycle week recipes)
 * 3. Ingredient Scaling & Par Level Depletion estimation
 * 4. Automated Vendor Purchase Order Recommendation based on projected resident meal headcount
 */

export interface ResidentDietaryCensus {
  totalActiveResidents: number
  dietTypeCounts: Record<string, number>
  textureCounts: Record<string, number>
  allergenCounts: Record<string, number>
  beverageCounts: Record<string, number>
}

export interface MenuItemDemand {
  menuItemId: string
  menuItemName: string
  mealSlot: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  portionMultiplier: number
  dietarySubstitutions: Array<{
    targetDiet: string
    substituteItemName: string
    headcount: number
  }>
  estimatedServings: number
  ingredientDemands: Array<{
    ingredientName: string
    vendorSku?: string
    quantityNeededGrams: number
    suggestedPackUnits: number
    packUnitUom: string
  }>
}

export interface DietaryOrderDemandProjection {
  cycleWeekId: string
  census: ResidentDietaryCensus
  totalProjectedMeals7Days: number
  recommendedPurchasingLines: Array<{
    vendorSku: string
    itemName: string
    category: string
    onHandUnits: number
    parLevelUnits: number
    projectedDemandUnits: number
    calculatedReorderQty: number
    clinicalJustification: string
  }>
}

export class DietaryDemandEngine {
  /**
   * Aggregate active resident census into clinical dietary breakdowns
   */
  calculateCensusMetrics(residents: Array<{
    status: string
    dietType: string
    texture: string
    allergies: string[]
    beverages: string[]
  }>): ResidentDietaryCensus {
    const active = residents.filter(r => r.status.toLowerCase() === 'active')

    const dietTypeCounts: Record<string, number> = {}
    const textureCounts: Record<string, number> = {}
    const allergenCounts: Record<string, number> = {}
    const beverageCounts: Record<string, number> = {}

    for (const r of active) {
      dietTypeCounts[r.dietType] = (dietTypeCounts[r.dietType] || 0) + 1
      textureCounts[r.texture] = (textureCounts[r.texture] || 0) + 1
      
      for (const a of r.allergies || []) {
        allergenCounts[a] = (allergenCounts[a] || 0) + 1
      }
      for (const b of r.beverages || []) {
        beverageCounts[b] = (beverageCounts[b] || 0) + 1
      }
    }

    return {
      totalActiveResidents: active.length,
      dietTypeCounts,
      textureCounts,
      allergenCounts,
      beverageCounts,
    }
  }

  /**
   * Calculate exact purchasing PO requirements by combining order guide pars with clinical headcount
   */
  calculateClinicalDemandOrder(
    census: ResidentDietaryCensus,
    orderGuideItems: Array<{
      vendorSku: string
      itemName: string
      category: string
      unitCost: number
      parLevel: number
      onHand: number
      packSize: string
      uom: string
    }>
  ): DietaryOrderDemandProjection['recommendedPurchasingLines'] {
    const headcount = census.totalActiveResidents || 1

    return orderGuideItems.map(item => {
      let clinicalDemandMultiplier = 1.0
      let clinicalJustification = 'Standard cycle baseline usage'

      const itemNameLower = item.itemName.toLowerCase()

      // Clinical Texture adjustments (Thickeners, Puree starches)
      const pureedCount = (census.textureCounts['Pureed'] || 0) + (census.textureCounts['Mechanical Soft'] || 0)
      if (itemNameLower.includes('thick') || itemNameLower.includes('puree') || itemNameLower.includes('starch')) {
        const pureeRatio = pureedCount / headcount
        clinicalDemandMultiplier = Math.max(0.5, pureeRatio * 2.5)
        clinicalJustification = `Scaled for ${pureedCount} residents on IDDSI Puree/Mech Soft texture orders`
      }

      // Renal / Low Sodium items
      const lowSodiumCount = (census.dietTypeCounts['NAS'] || 0) + (census.dietTypeCounts['Low Sodium'] || 0)
      if (itemNameLower.includes('low sodium') || itemNameLower.includes('no salt')) {
        clinicalDemandMultiplier = 1.0 + (lowSodiumCount / headcount)
        clinicalJustification = `Adjusted for ${lowSodiumCount} residents on NAS / Low Sodium diet orders`
      }

      // Diabetic / NCS items
      const ncsCount = (census.dietTypeCounts['NCS'] || 0) + (census.dietTypeCounts['Diabetic'] || 0)
      if (itemNameLower.includes('sugar free') || itemNameLower.includes('ncs')) {
        clinicalDemandMultiplier = 1.0 + (ncsCount / headcount)
        clinicalJustification = `Adjusted for ${ncsCount} residents on NCS diet orders`
      }

      const effectivePar = Math.ceil(item.parLevel * clinicalDemandMultiplier)
      const deficit = effectivePar - item.onHand
      const calculatedReorderQty = deficit > 0 ? Math.ceil(deficit) : 0

      return {
        vendorSku: item.vendorSku,
        itemName: item.itemName,
        category: item.category,
        onHandUnits: item.onHand,
        parLevelUnits: item.parLevel,
        projectedDemandUnits: effectivePar,
        calculatedReorderQty,
        clinicalJustification,
      }
    })
  }
}
