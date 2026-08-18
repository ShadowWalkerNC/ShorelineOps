/**
 * Clinical EHR Integration Layer (V3 abstraction)
 *
 * Generic clinical integration contracts based on HL7 FHIR principles.
 * Models residents, diet orders, textures, allergies, supplements, and census events.
 */

export interface EhrResidentUpdate {
  residentExternalId: string
  firstName: string
  lastName: string
  room?: string
  status: 'active' | 'discharged' | 'hospital'
  dietOrder?: string
  texture?: string
  allergies?: string[]
  supplements?: string[]
  effectiveAt: string
}

export interface EhrDietOrderChange {
  residentExternalId: string
  previousDietOrder?: string
  newDietOrder: string
  previousTexture?: string
  newTexture?: string
  reason?: string
  orderedBy?: string
  effectiveAt: string
}

export interface EhrValidationResult {
  residentExternalId: string
  residentName: string
  valid: boolean
  warnings: string[]
  incompatibleMenuItems: Array<{
    mealDate: string
    mealSlot: string
    menuItem: string
    conflictReason: string
  }>
}

/**
 * Generic EHR Connector Interface (V3 target)
 */
export interface EhrConnector {
  systemCode: string
  systemName: string

  /** Fetch active census from EHR */
  getCensus(facilityId: string): Promise<EhrResidentUpdate[]>

  /** Webhook / Event ingestion for ADT (Admit / Discharge / Transfer) and Diet Changes */
  processInboundUpdate(payload: unknown): Promise<EhrResidentUpdate>

  /** Validate meal assignments against updated clinical profile */
  validateResidentMeals(update: EhrResidentUpdate): Promise<EhrValidationResult>
}
