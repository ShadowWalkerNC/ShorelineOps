/**
 * Deterministic Clinical Safety Rules Engine
 * Computrition HS onTray / CBORD NetMenu / MealSuite Parity
 * 
 * Non-overridable clinical safety evaluator with hard-block rules for:
 * - Strict NPO designations
 * - Canonical allergen intersections (Big 9 + custom allergens)
 * - IDDSI Food Texture & Liquid Thickness compatibility matrices
 * - Nutrient range ceiling & floor limits (NAS sodium, NCS carbs, Renal minerals)
 */

import { globalWebhookEmitter } from '../webhooks/emitter'
import type { NpoBlockTriggeredEvent } from '../webhooks/events'
import crypto from 'crypto'



export type ViolationSeverity = 'BLOCK' | 'WARNING' | 'REVIEW_REQUIRED'

export interface SafetyFinding {
  ruleCode: 
    | 'NPO_VIOLATION'
    | 'ALLERGEN_INTERSECTION'
    | 'IDDSI_FOOD_MISMATCH'
    | 'IDDSI_LIQUID_MISMATCH'
    | 'NUTRIENT_CEILING_EXCEEDED'
    | 'FLUID_RESTRICTION_EXCEEDED'
  severity: ViolationSeverity
  message: string
  sourceEntityId: string
}

export interface ResidentDietaryProfileSnapshot {
  residentId: string
  residentName: string
  roomBed?: string
  profileVersion: number
  isNpo: boolean
  npoReason?: string
  requiredFoodTexture: string // e.g. 'Pureed', 'Minced & Moist', 'Soft & Bite-Sized', 'Regular'
  requiredLiquidTexture?: string // e.g. 'Thin', 'Nectar', 'Honey', 'Pudding'
  dietOrders: string[] // e.g. ['NAS', 'NCS', 'Renal', 'Regular']
  allergies: Array<{ id: string; canonicalKey: string; commonName: string }>
  fluidRestrictionMl?: number
}

export interface RecipeVariantSnapshot {
  id: string
  name: string
  foodTextureLevel: string
  liquidTextureLevel?: string
  allContainedAllergens: Array<{
    id: string
    canonicalKey: string
    commonName: string
    isCrossContact?: boolean
  }>
  nutrients: {
    calories: number
    sodiumMg: number
    carbsG: number
    proteinG?: number
    potassiumMg?: number
    phosphorusMg?: number
    fluidMl?: number
  }
}

export interface FacilityDietaryPolicy {
  foodTextureCompatibility: Record<string, { allowedTextures: string[]; isStrictBlock: boolean }>
  liquidTextureCompatibility: Record<string, { allowedTextures: string[]; isStrictBlock: boolean }>
  sodiumCeilingMgPerMeal: number // Default: 600mg for NAS
  carbCeilingGPerMeal: number // Default: 60g for NCS
  renalPotassiumCeilingMgPerMeal: number // Default: 800mg
  renalPhosphorusCeilingMgPerMeal: number // Default: 350mg
}

export const DEFAULT_FACILITY_POLICY: FacilityDietaryPolicy = {
  foodTextureCompatibility: {
    'Pureed': {
      allowedTextures: ['Pureed', 'IDDSI Level 4'],
      isStrictBlock: true,
    },
    'Minced & Moist': {
      allowedTextures: ['Pureed', 'IDDSI Level 4', 'Minced & Moist', 'IDDSI Level 5'],
      isStrictBlock: true,
    },
    'Soft & Bite-Sized': {
      allowedTextures: ['Pureed', 'Minced & Moist', 'Soft & Bite-Sized', 'IDDSI Level 6'],
      isStrictBlock: true,
    },
    'Mechanical Soft': {
      allowedTextures: ['Pureed', 'Minced & Moist', 'Mechanical Soft', 'Ground'],
      isStrictBlock: true,
    },
    'Regular': {
      allowedTextures: ['Pureed', 'Minced & Moist', 'Soft & Bite-Sized', 'Mechanical Soft', 'Regular', 'IDDSI Level 7'],
      isStrictBlock: false,
    },
  },
  liquidTextureCompatibility: {
    'Thin': {
      allowedTextures: ['Thin', 'IDDSI Level 0'],
      isStrictBlock: false,
    },
    'Slightly Thick': {
      allowedTextures: ['Slightly Thick', 'IDDSI Level 1'],
      isStrictBlock: true,
    },
    'Nectar': {
      allowedTextures: ['Nectar', 'Mildly Thick', 'IDDSI Level 2'],
      isStrictBlock: true,
    },
    'Honey': {
      allowedTextures: ['Honey', 'Moderately Thick', 'IDDSI Level 3'],
      isStrictBlock: true,
    },
    'Pudding': {
      allowedTextures: ['Pudding', 'Extremely Thick', 'IDDSI Level 4'],
      isStrictBlock: true,
    },
  },
  sodiumCeilingMgPerMeal: 600,
  carbCeilingGPerMeal: 60,
  renalPotassiumCeilingMgPerMeal: 800,
  renalPhosphorusCeilingMgPerMeal: 350,
}

export class SafetyEvaluatorEngine {
  /**
   * Deterministically evaluate meal safety for a resident
   */
  static evaluateMealSafety(
    profileSnapshot: ResidentDietaryProfileSnapshot,
    recipeVariant: RecipeVariantSnapshot,
    policyMatrix: FacilityDietaryPolicy = DEFAULT_FACILITY_POLICY
  ): {
    isSafe: boolean
    findings: SafetyFinding[]
    blockingCount: number
    warningCount: number
  } {
    const findings: SafetyFinding[] = []

    // 1. Strict NPO Check
    if (profileSnapshot.isNpo) {
      findings.push({
        ruleCode: 'NPO_VIOLATION',
        severity: 'BLOCK',
        message: `Resident is designated NPO${profileSnapshot.npoReason ? ` (${profileSnapshot.npoReason})` : ''}. All oral intake is strictly prohibited.`,
        sourceEntityId: profileSnapshot.residentId,
      })
      return {
        isSafe: false,
        findings,
        blockingCount: 1,
        warningCount: 0,
      }
    }

    // 2. Canonical Allergen Intersection
    const residentAllergens = new Set(
      profileSnapshot.allergies.map(a => a.canonicalKey.toLowerCase().trim())
    )

    for (const allergen of recipeVariant.allContainedAllergens) {
      const key = allergen.canonicalKey.toLowerCase().trim()
      if (residentAllergens.has(key)) {
        findings.push({
          ruleCode: 'ALLERGEN_INTERSECTION',
          severity: 'BLOCK',
          message: `Contains active allergen: ${allergen.commonName.toUpperCase()} (Cross-Contact Risk: ${allergen.isCrossContact ? 'YES' : 'NO'})`,
          sourceEntityId: allergen.id,
        })
      }
    }

    // 3. IDDSI Food Texture Matrix Evaluation
    const requiredTexture = profileSnapshot.requiredFoodTexture || 'Regular'
    const texturePolicy = policyMatrix.foodTextureCompatibility[requiredTexture] || {
      allowedTextures: ['Regular'],
      isStrictBlock: false,
    }

    const itemTexture = recipeVariant.foodTextureLevel || 'Regular'
    const isTextureAllowed = texturePolicy.allowedTextures.some(
      t => t.toLowerCase() === itemTexture.toLowerCase()
    )

    if (!isTextureAllowed) {
      findings.push({
        ruleCode: 'IDDSI_FOOD_MISMATCH',
        severity: texturePolicy.isStrictBlock ? 'BLOCK' : 'WARNING',
        message: `Food texture mismatch: Item is '${itemTexture}', but resident requires '${requiredTexture}'.`,
        sourceEntityId: recipeVariant.id,
      })
    }

    // 4. IDDSI Liquid Texture Matrix Evaluation
    if (profileSnapshot.requiredLiquidTexture && recipeVariant.liquidTextureLevel) {
      const requiredLiquid = profileSnapshot.requiredLiquidTexture
      const liquidPolicy = policyMatrix.liquidTextureCompatibility[requiredLiquid] || {
        allowedTextures: ['Thin'],
        isStrictBlock: false,
      }
      const itemLiquid = recipeVariant.liquidTextureLevel
      const isLiquidAllowed = liquidPolicy.allowedTextures.some(
        l => l.toLowerCase() === itemLiquid.toLowerCase()
      )
      if (!isLiquidAllowed) {
        findings.push({
          ruleCode: 'IDDSI_LIQUID_MISMATCH',
          severity: liquidPolicy.isStrictBlock ? 'BLOCK' : 'WARNING',
          message: `Liquid thickness mismatch: Item is '${itemLiquid}', but resident requires '${requiredLiquid}'.`,
          sourceEntityId: recipeVariant.id,
        })
      }
    }

    // 5. Therapeutic Nutrient Ceilings
    const diets = profileSnapshot.dietOrders.map(d => d.toUpperCase())

    // No Added Salt / 2g Sodium
    if (diets.some(d => d.includes('NAS') || d.includes('LOW SODIUM') || d.includes('2G SODIUM'))) {
      if (recipeVariant.nutrients.sodiumMg > policyMatrix.sodiumCeilingMgPerMeal) {
        findings.push({
          ruleCode: 'NUTRIENT_CEILING_EXCEEDED',
          severity: 'BLOCK',
          message: `Sodium ceiling exceeded: Recipe contains ${recipeVariant.nutrients.sodiumMg}mg sodium (Max allowed: ${policyMatrix.sodiumCeilingMgPerMeal}mg for NAS diet).`,
          sourceEntityId: recipeVariant.id,
        })
      }
    }

    // No Concentrated Sweets / Diabetic / Carb-Controlled
    if (diets.some(d => d.includes('NCS') || d.includes('DIABETIC') || d.includes('CARB') || d.includes('CCHO'))) {
      if (recipeVariant.nutrients.carbsG > policyMatrix.carbCeilingGPerMeal) {
        findings.push({
          ruleCode: 'NUTRIENT_CEILING_EXCEEDED',
          severity: 'WARNING',
          message: `Carbohydrate ceiling exceeded: Recipe contains ${recipeVariant.nutrients.carbsG}g carbs (Recommended max: ${policyMatrix.carbCeilingGPerMeal}g per meal).`,
          sourceEntityId: recipeVariant.id,
        })
      }
    }

    // Renal Diet (Potassium & Phosphorus limits)
    if (diets.some(d => d.includes('RENAL'))) {
      if (
        recipeVariant.nutrients.potassiumMg &&
        recipeVariant.nutrients.potassiumMg > policyMatrix.renalPotassiumCeilingMgPerMeal
      ) {
        findings.push({
          ruleCode: 'NUTRIENT_CEILING_EXCEEDED',
          severity: 'BLOCK',
          message: `Renal potassium ceiling exceeded: Recipe contains ${recipeVariant.nutrients.potassiumMg}mg potassium (Max allowed: ${policyMatrix.renalPotassiumCeilingMgPerMeal}mg).`,
          sourceEntityId: recipeVariant.id,
        })
      }
      if (
        recipeVariant.nutrients.phosphorusMg &&
        recipeVariant.nutrients.phosphorusMg > policyMatrix.renalPhosphorusCeilingMgPerMeal
      ) {
        findings.push({
          ruleCode: 'NUTRIENT_CEILING_EXCEEDED',
          severity: 'BLOCK',
          message: `Renal phosphorus ceiling exceeded: Recipe contains ${recipeVariant.nutrients.phosphorusMg}mg phosphorus (Max allowed: ${policyMatrix.renalPhosphorusCeilingMgPerMeal}mg).`,
          sourceEntityId: recipeVariant.id,
        })
      }
    }

    // Fluid Restriction
    if (
      profileSnapshot.fluidRestrictionMl &&
      recipeVariant.nutrients.fluidMl &&
      recipeVariant.nutrients.fluidMl > (profileSnapshot.fluidRestrictionMl / 3) // Per-meal allocation
    ) {
      findings.push({
        ruleCode: 'FLUID_RESTRICTION_EXCEEDED',
        severity: 'WARNING',
        message: `Fluid allocation exceeded: Item contains ${recipeVariant.nutrients.fluidMl}ml (Target: ≤${Math.round(profileSnapshot.fluidRestrictionMl / 3)}ml per meal).`,
        sourceEntityId: recipeVariant.id,
      })
    }

    const blockingCount = findings.filter(f => f.severity === 'BLOCK').length
    const warningCount = findings.filter(f => f.severity === 'WARNING' || f.severity === 'REVIEW_REQUIRED').length

    return {
      isSafe: blockingCount === 0,
      findings,
      blockingCount,
      warningCount,
    }
  }
}
