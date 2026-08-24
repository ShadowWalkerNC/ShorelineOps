import React, { useState } from 'react'
import { LicenseManager, type LicenseTier } from '@/security/license'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import { ShieldCheck, Key, ExternalLink, CheckCircle2, Lock, Sparkles, Building, Calendar, UserCheck } from 'lucide-react'

export default function LicenseManagerPanel() {
  const [license, setLicense] = useState(() => LicenseManager.getLicense())
  const [inputKey, setInputKey] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const isDemo = license.tier === 'demo'

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!inputKey.trim()) {
      LicenseManager.setLicenseKey('')
      setLicense(LicenseManager.getLicense())
      setSuccessMsg('License cleared. Instance reset to Free Open Source Community Edition.')
      return
    }

    try {
      LicenseManager.setLicenseKey(inputKey.trim())
      const updated = LicenseManager.getLicense()
      setLicense(updated)
      if (updated.tier !== 'community') {
        setSuccessMsg(`Successfully activated ${updated.tier.toUpperCase()} license for ${updated.facilityName}!`)
        setInputKey('')
      } else {
        setErrorMsg('Invalid license key or signature. Format must start with SH_PRO_ or SH_ENT_.')
      }
    } catch {
      setErrorMsg('Failed to parse license key.')
    }
  }

  const featuresList = [
    { key: 'unlimitedResidents', label: 'Resident Census & Dietary Profiles', tier: 'Community' },
    { key: 'recipeBookAndMenus', label: 'Cycle Menu Planner & Recipe Book', tier: 'Community' },
    { key: 'trayCardsAndKiosk', label: 'Tray Card Generator & Kitchen Tablet', tier: 'Community' },
    { key: 'usdaNutritionSolver', label: 'Real-Time USDA Nutrition Solver', tier: 'Pro' },
    { key: 'multiDistributorComparison', label: 'Lowest-Cost Split MRP Optimizer', tier: 'Pro' },
    { key: 'pointClickCareLiveSync', label: 'PointClickCare EHR Live 2-Way Sync', tier: 'Enterprise' },
    { key: 'cms2567SurveyBinder', label: 'CMS-2567 Federal Survey Digital Binder', tier: 'Enterprise' },
    { key: 'threeWayInvoiceMatch', label: '3-Way Invoice Match & Credit Memos', tier: 'Enterprise' },
    { key: 'multiFacilityConsolidation', label: 'Multi-Facility Chain Consolidated MRP', tier: 'Enterprise' },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white font-sans tracking-tight">
          SaaS License & Entitlements
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          ShorelineOps operates on an Open Core model. Core single-facility operations are free and open source; cloud sync, live EHR connectors, and multi-distributor MRP require a SaaS license key.
        </p>
      </div>

      {/* Current Tier Overview Card */}
      <AppleCard className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
              license.tier === 'enterprise' ? 'bg-purple-500/15 text-purple-600' :
              license.tier === 'pro' ? 'bg-blue-500/15 text-blue-600' :
              license.tier === 'demo' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {license.tier === 'enterprise' ? 'Enterprise Care Network SaaS' :
                   license.tier === 'pro' ? 'Pro Cloud SaaS Tier' :
                   license.tier === 'demo' ? 'Demo Sandbox Mode' : 'Free Community Core (Open Source)'}
                </h3>
                <AppleBadge color={
                  license.tier === 'enterprise' ? 'purple' :
                  license.tier === 'pro' ? 'blue' :
                  license.tier === 'demo' ? 'green' : 'gray'
                }>
                  {license.tier.toUpperCase()}
                </AppleBadge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <Building className="w-3.5 h-3.5" />
                <span>{license.facilityName}</span>
                {license.expiresAt && (
                  <>
                    <span>&middot;</span>
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Expires: {new Date(license.expiresAt).toLocaleDateString()}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <a
            href="https://shoreline-marketing.onrender.com/pricing"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm shrink-0"
          >
            <span>Upgrade SaaS Tier</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Feature Matrix Table */}
        <div className="mt-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-3">
            Active Feature Entitlements
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {featuresList.map(f => {
              const active = license.features[f.key as keyof typeof license.features]
              return (
                <div
                  key={f.key}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                    active
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/40 text-slate-900 dark:text-white font-medium'
                      : 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-200/40 dark:border-slate-800 text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {active ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span>{f.label}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                    {f.tier}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </AppleCard>

      {/* Enter License Key Card */}
      {!isDemo && (
        <AppleCard className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Activate SaaS License Key
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Paste your cryptographically signed license key from the Shoreline Cloud portal.
          </p>

          <form onSubmit={handleSaveKey} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              placeholder="SH_PRO_... or SH_ENT_..."
              value={inputKey}
              onChange={e => setInputKey(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
            />
            <AppleButton type="submit" size="sm" variant="primary">
              Activate Key
            </AppleButton>
            {license.tier !== 'community' && (
              <AppleButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  LicenseManager.setLicenseKey('')
                  setLicense(LicenseManager.getLicense())
                  setSuccessMsg('Reset to Community Core.')
                }}
              >
                Reset to Core
              </AppleButton>
            )}
          </form>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              {successMsg}
            </div>
          )}
        </AppleCard>
      )}

      {/* Open Core Architecture Explanation */}
      <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
        <span className="font-bold">🛡️ Open-Core Security Notice: </span>
        The source code repository on GitHub contains the free single-facility Community Core. Proprietary EHR live bridges (PointClickCare API OAuth endpoints), OCR invoice scanning pipelines, and multi-distributor lowest-cost split solvers are SaaS Cloud microservices protected by HMAC cryptographic license keys.
      </div>
    </div>
  )
}
