/**
 * ============================================================
 * SETUP WIZARD — First-Run Configuration
 * ============================================================
 * Shown on first launch before any user can access the app.
 * Completes: facility info, HIPAA officer, jurisdiction,
 * first admin account creation, and BAA acknowledgment.
 * On completion writes sl_setup_complete = true.
 * ============================================================
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useComplianceStore } from '../../state/complianceStore'
import { useUserStore } from '../../state/userStore'
import { validatePassword } from '../../security/passwordPolicy'
import type { FacilityInfo, HipaaOfficer } from '../../state/complianceStore'

const TOTAL_STEPS = 7

const FACILITY_TYPES = [
  { value: 'snf', label: 'Skilled Nursing Facility (SNF)' },
  { value: 'alf', label: 'Assisted Living Facility (ALF)' },
  { value: 'memory_care', label: 'Memory Care' },
  { value: 'adult_day', label: 'Adult Day Services' },
  { value: 'other', label: 'Other' },
] as const

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

export default function SetupWizardPage() {
  const navigate = useNavigate()
  const { setFacility, setOfficer, setJurisdiction, setBaa, markSetupComplete } = useComplianceStore()
  const { createUser } = useUserStore()

  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [baaScrolled, setBaaScrolled] = useState(false)

  // Step 2 — Facility
  const [facility, setFacilityState] = useState<FacilityInfo>({
    name: '', address: '', city: '', state: '', zip: '', phone: '',
    npiNumber: '', facilityType: 'snf', bedCount: 0, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })

  // Step 3 — HIPAA Officer
  const [officer, setOfficerState] = useState<Omit<HipaaOfficer, 'designatedAt'>>({
    name: '', title: '', email: '', phone: '',
  })

  // Step 4 — Jurisdiction
  const [jurisdiction, setJurisdictionState] = useState('')

  // Step 5 — First Admin
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminConfirm, setAdminConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])

  // Step 6 — BAA
  const [baaChecked, setBaaChecked] = useState(false)

  const progress = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100)

  function advance() { setError(''); setStep(s => s + 1) }
  function back() { setError(''); setStep(s => s - 1) }

  function validateFacility(): boolean {
    if (!facility.name.trim()) { setError('Facility name is required.'); return false }
    if (!facility.address.trim()) { setError('Address is required.'); return false }
    if (!facility.city.trim()) { setError('City is required.'); return false }
    if (!facility.state) { setError('State is required.'); return false }
    if (!facility.zip.trim()) { setError('ZIP code is required.'); return false }
    if (!facility.phone.trim()) { setError('Phone number is required.'); return false }
    if (facility.bedCount < 1) { setError('Bed count must be at least 1.'); return false }
    return true
  }

  function validateOfficer(): boolean {
    if (!officer.name.trim()) { setError('Officer name is required.'); return false }
    if (!officer.title.trim()) { setError('Title is required.'); return false }
    if (!officer.email.trim() || !officer.email.includes('@')) { setError('Valid email is required.'); return false }
    return true
  }

  function validateAdmin(): boolean {
    if (!adminName.trim()) { setError('Name is required.'); return false }
    if (!adminEmail.trim() || !adminEmail.includes('@')) { setError('Valid email is required.'); return false }
    const result = validatePassword(adminPassword)
    setPasswordErrors(result.errors)
    if (!result.valid) { setError('Password does not meet requirements.'); return false }
    if (adminPassword !== adminConfirm) { setError('Passwords do not match.'); return false }
    return true
  }

  async function handleFinish() {
    if (!baaChecked) { setError('You must acknowledge the Business Associate Agreement.'); return }
    setLoading(true)
    setError('')
    try {
      setFacility(facility)
      setOfficer({ ...officer, designatedAt: new Date().toISOString() })
      setJurisdiction(jurisdiction || facility.state)
      const user = await createUser(
        { name: adminName, email: adminEmail, role: 'admin', password: adminPassword },
        'system', 'Setup Wizard'
      )
      setBaa({
        acknowledgedBy: adminName,
        acknowledgedById: user.id,
        acknowledgedAt: new Date().toISOString(),
        ipAddress: null,
      })
      await markSetupComplete(user.id, adminName)
      advance()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Setup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handlePasswordChange(val: string) {
    setAdminPassword(val)
    if (val) setPasswordErrors(validatePassword(val).errors)
    else setPasswordErrors([])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">

        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Shoreline Setup</h1>
              <p className="text-sm text-gray-500">Step {step} of {TOTAL_STEPS}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-gray-100 rounded-full mt-4">
            <div
              className="h-2 bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="px-8 py-6">

          {/* Step 1 — Welcome */}
          {step === 1 && (
            <div className="text-center">
              <div className="text-5xl mb-4">🏥</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Welcome to Shoreline LAN</h2>
              <p className="text-gray-600 mb-4">
                This wizard will configure your facility’s HIPAA compliance settings,
                designate your Security Officer, and create your first administrator account.
              </p>
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-left">
                <strong>⚠️ Important:</strong> All data is stored locally on this device and encrypted with AES-256-GCM.
                Complete this setup on the device that will serve as your primary workstation.
                You can create additional user accounts after setup.
              </p>
              <button
                onClick={advance}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
              >
                Begin Setup
              </button>
            </div>
          )}

          {/* Step 2 — Facility Info */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Facility Information</h2>
              <p className="text-sm text-gray-500 mb-6">Required for HIPAA compliance records and breach notifications.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Facility Name *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={facility.name} onChange={e => setFacilityState(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={facility.address} onChange={e => setFacilityState(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={facility.city} onChange={e => setFacilityState(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={facility.state} onChange={e => setFacilityState(f => ({ ...f, state: e.target.value }))}>
                    <option value="">Select state</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={facility.zip} onChange={e => setFacilityState(f => ({ ...f, zip: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={facility.phone} onChange={e => setFacilityState(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NPI Number</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={facility.npiNumber} onChange={e => setFacilityState(f => ({ ...f, npiNumber: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Facility Type *</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={facility.facilityType} onChange={e => setFacilityState(f => ({ ...f, facilityType: e.target.value as FacilityInfo['facilityType'] }))}>
                    {FACILITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Licensed Bed Count *</label>
                  <input type="number" min={1} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={facility.bedCount || ''} onChange={e => setFacilityState(f => ({ ...f, bedCount: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — HIPAA Officer */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">HIPAA Security Officer</h2>
              <p className="text-sm text-gray-500 mb-2">Required by 45 CFR §164.308(a)(2). Must be a specific named individual.</p>
              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-6">
                The Security Officer is responsible for developing and implementing security policies and procedures.
                This does not need to be a clinician — it can be the facility administrator.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={officer.name} onChange={e => setOfficerState(o => ({ ...o, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Facility Administrator"
                    value={officer.title} onChange={e => setOfficerState(o => ({ ...o, title: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={officer.email} onChange={e => setOfficerState(o => ({ ...o, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={officer.phone} onChange={e => setOfficerState(o => ({ ...o, phone: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Jurisdiction */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">State Jurisdiction</h2>
              <p className="text-sm text-gray-500 mb-2">
                Many states have privacy laws that exceed HIPAA’s requirements.
                Your jurisdiction determines which additional rules apply.
              </p>
              <p className="text-xs text-gray-500 mb-6">This will default to your facility’s state if not changed.</p>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary State of Operation</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={jurisdiction || facility.state}
                onChange={e => setJurisdictionState(e.target.value)}
              >
                <option value="">Select state</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="mt-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                <p className="font-medium mb-1">States with enhanced privacy requirements include:</p>
                <p>CA (CMIA), NY (SHIELD Act), TX (THIPAA), IL (GIPA), WA (My Health MY Data Act), and others.</p>
                <p className="mt-1">Consult your compliance counsel for state-specific obligations.</p>
              </div>
            </div>
          )}

          {/* Step 5 — First Admin */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Create Administrator Account</h2>
              <p className="text-sm text-gray-500 mb-6">
                This will be the first user account with full admin access.
                You can create additional users from the Admin panel after setup.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={adminName} onChange={e => setAdminName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={adminPassword}
                      onChange={e => handlePasswordChange(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {passwordErrors.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {passwordErrors.map((e, i) => (
                        <li key={i} className="text-xs text-red-600 flex items-start gap-1">
                          <span>✗</span>{e}
                        </li>
                      ))}
                    </ul>
                  )}
                  {adminPassword && passwordErrors.length === 0 && (
                    <p className="mt-1 text-xs text-green-600">✓ Password meets all requirements</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${
                      adminConfirm && adminConfirm !== adminPassword ? 'border-red-400' : 'border-gray-300'
                    }`}
                    value={adminConfirm}
                    onChange={e => setAdminConfirm(e.target.value)}
                  />
                  {adminConfirm && adminConfirm !== adminPassword && (
                    <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
                  )}
                </div>
              </div>
              <div className="mt-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                Password requirements: 12+ characters, uppercase, lowercase, number, special character.
                Passwords expire every 90 days. Last 10 passwords cannot be reused.
              </div>
            </div>
          )}

          {/* Step 6 — BAA */}
          {step === 6 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Business Associate Agreement</h2>
              <p className="text-sm text-gray-500 mb-4">
                Review and acknowledge the terms governing use of Shoreline LAN as a HIPAA-compliant tool.
                Scroll to the bottom to enable acknowledgment.
              </p>
              <div
                className="border border-gray-200 rounded-lg h-64 overflow-y-auto p-4 text-xs text-gray-600 bg-gray-50"
                onScroll={e => {
                  const el = e.currentTarget
                  if (el.scrollHeight - el.scrollTop - el.clientHeight < 10) setBaaScrolled(true)
                }}
              >
                <p className="font-bold mb-2">BUSINESS ASSOCIATE AGREEMENT — SHORELINE LAN</p>
                <p className="mb-2">Effective upon acknowledgment by the Covered Entity.</p>
                <p className="mb-2"><strong>1. Definitions.</strong> Terms used but not otherwise defined herein shall have the same meaning as those terms in the HIPAA Rules (45 CFR Parts 160 and 164).</p>
                <p className="mb-2"><strong>2. Obligations of Business Associate.</strong> Shoreline LAN operates entirely on the Covered Entity’s local hardware. No Protected Health Information (PHI) is transmitted to or stored by Shoreline AI LLC or any third-party server. All PHI remains encrypted at rest on the Covered Entity’s device using AES-256-GCM.</p>
                <p className="mb-2"><strong>3. Permitted Uses and Disclosures.</strong> Shoreline LAN may use and disclose PHI solely to perform functions authorized by the Covered Entity through the application interface, consistent with 45 CFR §164.504(e).</p>
                <p className="mb-2"><strong>4. Safeguards.</strong> Shoreline LAN implements administrative, physical, and technical safeguards to protect PHI, including AES-256-GCM encryption, role-based access control, automatic session timeout, audit logging, and password policy enforcement.</p>
                <p className="mb-2"><strong>5. Reporting.</strong> Covered Entity is solely responsible for breach notification to HHS and affected individuals. Shoreline LAN audit logs are available as evidence for breach investigations.</p>
                <p className="mb-2"><strong>6. Subcontractors.</strong> Shoreline LAN does not engage subcontractors that access PHI. No data leaves the local device.</p>
                <p className="mb-2"><strong>7. Access.</strong> Covered Entity may access, amend, or receive an accounting of disclosures of PHI through the application’s resident record and audit log features.</p>
                <p className="mb-2"><strong>8. Termination.</strong> Covered Entity may terminate use at any time. Upon termination, Covered Entity is responsible for securing or destroying local data per their data destruction policy.</p>
                <p className="mb-2"><strong>9. Survival.</strong> Obligations regarding PHI protection survive termination of this agreement.</p>
                <p className="mb-2"><strong>10. Governing Law.</strong> This agreement is governed by applicable federal law and the laws of the Covered Entity’s jurisdiction.</p>
                <p className="font-medium mt-4">By acknowledging below, the Covered Entity certifies they have read, understood, and agree to these terms on behalf of the facility identified in Step 2.</p>
              </div>
              {!baaScrolled && (
                <p className="text-xs text-gray-400 mt-2 text-center">Scroll to the bottom of the agreement to continue.</p>
              )}
              {baaScrolled && (
                <label className="flex items-start gap-3 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
                    checked={baaChecked}
                    onChange={e => setBaaChecked(e.target.checked)}
                  />
                  <span className="text-sm text-gray-700">
                    I, <strong>{adminName || 'the administrator'}</strong>, acknowledge this Business Associate Agreement
                    on behalf of <strong>{facility.name || 'the facility'}</strong>.
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Step 7 — Complete */}
          {step === 7 && (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Setup Complete</h2>
              <p className="text-gray-600 mb-2">
                <strong>{facility.name}</strong> is now configured.
              </p>
              <p className="text-gray-600 mb-6">
                Your administrator account has been created. Please log in to continue.
              </p>
              <div className="text-xs text-gray-500 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6 text-left space-y-1">
                <p>✓ Facility information saved</p>
                <p>✓ HIPAA Security Officer designated: {officer.name}</p>
                <p>✓ Jurisdiction set: {jurisdiction || facility.state}</p>
                <p>✓ Administrator account created: {adminEmail}</p>
                <p>✓ Business Associate Agreement acknowledged</p>
                <p>✓ Compliance baseline established</p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
              >
                Proceed to Login
              </button>
            </div>
          )}

          {/* Error */}
          {error && step < 7 && (
            <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step < 7 && (
          <div className="px-8 pb-8 flex justify-between items-center">
            <button
              onClick={back}
              disabled={step === 1}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2"
            >
              ← Back
            </button>
            {step < 6 ? (
              <button
                onClick={() => {
                  let ok = true
                  if (step === 2) ok = validateFacility()
                  else if (step === 3) ok = validateOfficer()
                  else if (step === 5) ok = validateAdmin()
                  if (ok) advance()
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={loading || !baaChecked}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
              >
                {loading ? 'Saving…' : 'Finish Setup'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
