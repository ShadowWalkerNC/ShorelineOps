import React, { useState } from 'react'
import { useEnterpriseStore, type ManagedFacility, type EnterpriseMasterMenu } from '@/state/enterpriseStore'
import FeatureGate from '@/components/FeatureGate'
import { AppleBadge, AppleButton, AppleCard, AppleSegmentedControl } from '@/apple-ui'
import {
  Building,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Utensils,
  Share2,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Users,
  MapPin,
  Calendar,
  Sparkles,
  Search,
  Filter,
} from 'lucide-react'

type EnterpriseTab = 'facilities' | 'menus' | 'benchmarking'

export default function EnterprisePortalPage() {
  const {
    facilities,
    masterMenus,
    isSyndicating,
    lastSyndicatedAt,
    syndicateMasterMenu,
    updateFacilityCpdTarget,
  } = useEnterpriseStore()

  const [activeTab, setActiveTab] = useState<EnterpriseTab>('facilities')
  const [search, setSearch] = useState('')
  const [selectedMenuId, setSelectedMenuId] = useState(masterMenus[0]?.id || '')
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>(facilities.map(f => f.id))
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const totalCensus = facilities.reduce((sum, f) => sum + f.activeCensus, 0)
  const totalBeds = facilities.reduce((sum, f) => sum + f.bedCount, 0)
  const avgCpd = facilities.reduce((sum, f) => sum + (f.currentCpd * f.activeCensus), 0) / (totalCensus || 1)
  const targetAvgCpd = facilities.reduce((sum, f) => sum + (f.targetCpd * f.activeCensus), 0) / (totalCensus || 1)
  const avgCompliance = facilities.reduce((sum, f) => sum + f.complianceScore, 0) / (facilities.length || 1)

  const handleSyndicate = async (menuId: string) => {
    if (selectedFacilityIds.length === 0) {
      showToast('Select at least one facility to syndicate the master menu.')
      return
    }
    await syndicateMasterMenu(menuId, selectedFacilityIds)
    showToast(`Master cycle menu syndicated to ${selectedFacilityIds.length} care communities!`)
  }

  const toggleFacilitySelection = (id: string) => {
    setSelectedFacilityIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAllFacilities = () => {
    if (selectedFacilityIds.length === facilities.length) {
      setSelectedFacilityIds([])
    } else {
      setSelectedFacilityIds(facilities.map(f => f.id))
    }
  }

  const filteredFacilities = facilities.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.location.toLowerCase().includes(search.toLowerCase()) ||
    f.directorOfDining.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <FeatureGate
      requiredTier="enterprise"
      featureName="Multi-Facility Corporate Headquarters & Central Menu Syndication"
      description="Centralized dietary operations oversight for senior living chains. Syndicate 4-week seasonal cycle menus across 5–50 buildings in 1 click, benchmark cross-facility $/CPD spend, and monitor enterprise CMS-2567 survey readiness."
    >
      <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 py-2 animate-in fade-in duration-200">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
                Corporate Dietary Headquarters
              </h1>
              <AppleBadge color="purple" dot>
                {facilities.length} Care Communities
              </AppleBadge>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Multi-facility chain oversight, central seasonal cycle menu syndication, and network-wide food spend benchmarking.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <AppleButton
              variant="primary"
              size="md"
              icon={<Share2 className="w-4 h-4" />}
              onClick={() => handleSyndicate(selectedMenuId)}
              disabled={isSyndicating}
            >
              {isSyndicating ? 'Syndicating…' : 'Syndicate Master Menu'}
            </AppleButton>
          </div>
        </div>

        {/* Network Telemetry Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <AppleCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <Building className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Portfolio Census</div>
                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {totalCensus} <span className="text-xs text-slate-400 font-normal">/ {totalBeds} Beds ({Math.round(totalCensus/totalBeds*100)}%)</span>
                </div>
              </div>
            </div>
          </AppleCard>

          <AppleCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Network $/CPD</div>
                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>${avgCpd.toFixed(2)}</span>
                  {avgCpd <= targetAvgCpd ? (
                    <TrendingDown className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-rose-500" />
                  )}
                </div>
              </div>
            </div>
          </AppleCard>

          <AppleCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">CMS Survey Readiness</div>
                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {avgCompliance.toFixed(1)}% <span className="text-xs text-emerald-600 font-semibold font-mono">F-Tag Ready</span>
                </div>
              </div>
            </div>
          </AppleCard>

          <AppleCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Utensils className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Active Master Cycle</div>
                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  4-Week Fall/Winter
                </div>
              </div>
            </div>
          </AppleCard>
        </div>

        {/* Toast */}
        {toastMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Segmented Control */}
        <AppleSegmentedControl
          value={activeTab}
          onChange={v => setActiveTab(v as EnterpriseTab)}
          options={[
            { label: 'Care Facilities Portfolio', value: 'facilities' },
            { label: 'Master Menu Syndicator', value: 'menus' },
            { label: 'Cross-Facility $/CPD Benchmarking', value: 'benchmarking' },
          ]}
        />

        {/* ── TAB 1: FACILITIES PORTFOLIO ── */}
        {activeTab === 'facilities' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search community name, city, or dietary director…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="text-xs text-slate-400">
                {filteredFacilities.length} of {facilities.length} communities shown
              </div>
            </div>

            <AppleCard className="overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 font-mono uppercase tracking-wider">
                      <th className="p-3.5">Community Name</th>
                      <th className="p-3.5">Location</th>
                      <th className="p-3.5">Census / Beds</th>
                      <th className="p-3.5">Primary Vendor</th>
                      <th className="p-3.5">Current $/CPD</th>
                      <th className="p-3.5">Target $/CPD</th>
                      <th className="p-3.5">Survey Status</th>
                      <th className="p-3.5 text-right">Director of Dining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredFacilities.map(f => (
                      <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <Building className="w-3.5 h-3.5 text-blue-600" />
                            <span>{f.name}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{f.location}</span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                          {f.activeCensus} / {f.bedCount}
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-300">{f.primaryDistributor}</td>
                        <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                          ${f.currentCpd.toFixed(2)}
                        </td>
                        <td className="p-3.5 font-mono text-slate-400">
                          ${f.targetCpd.toFixed(2)}
                        </td>
                        <td className="p-3.5">
                          <AppleBadge
                            color={f.cmsSurveyStatus === 'INSPECTION_READY' ? 'green' : 'orange'}
                            dot
                          >
                            {f.cmsSurveyStatus === 'INSPECTION_READY' ? 'Survey Ready' : 'Minor Variance'}
                          </AppleBadge>
                        </td>
                        <td className="p-3.5 text-right text-slate-500 font-medium">{f.directorOfDining}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AppleCard>
          </div>
        )}

        {/* ── TAB 2: MASTER MENU SYNDICATOR ── */}
        {activeTab === 'menus' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <AppleCard className="p-5 space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-blue-600" />
                    <span>Corporate Master Cycle Menus</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Approved seasonal 4-week cycle menus ready for network syndication.</p>
                </div>

                <div className="space-y-2.5">
                  {masterMenus.map(m => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMenuId(m.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        selectedMenuId === m.id
                          ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-500/80 shadow-xs'
                          : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/60 dark:border-slate-700/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{m.name}</span>
                        <AppleBadge color={m.status === 'ACTIVE_SYNDICATED' ? 'green' : 'orange'}>
                          {m.status === 'ACTIVE_SYNDICATED' ? 'Active' : 'In Review'}
                        </AppleBadge>
                      </div>
                      <div className="text-[11px] text-slate-500 space-y-0.5">
                        <div>{m.cycleWeeks}-Week Seasonal Cycle ({m.totalRecipesCount} Recipes)</div>
                        <div className="text-[10px] text-slate-400 font-mono">Sign-off: {m.approvedByRd}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </AppleCard>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <AppleCard className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-emerald-600" />
                      <span>Target Care Communities for Syndication</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Select facilities to push master menu recipes and cycle calendar.</p>
                  </div>
                  <AppleButton size="sm" variant="secondary" onClick={selectAllFacilities}>
                    {selectedFacilityIds.length === facilities.length ? 'Deselect All' : 'Select All'}
                  </AppleButton>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {facilities.map(f => {
                    const isSelected = selectedFacilityIds.includes(f.id)
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleFacilitySelection(f.id)}
                        className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between text-xs transition-all ${
                          isSelected
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-white font-medium'
                            : 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-200/50 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold truncate">{f.name}</div>
                          <div className="text-[10px] text-slate-400">{f.location} · Census: {f.activeCensus}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-blue-600 accent-blue-600 pointer-events-none"
                        />
                      </div>
                    )
                  })}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <AppleButton
                    variant="primary"
                    size="md"
                    icon={<Share2 className="w-4 h-4" />}
                    onClick={() => handleSyndicate(selectedMenuId)}
                    disabled={isSyndicating || selectedFacilityIds.length === 0}
                  >
                    {isSyndicating ? 'Pushing Menu Updates…' : `Push Master Menu to ${selectedFacilityIds.length} Facilities`}
                  </AppleButton>
                </div>
              </AppleCard>
            </div>
          </div>
        )}

        {/* ── TAB 3: CROSS-FACILITY BENCHMARKING ── */}
        {activeTab === 'benchmarking' && (
          <AppleCard className="p-6 space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Network Food Spend ($/CPD) Variance</h2>
              <p className="text-xs text-slate-500">Benchmark raw food cost per resident day across every community against corporate targets.</p>
            </div>

            <div className="space-y-4">
              {facilities.map(f => {
                const variance = f.currentCpd - f.targetCpd
                const isUnder = variance <= 0
                return (
                  <div key={f.id} className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                        <Building className="w-4 h-4 text-blue-600" />
                        <span>{f.name} ({f.location})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-500">Target: ${f.targetCpd.toFixed(2)}</span>
                        <span className={`font-mono font-bold ${isUnder ? 'text-emerald-600' : 'text-rose-600'}`}>
                          Actual: ${f.currentCpd.toFixed(2)} ({isUnder ? '-' : '+'}${Math.abs(variance).toFixed(2)})
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isUnder ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        style={{ width: `${Math.min(100, (f.currentCpd / (f.targetCpd * 1.2)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </AppleCard>
        )}

      </div>
    </FeatureGate>
  )
}
