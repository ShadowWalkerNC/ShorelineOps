import { create } from 'zustand'

export interface ManagedFacility {
  id: string
  name: string
  location: string
  bedCount: number
  activeCensus: number
  primaryDistributor: string
  currentCpd: number
  targetCpd: number
  cmsSurveyStatus: 'INSPECTION_READY' | 'MINOR_VARIANCE' | 'AUDIT_REQUIRED'
  complianceScore: number
  lastMenuSync: string
  directorOfDining: string
}

export interface EnterpriseMasterMenu {
  id: string
  name: string
  season: 'Fall/Winter' | 'Spring/Summer'
  cycleWeeks: number
  approvedByRd: string
  approvedDate: string
  syndicatedFacilitiesCount: number
  totalRecipesCount: number
  status: 'ACTIVE_SYNDICATED' | 'DRAFT_REVIEW' | 'ARCHIVED'
}

export interface EnterpriseState {
  facilities: ManagedFacility[]
  masterMenus: EnterpriseMasterMenu[]
  activeFacilityId: string
  isSyndicating: boolean
  lastSyndicatedAt: string | null

  // Actions
  setActiveFacilityId: (id: string) => void
  syndicateMasterMenu: (menuId: string, targetFacilityIds: string[]) => Promise<void>
  updateFacilityCpdTarget: (facilityId: string, newTarget: number) => void
  addFacility: (facility: Omit<ManagedFacility, 'id'>) => void
}

const DEFAULT_FACILITIES: ManagedFacility[] = [
  {
    id: 'fac-1',
    name: 'Shoreline Healthcare Center',
    location: 'Portland, ME',
    bedCount: 75,
    activeCensus: 71,
    primaryDistributor: 'Dennis Food Service',
    currentCpd: 8.42,
    targetCpd: 8.75,
    cmsSurveyStatus: 'INSPECTION_READY',
    complianceScore: 98.4,
    lastMenuSync: '2026-08-25',
    directorOfDining: 'Chef Marcus Vance, CDM, CFPP',
  },
  {
    id: 'fac-2',
    name: 'Harbor View Senior Living',
    location: 'Augusta, ME',
    bedCount: 60,
    activeCensus: 58,
    primaryDistributor: 'Dennis Food Service',
    currentCpd: 8.85,
    targetCpd: 8.75,
    cmsSurveyStatus: 'INSPECTION_READY',
    complianceScore: 97.8,
    lastMenuSync: '2026-08-25',
    directorOfDining: 'Chef Elena Rostova',
  },
  {
    id: 'fac-3',
    name: 'Atlantic Rehabilitation & Care',
    location: 'Bangor, ME',
    bedCount: 90,
    activeCensus: 84,
    primaryDistributor: 'Sysco Corporation',
    currentCpd: 9.15,
    targetCpd: 9.00,
    cmsSurveyStatus: 'MINOR_VARIANCE',
    complianceScore: 94.2,
    lastMenuSync: '2026-08-24',
    directorOfDining: 'Chef David Miller',
  },
  {
    id: 'fac-4',
    name: 'Casco Bay Memory Care Center',
    location: 'South Portland, ME',
    bedCount: 48,
    activeCensus: 46,
    primaryDistributor: 'Dennis Food Service',
    currentCpd: 8.60,
    targetCpd: 8.75,
    cmsSurveyStatus: 'INSPECTION_READY',
    complianceScore: 99.1,
    lastMenuSync: '2026-08-25',
    directorOfDining: 'Chef Sarah Collins',
  },
  {
    id: 'fac-5',
    name: 'Penobscot Valley Living Community',
    location: 'Orono, ME',
    bedCount: 52,
    activeCensus: 50,
    primaryDistributor: 'US Foods',
    currentCpd: 8.70,
    targetCpd: 8.75,
    cmsSurveyStatus: 'INSPECTION_READY',
    complianceScore: 96.5,
    lastMenuSync: '2026-08-23',
    directorOfDining: 'Chef Arthur Davis',
  },
]

const DEFAULT_MASTER_MENUS: EnterpriseMasterMenu[] = [
  {
    id: 'mm-1',
    name: '2026 Fall/Winter Master Care Cycle (4-Week)',
    season: 'Fall/Winter',
    cycleWeeks: 4,
    approvedByRd: 'Sarah Jenkins, MS, RDN, LD (Corporate Clinical Director)',
    approvedDate: '2026-08-15',
    syndicatedFacilitiesCount: 5,
    totalRecipesCount: 168,
    status: 'ACTIVE_SYNDICATED',
  },
  {
    id: 'mm-2',
    name: '2027 Spring/Summer Master Care Cycle (4-Week)',
    season: 'Spring/Summer',
    cycleWeeks: 4,
    approvedByRd: 'In Clinical Review',
    approvedDate: 'Pending Sign-Off',
    syndicatedFacilitiesCount: 0,
    totalRecipesCount: 164,
    status: 'DRAFT_REVIEW',
  },
]

export const useEnterpriseStore = create<EnterpriseState>((set, get) => ({
  facilities: DEFAULT_FACILITIES,
  masterMenus: DEFAULT_MASTER_MENUS,
  activeFacilityId: 'fac-1',
  isSyndicating: false,
  lastSyndicatedAt: null,

  setActiveFacilityId: id => set({ activeFacilityId: id }),

  syndicateMasterMenu: async (menuId, targetFacilityIds) => {
    set({ isSyndicating: true })
    await new Promise(r => setTimeout(r, 600)) // Simulate network syndication

    const todayStr = new Date().toISOString().slice(0, 10)
    set(state => ({
      isSyndicating: false,
      lastSyndicatedAt: new Date().toISOString(),
      facilities: state.facilities.map(f => {
        if (targetFacilityIds.includes(f.id)) {
          return { ...f, lastMenuSync: todayStr }
        }
        return f
      }),
      masterMenus: state.masterMenus.map(m => {
        if (m.id === menuId) {
          return {
            ...m,
            status: 'ACTIVE_SYNDICATED',
            syndicatedFacilitiesCount: targetFacilityIds.length,
          }
        }
        return m
      }),
    }))
  },

  updateFacilityCpdTarget: (facilityId, newTarget) => {
    set(state => ({
      facilities: state.facilities.map(f =>
        f.id === facilityId ? { ...f, targetCpd: newTarget } : f
      ),
    }))
  },

  addFacility: facilityData => {
    const newFacility: ManagedFacility = {
      ...facilityData,
      id: `fac-${Date.now()}`,
    }
    set(state => ({
      facilities: [...state.facilities, newFacility],
    }))
  },
}))
