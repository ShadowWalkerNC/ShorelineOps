import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SetupWizardPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    facilityName: '',
    npiLicense: '',
    address: '',
    primaryContactEmail: '',
    facilityType: 'Assisted Living' as 'Assisted Living' | 'Skilled Nursing' | 'Memory Care' | 'Continuing Care',
    wings: ['West Wing', 'Memory Care', 'Rehab Unit'],
    diningRooms: ['Main Dining Room', 'Tray Delivery'],
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: '',
    setupSecret: '',
    baaSigneeName: '',
    baaAccepted: false,
    initMode: 'sample' as 'clean' | 'sample',
  })

  const [wingInput, setWingInput] = useState('')
  const [diningInput, setDiningInput] = useState('')

  const handleAddWing = () => {
    if (wingInput.trim() && !formData.wings.includes(wingInput.trim())) {
      setFormData((prev) => ({ ...prev, wings: [...prev.wings, wingInput.trim()] }))
      setWingInput('')
    }
  }

  const handleRemoveWing = (wing: string) => {
    setFormData((prev) => ({ ...prev, wings: prev.wings.filter((w) => w !== wing) }))
  }

  const handleAddDining = () => {
    if (diningInput.trim() && !formData.diningRooms.includes(diningInput.trim())) {
      setFormData((prev) => ({ ...prev, diningRooms: [...prev.diningRooms, diningInput.trim()] }))
      setDiningInput('')
    }
  }

  const handleRemoveDining = (room: string) => {
    setFormData((prev) => ({ ...prev, diningRooms: prev.diningRooms.filter((r) => r !== room) }))
  }

  const handleFinalSubmit = async () => {
    setError(null)
    if (formData.adminPassword !== formData.adminPasswordConfirm) {
      setError('Admin passwords do not match.')
      return
    }
    if (formData.adminPassword.length < 12) {
      setError('Admin password must be at least 12 characters and include upper, lower, number, and special character.')
      return
    }
    if (!formData.setupSecret || formData.setupSecret.length < 16) {
      setError('Setup bootstrap secret is required (must match server SETUP_BOOTSTRAP_SECRET).')
      return
    }
    if (!formData.baaAccepted) {
      setError('You must read and accept the Business Associate Agreement (BAA) to proceed.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/setup/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Setup-Secret': formData.setupSecret,
        },
        body: JSON.stringify({
          facilityName: formData.facilityName,
          npiLicense: formData.npiLicense,
          address: formData.address,
          primaryContactEmail: formData.primaryContactEmail,
          facilityType: formData.facilityType,
          wings: formData.wings,
          diningRooms: formData.diningRooms,
          adminName: formData.adminName,
          adminEmail: formData.adminEmail,
          adminPassword: formData.adminPassword,
          baaSigneeName: formData.baaSigneeName,
          initMode: formData.initMode,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete setup.')
      }

      navigate('/login', { replace: true })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const STEPS = [
    { id: 1, name: 'Facility' },
    { id: 2, name: 'Admin Account' },
    { id: 3, name: 'Wings & Dining' },
    { id: 4, name: 'Security' },
    { id: 5, name: 'HIPAA & BAA' },
    { id: 6, name: 'Launch Mode' },
  ]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'clamp(20px, 4vw, 48px) clamp(12px, 4vw, 24px)',
        fontFamily: 'var(--font-body)',
        color: 'var(--text-primary)',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 780,
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          padding: '40px 48px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 28
        }}
      >
        {/* Header Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-bold)',
              letterSpacing: '0.5px',
              marginBottom: 12
            }}
          >
            🛡️ HIPAA & SOC 2 COMPLIANT FACILITY ONBOARDING
          </div>
          <h1 style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--weight-black)', color: 'var(--text-primary)', marginBottom: 8 }}>
            ShorelineOps Setup Wizard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)', maxWidth: 540, lineHeight: 'var(--leading-normal)' }}>
            Initialize your facility instance, administrative security keys, campus layout, and regulatory compliance agreements.
          </p>
        </div>

        {/* Stepper Progress Indicator */}
        <div style={{ padding: '0 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
            {/* Background Line */}
            <div
              style={{
                position: 'absolute',
                top: 18,
                left: 24,
                right: 24,
                height: 3,
                backgroundColor: 'var(--border-color)',
                zIndex: 0
              }}
            />
            {/* Progress Line */}
            <div
              style={{
                position: 'absolute',
                top: 18,
                left: 24,
                width: `${((step - 1) / (STEPS.length - 1)) * 92}%`,
                height: 3,
                backgroundColor: 'var(--color-primary)',
                transition: 'width 0.3s ease',
                zIndex: 0
              }}
            />

            {STEPS.map((s) => {
              const isPassed = step > s.id
              const isCurrent = step === s.id
              return (
                <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 1 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: isCurrent ? 'var(--color-primary)' : isPassed ? 'var(--color-primary-light)' : 'var(--bg-card)',
                      border: `2.5px solid ${isCurrent || isPassed ? 'var(--color-primary)' : 'var(--border-color)'}`,
                      color: isCurrent ? '#ffffff' : isPassed ? 'var(--color-primary)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'var(--weight-bold)',
                      fontSize: 'var(--text-sm)',
                      boxShadow: isCurrent ? '0 0 0 4px var(--color-primary-light)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isPassed ? '✓' : s.id}
                  </div>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: isCurrent ? 'var(--color-primary)' : 'var(--text-muted)',
                      fontWeight: isCurrent ? 'var(--weight-bold)' : 'var(--weight-medium)'
                    }}
                  >
                    {s.name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', padding: '14px 18px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Step Card Content Container */}
        <div style={{ backgroundColor: 'var(--bg-app)', padding: 28, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          
          {/* Step 1: Facility Info */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 4 }}>
                  Step 1: Facility & Campus Identity
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Enter your organization's legal name, license number, and primary operational details.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Facility / Organization Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shoreline Senior Living & Rehabilitation"
                  value={formData.facilityName}
                  onChange={(e) => setFormData({ ...formData, facilityName: e.target.value })}
                  style={{
                    width: '100%',
                    height: 'var(--input-height)',
                    padding: '0 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: 'var(--text-base)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 6, color: 'var(--text-primary)' }}>
                    Facility Type <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <select
                    value={formData.facilityType}
                    onChange={(e) => setFormData({ ...formData, facilityType: e.target.value as any })}
                    style={{
                      width: '100%',
                      height: 'var(--input-height)',
                      padding: '0 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      fontSize: 'var(--text-base)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="Assisted Living">Assisted Living Facility</option>
                    <option value="Skilled Nursing">Skilled Nursing Facility (SNF)</option>
                    <option value="Memory Care">Memory Care Community</option>
                    <option value="Continuing Care">Continuing Care Retirement Community (CCRC)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 6, color: 'var(--text-primary)' }}>
                    NPI / State License Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1982039481"
                    value={formData.npiLicense}
                    onChange={(e) => setFormData({ ...formData, npiLicense: e.target.value })}
                    style={{
                      width: '100%',
                      height: 'var(--input-height)',
                      padding: '0 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      fontSize: 'var(--text-base)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Primary Operational / Billing Email <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="email"
                  placeholder="admin@shorelinecare.com"
                  value={formData.primaryContactEmail}
                  onChange={(e) => setFormData({ ...formData, primaryContactEmail: e.target.value })}
                  style={{
                    width: '100%',
                    height: 'var(--input-height)',
                    padding: '0 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: 'var(--text-base)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Facility Physical Address
                </label>
                <input
                  type="text"
                  placeholder="100 Shoreline Drive, Coastal City, CA 90210"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{
                    width: '100%',
                    height: 'var(--input-height)',
                    padding: '0 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: 'var(--text-base)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 2: Admin Account */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 4 }}>
                  Step 2: Super Administrator Credentials
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Create your master facility administrator account. This user holds full system control and staff user management rights.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Administrator Full Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Alex Morgan"
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  style={{
                    width: '100%',
                    height: 'var(--input-height)',
                    padding: '0 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: 'var(--text-base)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Admin Email Address <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="email"
                  placeholder="alex.morgan@shorelinecare.com"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  style={{
                    width: '100%',
                    height: 'var(--input-height)',
                    padding: '0 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: 'var(--text-base)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 6, color: 'var(--text-primary)' }}>
                    Password (min 12 chars, mixed case, number, special) <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    style={{
                      width: '100%',
                      height: 'var(--input-height)',
                      padding: '0 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      fontSize: 'var(--text-base)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 6, color: 'var(--text-primary)' }}>
                    Confirm Password <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={formData.adminPasswordConfirm}
                    onChange={(e) => setFormData({ ...formData, adminPasswordConfirm: e.target.value })}
                    style={{
                      width: '100%',
                      height: 'var(--input-height)',
                      padding: '0 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      fontSize: 'var(--text-base)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Wings & Dining Rooms */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 4 }}>
                  Step 3: Wings, Stations & Dining Rooms
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Define your campus wings and meal distribution locations.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Facility Wings / Care Units
                </label>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <input
                    type="text"
                    placeholder="e.g. Memory Care, East Wing"
                    value={wingInput}
                    onChange={(e) => setWingInput(e.target.value)}
                    style={{
                      flex: 1,
                      height: 'var(--input-height)',
                      padding: '0 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      fontSize: 'var(--text-base)',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <button
                    onClick={handleAddWing}
                    style={{
                      height: 'var(--input-height)',
                      padding: '0 20px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-teal)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 'var(--weight-bold)',
                      cursor: 'pointer'
                    }}
                  >
                    Add Wing
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {formData.wings.map((w) => (
                    <span
                      key={w}
                      style={{
                        backgroundColor: 'var(--color-teal-light)',
                        color: 'var(--color-teal)',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 'var(--weight-bold)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      {w}
                      <button
                        onClick={() => handleRemoveWing(w)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-teal)', fontWeight: 'bold' }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Dining Rooms & Tray Lines
                </label>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <input
                    type="text"
                    placeholder="e.g. Main Dining Room, Tray Service"
                    value={diningInput}
                    onChange={(e) => setDiningInput(e.target.value)}
                    style={{
                      flex: 1,
                      height: 'var(--input-height)',
                      padding: '0 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      fontSize: 'var(--text-base)',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <button
                    onClick={handleAddDining}
                    style={{
                      height: 'var(--input-height)',
                      padding: '0 20px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-primary)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 'var(--weight-bold)',
                      cursor: 'pointer'
                    }}
                  >
                    Add Dining Room
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {formData.diningRooms.map((r) => (
                    <span
                      key={r}
                      style={{
                        backgroundColor: 'var(--color-primary-light)',
                        color: 'var(--color-primary)',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 'var(--weight-bold)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      {r}
                      <button
                        onClick={() => handleRemoveDining(r)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 'bold' }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Security */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 4 }}>
                  Step 4: Security & Safeguards Configuration
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Review active security controls enforcing HIPAA Security Rule compliance (§164.312).
                </p>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', gap: 14 }}>
                <div style={{ fontSize: 24 }}>🔐</div>
                <div>
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary)' }}>
                    AES-256 Storage & TLS 1.3 Transport Encryption
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                    All local SQLite databases, backup snapshots, and network communication channels enforce AES-256 and TLS 1.3 cryptographic protection.
                  </p>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', gap: 14 }}>
                <div style={{ fontSize: 24 }}>⌛</div>
                <div>
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary)' }}>
                    Automatic 15-Minute Inactivity Session Lockout
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                    Terminal stations automatically lock after 15 minutes of idle time to prevent unauthorized access to resident PHI.
                  </p>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', gap: 14 }}>
                <div style={{ fontSize: 24 }}>📋</div>
                <div>
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary)' }}>
                    Immutable Audit Trail Logging (§164.312(b))
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                    Every login, diet order change, resident record view, and timecard punch is logged with IP address and user ID.
                  </p>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Setup Bootstrap Secret <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Must match the server environment variable <code>SETUP_BOOTSTRAP_SECRET</code> (min 16 characters).
                </p>
                <input
                  type="password"
                  placeholder="Enter setup secret from server env"
                  value={formData.setupSecret}
                  onChange={(e) => setFormData({ ...formData, setupSecret: e.target.value })}
                  autoComplete="off"
                  style={{
                    width: '100%',
                    height: 'var(--input-height)',
                    padding: '0 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: 'var(--text-base)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 5: HIPAA Agreement */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 4 }}>
                  Step 5: Business Associate Agreement (BAA) Sign-Off
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Execute the required HIPAA Business Associate Agreement to initialize compliance tracking.
                </p>
              </div>

              <div
                style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  padding: 16,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6
                }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>HIPAA BUSINESS ASSOCIATE AGREEMENT (BAA) SUMMARY</strong><br /><br />
                This Business Associate Agreement ("BAA") is entered into by and between Covered Entity ({formData.facilityName || 'Facility'}) and ShorelineOps. Covered Entity and Business Associate agree to:<br />
                1. Implement administrative, physical, and technical safeguards that reasonably protect the confidentiality, integrity, and availability of PHI.<br />
                2. Report any security incident or breach of unsecured PHI within 24 hours of discovery.<br />
                3. Maintain immutable audit logs for a minimum of 6 years in accordance with federal healthcare compliance regulations.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Authorized Representative Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Alex Morgan, Executive Director"
                  value={formData.baaSigneeName}
                  onChange={(e) => setFormData({ ...formData, baaSigneeName: e.target.value })}
                  style={{
                    width: '100%',
                    height: 'var(--input-height)',
                    padding: '0 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: 'var(--text-base)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={formData.baaAccepted}
                  onChange={(e) => setFormData({ ...formData, baaAccepted: e.target.checked })}
                  style={{ width: 20, height: 20, marginTop: 2 }}
                />
                <span>
                  I represent that I have legal authority to bind <strong>{formData.facilityName || 'this facility'}</strong> and hereby accept and digitally execute the HIPAA Business Associate Agreement.
                </span>
              </label>
            </div>
          )}

          {/* Step 6: Launch Mode */}
          {step === 6 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 4 }}>
                  Step 6: Choose Database Initialization Mode
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Select how your facility database should be seeded upon launch:
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div
                  onClick={() => setFormData({ ...formData, initMode: 'sample' })}
                  style={{
                    padding: 20,
                    borderRadius: 'var(--radius-lg)',
                    border: `2px solid ${formData.initMode === 'sample' ? 'var(--color-primary)' : 'var(--border-color)'}`,
                    backgroundColor: formData.initMode === 'sample' ? 'var(--color-primary-light)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
                    🧪 Sample Demo Data
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Populates anonymized sample resident records, diet orders, recipes, and shift rosters for instant staff evaluation and testing.
                  </p>
                </div>

                <div
                  onClick={() => setFormData({ ...formData, initMode: 'clean' })}
                  style={{
                    padding: 20,
                    borderRadius: 'var(--radius-lg)',
                    border: `2px solid ${formData.initMode === 'clean' ? 'var(--color-primary)' : 'var(--border-color)'}`,
                    backgroundColor: formData.initMode === 'clean' ? 'var(--color-primary-light)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
                    ✨ Clean Production Slate
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Initializes a clean slate with zero resident records. Ready for live resident admissions and actual staff onboarding.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                height: 'var(--btn-height-md)',
                padding: '0 24px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontWeight: 'var(--weight-bold)',
                cursor: 'pointer'
              }}
            >
              ← Back
            </button>
          ) : <div />}

          {step < 6 ? (
            <button
              disabled={
                (step === 1 && (!formData.facilityName || !formData.primaryContactEmail)) ||
                (step === 2 && (!formData.adminName || !formData.adminEmail || !formData.adminPassword))
              }
              onClick={() => setStep(step + 1)}
              style={{
                height: 'var(--btn-height-md)',
                padding: '0 28px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                fontWeight: 'var(--weight-bold)',
                cursor: 'pointer'
              }}
            >
              Continue →
            </button>
          ) : (
            <button
              disabled={loading || !formData.baaAccepted || !formData.baaSigneeName}
              onClick={handleFinalSubmit}
              style={{
                height: 'var(--btn-height-md)',
                padding: '0 32px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-success)',
                color: '#ffffff',
                fontWeight: 'var(--weight-bold)',
                cursor: 'pointer'
              }}
            >
              {loading ? 'Initializing Setup...' : '🚀 Complete Setup & Launch Facility'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
