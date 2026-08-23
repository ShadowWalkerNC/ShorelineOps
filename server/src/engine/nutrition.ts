/**
 * Dietary Nutritional Calculation & Clinical Constraint Solver Engine
 * 
 * Provides automated macro/micronutrient computation, Big 9 allergen scanning,
 * IDDSI texture compliance, and therapeutic diet order validation for senior living.
 */

import { UnitConversionEngine } from './units'

export interface NutrientValues {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  satFatG: number
  sodiumMg: number
  potassiumMg: number
  phosphorusMg: number
  fiberG: number
  sugarG: number
}

export interface IngredientNutrientProfile extends NutrientValues {
  itemName: string
  referenceGrams: number // usually per 100g
  allergens: string[]
  iddsiSuitableLevels: number[] // IDDSI levels 3-7
}

export interface ClinicalConstraintRule {
  dietOrder: string
  minCaloriesPerMeal?: number
  maxCaloriesPerMeal?: number
  maxSodiumMgPerMeal?: number
  maxSodiumMgPerDay?: number
  maxCarbsGPerMeal?: number
  minProteinGPerMeal?: number
  maxFatGPerMeal?: number
  maxPotassiumMgPerMeal?: number
  maxPhosphorusMgPerMeal?: number
  requiredIddsiLevel?: number // e.g. 4 for Pureed, 5 for Minced & Moist
}

export const CLINICAL_DIET_RULES: Record<string, ClinicalConstraintRule> = {
  'Regular': {
    dietOrder: 'Regular Standard Diet',
    minCaloriesPerMeal: 450,
  },
  'NAS': {
    dietOrder: 'NAS (No Added Salt)',
    maxSodiumMgPerMeal: 600,
    maxSodiumMgPerDay: 2000,
  },
  'Low Sodium': {
    dietOrder: 'Low Sodium Strict',
    maxSodiumMgPerMeal: 500,
    maxSodiumMgPerDay: 1500,
  },
  'NCS': {
    dietOrder: 'NCS (No Concentrated Sweets / Diabetic)',
    maxCarbsGPerMeal: 60,
  },
  'Renal': {
    dietOrder: 'Renal / Kidney Disease',
    maxSodiumMgPerMeal: 500,
    maxPotassiumMgPerMeal: 700,
    maxPhosphorusMgPerMeal: 350,
    maxFatGPerMeal: 25,
  },
  'Cardiac': {
    dietOrder: 'Cardiac / Heart Healthy',
    maxSodiumMgPerMeal: 500,
    maxFatGPerMeal: 20,
  },
  'High Protein': {
    dietOrder: 'High Protein / Wound Care Recovery',
    minProteinGPerMeal: 25,
  },
  'Pureed': {
    dietOrder: 'IDDSI Level 4 Pureed',
    requiredIddsiLevel: 4,
  },
  'Mechanical Soft': {
    dietOrder: 'IDDSI Level 5 Minced & Moist',
    requiredIddsiLevel: 5,
  },
}

// Built-in standard institutional nutrient baseline library (per 100g)
export const INGREDIENT_NUTRIENT_LIBRARY: Record<string, IngredientNutrientProfile> = {
  'chicken breast': {
    itemName: 'Chicken breast, skinless, boneless',
    referenceGrams: 100,
    calories: 165,
    proteinG: 31.0,
    carbsG: 0.0,
    fatG: 3.6,
    satFatG: 1.0,
    sodiumMg: 74,
    potassiumMg: 256,
    phosphorusMg: 228,
    fiberG: 0.0,
    sugarG: 0.0,
    allergens: [],
    iddsiSuitableLevels: [6, 7],
  },
  'ground beef 80/20': {
    itemName: 'Ground beef 80/20 raw',
    referenceGrams: 100,
    calories: 254,
    proteinG: 17.2,
    carbsG: 0.0,
    fatG: 20.0,
    satFatG: 7.6,
    sodiumMg: 66,
    potassiumMg: 289,
    phosphorusMg: 158,
    fiberG: 0.0,
    sugarG: 0.0,
    allergens: [],
    iddsiSuitableLevels: [5, 6, 7],
  },
  'atlantic salmon': {
    itemName: 'Atlantic Salmon fillet raw',
    referenceGrams: 100,
    calories: 208,
    proteinG: 20.4,
    carbsG: 0.0,
    fatG: 13.4,
    satFatG: 3.1,
    sodiumMg: 59,
    potassiumMg: 363,
    phosphorusMg: 240,
    fiberG: 0.0,
    sugarG: 0.0,
    allergens: ['Fish'],
    iddsiSuitableLevels: [5, 6, 7],
  },
  'eggs': {
    itemName: 'Large whole eggs fresh',
    referenceGrams: 100,
    calories: 143,
    proteinG: 12.6,
    carbsG: 0.7,
    fatG: 9.5,
    satFatG: 3.1,
    sodiumMg: 142,
    potassiumMg: 138,
    phosphorusMg: 198,
    fiberG: 0.0,
    sugarG: 0.4,
    allergens: ['Eggs'],
    iddsiSuitableLevels: [4, 5, 6, 7],
  },
  'whole milk': {
    itemName: 'Pasteurized whole milk 3.25%',
    referenceGrams: 100,
    calories: 61,
    proteinG: 3.2,
    carbsG: 4.8,
    fatG: 3.3,
    satFatG: 1.9,
    sodiumMg: 43,
    potassiumMg: 132,
    phosphorusMg: 84,
    fiberG: 0.0,
    sugarG: 5.1,
    allergens: ['Dairy'],
    iddsiSuitableLevels: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  'white flour': {
    itemName: 'All-purpose white flour enriched',
    referenceGrams: 100,
    calories: 364,
    proteinG: 10.3,
    carbsG: 76.3,
    fatG: 1.0,
    satFatG: 0.2,
    sodiumMg: 2,
    potassiumMg: 107,
    phosphorusMg: 108,
    fiberG: 2.7,
    sugarG: 0.3,
    allergens: ['Gluten', 'Wheat'],
    iddsiSuitableLevels: [4, 5, 6, 7],
  },
  'russet potatoes': {
    itemName: 'Russet potatoes raw peeled',
    referenceGrams: 100,
    calories: 79,
    proteinG: 2.1,
    carbsG: 18.1,
    fatG: 0.1,
    satFatG: 0.0,
    sodiumMg: 6,
    potassiumMg: 417,
    phosphorusMg: 70,
    fiberG: 1.3,
    sugarG: 0.6,
    allergens: [],
    iddsiSuitableLevels: [4, 5, 6, 7],
  },
  'broccoli florets': {
    itemName: 'Fresh broccoli florets raw',
    referenceGrams: 100,
    calories: 34,
    proteinG: 2.8,
    carbsG: 6.6,
    fatG: 0.4,
    satFatG: 0.1,
    sodiumMg: 33,
    potassiumMg: 316,
    phosphorusMg: 66,
    fiberG: 2.6,
    sugarG: 1.7,
    allergens: [],
    iddsiSuitableLevels: [4, 5, 6, 7],
  },
  'food thickener': {
    itemName: 'Commercial starch/gum food thickener',
    referenceGrams: 100,
    calories: 375,
    proteinG: 0.5,
    carbsG: 92.0,
    fatG: 0.1,
    satFatG: 0.0,
    sodiumMg: 180,
    potassiumMg: 45,
    phosphorusMg: 20,
    fiberG: 2.0,
    sugarG: 0.0,
    allergens: [],
    iddsiSuitableLevels: [1, 2, 3, 4],
  },
}

export class DietaryNutritionalEngine {
  /**
   * Auto-detect Big 9 allergens from ingredient list text
   */
  static detectAllergens(ingredients: Array<{ item: string }>): string[] {
    const detected = new Set<string>()
    const rules: Array<{ allergen: string; keywords: string[] }> = [
      { allergen: 'Gluten', keywords: ['wheat', 'flour', 'gluten', 'barley', 'rye', 'bread', 'pasta', 'cereal', 'oats', 'soy sauce', 'breadcrumb'] },
      { allergen: 'Dairy', keywords: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'whey', 'casein', 'sour cream', 'parmesan', 'cheddar', 'mozzarella'] },
      { allergen: 'Eggs', keywords: ['egg', 'eggs', 'mayonnaise', 'meringue', 'albumin', 'yolk'] },
      { allergen: 'Nuts', keywords: ['peanut', 'peanuts', 'almond', 'walnut', 'cashew', 'pecan', 'hazelnut', 'pistachio', 'nut', 'nuts'] },
      { allergen: 'Soy', keywords: ['soy', 'soya', 'tofu', 'edamame', 'tamari', 'miso', 'soybean', 'lecithin'] },
      { allergen: 'Fish', keywords: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'haddock', 'trout', 'bass'] },
      { allergen: 'Shellfish', keywords: ['shrimp', 'crab', 'lobster', 'clam', 'mussel', 'scallop', 'oyster', 'prawn'] },
      { allergen: 'Sesame', keywords: ['sesame', 'tahini', 'sesame oil', 'sesame seeds'] },
    ]

    for (const ing of ingredients) {
      const lower = ing.item.toLowerCase()
      for (const rule of rules) {
        if (rule.keywords.some(kw => lower.includes(kw))) {
          detected.add(rule.allergen)
        }
      }
    }

    return Array.from(detected)
  }

  /**
   * Find matching nutrient profile from internal database
   */
  static lookupNutrientProfile(itemName: string): IngredientNutrientProfile {
    const lower = itemName.toLowerCase().trim()
    for (const [key, profile] of Object.entries(INGREDIENT_NUTRIENT_LIBRARY)) {
      if (lower.includes(key) || key.includes(lower)) {
        return profile
      }
    }

    // Default fallback approximation
    return {
      itemName,
      referenceGrams: 100,
      calories: 120,
      proteinG: 5.0,
      carbsG: 15.0,
      fatG: 4.0,
      satFatG: 1.0,
      sodiumMg: 120,
      potassiumMg: 150,
      phosphorusMg: 100,
      fiberG: 1.5,
      sugarG: 2.0,
      allergens: [],
      iddsiSuitableLevels: [7],
    }
  }

  /**
   * Compute per-serving and batch nutritional values for a recipe
   */
  static calculateRecipeNutrition(
    ingredients: Array<{ item: string; qty: string }>,
    baseServings: number
  ): {
    perServing: NutrientValues
    totalBatch: NutrientValues
    allergens: string[]
    ingredientContributions: Array<{
      item: string
      grams: number
      calories: number
      proteinG: number
      sodiumMg: number
    }>
  } {
    const servings = Math.max(1, baseServings)
    let totalGrams = 0
    const totalBatch: NutrientValues = {
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      satFatG: 0,
      sodiumMg: 0,
      potassiumMg: 0,
      phosphorusMg: 0,
      fiberG: 0,
      sugarG: 0,
    }

    const contributions: Array<{
      item: string
      grams: number
      calories: number
      proteinG: number
      sodiumMg: number
    }> = []

    for (const ing of ingredients) {
      const parsed = UnitConversionEngine.parseQuantityString(ing.qty)
      const converted = UnitConversionEngine.convert(parsed.amount, parsed.unit, 'g', ing.item)
      const grams = converted.convertedAmount
      totalGrams += grams

      const profile = this.lookupNutrientProfile(ing.item)
      const factor = grams / profile.referenceGrams

      const cals = profile.calories * factor
      const prot = profile.proteinG * factor
      const carbs = profile.carbsG * factor
      const fat = profile.fatG * factor
      const satFat = profile.satFatG * factor
      const sod = profile.sodiumMg * factor
      const pot = profile.potassiumMg * factor
      const phos = profile.phosphorusMg * factor
      const fib = profile.fiberG * factor
      const sug = profile.sugarG * factor

      totalBatch.calories += cals
      totalBatch.proteinG += prot
      totalBatch.carbsG += carbs
      totalBatch.fatG += fat
      totalBatch.satFatG += satFat
      totalBatch.sodiumMg += sod
      totalBatch.potassiumMg += pot
      totalBatch.phosphorusMg += phos
      totalBatch.fiberG += fib
      totalBatch.sugarG += sug

      contributions.push({
        item: ing.item,
        grams: Math.round(grams * 10) / 10,
        calories: Math.round(cals),
        proteinG: Math.round(prot * 10) / 10,
        sodiumMg: Math.round(sod),
      })
    }

    const perServing: NutrientValues = {
      calories: Math.round(totalBatch.calories / servings),
      proteinG: Math.round((totalBatch.proteinG / servings) * 10) / 10,
      carbsG: Math.round((totalBatch.carbsG / servings) * 10) / 10,
      fatG: Math.round((totalBatch.fatG / servings) * 10) / 10,
      satFatG: Math.round((totalBatch.satFatG / servings) * 10) / 10,
      sodiumMg: Math.round(totalBatch.sodiumMg / servings),
      potassiumMg: Math.round(totalBatch.potassiumMg / servings),
      phosphorusMg: Math.round(totalBatch.phosphorusMg / servings),
      fiberG: Math.round((totalBatch.fiberG / servings) * 10) / 10,
      sugarG: Math.round((totalBatch.sugarG / servings) * 10) / 10,
    }

    const allergens = this.detectAllergens(ingredients)

    return {
      perServing,
      totalBatch,
      allergens,
      ingredientContributions: contributions,
    }
  }

  /**
   * Validate meal items against clinical therapeutic diet orders & resident allergies
   */
  static validateMealForResident(
    resident: {
      id: string
      name: string
      dietType: string
      texture: string
      allergies: string[]
    },
    mealItems: Array<{
      name: string
      nutrition: NutrientValues
      allergens: string[]
      iddsiLevel?: number
    }>
  ): {
    compliant: boolean
    criticalAlerts: string[]
    warningFlags: string[]
    combinedNutrients: NutrientValues
  } {
    const criticalAlerts: string[] = []
    const warningFlags: string[] = []

    const combined: NutrientValues = {
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      satFatG: 0,
      sodiumMg: 0,
      potassiumMg: 0,
      phosphorusMg: 0,
      fiberG: 0,
      sugarG: 0,
    }

    for (const item of mealItems) {
      combined.calories += item.nutrition.calories
      combined.proteinG += item.nutrition.proteinG
      combined.carbsG += item.nutrition.carbsG
      combined.fatG += item.nutrition.fatG
      combined.satFatG += item.nutrition.satFatG
      combined.sodiumMg += item.nutrition.sodiumMg
      combined.potassiumMg += item.nutrition.potassiumMg
      combined.phosphorusMg += item.nutrition.phosphorusMg
      combined.fiberG += item.nutrition.fiberG
      combined.sugarG += item.nutrition.sugarG

      // 1. Check Allergens (Critical Medical Alert)
      for (const resAllergy of resident.allergies || []) {
        const match = item.allergens.some(a => a.toLowerCase() === resAllergy.toLowerCase())
        if (match) {
          criticalAlerts.push(`ALLERGEN VIOLATION: "${item.name}" contains ${resAllergy} for resident ${resident.name}`)
        }
      }
    }

    // 2. Check Clinical Diet Order Rules
    const rule = CLINICAL_DIET_RULES[resident.dietType]
    if (rule) {
      if (rule.maxSodiumMgPerMeal && combined.sodiumMg > rule.maxSodiumMgPerMeal) {
        warningFlags.push(`Sodium Limit Exceeded: ${combined.sodiumMg}mg > ${rule.maxSodiumMgPerMeal}mg for ${resident.dietType}`)
      }
      if (rule.maxCarbsGPerMeal && combined.carbsG > rule.maxCarbsGPerMeal) {
        warningFlags.push(`Carbohydrate Target Exceeded: ${combined.carbsG}g > ${rule.maxCarbsGPerMeal}g for ${resident.dietType}`)
      }
      if (rule.minProteinGPerMeal && combined.proteinG < rule.minProteinGPerMeal) {
        warningFlags.push(`Protein Below Target: ${combined.proteinG}g < ${rule.minProteinGPerMeal}g for ${resident.dietType}`)
      }
      if (rule.maxPotassiumMgPerMeal && combined.potassiumMg > rule.maxPotassiumMgPerMeal) {
        warningFlags.push(`Renal Potassium Warning: ${combined.potassiumMg}mg > ${rule.maxPotassiumMgPerMeal}mg`)
      }
    }

    // 3. Texture Check
    if (resident.texture === 'Pureed' || resident.texture === 'Mechanical Soft') {
      warningFlags.push(`Requires Kitchen Texture Modification: IDDSI ${resident.texture}`)
    }

    const compliant = criticalAlerts.length === 0 && warningFlags.length === 0

    return {
      compliant,
      criticalAlerts,
      warningFlags,
      combinedNutrients: combined,
    }
  }
}
