import React, { useState } from 'react'
import { useResidentsStore } from '../../state/residentsStore'

export default function TrayCardGeneratorPage() {
  const { residents } = useResidentsStore()
  const [selectedWing, setSelectedWing] = useState<string>('all')
  const [selectedMeal, setSelectedMeal] = useState<'Breakfast' | 'Lunch' | 'Dinner'>('Lunch')

  const wings = Array.from(new Set(residents.map((r: any) => r.wing || 'West Wing'))).filter(Boolean)

  const filteredResidents = residents.filter((r: any) => {
    if (selectedWing !== 'all' && (r.wing || 'West Wing') !== selectedWing) return false
    return true
  })

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="sl-page">
      <div className="no-print" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 4 }}>
            Dietary Tray Cards & Meal Tickets
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)' }}>
            Generate and print room tray tickets with clinical diet orders, liquid consistencies, and allergy warnings.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={selectedWing}
            onChange={(e) => setSelectedWing(e.target.value)}
            style={{
              height: 'var(--input-height)',
              padding: '0 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-base)'
            }}
          >
            <option value="all">All Wings & Units</option>
            {wings.map((wing: any) => (
              <option key={wing} value={wing}>{wing}</option>
            ))}
          </select>

          <select
            value={selectedMeal}
            onChange={(e) => setSelectedMeal(e.target.value as any)}
            style={{
              height: 'var(--input-height)',
              padding: '0 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-base)'
            }}
          >
            <option value="Breakfast">Breakfast Service</option>
            <option value="Lunch">Lunch Service</option>
            <option value="Dinner">Dinner Service</option>
          </select>

          <button
            onClick={handlePrint}
            style={{
              height: 'var(--input-height)',
              padding: '0 20px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              fontWeight: 'var(--weight-semi)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print Tray Cards
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {filteredResidents.map((resident: any) => {
          const texture = resident.texture || resident.dietTexture || 'Regular'
          const fluid = resident.fluidConsistency || resident.liquidConsistency || 'Thin Liquids'
          const allergies = resident.allergies || []
          const dislikes = resident.dislikes || []
          const dietOrder = resident.dietOrder || resident.dietType || 'Regular Diet'

          return (
            <div
              key={resident.id}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '2px solid var(--border-color)',
                padding: 18,
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                pageBreakInside: 'avoid'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Room {resident.roomNumber || resident.room || 'Unassigned'}
                  </span>
                  <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginTop: 2 }}>
                    {resident.name}
                  </h3>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {resident.wing || 'West Wing'} &bull; Table {resident.tableNumber || '1'}
                  </span>
                </div>
                <span
                  style={{
                    backgroundColor: 'var(--color-primary-light)',
                    color: 'var(--color-primary)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--weight-bold)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  {selectedMeal}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, backgroundColor: 'var(--bg-app)', padding: 10, borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 'var(--weight-medium)' }}>Texture</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>{texture}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 'var(--weight-medium)' }}>Fluid Consistency</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-teal)' }}>{fluid}</div>
                </div>
              </div>

              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                <strong>Order:</strong> {dietOrder}
              </div>

              {allergies.length > 0 ? (
                <div style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)' }}>
                  ⚠️ ALLERGIES: {allergies.join(', ')}
                </div>
              ) : (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', fontWeight: 'var(--weight-medium)' }}>
                  ✓ No Known Food Allergies
                </div>
              )}

              {dislikes.length > 0 && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  <strong>Dislikes:</strong> {dislikes.join(', ')}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
