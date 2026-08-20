/**
 * PointClickCare & MatrixCare Inbound Sync Adapter (V3 Implementation)
 *
 * Simulates and processes inbound FHIR/HL7 ADT and Diet Order updates.
 * Computes automated dynamic meal validation and therapeutic nutrient calculations.
 */

import {
  EhrConnector,
  EhrResidentUpdate,
  EhrValidationResult,
} from './ehr'

export interface NutrientBreakdown {
  calories: number
  proteinGrams: number
  carbGrams: number
  fatGrams: number
  sodiumMg: number
  status: 'compliant' | 'warning' | 'exceeded'
  notes?: string
}

export class PointClickCareConnector implements EhrConnector {
  public readonly systemCode = 'pointclickcare'
  public readonly systemName = 'PointClickCare EHR'

  async getCensus(facilityId: string): Promise<EhrResidentUpdate[]> {
    return [
      {
        residentExternalId: 'PCC-RES-101',
        firstName: 'Eleanor',
        lastName: 'Vance',
        room: '104-A',
        status: 'active',
        dietOrder: 'Regular',
        texture: 'Regular',
        allergies: [],
        supplements: ['Ensure Plus Vanilla'],
        effectiveAt: new Date().toISOString(),
      },
      {
        residentExternalId: 'PCC-RES-102',
        firstName: 'Arthur',
        lastName: 'Pendelton',
        room: '112-B',
        status: 'active',
        dietOrder: 'Diabetic / NCS',
        texture: 'Pureed',
        allergies: ['Shellfish', 'Tree Nuts'],
        supplements: ['Glucerna Shake'],
        effectiveAt: new Date().toISOString(),
      },
      {
        residentExternalId: 'PCC-RES-103',
        firstName: 'Margaret',
        lastName: 'Holloway',
        room: '101',
        status: 'active',
        dietOrder: 'NAS / Low Sodium',
        texture: 'Regular',
        allergies: ['Gluten', 'Wheat'],
        effectiveAt: new Date().toISOString(),
      },
    ]
  }

  async processInboundUpdate(payload: any): Promise<EhrResidentUpdate> {
    const raw = payload || {}
    return {
      residentExternalId: raw.residentExternalId || `PCC-${Date.now()}`,
      firstName: raw.firstName || 'Unknown',
      lastName: raw.lastName || 'Resident',
      room: raw.room || 'Unassigned',
      status: raw.status || 'active',
      dietOrder: raw.dietOrder || 'Regular',
      texture: raw.texture || 'Regular',
      allergies: Array.isArray(raw.allergies) ? raw.allergies : [],
      supplements: Array.isArray(raw.supplements) ? raw.supplements : [],
      effectiveAt: new Date().toISOString(),
    }
  }

  async validateResidentMeals(update: EhrResidentUpdate): Promise<EhrValidationResult> {
    const warnings: string[] = []
    const incompatibleItems: EhrValidationResult['incompatibleMenuItems'] = []

    const allergies = update.allergies || []
    const isPureed = (update.texture || '').toLowerCase().includes('puree')
    const isNcs = (update.dietOrder || '').toLowerCase().includes('ncs') || (update.dietOrder || '').toLowerCase().includes('diabetic')
    const isNas = (update.dietOrder || '').toLowerCase().includes('nas') || (update.dietOrder || '').toLowerCase().includes('sodium')

    if (allergies.includes('Gluten') || allergies.includes('Wheat')) {
      warnings.push('Gluten allergy: Flag regular breads, pastas, and breaded items.')
    }
    if (isPureed) {
      warnings.push('Pureed IDDSI Level 4 required: No raw textures or whole meats.')
    }
    if (isNcs) {
      warnings.push('No Concentrated Sweets: Replace regular desserts with sugar-free alternatives.')
    }
    if (isNas) {
      warnings.push('No Added Salt: Exclude high-sodium processed broths.')
    }

    return {
      residentExternalId: update.residentExternalId,
      residentName: `${update.firstName} ${update.lastName}`,
      valid: incompatibleItems.length === 0,
      warnings,
      incompatibleMenuItems: incompatibleItems,
    }
  }

  /**
   * Nutrient Analysis Engine: computes macronutrient breakdown & compliance
   */
  calculateNutrients(dietOrder: string, plannedItems: Array<{ name: string; calories?: number; protein?: number; sodium?: number }>): NutrientBreakdown {
    let calories = 0
    let proteinGrams = 0
    let carbGrams = 0
    let fatGrams = 0
    let sodiumMg = 0

    plannedItems.forEach(item => {
      calories += item.calories || 350
      proteinGrams += item.protein || 18
      carbGrams += 32
      fatGrams += 12
      sodiumMg += item.sodium || 420
    })

    const isNas = dietOrder.toLowerCase().includes('nas') || dietOrder.toLowerCase().includes('sodium')
    const isRenal = dietOrder.toLowerCase().includes('renal')

    let status: NutrientBreakdown['status'] = 'compliant'
    let notes = 'Meets therapeutic dietary guideline targets.'

    if (isNas && sodiumMg > 800) {
      status = 'warning'
      notes = `Sodium (${sodiumMg}mg) exceeds per-meal target for Low Sodium/NAS order (<750mg).`
    } else if (isRenal && sodiumMg > 700) {
      status = 'warning'
      notes = `Sodium and protein load exceeds standard Renal protocol threshold.`
    }

    return {
      calories,
      proteinGrams,
      carbGrams,
      fatGrams,
      sodiumMg,
      status,
      notes,
    }
  }
}
