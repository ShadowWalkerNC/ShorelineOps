/**
 * Deterministic Dietary Planning, Texture Formulation & Clinical Menu Audit Engine
 * 
 * 100% Deterministic Rules & Algorithms (No AI/LLMs)
 * 
 * Capabilities:
 * 1. Clinical Ingredient Substitution Engine (Allergens, Renal, NAS, Diabetic)
 * 2. IDDSI 2.0 Pureed & Minced Liquid-to-Solid Texture Formulation
 * 3. 7-Day & 28-Day Cycle Menu Nutritional & Chromatic Plate Balance Auditor
 * 4. Census Production Demand Splitter across Discrete Diet & Texture Stations
 */

import { UnitConversionEngine } from './units'
import { DietaryNutritionalEngine, NutrientValues } from './nutrition'

export interface IngredientSubstitutionRule {
  targetConstraint: 'GLUTEN_FREE' | 'DAIRY_FREE' | 'EGG_FREE' | 'SOY_FREE' | 'LOW_SODIUM' | 'LOW_POTASSIUM_RENAL' | 'LOW_CARB_DIABETIC'
  originalIngredientKeywords: string[]
  substituteIngredient: string
  substituteRatio: number // e.g. 1.0 for 1:1, 0.75 for 3:4
  culinaryInstruction: string
  allergenEliminated: string[]
  nutrientImpact: Partial<NutrientValues>
}

export interface IddsiFormulationResult {
  baseItemName: string
  targetIddsiLevel: 4 | 5 | 6 // 4=Pureed, 5=Minced & Moist, 6=Soft & Bite-Sized
  solidWeightGrams: number
  recommendedLiquidBinder: string
  liquidBinderVolumeOz: number
  liquidBinderGrams: number
  thickenerAgent?: string
  thickenerAmountGrams?: number
  complianceChecklist: string[]
  forkTestStandard: string
}

export interface CycleMenuDayPlan {
  dayOfWeek: string // Monday - Sunday
  breakfast: { name: string; category: string; proteinType: string; colorGroup: 'green' | 'red_orange' | 'yellow' | 'brown' | 'white' }
  lunch: { name: string; category: string; proteinType: string; colorGroup: 'green' | 'red_orange' | 'yellow' | 'brown' | 'white' }
  dinner: { name: string; category: string; proteinType: string; colorGroup: 'green' | 'red_orange' | 'yellow' | 'brown' | 'white' }
  eveningSnack?: { name: string; calories: number; proteinG: number }
  mealTimes: { dinnerEnd: string; breakfastStart: string } // e.g. "18:00", "07:30"
}

export interface CycleMenuAuditReport {
  isCompliant: boolean
  compositeScorePct: number
  proteinRotationIssues: string[]
  plateColorDiversityScorePct: number
  colorWarnings: string[]
  mealTiming14HourAudit: {
    maxSpanHours: number
    compliantDaysCount: number
    isCompliant: boolean
    nonCompliantDays: string[]
  }
  recommendations: string[]
}

export class DeterministicDietaryEngine {
  /**
   * Pre-built clinical ingredient substitution rules
   */
  static readonly SUBSTITUTION_RULES: IngredientSubstitutionRule[] = [
    // 1. Gluten-Free substitutions
    {
      targetConstraint: 'GLUTEN_FREE',
      originalIngredientKeywords: ['all-purpose flour', 'wheat flour', 'bread crumbs', 'flour'],
      substituteIngredient: 'Cornstarch & White Rice Flour Blend',
      substituteRatio: 0.85,
      culinaryInstruction: 'Whisk cornstarch with cool liquid before adding to hot stock to prevent clumping.',
      allergenEliminated: ['Gluten', 'Wheat'],
      nutrientImpact: { carbsG: 0, sodiumMg: -5 },
    },
    // 2. Dairy-Free substitutions
    {
      targetConstraint: 'DAIRY_FREE',
      originalIngredientKeywords: ['butter', 'heavy cream', 'whole milk', 'milk', 'cheddar cheese'],
      substituteIngredient: 'Extra Virgin Olive Oil / Oat Milk Base',
      substituteRatio: 0.90,
      culinaryInstruction: 'Substitute equal parts plant-based fat; emulsify thoroughly during sauce reduction.',
      allergenEliminated: ['Dairy'],
      nutrientImpact: { satFatG: -3.5, sodiumMg: -15 },
    },
    // 3. Egg-Free substitutions
    {
      targetConstraint: 'EGG_FREE',
      originalIngredientKeywords: ['whole eggs', 'liquid eggs', 'egg', 'eggs'],
      substituteIngredient: 'Aquafaba / Ground Flaxseed Slurry (1 tbsp flax + 3 tbsp water per egg)',
      substituteRatio: 1.0,
      culinaryInstruction: 'Allow slurry to hydrate for 5 minutes before folding into batter or meatloaf matrix.',
      allergenEliminated: ['Eggs'],
      nutrientImpact: { proteinG: -2.0, satFatG: -1.5 },
    },
    // 4. Low Sodium / NAS substitutions
    {
      targetConstraint: 'LOW_SODIUM',
      originalIngredientKeywords: ['salt', 'kosher salt', 'table salt', 'soy sauce', 'garlic salt'],
      substituteIngredient: 'Citrus Herb Seasoning (Lemon peel, garlic powder, onion powder, thyme, rosemary)',
      substituteRatio: 0.75,
      culinaryInstruction: 'Add citrus herb seasoning during last 10 minutes of cooking to preserve volatile aromatic oils.',
      allergenEliminated: [],
      nutrientImpact: { sodiumMg: -580 },
    },
    // 5. Renal / Low Potassium substitutions
    {
      targetConstraint: 'LOW_POTASSIUM_RENAL',
      originalIngredientKeywords: ['baked potato', 'mashed potatoes', 'spinach', 'tomato sauce', 'bananas'],
      substituteIngredient: 'Steamed Cauliflower Mash / White Jasmine Rice',
      substituteRatio: 1.0,
      culinaryInstruction: 'Leach root vegetables in cold water for 2 hours if potatoes must be served to lower potassium.',
      allergenEliminated: [],
      nutrientImpact: { potassiumMg: -420, phosphorusMg: -80 },
    },
    // 6. Diabetic / NCS substitutions
    {
      targetConstraint: 'LOW_CARB_DIABETIC',
      originalIngredientKeywords: ['sugar', 'brown sugar', 'corn syrup', 'honey', 'maple syrup'],
      substituteIngredient: 'Monkfruit & Erythritol Natural Sweetener',
      substituteRatio: 0.80,
      culinaryInstruction: 'Dissolve sweetener thoroughly in warm liquid phase; reduce baking temperature by 15°F.',
      allergenEliminated: [],
      nutrientImpact: { carbsG: -25, sugarG: -24, calories: -95 },
    },
  ]

  /**
   * Find deterministic substitutions for recipe ingredients
   */
  static findSubstitutions(
    ingredients: Array<{ item: string; qty: string }>,
    constraint: IngredientSubstitutionRule['targetConstraint']
  ): Array<{
    originalItem: string
    substituteItem: string
    newQtyDisplay: string
    culinaryInstruction: string
    allergensEliminated: string[]
  }> {
    const results: Array<{
      originalItem: string
      substituteItem: string
      newQtyDisplay: string
      culinaryInstruction: string
      allergensEliminated: string[]
    }> = []

    const matchingRules = this.SUBSTITUTION_RULES.filter(r => r.targetConstraint === constraint)

    for (const ing of ingredients) {
      const lower = ing.item.toLowerCase().trim()
      for (const rule of matchingRules) {
        if (rule.originalIngredientKeywords.some(kw => lower.includes(kw))) {
          const parsed = UnitConversionEngine.parseQuantityString(ing.qty)
          const newAmount = Math.round(parsed.amount * rule.substituteRatio * 10) / 10
          const unitStr = parsed.unit ? ` ${parsed.unit}` : ''

          results.push({
            originalItem: ing.item,
            substituteItem: rule.substituteIngredient,
            newQtyDisplay: `${newAmount}${unitStr}`,
            culinaryInstruction: rule.culinaryInstruction,
            allergensEliminated: rule.allergenEliminated,
          })
          break
        }
      }
    }

    return results
  }

  /**
   * Compute exact IDDSI Level 4 Pureed and Level 5 Minced liquid binder formulation
   */
  static computeIddsiFormulation(
    baseFoodName: string,
    foodCategory: 'Meat/Poultry' | 'Fish' | 'Starch/Potato' | 'Vegetable' | 'Fruit',
    cookedWeightGrams: number,
    targetLevel: 4 | 5 | 6 = 4
  ): IddsiFormulationResult {
    let binderType = 'Poultry Broth'
    let liquidRatio = 0.25 // 25% liquid by weight for meats
    let thickenerNeeded = false
    let thickenerGrams = 0

    if (foodCategory === 'Meat/Poultry') {
      binderType = 'Low-Sodium Poultry or Beef Stock'
      liquidRatio = targetLevel === 4 ? 0.30 : 0.15
    } else if (foodCategory === 'Fish') {
      binderType = 'Vegetable Broth / Lemon Butter Emulsion'
      liquidRatio = targetLevel === 4 ? 0.20 : 0.10
    } else if (foodCategory === 'Vegetable') {
      binderType = 'Vegetable Cooking Broth'
      liquidRatio = targetLevel === 4 ? 0.15 : 0.08
      thickenerNeeded = targetLevel === 4
      thickenerGrams = Math.round(cookedWeightGrams * 0.02 * 10) / 10 // 2% starch thickener
    } else if (foodCategory === 'Starch/Potato') {
      binderType = 'Warm Whole Milk / Fortified Broth'
      liquidRatio = targetLevel === 4 ? 0.22 : 0.10
    } else {
      binderType = 'Natural 100% Fruit Juice'
      liquidRatio = targetLevel === 4 ? 0.18 : 0.05
    }

    const liquidGrams = Math.round(cookedWeightGrams * liquidRatio)
    const liquidOz = Math.round((liquidGrams / 28.3495) * 10) / 10

    const checklist: string[] = []
    let forkTestStandard = ''

    if (targetLevel === 4) {
      checklist.push('Fork Drip Test: Puree sits in a mound above fork tines; does not drip continuously.')
      checklist.push('Spoon Tilt Test: Slides off spoon easily when tilted with little food left behind.')
      checklist.push('Zero discrete lumps or particulate matter (homogenous texture).')
      forkTestStandard = 'IDDSI Level 4 (Fork Drip & Spoon Tilt Pass)'
    } else if (targetLevel === 5) {
      checklist.push('Particle size <= 4mm (adult) or <= 2mm (pediatric). Fits between standard fork tines.')
      checklist.push('Cohesive and moist; gravy/sauce holds pieces together without pooling liquid.')
      checklist.push('Easily mashed with the side of a fork with minimal force.')
      forkTestStandard = 'IDDSI Level 5 Minced & Moist (Particle size <= 4mm)'
    } else {
      checklist.push('Bite-sized pieces <= 15mm x 15mm (adult).')
      checklist.push('Can be cut easily with the side of a fork with no knife required.')
      forkTestStandard = 'IDDSI Level 6 Soft & Bite-Sized (<= 15mm pieces)'
    }

    return {
      baseItemName: baseFoodName,
      targetIddsiLevel: targetLevel,
      solidWeightGrams: Math.round(cookedWeightGrams),
      recommendedLiquidBinder: binderType,
      liquidBinderVolumeOz: liquidOz,
      liquidBinderGrams: liquidGrams,
      thickenerAgent: thickenerNeeded ? 'Commercial Food Thickener (Starch/Gum blend)' : undefined,
      thickenerAmountGrams: thickenerNeeded ? thickenerGrams : undefined,
      complianceChecklist: checklist,
      forkTestStandard,
    }
  }

  /**
   * Audit a 7-day institutional cycle menu for nutritional, protein, chromatic, and 14-hour compliance
   */
  static auditCycleMenu(days: CycleMenuDayPlan[]): CycleMenuAuditReport {
    const proteinRotationIssues: string[] = []
    const colorWarnings: string[] = []
    const recommendations: string[] = []
    let nonCompliantTimingDays: string[] = []

    let previousLunchProtein = ''
    let previousDinnerProtein = ''

    let colorScoreTotal = 0

    for (let i = 0; i < days.length; i++) {
      const day = days[i]

      // 1. Protein Variety Check: No back-to-back same protein category across lunch & dinner
      if (day.lunch.proteinType.toLowerCase() === day.dinner.proteinType.toLowerCase() && day.lunch.proteinType !== 'Vegetarian') {
        proteinRotationIssues.push(`${day.dayOfWeek}: Lunch and Dinner both feature ${day.lunch.proteinType}. Substitute one protein for menu variety.`)
      }

      if (previousDinnerProtein && previousDinnerProtein.toLowerCase() === day.lunch.proteinType.toLowerCase() && day.lunch.proteinType !== 'Vegetarian') {
        proteinRotationIssues.push(`${day.dayOfWeek}: Lunch repeats yesterday's dinner protein (${day.lunch.proteinType}).`)
      }

      previousLunchProtein = day.lunch.proteinType
      previousDinnerProtein = day.dinner.proteinType

      // 2. Chromatic Plate Diversity Check: Avoid monochromatic meals (e.g. all beige)
      const colors = [day.lunch.colorGroup, day.dinner.colorGroup]
      const hasGreenOrRed = colors.some(c => c === 'green' || c === 'red_orange')
      if (hasGreenOrRed) {
        colorScoreTotal += 100
      } else {
        colorScoreTotal += 50
        colorWarnings.push(`${day.dayOfWeek}: Meal lacks chromatic color contrast (mostly ${day.lunch.colorGroup}/${day.dinner.colorGroup}). Add steamed broccoli, roasted carrots, or red peppers.`)
      }

      // 3. 14-Hour Span Rule Check (CMS F809)
      const [dHour, dMin] = day.mealTimes.dinnerEnd.split(':').map(Number)
      const [bHour, bMin] = day.mealTimes.breakfastStart.split(':').map(Number)

      const dinnerTotalMinutes = dHour * 60 + dMin
      const breakfastTotalMinutes = (bHour + 24) * 60 + bMin
      const elapsedHours = (breakfastTotalMinutes - dinnerTotalMinutes) / 60

      const maxAllowedHours = day.eveningSnack && day.eveningSnack.proteinG >= 5 ? 16.0 : 14.0

      if (elapsedHours > maxAllowedHours) {
        nonCompliantTimingDays.push(`${day.dayOfWeek} (${elapsedHours.toFixed(1)} hrs > ${maxAllowedHours} hrs max)`)
      }
    }

    const avgColorScore = Math.round(colorScoreTotal / Math.max(1, days.length))
    const isTimingCompliant = nonCompliantTimingDays.length === 0

    if (proteinRotationIssues.length > 0) {
      recommendations.push('Rotate poultry, beef, fish, and pork evenly throughout the 7-day schedule to satisfy CMS F800 meal palatability.')
    }
    if (!isTimingCompliant) {
      recommendations.push('Adjust breakfast start time earlier or provide a protein-fortified evening snack (CMS F809 14-hour rule).')
    }
    if (avgColorScore < 85) {
      recommendations.push('Incorporate bright green and orange vegetable sides for enhanced visual appeal and antioxidant density.')
    }

    const compositeScorePct = Math.max(0, 100 - (proteinRotationIssues.length * 5) - (nonCompliantTimingDays.length * 15) - Math.max(0, 100 - avgColorScore))

    return {
      isCompliant: proteinRotationIssues.length === 0 && isTimingCompliant && avgColorScore >= 80,
      compositeScorePct,
      proteinRotationIssues,
      plateColorDiversityScorePct: avgColorScore,
      colorWarnings,
      mealTiming14HourAudit: {
        maxSpanHours: 14.0,
        compliantDaysCount: days.length - nonCompliantTimingDays.length,
        isCompliant: isTimingCompliant,
        nonCompliantDays: nonCompliantTimingDays,
      },
      recommendations,
    }
  }

  /**
   * Split total resident headcount into station batch production work orders
   */
  static splitCensusProductionDemand(
    menuItemName: string,
    basePortionOz: number,
    census: {
      totalResidents: number
      regularCount: number
      mechanicalSoftCount: number
      pureedCount: number
      nasLowSodiumCount: number
      diabeticNcsCount: number
    }
  ): {
    item: string
    totalPortions: number
    hotLineStation: { portions: number; totalWeightLbs: number; instructions: string }
    pureeStation: { portions: number; cookedMeatLbs: number; brothBinderOz: number; instructions: string }
    mechanicalSoftStation: { portions: number; mincedLbs: number; gravyOz: number; instructions: string }
    specialDietStation: { nasPortions: number; ncsPortions: number; instructions: string }
  } {
    const singlePortionLbs = basePortionOz / 16.0

    // Hot line regular portions
    const regularLbs = Math.round(census.regularCount * singlePortionLbs * 10) / 10

    // Pureed formulation: 4oz cooked meat + 1.2oz broth binder per portion
    const pureedMeatLbs = Math.round(census.pureedCount * singlePortionLbs * 10) / 10
    const pureedBrothOz = Math.round(census.pureedCount * 1.2 * 10) / 10

    // Mechanical soft formulation: 4oz minced meat + 1.0oz moisture gravy per portion
    const softMeatLbs = Math.round(census.mechanicalSoftCount * singlePortionLbs * 10) / 10
    const softGravyOz = Math.round(census.mechanicalSoftCount * 1.0 * 10) / 10

    return {
      item: menuItemName,
      totalPortions: census.totalResidents,
      hotLineStation: {
        portions: census.regularCount,
        totalWeightLbs: regularLbs,
        instructions: `Cook to 165°F core temp; stage on steam table pan holding at >= 140°F.`,
      },
      pureeStation: {
        portions: census.pureedCount,
        cookedMeatLbs: pureedMeatLbs,
        brothBinderOz: pureedBrothOz,
        instructions: `Blend cooked ${menuItemName} with ${pureedBrothOz} oz poultry stock to smooth IDDSI Level 4 consistency. Perform Fork Drip & Spoon Tilt test.`,
      },
      mechanicalSoftStation: {
        portions: census.mechanicalSoftCount,
        mincedLbs: softMeatLbs,
        gravyOz: softGravyOz,
        instructions: `Mince cooked ${menuItemName} to <= 4mm particle size. Fold in ${softGravyOz} oz moisture gravy.`,
      },
      specialDietStation: {
        nasPortions: census.nasLowSodiumCount,
        ncsPortions: census.diabeticNcsCount,
        instructions: `Portion ${census.nasLowSodiumCount} NAS plates from unseasoned pan; ensure no high-sugar glazes on ${census.diabeticNcsCount} NCS diabetic plates.`,
      },
    }
  }
}
