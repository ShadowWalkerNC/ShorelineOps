import { create } from 'zustand'
import { LicenseManager } from '@/security/license'

export interface FacilityProfile {
  name: string
  organization: string
  npiNumber: string
  licenseNumber: string
  facilityType: 'Assisted Living' | 'Skilled Nursing' | 'Memory Care' | 'Continuing Care' | 'Hospital'
  address: string
  phone: string
  email: string
  directorOfDining: string
  registeredDietitian: string
}

export interface OperationsConfig {
  wings: string[]
  diningRooms: string[]
  targetCpd: number // Cost per resident day target in USD (e.g. 8.75)
  mealTimes: {
    breakfast: string
    lunch: string
    dinner: string
    snack: string
  }
  temperatureUnit: 'F' | 'C'
  iddsiStrictEnforcement: boolean
  fourteenHourRuleCheck: boolean // CMS F809 span between dinner and breakfast
}

export interface IntegrationsConfig {
  primaryDistributor: 'dennis' | 'sysco' | 'usfoods' | 'gordon' | 'pfg'
  distributorCustomerNumber: string
  pccFacilityId: string
  autoSyncCensus: boolean
  invoiceOcrAutoApprove: boolean
}

export interface SecurityConfig {
  sessionTimeoutMinutes: number
  hipaaAuditRetentionDays: number
  baaSignedDate: string
  baaSignee: string
}

export interface SettingsState {
  facility: FacilityProfile
  operations: OperationsConfig
  integrations: IntegrationsConfig
  security: SecurityConfig
  isSaving: boolean
  lastSavedAt: string | null

  // Actions
  updateFacility: (updates: Partial<FacilityProfile>) => void
  updateOperations: (updates: Partial<OperationsConfig>) => void
  updateIntegrations: (updates: Partial<IntegrationsConfig>) => void
  updateSecurity: (updates: Partial<SecurityConfig>) => void
  addWing: (wingName: string) => void
  removeWing: (wingName: string) => void
  addDiningRoom: (roomName: string) => void
  removeDiningRoom: (roomName: string) => void
  saveSettings: () => Promise<void>
  resetDefaults: () => void
}

const STORAGE_KEY = 'shoreline_facility_settings'

const DEFAULT_SETTINGS: {
  facility: FacilityProfile
  operations: OperationsConfig
  integrations: IntegrationsConfig
  security: SecurityConfig
} = {
  facility: {
    name: 'Shoreline Healthcare & Rehabilitation',
    organization: 'Shoreline Senior Living Group LLC',
    npiNumber: '1942857102',
    licenseNumber: 'SNF-ME-40891',
    facilityType: 'Skilled Nursing',
    address: '104 Shoreline Drive, Portland, ME 04101',
    phone: '(207) 555-0199',
    email: 'dietary.ops@shorelinecare.com',
    directorOfDining: 'Chef Marcus Vance, CDM, CFPP',
    registeredDietitian: 'Sarah Jenkins, MS, RDN, LD',
  },
  operations: {
    wings: ['Coastal Wing (Assisted Living)', 'Harbor View (Memory Care)', 'Atlantic Rehab Unit'],
    diningRooms: ['Main Dining Hall', 'Harbor Bistro', 'In-Room Bedside Tray Service'],
    targetCpd: 8.75,
    mealTimes: {
      breakfast: '07:30',
      lunch: '12:00',
      dinner: '17:30',
      snack: '20:00',
    },
    temperatureUnit: 'F',
    iddsiStrictEnforcement: true,
    fourteenHourRuleCheck: true,
  },
  integrations: {
    primaryDistributor: 'dennis',
    distributorCustomerNumber: 'DEN-884910',
    pccFacilityId: 'FAC-PORTLAND-01',
    autoSyncCensus: true,
    invoiceOcrAutoApprove: false,
  },
  security: {
    sessionTimeoutMinutes: 30,
    hipaaAuditRetentionDays: 2555, // 7 years HIPAA compliance
    baaSignedDate: '2026-01-15',
    baaSignee: 'Marcus Vance (Executive Director)',
  },
}

function loadInitialSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        facility: { ...DEFAULT_SETTINGS.facility, ...parsed.facility },
        operations: { ...DEFAULT_SETTINGS.operations, ...parsed.operations },
        integrations: { ...DEFAULT_SETTINGS.integrations, ...parsed.integrations },
        security: { ...DEFAULT_SETTINGS.security, ...parsed.security },
      }
    }
  } catch (err) {
    console.warn('Failed to parse settings from storage:', err)
  }
  return DEFAULT_SETTINGS
}

const initial = loadInitialSettings()

export const useSettingsStore = create<SettingsState>((set, get) => ({
  facility: initial.facility,
  operations: initial.operations,
  integrations: initial.integrations,
  security: initial.security,
  isSaving: false,
  lastSavedAt: null,

  updateFacility: updates => {
    set(state => ({
      facility: { ...state.facility, ...updates },
    }))
  },

  updateOperations: updates => {
    set(state => ({
      operations: { ...state.operations, ...updates },
    }))
  },

  updateIntegrations: updates => {
    set(state => ({
      integrations: { ...state.integrations, ...updates },
    }))
  },

  updateSecurity: updates => {
    set(state => ({
      security: { ...state.security, ...updates },
    }))
  },

  addWing: wingName => {
    const trimmed = wingName.trim()
    if (!trimmed) return
    set(state => {
      if (state.operations.wings.includes(trimmed)) return state
      return {
        operations: {
          ...state.operations,
          wings: [...state.operations.wings, trimmed],
        },
      }
    })
  },

  removeWing: wingName => {
    set(state => ({
      operations: {
        ...state.operations,
        wings: state.operations.wings.filter(w => w !== wingName),
      },
    }))
  },

  addDiningRoom: roomName => {
    const trimmed = roomName.trim()
    if (!trimmed) return
    set(state => {
      if (state.operations.diningRooms.includes(trimmed)) return state
      return {
        operations: {
          ...state.operations,
          diningRooms: [...state.operations.diningRooms, trimmed],
        },
      }
    })
  },

  removeDiningRoom: roomName => {
    set(state => ({
      operations: {
        ...state.operations,
        diningRooms: state.operations.diningRooms.filter(r => r !== roomName),
      },
    }))
  },

  saveSettings: async () => {
    set({ isSaving: true })
    try {
      const { facility, operations, integrations, security } = get()
      const payload = { facility, operations, integrations, security }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      set({ lastSavedAt: new Date().toISOString(), isSaving: false })
    } catch (err) {
      set({ isSaving: false })
      throw err
    }
  },

  resetDefaults: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({
      facility: DEFAULT_SETTINGS.facility,
      operations: DEFAULT_SETTINGS.operations,
      integrations: DEFAULT_SETTINGS.integrations,
      security: DEFAULT_SETTINGS.security,
      lastSavedAt: new Date().toISOString(),
    })
  },
}))
