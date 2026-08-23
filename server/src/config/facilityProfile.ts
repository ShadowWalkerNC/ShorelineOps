/**
 * ShorelineOps Multi-Segment Facility Configuration Profile
 * 
 * Adapts platform workflows for:
 * 1. Senior Living & Skilled Nursing (IDDSI dysphagia textures, NAS/NCS diets, dining tables)
 * 2. Hospitals & Acute Care (HL7/FHIR EHR, NPO status, sterile tray delivery, clinical dietitians)
 * 3. K-12 & Higher Education (USDA NSLP meal pattern compliance, nut-free allergy zones)
 * 4. Catering & Commissary Operations (Banquet Event Orders / BEOs, batch production worksheets)
 */

export type FacilitySegment = 
  | 'senior_living'
  | 'hospital_acute_care'
  | 'k12_education'
  | 'commercial_catering'

export interface FacilityProfileConfig {
  segment: FacilitySegment
  displayName: string
  enableTrayCards: boolean
  enableIddsiTextures: boolean
  enableTableAssignments: boolean
  enableNslpCompliance: boolean
  enableBeoBanquets: boolean
  defaultHaccpTempF: number
  primaryDietaryStandards: string[]
  supportedAllergenProfiles: string[]
}

export const SEGMENT_PROFILES: Record<FacilitySegment, FacilityProfileConfig> = {
  senior_living: {
    segment: 'senior_living',
    displayName: 'Senior Living & Memory Care',
    enableTrayCards: true,
    enableIddsiTextures: true,
    enableTableAssignments: true,
    enableNslpCompliance: false,
    enableBeoBanquets: false,
    defaultHaccpTempF: 165,
    primaryDietaryStandards: ['IDDSI', 'NAS (≤600mg)', 'NCS (≤60g Carb)', 'Renal', 'Cardiac'],
    supportedAllergenProfiles: ['Dairy', 'Gluten', 'Eggs', 'Nuts', 'Peanuts', 'Soy', 'Fish', 'Shellfish', 'Sesame'],
  },
  hospital_acute_care: {
    segment: 'hospital_acute_care',
    displayName: 'Hospital & Acute Healthcare',
    enableTrayCards: true,
    enableIddsiTextures: true,
    enableTableAssignments: false, // Bedside delivery
    enableNslpCompliance: false,
    enableBeoBanquets: false,
    defaultHaccpTempF: 165,
    primaryDietaryStandards: ['HL7/FHIR', 'NPO', 'Clear Liquid', 'Full Liquid', 'Post-Op Low Residue', 'Strict Renal'],
    supportedAllergenProfiles: ['Dairy', 'Gluten', 'Eggs', 'Nuts', 'Peanuts', 'Soy', 'Fish', 'Shellfish', 'Sesame', 'Latex Cross-Reactive'],
  },
  k12_education: {
    segment: 'k12_education',
    displayName: 'K-12 & Higher Education',
    enableTrayCards: false, // Cafeteria line service
    enableIddsiTextures: false,
    enableTableAssignments: false,
    enableNslpCompliance: true, // USDA National School Lunch Program
    enableBeoBanquets: false,
    defaultHaccpTempF: 165,
    primaryDietaryStandards: ['USDA NSLP', 'Whole Grain Rich', 'Target 2 Sodium', 'Zero Trans Fat'],
    supportedAllergenProfiles: ['Peanut-Free Zone', 'Tree Nuts', 'Dairy', 'Gluten', 'Eggs', 'Soy'],
  },
  commercial_catering: {
    segment: 'commercial_catering',
    displayName: 'Commercial Catering & Commissary',
    enableTrayCards: false,
    enableIddsiTextures: false,
    enableTableAssignments: true,
    enableNslpCompliance: false,
    enableBeoBanquets: true, // Banquet Event Orders
    defaultHaccpTempF: 165,
    primaryDietaryStandards: ['HACCP Cook-Chill', 'Sous-Vide Safety', 'Buffet Line Holding'],
    supportedAllergenProfiles: ['Big 9 Standard', 'Vegan', 'Vegetarian', 'Halal', 'Kosher'],
  },
}

let activeProfile: FacilityProfileConfig = SEGMENT_PROFILES.senior_living

export function setFacilityProfile(segment: FacilitySegment): FacilityProfileConfig {
  activeProfile = SEGMENT_PROFILES[segment] || SEGMENT_PROFILES.senior_living
  return activeProfile
}

export function getFacilityProfile(): FacilityProfileConfig {
  const envSegment = process.env.FACILITY_SEGMENT as FacilitySegment | undefined
  if (envSegment && SEGMENT_PROFILES[envSegment]) {
    return SEGMENT_PROFILES[envSegment]
  }
  return activeProfile
}
