import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/requireAuth'
import { requireTier } from '../middleware/requireTier'
import { serverCache } from '../middleware/cache'

export const enterpriseRouter = Router()

interface ManagedFacility {
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

const MANAGED_FACILITIES: ManagedFacility[] = [
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

// GET /api/enterprise/facilities - List managed facilities
enterpriseRouter.get('/facilities', requireAuth, requireTier('enterprise'), async (req: Request, res: Response) => {
  const cacheKey = 'enterprise_facilities_list'
  const cached = serverCache.get(cacheKey)
  if (cached) {
    return res.json({ facilities: cached.value, cached: true })
  }

  serverCache.set(cacheKey, MANAGED_FACILITIES, 60, 'enterprise')
  return res.json({ facilities: MANAGED_FACILITIES, cached: false })
})

// POST /api/enterprise/syndicate-menu - Syndicate master menu across network
enterpriseRouter.post('/syndicate-menu', requireAuth, requireTier('enterprise'), async (req: Request, res: Response) => {
  const { menuId, targetFacilityIds } = req.body

  if (!menuId || !Array.isArray(targetFacilityIds) || targetFacilityIds.length === 0) {
    return res.status(400).json({ error: 'menuId and non-empty targetFacilityIds array are required' })
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  MANAGED_FACILITIES.forEach(f => {
    if (targetFacilityIds.includes(f.id)) {
      f.lastMenuSync = todayStr
    }
  })

  serverCache.invalidateTag('enterprise')

  return res.json({
    status: 'SYNDICATED',
    menuId,
    targetFacilitiesCount: targetFacilityIds.length,
    syndicatedAt: new Date().toISOString(),
  })
})

// GET /api/enterprise/benchmarks - Cross-facility $/CPD benchmarking
enterpriseRouter.get('/benchmarks', requireAuth, requireTier('enterprise'), async (req: Request, res: Response) => {
  const totalCensus = MANAGED_FACILITIES.reduce((sum, f) => sum + f.activeCensus, 0)
  const networkAvgCpd = MANAGED_FACILITIES.reduce((sum, f) => sum + (f.currentCpd * f.activeCensus), 0) / (totalCensus || 1)
  const networkTargetCpd = MANAGED_FACILITIES.reduce((sum, f) => sum + (f.targetCpd * f.activeCensus), 0) / (totalCensus || 1)

  return res.json({
    totalFacilities: MANAGED_FACILITIES.length,
    totalActiveCensus: totalCensus,
    networkAvgCpd: parseFloat(networkAvgCpd.toFixed(2)),
    networkTargetCpd: parseFloat(networkTargetCpd.toFixed(2)),
    variance: parseFloat((networkAvgCpd - networkTargetCpd).toFixed(2)),
    facilities: MANAGED_FACILITIES.map(f => ({
      id: f.id,
      name: f.name,
      currentCpd: f.currentCpd,
      targetCpd: f.targetCpd,
      variance: parseFloat((f.currentCpd - f.targetCpd).toFixed(2)),
      status: f.currentCpd <= f.targetCpd ? 'UNDER_BUDGET' : 'OVER_BUDGET',
    })),
  })
})
