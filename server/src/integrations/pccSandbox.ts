/**
 * PointClickCare (PCC) Synthetic FHIR R4 Staging Sandbox
 * Shoreline Care OS v6.1
 *
 * Generates authentic FHIR R4 bundles (Patient, NutritionOrder, AllergyIntolerance)
 * to test live EHR sync, webhook triggers, and RD Triage queue reconciliation safely
 * before deploying live hospital PointClickCare credentials.
 */

export interface FhirCoding {
  system: string
  code: string
  display: string
}

export interface FhirCodeableConcept {
  coding: FhirCoding[]
  text: string
}

export interface FhirPatientResource {
  resourceType: 'Patient'
  id: string
  identifier: Array<{ system: string; value: string }>
  active: boolean
  name: Array<{ use: string; family: string; given: string[] }>
  gender: 'male' | 'female' | 'other'
  birthDate: string
}

export interface FhirNutritionOrderResource {
  resourceType: 'NutritionOrder'
  id: string
  status: 'active' | 'on-hold' | 'completed' | 'cancelled'
  intent: 'order'
  patient: { reference: string; display: string }
  dateTime: string
  orderer?: { reference: string; display: string }
  oralDiet?: {
    type?: FhirCodeableConcept[]
    texture?: Array<{
      modifier: FhirCodeableConcept
      foodType?: FhirCodeableConcept
    }>
    fluidConsistencyType?: FhirCodeableConcept[]
    instruction?: string
  }
  supplement?: Array<{
    type: FhirCodeableConcept
    productName: string
    instruction?: string
  }>
}

export interface FhirAllergyIntoleranceResource {
  resourceType: 'AllergyIntolerance'
  id: string
  clinicalStatus: { coding: FhirCoding[] }
  verificationStatus: { coding: FhirCoding[] }
  type: 'allergy' | 'intolerance'
  category: string[]
  criticality: 'low' | 'high' | 'unable-to-assess'
  code: FhirCodeableConcept
  patient: { reference: string; display: string }
}

export interface FhirBundle {
  resourceType: 'Bundle'
  type: 'transaction' | 'collection' | 'batch'
  entry: Array<{
    fullUrl: string
    resource: FhirPatientResource | FhirNutritionOrderResource | FhirAllergyIntoleranceResource | any
  }>
}

export class PccSyntheticFhirSandbox {
  /**
   * Generates a sample FHIR R4 Bundle simulating a PointClickCare resident admission with diet order & allergies.
   */
  static generateAdmissionBundle(residentId: string, options?: {
    name?: { first: string; last: string }
    diet?: string
    textureModifier?: string
    isNpo?: boolean
    allergens?: string[]
  }): FhirBundle {
    const first = options?.name?.first || 'Eleanor'
    const last = options?.name?.last || 'Vance'
    const diet = options?.diet || 'Regular'
    const isNpo = options?.isNpo || false
    const allergens = options?.allergens || ['Shellfish']
    const textureModifier = options?.textureModifier || (isNpo ? 'NPO' : 'IDDSI Level 7 Regular')

    const patientId = `Patient-${residentId}`
    const nutritionOrderId = `NutritionOrder-${residentId}-01`

    const entries: FhirBundle['entry'] = [
      {
        fullUrl: `urn:uuid:${patientId}`,
        resource: {
          resourceType: 'Patient',
          id: patientId,
          identifier: [{ system: 'https://pointclickcare.com/patients', value: residentId }],
          active: true,
          name: [{ use: 'official', family: last, given: [first] }],
          gender: 'female',
          birthDate: '1942-08-14',
        } as FhirPatientResource,
      },
      {
        fullUrl: `urn:uuid:${nutritionOrderId}`,
        resource: {
          resourceType: 'NutritionOrder',
          id: nutritionOrderId,
          status: 'active',
          intent: 'order',
          patient: { reference: `Patient/${patientId}`, display: `${first} ${last}` },
          dateTime: new Date().toISOString(),
          oralDiet: {
            type: [
              {
                coding: [{ system: 'http://snomed.info/sct', code: isNpo ? '435471000124103' : '226211001', display: diet }],
                text: diet,
              },
            ],
            texture: [
              {
                modifier: {
                  coding: [{ system: 'https://iddsi.org/framework', code: textureModifier, display: textureModifier }],
                  text: textureModifier,
                },
              },
            ],
            instruction: isNpo ? 'STRICT NPO - Physician order pre-procedure' : 'Standard dietary intake',
          },
        } as FhirNutritionOrderResource,
      },
    ]

    allergens.forEach((allergen, idx) => {
      entries.push({
        fullUrl: `urn:uuid:AllergyIntolerance-${residentId}-${idx}`,
        resource: {
          resourceType: 'AllergyIntolerance',
          id: `Allergy-${residentId}-${idx}`,
          clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active', display: 'Active' }] },
          verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed', display: 'Confirmed' }] },
          type: 'allergy',
          category: ['food'],
          criticality: 'high',
          code: {
            coding: [{ system: 'http://snomed.info/sct', code: '91935009', display: allergen }],
            text: allergen,
          },
          patient: { reference: `Patient/${patientId}`, display: `${first} ${last}` },
        } as FhirAllergyIntoleranceResource,
      })
    })

    return {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: entries,
    }
  }

  /**
   * Translates an authentic inbound FHIR R4 bundle into internal ShorelineOps EHR data format.
   */
  static parseFhirBundle(bundle: FhirBundle): {
    residentExternalId: string
    firstName: string
    lastName: string
    dietOrder: string
    texture: string
    isNpo: boolean
    allergies: string[]
  } {
    let residentExternalId = 'PCC-UNKNOWN'
    let firstName = 'Unknown'
    let lastName = 'Resident'
    let dietOrder = 'Regular'
    let texture = 'Regular'
    let isNpo = false
    const allergies: string[] = []

    for (const entry of bundle.entry || []) {
      const resource = entry.resource
      if (!resource) continue

      if (resource.resourceType === 'Patient') {
        const p = resource as FhirPatientResource
        residentExternalId = p.identifier?.[0]?.value || p.id
        firstName = p.name?.[0]?.given?.[0] || firstName
        lastName = p.name?.[0]?.family || lastName
      } else if (resource.resourceType === 'NutritionOrder') {
        const no = resource as FhirNutritionOrderResource
        dietOrder = no.oralDiet?.type?.[0]?.text || dietOrder
        texture = no.oralDiet?.texture?.[0]?.modifier?.text || texture
        if (dietOrder.toLowerCase().includes('npo') || texture.toLowerCase().includes('npo')) {
          isNpo = true
        }
      } else if (resource.resourceType === 'AllergyIntolerance') {
        const ai = resource as FhirAllergyIntoleranceResource
        if (ai.code?.text) {
          allergies.push(ai.code.text)
        }
      }
    }

    return {
      residentExternalId,
      firstName,
      lastName,
      dietOrder,
      texture,
      isNpo,
      allergies,
    }
  }
}