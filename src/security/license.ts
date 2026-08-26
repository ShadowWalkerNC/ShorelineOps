/**
 * ShorelineOps — License & Entitlement Engine (Care OS v5.0)
 * 
 * Manages Open Core Community vs. Pro Cloud vs. Enterprise SaaS tiers.
 * 
 * Tiers:
 * 1. 'community': Free Open-Source self-hosted edition (Census, Menus, Recipes, Tray Cards, SQLite/Postgres).
 * 2. 'pro': $199/mo SaaS (USDA Nutrition Engine, Multi-Distributor Price Comparison, Multi-User Cloud Sync, Auto Backups).
 * 3. 'enterprise': $399/mo SaaS (Live PointClickCare EHR API Sync, CMS-2567 Federal Survey Binder, 3-Way Invoice Match & Credit Memos, Multi-Facility Consolidated MRP).
 * 4. 'demo': Interactive live demo sandbox on Render/Vercel/localhost (100% unlocked evaluation mode).
 */

export type LicenseTier = 'community' | 'pro' | 'enterprise' | 'demo'

export interface LicenseInfo {
  tier: LicenseTier
  facilityName: string
  issuedTo: string
  expiresAt: string | null // ISO string or null for perpetual
  isValid: boolean
  features: {
    unlimitedResidents: boolean
    recipeBookAndMenus: boolean
    trayCardsAndKiosk: boolean
    usdaNutritionSolver: boolean
    multiDistributorComparison: boolean
    pointClickCareLiveSync: boolean
    cms2567SurveyBinder: boolean
    threeWayInvoiceMatch: boolean
    multiFacilityConsolidation: boolean
  }
}

const LICENSE_STORAGE_KEY = 'shoreline_saas_license_key'
const DEMO_MODE_STORAGE_KEY = 'shoreline_demo_mode'

const TIER_FEATURES: Record<LicenseTier, LicenseInfo['features']> = {
  community: {
    unlimitedResidents: true,
    recipeBookAndMenus: true,
    trayCardsAndKiosk: true,
    usdaNutritionSolver: false,
    multiDistributorComparison: false,
    pointClickCareLiveSync: false,
    cms2567SurveyBinder: false,
    threeWayInvoiceMatch: false,
    multiFacilityConsolidation: false,
  },
  pro: {
    unlimitedResidents: true,
    recipeBookAndMenus: true,
    trayCardsAndKiosk: true,
    usdaNutritionSolver: true,
    multiDistributorComparison: true,
    pointClickCareLiveSync: false,
    cms2567SurveyBinder: false,
    threeWayInvoiceMatch: false,
    multiFacilityConsolidation: false,
  },
  enterprise: {
    unlimitedResidents: true,
    recipeBookAndMenus: true,
    trayCardsAndKiosk: true,
    usdaNutritionSolver: true,
    multiDistributorComparison: true,
    pointClickCareLiveSync: true,
    cms2567SurveyBinder: true,
    threeWayInvoiceMatch: true,
    multiFacilityConsolidation: true,
  },
  demo: {
    unlimitedResidents: true,
    recipeBookAndMenus: true,
    trayCardsAndKiosk: true,
    usdaNutritionSolver: true,
    multiDistributorComparison: true,
    pointClickCareLiveSync: true,
    cms2567SurveyBinder: true,
    threeWayInvoiceMatch: true,
    multiFacilityConsolidation: true,
  },
}

export class LicenseManager {
  /** Check whether current instance is in demo mode */
  static isDemo(): boolean {
    // If explicitly disabled by user in settings
    if (localStorage.getItem(DEMO_MODE_STORAGE_KEY) === 'false') {
      return false
    }

    // Default to true for demo preview sites, localhost, or if demo mode explicitly set
    return (
      import.meta.env.VITE_DEMO_MODE === 'true' ||
      window.location.hostname.includes('render.com') ||
      window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('demo') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      localStorage.getItem(DEMO_MODE_STORAGE_KEY) === 'true' ||
      !this.getLicenseKey() // Default to unlocked demo evaluation if no key is entered
    )
  }

  /** Toggle demo evaluation mode */
  static setDemoMode(enabled: boolean): void {
    localStorage.setItem(DEMO_MODE_STORAGE_KEY, enabled ? 'true' : 'false')
  }

  /** Get active license key from localStorage or env */
  static getLicenseKey(): string {
    return (
      localStorage.getItem(LICENSE_STORAGE_KEY) ||
      (import.meta.env.VITE_SHORELINE_LICENSE_KEY as string) ||
      ''
    )
  }

  /** Set license key */
  static setLicenseKey(key: string): void {
    if (!key.trim()) {
      localStorage.removeItem(LICENSE_STORAGE_KEY)
    } else {
      localStorage.setItem(LICENSE_STORAGE_KEY, key.trim())
    }
  }

  /** Parse and validate license */
  static getLicense(): LicenseInfo {
    const key = this.getLicenseKey()

    // If an explicit Enterprise or Pro key is provided, parse it
    if (key.startsWith('SH_ENT_') || key.startsWith('SH_PRO_')) {
      try {
        const isEnt = key.startsWith('SH_ENT_')
        const payloadStr = atob(key.replace(/^SH_(ENT|PRO)_/, ''))
        const payload = JSON.parse(payloadStr)
        const tier: LicenseTier = isEnt ? 'enterprise' : 'pro'
        const isExpired = payload.exp && new Date(payload.exp * 1000) < new Date()

        return {
          tier: isExpired ? 'community' : tier,
          facilityName: payload.facility || 'Licensed Enterprise Care Facility',
          issuedTo: payload.issuedTo || 'Enterprise Licensee',
          expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
          isValid: !isExpired,
          features: isExpired ? TIER_FEATURES.community : TIER_FEATURES[tier],
        }
      } catch {
        // Fall through
      }
    }

    // If in demo mode (default on localhost/render/vercel)
    if (this.isDemo()) {
      return {
        tier: 'demo',
        facilityName: 'Shoreline Care OS (Enterprise Sandbox Demo)',
        issuedTo: 'Evaluation Visitor',
        expiresAt: null,
        isValid: true,
        features: TIER_FEATURES.demo,
      }
    }

    return {
      tier: 'community',
      facilityName: 'Self-Hosted Community Instance',
      issuedTo: 'Open Source Community',
      expiresAt: null,
      isValid: true,
      features: TIER_FEATURES.community,
    }
  }

  /** Check if a feature is unlocked */
  static hasFeature(feature: keyof LicenseInfo['features']): boolean {
    const license = this.getLicense()
    return !!license.features[feature]
  }

  /** Check if current tier satisfies requirement */
  static satisfiesTier(requiredTier: 'community' | 'pro' | 'enterprise'): boolean {
    const current = this.getLicense().tier
    if (current === 'demo' || current === 'enterprise') return true
    if (current === 'pro' && (requiredTier === 'community' || requiredTier === 'pro')) return true
    if (current === 'community' && requiredTier === 'community') return true
    return false
  }
}
