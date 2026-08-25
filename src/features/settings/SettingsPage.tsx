import React, { useState } from 'react'
import { useSettingsStore, type FacilityProfile, type OperationsConfig, type IntegrationsConfig, type SecurityConfig } from '@/state/settingsStore'
import { LicenseManager } from '@/security/license'
import { AppleBadge, AppleButton, AppleCard, AppleSegmentedControl } from '@/apple-ui'
import {
  Building2,
  MapPin,
  UtensilsCrossed,
  Truck,
  Shield,
  Key,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Clock,
  ExternalLink,
  Sparkles,
  Layers,
  HeartHandshake,
  DollarSign,
} from 'lucide-react'

type SettingsTab = 'facility' | 'wings' | 'clinical' | 'integrations' | 'security'

export default function SettingsPage() {
  const {
    facility,
    operations,
    integrations,
    security,
    isSaving,
    lastSavedAt,
    updateFacility,
    updateOperations,
    updateIntegrations,
    updateSecurity,
    addWing,
    removeWing,
    addDiningRoom,
    removeDiningRoom,
    saveSettings,
    resetDefaults,
  } = useSettingsStore()

  const [activeTab, setActiveTab] = useState<SettingsTab>('facility')
  const [newWing, setNewWing] = useState('')
  const [newRoom, setNewRoom] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const license = LicenseManager.getLicense()

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      await saveSettings()
      showToast('Facility settings saved and synced successfully!')
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings.', 'error')
    }
  }

  const handleReset = () => {
    if (!window.confirm('Reset all facility settings to factory defaults?')) return
    resetDefaults()
    showToast('Settings reset to default profile.')
  }

  const handleAddWingSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWing.trim()) return
    addWing(newWing)
    setNewWing('')
  }

  const handleAddRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoom.trim()) return
    addDiningRoom(newRoom)
    setNewRoom('')
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-1 sm:px-4 py-2 animate-in fade-in duration-200">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
              Facility & Operations Settings
            </h1>
            <AppleBadge color={license.tier === 'enterprise' ? 'purple' : license.tier === 'pro' ? 'blue' : 'green'}>
              {license.tier.toUpperCase()} TIER
            </AppleBadge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure healthcare community profile, residential wings, dining schedule, distributor accounts, and compliance parameters.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <AppleButton
            variant="secondary"
            size="md"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={handleReset}
          >
            Reset Defaults
          </AppleButton>
          <AppleButton
            variant="primary"
            size="md"
            icon={<Save className="w-4 h-4" />}
            onClick={() => handleSave()}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </AppleButton>
        </div>
      </div>

      {/* ── Top Telemetry Overview Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <AppleCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Facility</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {facility.name}
              </div>
            </div>
          </div>
        </AppleCard>

        <AppleCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Primary Vendor</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                {integrations.primaryDistributor} Food Service
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
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Target CPD</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                ${operations.targetCpd.toFixed(2)} / Resident Day
              </div>
            </div>
          </div>
        </AppleCard>

        <AppleCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Meal Service Window</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {operations.mealTimes.breakfast} – {operations.mealTimes.dinner}
              </div>
            </div>
          </div>
        </AppleCard>
      </div>

      {/* ── Toast Notification Banner ── */}
      {toast && (
        <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold animate-in slide-in-from-top ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ── Cupertino Segmented Tab Navigation ── */}
      <AppleSegmentedControl
        value={activeTab}
        onChange={v => setActiveTab(v as SettingsTab)}
        options={[
          { label: 'Facility Profile', value: 'facility' },
          { label: 'Wings & Dining Rooms', value: 'wings' },
          { label: 'Dietary & Clinical', value: 'clinical' },
          { label: 'Distributor & Integrations', value: 'integrations' },
          { label: 'Security & SaaS License', value: 'security' },
        ]}
      />

      {/* ── TAB 1: FACILITY PROFILE ── */}
      {activeTab === 'facility' && (
        <AppleCard className="p-6 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Organization & Facility Details</h2>
            <p className="text-xs text-slate-500">Legal facility entity name, state licensing, and official contact metadata.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">Facility / Community Name</label>
              <input
                type="text"
                value={facility.name}
                onChange={e => updateFacility({ name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">Management Company / Parent Org</label>
              <input
                type="text"
                value={facility.organization}
                onChange={e => updateFacility({ organization: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">Facility Type</label>
              <select
                value={facility.facilityType}
                onChange={e => updateFacility({ facilityType: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium outline-none"
              >
                <option value="Skilled Nursing">Skilled Nursing Facility (SNF)</option>
                <option value="Assisted Living">Assisted Living Facility (ALF)</option>
                <option value="Memory Care">Memory Care Community</option>
                <option value="Continuing Care">Continuing Care Retirement Community (CCRC)</option>
                <option value="Hospital">Acute Care / Hospital</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">National Provider Identifier (NPI)</label>
              <input
                type="text"
                value={facility.npiNumber}
                onChange={e => updateFacility({ npiNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">State Operating License #</label>
              <input
                type="text"
                value={facility.licenseNumber}
                onChange={e => updateFacility({ licenseNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">Physical Address</label>
              <input
                type="text"
                value={facility.address}
                onChange={e => updateFacility({ address: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">Main Operations Phone</label>
              <input
                type="text"
                value={facility.phone}
                onChange={e => updateFacility({ phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">Operations Contact Email</label>
              <input
                type="email"
                value={facility.email}
                onChange={e => updateFacility({ email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Clinical & Culinary Leadership</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-300">Director of Dining / Executive Chef</label>
                <input
                  type="text"
                  value={facility.directorOfDining}
                  onChange={e => updateFacility({ directorOfDining: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-300">Registered Dietitian (RDN / LD)</label>
                <input
                  type="text"
                  value={facility.registeredDietitian}
                  onChange={e => updateFacility({ registeredDietitian: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium outline-none"
                />
              </div>
            </div>
          </div>
        </AppleCard>
      )}

      {/* ── TAB 2: WINGS & DINING ROOMS ── */}
      {activeTab === 'wings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AppleCard className="p-6 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Residential Wings & Units</span>
              </h2>
              <p className="text-xs text-slate-500">Configure floor wings for census reporting and room tray grouping.</p>
            </div>

            <div className="space-y-2">
              {operations.wings.map(w => (
                <div key={w} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                  <span className="font-medium text-slate-900 dark:text-white">{w}</span>
                  <button
                    onClick={() => removeWing(w)}
                    className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddWingSubmit} className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="New Wing (e.g. Memory Care South)…"
                value={newWing}
                onChange={e => setNewWing(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <AppleButton type="submit" size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />}>
                Add Wing
              </AppleButton>
            </form>
          </AppleCard>

          <AppleCard className="p-6 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
                <span>Dining Locations & Stations</span>
              </h2>
              <p className="text-xs text-slate-500">Service zones for tray card sorting and cook tally distribution.</p>
            </div>

            <div className="space-y-2">
              {operations.diningRooms.map(r => (
                <div key={r} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                  <span className="font-medium text-slate-900 dark:text-white">{r}</span>
                  <button
                    onClick={() => removeDiningRoom(r)}
                    className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddRoomSubmit} className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="New Dining Location (e.g. Garden Bistro)…"
                value={newRoom}
                onChange={e => setNewRoom(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <AppleButton type="submit" size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />}>
                Add Location
              </AppleButton>
            </form>
          </AppleCard>
        </div>
      )}

      {/* ── TAB 3: DIETARY & CLINICAL STANDARDS ── */}
      {activeTab === 'clinical' && (
        <AppleCard className="p-6 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Clinical & Dining Operational Standards</h2>
            <p className="text-xs text-slate-500">CMS compliance parameters, meal service schedule times, and target cost metrics.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">Target Raw Food Cost Per Resident Day (CPD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={operations.targetCpd}
                  onChange={e => updateOperations({ targetCpd: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-400">Industry benchmark: $7.50 – $10.25 / resident day</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">HACCP Temperature Unit</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateOperations({ temperatureUnit: 'F' })}
                  className={`flex-1 py-2 rounded-xl font-bold border transition-all ${
                    operations.temperatureUnit === 'F'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  Fahrenheit (°F)
                </button>
                <button
                  type="button"
                  onClick={() => updateOperations({ temperatureUnit: 'C' })}
                  className={`flex-1 py-2 rounded-xl font-bold border transition-all ${
                    operations.temperatureUnit === 'C'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  Celsius (°C)
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daily Meal Schedule (CMS F809 Compliance)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-300">Breakfast Start</label>
                <input
                  type="time"
                  value={operations.mealTimes.breakfast}
                  onChange={e => updateOperations({ mealTimes: { ...operations.mealTimes, breakfast: e.target.value } })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-300">Lunch Start</label>
                <input
                  type="time"
                  value={operations.mealTimes.lunch}
                  onChange={e => updateOperations({ mealTimes: { ...operations.mealTimes, lunch: e.target.value } })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-300">Dinner Start</label>
                <input
                  type="time"
                  value={operations.mealTimes.dinner}
                  onChange={e => updateOperations({ mealTimes: { ...operations.mealTimes, dinner: e.target.value } })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-300">Evening Snack Window</label>
                <input
                  type="time"
                  value={operations.mealTimes.snack}
                  onChange={e => updateOperations({ mealTimes: { ...operations.mealTimes, snack: e.target.value } })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono outline-none"
                />
              </div>
            </div>
          </div>
        </AppleCard>
      )}

      {/* ── TAB 4: DISTRIBUTORS & INTEGRATIONS ── */}
      {activeTab === 'integrations' && (
        <AppleCard className="p-6 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Distributors & External Systems</h2>
            <p className="text-xs text-slate-500">Configure broadline food distributors, order guide accounts, and EHR sync.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">Primary Broadline Vendor</label>
              <select
                value={integrations.primaryDistributor}
                onChange={e => updateIntegrations({ primaryDistributor: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium outline-none"
              >
                <option value="dennis">Dennis Food Service</option>
                <option value="sysco">Sysco Corporation</option>
                <option value="usfoods">US Foods</option>
                <option value="gordon">Gordon Food Service (GFS)</option>
                <option value="pfg">Performance Food Group (PFG)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">Vendor Customer / Account #</label>
              <input
                type="text"
                value={integrations.distributorCustomerNumber}
                onChange={e => updateIntegrations({ distributorCustomerNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">PointClickCare / EHR Facility ID</label>
              <input
                type="text"
                value={integrations.pccFacilityId}
                onChange={e => updateIntegrations({ pccFacilityId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono outline-none"
              />
            </div>
          </div>
        </AppleCard>
      )}

      {/* ── TAB 5: SECURITY & LICENSING ── */}
      {activeTab === 'security' && (
        <AppleCard className="p-6 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">HIPAA Security & SaaS Licensing</h2>
            <p className="text-xs text-slate-500">Manage SaaS tier entitlement, timeout sessions, and HIPAA audit parameters.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">Session Inactivity Timeout</label>
              <select
                value={security.sessionTimeoutMinutes}
                onChange={e => updateSecurity({ sessionTimeoutMinutes: parseInt(e.target.value) || 30 })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium outline-none"
              >
                <option value={15}>15 minutes (High Security)</option>
                <option value={30}>30 minutes (Standard HIPAA)</option>
                <option value={60}>60 minutes (Extended)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">HIPAA Audit Retention Window</label>
              <input
                type="text"
                disabled
                value="7 Years (2,555 Days) — Immutable Storage"
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 font-mono outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-300">Business Associate Agreement (BAA)</label>
              <input
                type="text"
                disabled
                value={`Signed on ${security.baaSignedDate} by ${security.baaSignee}`}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 outline-none"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active License Tier</h3>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{license.facilityName}</div>
                  <div className="text-slate-400">Current Tier: <span className="font-bold text-blue-600">{license.tier.toUpperCase()}</span></div>
                </div>
              </div>
              <a
                href="https://shoreline-marketing.onrender.com/pricing"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <span>Upgrade License</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </AppleCard>
      )}

      {/* Save Button Bar */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="text-xs text-slate-400">
          {lastSavedAt ? `Last saved at ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Unsaved changes are kept in local memory'}
        </div>
        <AppleButton variant="primary" size="md" icon={<Save className="w-4 h-4" />} onClick={() => handleSave()} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save All Settings'}
        </AppleButton>
      </div>
    </div>
  )
}
