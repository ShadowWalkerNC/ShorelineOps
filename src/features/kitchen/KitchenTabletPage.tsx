import React, { useState } from 'react'
import TrayAssemblyScanner from './components/TrayAssemblyScanner'

interface CookWorksheetItem {
  id: string
  name: string
  mealSlot: 'Breakfast' | 'Lunch' | 'Dinner'
  category: string
  batchCount: number
  prepNotes: string
  status: 'pending' | 'prepping' | 'completed'
}

interface TrayCardDispatchItem {
  id: string
  residentName: string
  room: string
  dietOrder: string
  texture: string
  allergies: string[]
  beverages: string[]
  dispatched: boolean
}

interface QuickParItem {
  id: string
  sku: string
  name: string
  packSize: string
  parLevel: number
  onHand: number
}

export default function KitchenTabletPage() {
  const [activeTab, setActiveTab] = useState<'worksheet' | 'traycards' | 'scanner' | 'quickpar'>('worksheet')
  const [mealFilter, setMealFilter] = useState<'Breakfast' | 'Lunch' | 'Dinner'>('Lunch')

  // Data states
  const [worksheetItems, setWorksheetItems] = useState<CookWorksheetItem[]>([
    { id: '1', name: 'Roast Turkey Breast with Gravy', mealSlot: 'Lunch', category: 'Entree', batchCount: 42, prepNotes: 'Cook internal temp 165°F; hold at 145°F', status: 'prepping' },
    { id: '2', name: 'Mashed Potatoes & Gravy', mealSlot: 'Lunch', category: 'Starch', batchCount: 45, prepNotes: 'Smooth consistency for regular & mechanical soft', status: 'completed' },
    { id: '3', name: 'Steamed Green Beans', mealSlot: 'Lunch', category: 'Vegetable', batchCount: 40, prepNotes: 'Reserve 6 portions for pureed blend', status: 'pending' },
    { id: '4', name: 'Pureed Roast Turkey', mealSlot: 'Lunch', category: 'Pureed Entree', batchCount: 4, prepNotes: 'Blend with turkey broth to IDDSI Level 4', status: 'prepping' },
    { id: '5', name: 'Vegetable Lasagna (Vegetarian Opt)', mealSlot: 'Lunch', category: 'Alt Entree', batchCount: 8, prepNotes: 'Portion individual casserole ramekins', status: 'pending' },
  ])

  const [trayCards, setTrayCards] = useState<TrayCardDispatchItem[]>([
    { id: '1', residentName: 'Arthur Pendelton', room: '112-B', dietOrder: 'Puree / Mechanical Soft', texture: 'Puree', allergies: ['Shellfish', 'Tree Nuts'], beverages: ['Water Thickened Nectar', 'Apple Juice'], dispatched: false },
    { id: '2', residentName: 'Eleanor Vance', room: '104-A', dietOrder: 'Regular', texture: 'Regular', allergies: ['Penicillin (Medical)'], beverages: ['Coffee Decaf with Milk'], dispatched: false },
    { id: '3', residentName: 'Harold Finch', room: '108-A', dietOrder: 'No Concentrated Sweets (NCS)', texture: 'Ground / Minced', allergies: ['Peanuts'], beverages: ['Iced Tea Unsweetened'], dispatched: true },
    { id: '4', residentName: 'Margaret Holloway', room: '201-A', dietOrder: 'No Added Salt (NAS)', texture: 'Regular', allergies: ['Gluten / Wheat'], beverages: ['Skim Milk', 'Water'], dispatched: false },
    { id: '5', residentName: 'Walter Bishop', room: '204-B', dietOrder: 'Renal Diet / Low Sodium', texture: 'Regular', allergies: ['None'], beverages: ['Cranberry Juice'], dispatched: true },
  ])

  const [parItems, setParItems] = useState<QuickParItem[]>([
    { id: '1', sku: 'DNS-1001', name: 'Peaches Diced in 100% Juice', packSize: '6/#10 cans', parLevel: 5, onHand: 2 },
    { id: '2', sku: 'DNS-1002', name: 'Orange Juice Thickened Nectar', packSize: '12/32oz', parLevel: 4, onHand: 2 },
    { id: '3', sku: 'DNS-1003', name: 'Pureed Green Beans', packSize: '24/4oz', parLevel: 3, onHand: 1 },
    { id: '4', sku: 'DNS-1004', name: 'Chicken Breast Boneless Skinless', packSize: '40/4oz', parLevel: 6, onHand: 4 },
  ])

  const toggleWorksheetStatus = (id: string) => {
    setWorksheetItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const nextStatus = item.status === 'pending' ? 'prepping' : item.status === 'prepping' ? 'completed' : 'pending'
      return { ...item, status: nextStatus }
    }))
  }

  const toggleTrayDispatch = (id: string) => {
    setTrayCards(prev => prev.map(tc => tc.id === id ? { ...tc, dispatched: !tc.dispatched } : tc))
  }

  const adjustOnHand = (id: string, delta: number) => {
    setParItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const nextCount = Math.max(0, item.onHand + delta)
      return { ...item, onHand: nextCount }
    }))
  }

  const activeTrayIndex = trayCards.findIndex(t => !t.dispatched)
  const currentCard = activeTrayIndex !== -1 ? trayCards[activeTrayIndex] : null

  return (
    <div style={{ minHeight: '100dvh', background: '#0F172A', color: '#F8FAFC', padding: 20, fontFamily: 'Outfit, system-ui, sans-serif' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#3B82F6', padding: '10px 16px', borderRadius: 12, fontWeight: 900, fontSize: 20, letterSpacing: '1px' }}>
            KITCHEN TABLET
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Shoreline Dietary Command</div>
            <div style={{ fontSize: 13, color: '#94A3B8' }}>High-Contrast Touch Optimized Interface</div>
          </div>
        </div>

        {/* Meal Selector */}
        <div style={{ display: 'flex', background: '#1E293B', borderRadius: 12, padding: 4, gap: 4 }}>
          {(['Breakfast', 'Lunch', 'Dinner'] as const).map(meal => (
            <button
              key={meal}
              onClick={() => setMealFilter(meal)}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: mealFilter === meal ? '#3B82F6' : 'transparent',
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer'
              }}
            >
              {meal}
            </button>
          ))}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('worksheet')}
          style={{
            padding: '16px',
            borderRadius: 14,
            border: activeTab === 'worksheet' ? '3px solid #60A5FA' : '2px solid #334155',
            background: activeTab === 'worksheet' ? '#1E293B' : '#0F172A',
            color: '#fff',
            fontWeight: 800,
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }}></span>
          Cook Worksheets
        </button>

        <button
          onClick={() => setActiveTab('traycards')}
          style={{
            padding: '16px',
            borderRadius: 14,
            border: activeTab === 'traycards' ? '3px solid #60A5FA' : '2px solid #334155',
            background: activeTab === 'traycards' ? '#1E293B' : '#0F172A',
            color: '#fff',
            fontWeight: 800,
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6' }}></span>
          Tray Line ({trayCards.filter(t => t.dispatched).length}/{trayCards.length})
        </button>

        <button
          onClick={() => setActiveTab('scanner')}
          style={{
            padding: '16px',
            borderRadius: 14,
            border: activeTab === 'scanner' ? '3px solid #60A5FA' : '2px solid #334155',
            background: activeTab === 'scanner' ? '#1E293B' : '#0F172A',
            color: '#fff',
            fontWeight: 800,
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }}></span>
          📸 QR Tray Scanner
        </button>

        <button
          onClick={() => setActiveTab('quickpar')}
          style={{
            padding: '16px',
            borderRadius: 14,
            border: activeTab === 'quickpar' ? '3px solid #60A5FA' : '2px solid #334155',
            background: activeTab === 'quickpar' ? '#1E293B' : '#0F172A',
            color: '#fff',
            fontWeight: 800,
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }}></span>
          Quick Par Counter
        </button>
      </div>

      {/* Tab: QR Tray Scanner */}
      {activeTab === 'scanner' && (
        <TrayAssemblyScanner />
      )}

      {/* Tab: Cook Worksheets */}
      {activeTab === 'worksheet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {worksheetItems.map(item => {
            const isCompleted = item.status === 'completed'
            const isPrepping = item.status === 'prepping'
            return (
              <div
                key={item.id}
                onClick={() => toggleWorksheetStatus(item.id)}
                style={{
                  background: isCompleted ? '#064E3B' : isPrepping ? '#1E3A8A' : '#1E293B',
                  border: `2px solid ${isCompleted ? '#10B981' : isPrepping ? '#3B82F6' : '#334155'}`,
                  borderRadius: 16,
                  padding: '20px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>
                      {item.category}
                    </span>
                    <span style={{ fontSize: 14, color: isCompleted ? '#6EE7B7' : '#93C5FD', fontWeight: 700 }}>
                      STATUS: {item.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: '#fff' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 4 }}>
                    {item.prepNotes}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#F8FAFC' }}>
                    {item.batchCount}
                  </div>
                  <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>SERVINGS</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Tray Card Line Dispatch */}
      {activeTab === 'traycards' && (
        <div>
          {currentCard ? (
            <div style={{ background: '#1E293B', border: '3px solid #3B82F6', borderRadius: 20, padding: 32, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <span style={{ padding: '6px 16px', background: '#3B82F6', color: '#fff', borderRadius: 20, fontSize: 16, fontWeight: 800 }}>
                    ROOM {currentCard.room}
                  </span>
                  <h2 style={{ fontSize: 36, fontWeight: 900, margin: '12px 0 0', color: '#fff' }}>
                    {currentCard.residentName}
                  </h2>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, color: '#94A3B8', fontWeight: 700 }}>CARD {activeTrayIndex + 1} OF {trayCards.length}</div>
                </div>
              </div>

              {/* Diet Order & Texture */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ background: '#0F172A', padding: 18, borderRadius: 14, border: '1px solid #334155' }}>
                  <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Therapeutic Diet</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#60A5FA', marginTop: 4 }}>{currentCard.dietOrder}</div>
                </div>
                <div style={{ background: '#0F172A', padding: 18, borderRadius: 14, border: '1px solid #334155' }}>
                  <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Texture Requirement</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#F59E0B', marginTop: 4 }}>{currentCard.texture}</div>
                </div>
              </div>

              {/* High-Contrast Allergy Warning Banner */}
              <div style={{ background: '#7F1D1D', border: '2px solid #EF4444', borderRadius: 14, padding: 18, marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#FCA5A5', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }}></span>
                  CRITICAL ALLERGEN ALERTS
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginTop: 4 }}>
                  {currentCard.allergies.join(', ') || 'No Known Allergies'}
                </div>
              </div>

              {/* Beverages */}
              <div style={{ background: '#0F172A', padding: 18, borderRadius: 14, border: '1px solid #334155', marginBottom: 32 }}>
                <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Required Beverages</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#E2E8F0', marginTop: 4 }}>
                  {currentCard.beverages.join(' • ')}
                </div>
              </div>

              {/* Dispatch Action Button */}
              <button
                onClick={() => toggleTrayDispatch(currentCard.id)}
                style={{
                  width: '100%',
                  padding: '24px',
                  borderRadius: 16,
                  border: 'none',
                  background: '#10B981',
                  color: '#fff',
                  fontSize: 26,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.4)'
                }}
              >
                VERIFY & DISPATCH TRAY TO CART
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 60, background: '#1E293B', borderRadius: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#10B981', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 900 }}>✓</div>
              <h2 style={{ fontSize: 32, fontWeight: 900, color: '#fff', margin: 0 }}>All Trays Dispatched</h2>
              <p style={{ fontSize: 18, color: '#94A3B8', marginTop: 8 }}>The meal service line for {mealFilter} is complete.</p>
              <button
                onClick={() => setTrayCards(prev => prev.map(t => ({ ...t, dispatched: false })))}
                style={{ marginTop: 20, padding: '12px 24px', borderRadius: 12, border: '1px solid #475569', background: '#0F172A', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
              >
                Reset Tray Card Queue
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Quick Par Counter */}
      {activeTab === 'quickpar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 15, color: '#94A3B8', marginBottom: 4 }}>
            Tap <strong>+</strong> or <strong>-</strong> to adjust physical on-hand case counts during kitchen walk-throughs.
          </div>
          {parItems.map(item => (
            <div
              key={item.id}
              style={{
                background: '#1E293B',
                border: '2px solid #334155',
                borderRadius: 16,
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontSize: 14, color: '#94A3B8', fontWeight: 600 }}>{item.sku} • {item.packSize}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 2 }}>{item.name}</div>
                <div style={{ fontSize: 15, color: '#38BDF8', marginTop: 4, fontWeight: 700 }}>Par Level: {item.parLevel} cases</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                  onClick={() => adjustOnHand(item.id, -1)}
                  style={{ width: 64, height: 64, borderRadius: 16, border: 'none', background: '#334155', color: '#fff', fontSize: 32, fontWeight: 900, cursor: 'pointer' }}
                >
                  -
                </button>
                <div style={{ minWidth: 60, textAlign: 'center', fontSize: 36, fontWeight: 900, color: item.onHand < item.parLevel ? '#F87171' : '#4ADE80' }}>
                  {item.onHand}
                </div>
                <button
                  onClick={() => adjustOnHand(item.id, 1)}
                  style={{ width: 64, height: 64, borderRadius: 16, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 32, fontWeight: 900, cursor: 'pointer' }}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
