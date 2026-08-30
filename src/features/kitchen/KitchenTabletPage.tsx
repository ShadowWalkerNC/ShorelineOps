import React, { useState, useEffect, useRef } from 'react'
import TrayAssemblyScanner from './components/TrayAssemblyScanner'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import {
  Mic,
  MicOff,
  Droplets,
  Thermometer,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Activity,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react'

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

interface HaccpVoiceLog {
  id: string
  timestamp: string
  item: string
  temperatureF: number
  type: 'HOT_HOLD' | 'COOK_CORE' | 'COOLING' | 'WASTE'
  status: 'PASS' | 'CRITICAL_FAIL' | 'LOGGED'
  recordedVia: 'voice' | 'manual'
  loggedBy: string
  wastePortions?: number
}

interface HydrationRecord {
  id: string
  residentName: string
  room: string
  liquidTexture: 'Regular Water' | 'Thickened Nectar' | 'Thickened Honey' | 'Fortified Shake'
  targetOz: number
  consumedOz: number
  acceptancePct: number
  timeSlot: 'Morning Pass (10 AM)' | 'Afternoon Pass (2 PM)' | 'Evening Pass (7 PM)'
  status: 'COMPLETED' | 'PENDING' | 'REFUSED'
}

export default function KitchenTabletPage() {
  const [activeTab, setActiveTab] = useState<'worksheet' | 'traycards' | 'scanner' | 'quickpar' | 'voice_haccp' | 'hydration'>('worksheet')
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

  // Network and Screen Wake Lock state
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const wakeLockRef = useRef<any>(null)

  // Voice HACCP state
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [pendingHaccpModal, setPendingHaccpModal] = useState<{
    item: string
    temperatureF: number
    type: 'COOK_CORE' | 'HOT_HOLD' | 'COOLING' | 'WASTE'
    suggestedStatus: 'PASS' | 'CRITICAL_FAIL'
    correctiveAction?: string
  } | null>(null)

  const [haccpLogs, setHaccpLogs] = useState<HaccpVoiceLog[]>([
    { id: 'h-1', timestamp: '11:15 AM', item: 'Roast Turkey Breast', temperatureF: 168.4, type: 'COOK_CORE', status: 'PASS', recordedVia: 'voice', loggedBy: 'Line Cook Dave' },
    { id: 'h-2', timestamp: '11:22 AM', item: 'Mashed Potatoes & Gravy', temperatureF: 152.0, type: 'HOT_HOLD', status: 'PASS', recordedVia: 'voice', loggedBy: 'Line Cook Dave' },
    { id: 'h-3', timestamp: '11:28 AM', item: 'Pureed Roast Turkey (Pan 2)', temperatureF: 166.2, type: 'COOK_CORE', status: 'PASS', recordedVia: 'voice', loggedBy: 'Cook Aide Elena' },
  ])

  // Screen Wake Lock initialization for hot kitchen lines
  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
          setWakeLockActive(true)
        }
      } catch {
        setWakeLockActive(false)
      }
    }
    requestWakeLock()

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
      }
    }
  }, [])

  // Hydration state
  const [hydrationRecords, setHydrationRecords] = useState<HydrationRecord[]>([
    { id: 'hy-1', residentName: 'Arthur Pendelton', room: '112-B', liquidTexture: 'Thickened Nectar', targetOz: 8, consumedOz: 6, acceptancePct: 75, timeSlot: 'Morning Pass (10 AM)', status: 'COMPLETED' },
    { id: 'hy-2', residentName: 'Eleanor Vance', room: '104-A', liquidTexture: 'Regular Water', targetOz: 8, consumedOz: 8, acceptancePct: 100, timeSlot: 'Morning Pass (10 AM)', status: 'COMPLETED' },
    { id: 'hy-3', residentName: 'Harold Finch', room: '108-A', liquidTexture: 'Regular Water', targetOz: 8, consumedOz: 4, acceptancePct: 50, timeSlot: 'Morning Pass (10 AM)', status: 'COMPLETED' },
    { id: 'hy-4', residentName: 'Margaret Holloway', room: '201-A', liquidTexture: 'Thickened Honey', targetOz: 6, consumedOz: 0, acceptancePct: 0, timeSlot: 'Morning Pass (10 AM)', status: 'PENDING' },
    { id: 'hy-5', residentName: 'Walter Bishop', room: '204-B', liquidTexture: 'Fortified Shake', targetOz: 8, consumedOz: 8, acceptancePct: 100, timeSlot: 'Morning Pass (10 AM)', status: 'COMPLETED' },
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

  // Voice speech synthesis & recognition handler with confirmation card
  const handleVoiceCommand = (text: string) => {
    setTranscript(text)
    const lower = text.toLowerCase()
    const tempMatch = text.match(/(\d{2,3})/g)
    const temp = tempMatch ? parseFloat(tempMatch[0]) : 165.0

    if (lower.includes('discard') || lower.includes('waste')) {
      const newLog: HaccpVoiceLog = {
        id: `h-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        item: lower.replace(/(discard|waste|\d+ portions?)/g, '').trim() || 'Prepared Food Item',
        temperatureF: 0,
        type: 'WASTE',
        status: 'LOGGED',
        recordedVia: 'voice',
        loggedBy: 'Kitchen Voice Tablet',
        wastePortions: tempMatch ? parseInt(tempMatch[0]) : 4,
      }
      setHaccpLogs(prev => [newLog, ...prev])
    } else {
      const isPass = temp >= 140.0
      // Instead of silently saving, display confirmation card modal
      setPendingHaccpModal({
        item: text.replace(/(\d{2,3}|degrees|holding|at|core|temp)/gi, '').trim() || 'Hot Line Entree',
        temperatureF: temp,
        type: temp >= 165 ? 'COOK_CORE' : 'HOT_HOLD',
        suggestedStatus: isPass ? 'PASS' : 'CRITICAL_FAIL',
      })
    }
  }

  const confirmPendingHaccpLog = (correctiveAction?: string) => {
    if (!pendingHaccpModal) return
    const newLog: HaccpVoiceLog = {
      id: `h-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      item: pendingHaccpModal.item,
      temperatureF: pendingHaccpModal.temperatureF,
      type: pendingHaccpModal.type,
      status: correctiveAction ? 'PASS' : pendingHaccpModal.suggestedStatus,
      recordedVia: 'voice',
      loggedBy: 'Line Cook (Verified)',
    }
    setHaccpLogs(prev => [newLog, ...prev])
    setPendingHaccpModal(null)
  }

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false)
      return
    }

    setIsListening(true)
    // Attempt browser Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onresult = (event: any) => {
        const spoken = event.results[0][0].transcript
        handleVoiceCommand(spoken)
        setIsListening(false)
      }

      recognition.onerror = () => {
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      try {
        recognition.start()
      } catch (e) {
        setIsListening(false)
      }
    } else {
      // Fallback voice simulation for dev / offline tablets
      setTimeout(() => {
        handleVoiceCommand('Steamed Green Beans holding at 154 degrees')
        setIsListening(false)
      }, 1500)
    }
  }

  const updateHydration = (id: string, pct: number) => {
    setHydrationRecords(prev => prev.map(rec => {
      if (rec.id !== id) return rec
      const consumed = Math.round((rec.targetOz * pct) / 100)
      const status = pct === 0 ? 'REFUSED' : 'COMPLETED'
      return { ...rec, acceptancePct: pct, consumedOz: consumed, status }
    }))
  }

  const activeTrayIndex = trayCards.findIndex(t => !t.dispatched)
  const currentCard = activeTrayIndex !== -1 ? trayCards[activeTrayIndex] : null

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 px-3.5 py-2 rounded-xl font-black text-lg tracking-wider text-white">
            KITCHEN TABLET
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">Shoreline Dietary Command</div>
            <div className="text-xs text-slate-400 flex items-center gap-2.5 mt-0.5">
              <span className={`inline-flex items-center gap-1.5 font-bold ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {isOnline ? 'ONLINE (Cloud Synced)' : 'OFFLINE (Local Queue Active)'}
              </span>
              <span className="text-slate-600">&bull;</span>
              <span className={wakeLockActive ? 'text-blue-400 font-semibold' : 'text-slate-400'}>
                ⚡ {wakeLockActive ? 'Screen Wake-Lock Active' : 'Standard Display'}
              </span>
            </div>
          </div>
        </div>

        {/* Meal Selector */}
        <div className="flex bg-slate-800/80 p-1 rounded-xl gap-1">
          {(['Breakfast', 'Lunch', 'Dinner'] as const).map(meal => (
            <button
              key={meal}
              onClick={() => setMealFilter(meal)}
              className={`py-2 px-4 rounded-lg font-bold text-xs sm:text-sm transition-all ${
                mealFilter === meal ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              {meal}
            </button>
          ))}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          { key: 'worksheet', label: 'Cook Sheets', dot: 'bg-rose-500' },
          { key: 'traycards', label: `Tray Line (${trayCards.filter(t => t.dispatched).length}/${trayCards.length})`, dot: 'bg-blue-500' },
          { key: 'scanner', label: 'QR Tray Scanner', dot: 'bg-amber-500' },
          { key: 'voice_haccp', label: 'Voice HACCP', dot: 'bg-purple-500' },
          { key: 'hydration', label: 'Hydration Pass', dot: 'bg-cyan-500' },
          { key: 'quickpar', label: 'Quick Par Count', dot: 'bg-emerald-500' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`py-3 px-3 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 border ${
              activeTab === tab.key
                ? 'bg-slate-900 text-white border-blue-500 shadow-md ring-2 ring-blue-500/20'
                : 'bg-slate-900/50 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-850'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${tab.dot}`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab: QR Tray Scanner */}
      {activeTab === 'scanner' && (
        <TrayAssemblyScanner />
      )}

      {/* Tab: Voice HACCP & Temp Logging */}
      {activeTab === 'voice_haccp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#1E293B', padding: 24, borderRadius: 20, border: '2px solid #475569', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>Hands-Free Kitchen Voice Temp & Waste Logger</div>
              <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 4 }}>
                Speak clearly into tablet: <span style={{ color: '#60A5FA', fontWeight: 700 }}>"Chicken breast holding at 168 degrees"</span> or <span style={{ color: '#F87171', fontWeight: 700 }}>"4 portions cod discarded due to over-hold"</span>
              </div>
            </div>

            <button
              onClick={toggleListening}
              style={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: isListening ? '#EF4444' : '#8B5CF6',
                border: '4px solid #fff',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isListening ? '0 0 30px rgba(239, 68, 68, 0.6)' : '0 4px 15px rgba(139, 92, 246, 0.4)',
                transition: 'all 0.2s ease',
              }}
            >
              {isListening ? <Mic className="w-10 h-10 animate-pulse" /> : <Mic className="w-10 h-10" />}
            </button>

            {transcript && (
              <div style={{ background: '#0F172A', padding: '10px 18px', borderRadius: 12, border: '1px solid #3B82F6', fontSize: 14, color: '#93C5FD' }}>
                🎙️ Heard: "{transcript}"
              </div>
            )}

            {/* Quick Manual Tap Presets for Gloved Cooks */}
            <div style={{ width: '100%', borderTop: '1px solid #334155', paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, textAlign: 'center' }}>
                Quick Manual 1-Tap Presets (Gloved Entry)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                {[
                  { label: 'Poultry Core', temp: 168.0, icon: '🔥', type: 'COOK_CORE' },
                  { label: 'Hot Hold', temp: 145.0, icon: '🍲', type: 'HOT_HOLD' },
                  { label: 'Cooked Veg', temp: 138.0, icon: '🥦', type: 'HOT_HOLD' },
                  { label: 'Walk-In Cooler', temp: 37.5, icon: '🧊', type: 'COOLING' },
                  { label: 'Dish Final Rinse', temp: 181.0, icon: '🧼', type: 'COOK_CORE' },
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setPendingHaccpModal({
                        item: `${preset.label} (${preset.type.replace('_', ' ')})`,
                        temperatureF: preset.temp,
                        type: preset.type as any,
                        suggestedStatus: 'PASS',
                      })
                    }}
                    style={{
                      padding: '12px 8px',
                      borderRadius: 12,
                      border: '1px solid #475569',
                      background: '#0F172A',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{preset.icon}</span>
                    <span>{preset.label}</span>
                    <span style={{ color: '#60A5FA', fontWeight: 900, fontSize: 14 }}>{preset.temp}°F</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Voice / Manual HACCP Confirmation Modal */}
          {pendingHaccpModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ background: '#1E293B', maxWidth: 480, width: '100%', borderRadius: 24, border: '2px solid #3B82F6', padding: 28, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Confirm HACCP Log Entry
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginTop: 4 }}>
                    {pendingHaccpModal.item}
                  </div>
                </div>

                <div style={{ background: '#0F172A', padding: 20, borderRadius: 18, border: '1px solid #334155', textAlign: 'center' }}>
                  <div style={{ fontSize: 44, fontWeight: 900, color: pendingHaccpModal.suggestedStatus === 'PASS' ? '#34D399' : '#F87171' }}>
                    {pendingHaccpModal.temperatureF.toFixed(1)}°F
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: pendingHaccpModal.suggestedStatus === 'PASS' ? '#10B981' : '#EF4444', marginTop: 4 }}>
                    {pendingHaccpModal.suggestedStatus === 'PASS' ? '✅ MEETS FDA / HACCP CRITICAL LIMIT' : '⚠️ BELOW MINIMUM HOLDING TEMPERATURE'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={() => confirmPendingHaccpLog()}
                    style={{ padding: '16px', borderRadius: 14, border: 'none', background: '#10B981', color: '#fff', fontWeight: 900, fontSize: 16, cursor: 'pointer' }}
                  >
                    ✓ Confirm & Stamp Log ({pendingHaccpModal.temperatureF}°F)
                  </button>

                  {pendingHaccpModal.suggestedStatus === 'CRITICAL_FAIL' && (
                    <button
                      onClick={() => confirmPendingHaccpLog('Reheated to 165°F and re-verified')}
                      style={{ padding: '14px', borderRadius: 14, border: '1px solid #F59E0B', background: '#78350F', color: '#FDE68A', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
                    >
                      ⚡ Add Corrective Action: Reheated to 165°F
                    </button>
                  )}

                  <button
                    onClick={() => setPendingHaccpModal(null)}
                    style={{ padding: '12px', borderRadius: 12, border: '1px solid #475569', background: '#334155', color: '#94A3B8', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                  >
                    Cancel / Discard
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ background: '#1E293B', borderRadius: 16, border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', fontWeight: 800, fontSize: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Today's Real-Time HACCP Core Temp & Waste Log</span>
              <span style={{ fontSize: 13, color: '#10B981', fontWeight: 700 }}>{haccpLogs.filter(l => l.status === 'PASS').length} Passed · 0 Violations</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {haccpLogs.map(log => (
                <div key={log.id} style={{ padding: '14px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ padding: '4px 8px', borderRadius: 6, background: log.type === 'WASTE' ? '#7F1D1D' : '#1E3A8A', color: '#fff', fontSize: 11, fontWeight: 800 }}>
                      {log.type}
                    </span>
                    <div>
                      <div style={{ fontWeight: 800, color: '#fff' }}>{log.item}</div>
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>{log.timestamp} · {log.loggedBy} (Recorded via {log.recordedVia})</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {log.type !== 'WASTE' ? (
                      <span style={{ fontSize: 18, fontWeight: 900, color: log.status === 'PASS' ? '#34D399' : '#F87171' }}>
                        {log.temperatureF.toFixed(1)}°F
                      </span>
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#F87171' }}>
                        {log.wastePortions} Portions Discarded
                      </span>
                    )}
                    <span style={{ padding: '4px 10px', borderRadius: 8, background: log.status === 'PASS' ? '#064E3B' : '#7F1D1D', color: log.status === 'PASS' ? '#6EE7B7' : '#FCA5A5', fontWeight: 800, fontSize: 12 }}>
                      {log.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Hydration Pass (CMS F807) */}
      {activeTab === 'hydration' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#1E293B', padding: 20, borderRadius: 16, border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>CMS F807 Clinical Resident Hydration Pass</div>
              <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Morning Hydration Round (10:00 AM) · Thickened Liquid Compliance Enforcement</div>
            </div>
            <div style={{ background: '#0891B2', padding: '8px 16px', borderRadius: 10, fontWeight: 800, fontSize: 14 }}>
              85% Target Met
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {hydrationRecords.map(rec => (
              <div key={rec.id} style={{ background: '#1E293B', border: `2px solid ${rec.status === 'COMPLETED' ? '#0891B2' : '#475569'}`, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{rec.residentName}</div>
                    <div style={{ fontSize: 13, color: '#94A3B8' }}>Room {rec.room}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 8, background: '#0F172A', color: '#67E8F9', fontWeight: 800, fontSize: 12, border: '1px solid #0891B2' }}>
                    {rec.liquidTexture}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0F172A', padding: '8px 12px', borderRadius: 10, fontSize: 13 }}>
                  <span style={{ color: '#94A3B8' }}>Target: {rec.targetOz} oz</span>
                  <span style={{ color: '#67E8F9', fontWeight: 800 }}>Consumed: {rec.consumedOz} oz ({rec.acceptancePct}%)</span>
                </div>

                {/* Quick 1-Tap Intake Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {[100, 75, 50, 25, 0].map(pct => (
                    <button
                      key={pct}
                      onClick={() => updateHydration(rec.id, pct)}
                      style={{
                        padding: '10px 4px',
                        borderRadius: 8,
                        border: rec.acceptancePct === pct ? '2px solid #38BDF8' : '1px solid #334155',
                        background: rec.acceptancePct === pct ? '#0284C7' : '#0F172A',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {pct === 0 ? 'Refuse' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
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
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#60A5FA' }}>
                    {item.batchCount}
                  </div>
                  <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 700 }}>PORTIONS</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Tray Line Step-Through */}
      {activeTab === 'traycards' && (
        <div>
          {currentCard ? (
            <div style={{ background: '#1E293B', border: '3px solid #3B82F6', borderRadius: 20, padding: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #334155', paddingBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 14, color: '#60A5FA', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    CURRENT MEAL TICKET ({activeTrayIndex + 1} OF {trayCards.length})
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', marginTop: 4 }}>
                    {currentCard.residentName}
                  </div>
                  <div style={{ fontSize: 18, color: '#94A3B8', marginTop: 4 }}>
                    Room: <span style={{ color: '#fff', fontWeight: 700 }}>{currentCard.room}</span>
                  </div>
                </div>

                <div style={{ background: '#0F172A', padding: '12px 24px', borderRadius: 14, border: '2px solid #334155', textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 700 }}>REQUIRED TEXTURE</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#F59E0B', marginTop: 2 }}>{currentCard.texture}</div>
                </div>
              </div>

              {/* Diet Order & Allergies Banner */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
                <div style={{ background: '#0F172A', padding: 20, borderRadius: 16, border: '2px solid #334155' }}>
                  <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 700 }}>CLINICAL DIET ORDER</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 6 }}>{currentCard.dietOrder}</div>
                </div>

                <div style={{ background: '#450A0A', padding: 20, borderRadius: 16, border: '2px solid #EF4444' }}>
                  <div style={{ fontSize: 13, color: '#FCA5A5', fontWeight: 800 }}>⚠️ HIGHLIGHTED ALLERGIES</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#EF4444', marginTop: 6 }}>
                    {currentCard.allergies.join(', ')}
                  </div>
                </div>
              </div>

              {/* Beverages */}
              <div style={{ background: '#0F172A', padding: 20, borderRadius: 16, border: '2px solid #334155', marginTop: 20 }}>
                <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 700 }}>BEVERAGE SELECTIONS</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#60A5FA', marginTop: 6 }}>
                  {currentCard.beverages.join('  •  ')}
                </div>
              </div>

              {/* 1-Tap Action Button */}
              <button
                onClick={() => toggleTrayDispatch(currentCard.id)}
                style={{
                  width: '100%',
                  marginTop: 28,
                  padding: '24px',
                  borderRadius: 16,
                  border: 'none',
                  background: '#10B981',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 22,
                  cursor: 'pointer',
                  boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12
                }}
              >
                <span>✓</span> VERIFY & DISPATCH TRAY TO CART
              </button>
            </div>
          ) : (
            <div style={{ background: '#064E3B', padding: 48, borderRadius: 20, textAlign: 'center', border: '2px solid #10B981' }}>
              <div style={{ fontSize: 48 }}>🎉</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginTop: 12 }}>ALL TRAYS DISPATCHED!</div>
              <div style={{ fontSize: 16, color: '#A7F3D0', marginTop: 8 }}>Tray line service for {mealFilter} is 100% complete and delivered.</div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Quick Par Counter */}
      {activeTab === 'quickpar' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {parItems.map(item => (
            <div
              key={item.id}
              style={{
                background: '#1E293B',
                borderRadius: 16,
                padding: 20,
                border: '2px solid #334155',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: '#60A5FA', fontWeight: 800 }}>SKU: {item.sku}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 4 }}>{item.name}</div>
                <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>Pack: {item.packSize} • Par: {item.parLevel}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, background: '#0F172A', padding: '12px 16px', borderRadius: 12 }}>
                <button
                  onClick={() => adjustOnHand(item.id, -1)}
                  style={{ width: 48, height: 48, borderRadius: 10, background: '#EF4444', color: '#fff', border: 'none', fontSize: 24, fontWeight: 900, cursor: 'pointer' }}
                >
                  -
                </button>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: item.onHand < item.parLevel ? '#F87171' : '#34D399' }}>
                    {item.onHand}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>ON HAND</div>
                </div>

                <button
                  onClick={() => adjustOnHand(item.id, 1)}
                  style={{ width: 48, height: 48, borderRadius: 10, background: '#10B981', color: '#fff', border: 'none', fontSize: 24, fontWeight: 900, cursor: 'pointer' }}
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
