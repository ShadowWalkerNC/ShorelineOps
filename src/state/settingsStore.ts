import { create } from 'zustand'
import { settingsApi, type FacilitySettingsPayload } from '@/api/admin'
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

/**
 * Sync state of the facility settings store.
 * - 'synced': last server round-trip succeeded; local state == server.
 * - 'syncing': a server round-trip is in flight.
 * - 'offline-cached': server unreachable; showing localStorage cache.
 * - 'error': last write failed (e.g. permission); local edits kept, flagged.
 *
 * Server is authoritative: on every successful read/write the server
 * response replaces local state, and localStorage is only an offline cache.
 */
export type SettingsSyncState = 'synced' | 'syncing' | 'offline-cached' | 'error'

export interface SettingsState {
  facility: FacilityProfile
  operations: OperationsConfig
  integrations: IntegrationsConfig
  security: SecurityConfig
  isSaving: boolean
  lastSavedAt: string | null
  syncState: SettingsSyncState
  lastSyncedAt: string | null
  syncError: string | null

  // Actions
  updateFacility: (updates: Partial<FacilityProfile>) => void
  updateOperations: (updates: Partial<OperationsConfig>) => void
  updateIntegrations: (updates: Partial<IntegrationsConfig>) => void
  updateSecurity: (updates: Partial<SecurityConfig>) => void
  addWing: (wingName: string) => void
  removeWing: (wingName: string) => void
  addDiningRoom: (roomName: string) => void
  removeDiningRoom: (roomName: string) => void
  /** Pull authoritative settings from the server (falls back to cache). */
  loadFromServer: () => Promise<void>
  /** Write-through save: PUT to server, then refresh localStorage cache. */
  saveSettings: () => Promise<void>
  /** Reset to factory defaults server-side (manager-gated). */
  resetDefaults: () => Promise<void>
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

/** Deep-clone the defaults so no caller mutates the shared constant. */
function freshDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as typeof DEFAULT_SETTINGS
}

function loadCachedSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        facility: { ...DEFAULT_SETTINGS.facility, ...parsed.facility },
        operations: {
          ...DEFAULT_SETTINGS.operations,
          ...parsed.operations,
          mealTimes: { ...DEFAULT_SETTINGS.operations.mealTimes, ...(parsed.operations?.mealTimes ?? {}) },
        },
        integrations: { ...DEFAULT_SETTINGS.integrations, ...parsed.integrations },
        security: { ...DEFAULT_SETTINGS.security, ...parsed.security },
      }
    }
  } catch (err) {
    console.warn('Failed to parse settings from storage:', err)
  }
  return freshDefaults()
}

function applyServerPayload(
  state: Pick<SettingsState, 'facility' | 'operations' | 'integrations' | 'security'>,
  payload: FacilitySettingsPayload
): Pick<SettingsState, 'facility' | 'operations' | 'integrations' | 'security'> {
  const s = payload.settings
  return {
    facility: { ...DEFAULT_SETTINGS.facility, ...(s.facility ?? {}) },
    operations: {
      ...DEFAULT_SETTINGS.operations,
      ...(s.operations ?? {}),
      mealTimes: { ...DEFAULT_SETTINGS.operations.mealTimes, ...(s.operations?.mealTimes ?? {}) },
    },
    integrations: { ...DEFAULT_SETTINGS.integrations, ...(s.integrations ?? {}) },
    security: { ...DEFAULT_SETTINGS.security, ...(s.security ?? {}) },
  }
}

function writeCache(state: SettingsState) {
  try {
    const payload = {
      facility: state.facility,
      operations: state.operations,
      integrations: state.integrations,
      security: state.security,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('Failed to cache settings to local storage:', err)
  }
}

const initial = loadCachedSettings()

export const useSettingsStore = create<SettingsState>((set, get) => ({
  facility: initial.facility,
  operations: initial.operations,
  integrations: initial.integrations,
  security: initial.security,
  isSaving: false,
  lastSavedAt: null,
  // Start honest: we only have the offline cache until a server read succeeds.
  syncState: 'offline-cached',
  lastSyncedAt: null,
  syncError: null,

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

  loadFromServer: async () => {
    // Avoid piling up parallel loads.
    if (get().syncState === 'syncing') return
    set({ syncState: 'syncing', syncError: null })
    try {
      const payload = await settingsApi.getFacilitySettings()
      const applied = applyServerPayload(get(), payload)
      const now = new Date().toISOString()
      set({
        ...applied,
        syncState: 'synced',
        lastSyncedAt: now,
        syncError: null,
      })
      writeCache(get())
    } catch (err: any) {
      // Server unreachable (offline, expired session, etc.): keep the
      // localStorage cache visible and say so — never silent.
      set({
        syncState: 'offline-cached',
        syncError: err?.message ?? 'Settings server unreachable — showing cached settings.',
      })
    }
  },

  saveSettings: async () => {
    set({ isSaving: true, syncError: null })
    try {
      const { facility, operations, integrations, security } = get()
      // Write-through: server is authoritative. The response replaces local
      // state (server wins) and then refreshes the offline cache.
      const payload = await settingsApi.updateFacilitySettings({
        facility,
        operations,
        integrations,
        security,
      })
      const applied = applyServerPayload(get(), payload)
      const now = new Date().toISOString()
      set({
        ...applied,
        lastSavedAt: now,
        lastSyncedAt: now,
        syncState: 'synced',
        syncError: null,
        isSaving: false,
      })
      writeCache(get())
    } catch (err: any) {
      // Local edits are kept so nothing is silently lost, but the failure
      // is surfaced honestly (permission denied, offline, …).
      set({
        isSaving: false,
        syncState: 'error',
        syncError: err?.message ?? 'Failed to save settings.',
      })
      throw err
    }
  },

  resetDefaults: async () => {
    set({ isSaving: true, syncError: null })
    try {
      const defaults = freshDefaults()
      // Reset happens server-side so every device converges; manager-gated.
      const payload = await settingsApi.updateFacilitySettings(defaults)
      const applied = applyServerPayload(get(), payload)
      const now = new Date().toISOString()
      set({
        ...applied,
        lastSavedAt: now,
        lastSyncedAt: now,
        syncState: 'synced',
        syncError: null,
        isSaving: false,
      })
      writeCache(get())
    } catch (err: any) {
      set({
        isSaving: false,
        syncState: 'error',
        syncError: err?.message ?? 'Failed to reset settings.',
      })
      throw err
    }
  },
}))
