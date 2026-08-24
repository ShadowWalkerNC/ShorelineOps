import React, { useState } from 'react'
import { LicenseManager, type LicenseTier } from '@/security/license'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import { ShieldCheck, Sparkles, Key, ExternalLink, CheckCircle2, Lock } from 'lucide-react'

interface FeatureGateProps {
  requiredTier: 'pro' | 'enterprise'
  featureName: string
  description: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function FeatureGate({
  requiredTier,
  featureName,
  description,
  children,
  fallback,
}: FeatureGateProps) {
  const license = LicenseManager.getLicense()
  const hasAccess = LicenseManager.satisfiesTier(requiredTier)
  const isDemo = license.tier === 'demo'

  const [inputKey, setInputKey] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault()
    setKeyError(null)
    setSuccessMsg(null)

    if (!inputKey.trim()) {
      setKeyError('Please enter a license key.')
      return
    }

    try {
      LicenseManager.setLicenseKey(inputKey.trim())
      const newLic = LicenseManager.getLicense()
      if (LicenseManager.satisfiesTier(requiredTier)) {
        setSuccessMsg(`Successfully activated ${newLic.tier.toUpperCase()} license for ${newLic.facilityName}!`)
        window.location.reload()
      } else {
        setKeyError(`This license is valid for ${newLic.tier.toUpperCase()}, but this feature requires ${requiredTier.toUpperCase()}.`)
      }
    } catch {
      setKeyError('Invalid license key format. Keys start with SH_PRO_ or SH_ENT_.')
    }
  }

  if (hasAccess) {
    return (
      <div className="relative">
        {isDemo && (
          <div className="mb-3 flex items-center justify-between px-3 py-1.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 text-xs">
            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Demo Preview Mode · {requiredTier === 'enterprise' ? 'Enterprise SaaS Feature' : 'Pro Cloud Feature'}</span>
            </div>
            <a
              href="https://shoreline-marketing.onrender.com/pricing"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1"
            >
              <span>View SaaS Pricing</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
        {children}
      </div>
    )
  }

  if (fallback) {
    return <>{fallback}</>
  }

  const tierName = requiredTier === 'enterprise' ? 'Enterprise SaaS ($399/mo)' : 'Pro Cloud SaaS ($199/mo)'

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <AppleCard className="p-8 backdrop-blur-2xl border-slate-200/80 dark:border-slate-800/80 shadow-apple-elevated space-y-6">
        
        {/* Header with Lock Icon */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
                {featureName}
              </h2>
              <AppleBadge color={requiredTier === 'enterprise' ? 'purple' : 'blue'}>
                {requiredTier.toUpperCase()} TIER
              </AppleBadge>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {description}
            </p>
          </div>
        </div>

        {/* Feature Comparison Box */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            Included in {tierName}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Full automated live integration</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Multi-distributor rate synchronization</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Audit & compliance federal crosswalk</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Dedicated customer success engineering</span>
            </div>
          </div>
        </div>

        {/* Action Row: License Key Input & Pricing Link */}
        <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <form onSubmit={handleActivate} className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter License Key (SH_PRO_... or SH_ENT_...)"
                  value={inputKey}
                  onChange={e => setInputKey(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                />
              </div>
              <AppleButton type="submit" size="sm" variant="primary">
                Activate
              </AppleButton>
            </form>

            <a
              href="https://shoreline-marketing.onrender.com/pricing"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors"
            >
              <span>Subscribe & Get License</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>

          {keyError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {keyError}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              {successMsg}
            </div>
          )}
        </div>

      </AppleCard>
    </div>
  )
}
