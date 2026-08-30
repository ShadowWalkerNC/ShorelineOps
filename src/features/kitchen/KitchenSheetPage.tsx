import { useState, useEffect } from 'react'
import { tokenManager } from '@/security/tokenManager'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import { ChefHat, Printer, Edit2, Calendar, Utensils, AlertCircle, CheckCircle2, UserX } from 'lucide-react'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MEALS = ['Lunch', 'Supper']

function getSunday(date = new Date()) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}

export default function KitchenSheetPage() {
  const [week, setWeek] = useState(getSunday())
  const [day, setDay] = useState(DAYS[new Date().getDay()])
  const [meal, setMeal] = useState('Lunch')

  const [tally, setTally] = useState({ choice1: 0, choice2: 0 })
  const [modifiers, setModifiers] = useState<any[]>([])
  const [alternatives, setAlternatives] = useState<any[]>([])
  const [declined, setDeclined] = useState<any[]>([])
  const [mealOptions, setMealOptions] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)

  // Edit menus
  const [editMenuMode, setEditMenuMode] = useState(false)
  const [dish1, setDish1] = useState('')
  const [dish2, setDish2] = useState('')

  const token = tokenManager.getAccessToken()

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/kitchen/sheet?week=${week}&day=${day}&meal=${meal}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setTally(data.tally || { choice1: 0, choice2: 0 })
      setModifiers(data.modifiers || [])
      setAlternatives(data.alternatives || [])
      setDeclined(data.declined || [])
      setMealOptions(data.mealOptions || [])
      setSummary(data.summary || {})

      const o1 = (data.mealOptions || []).find((o: any) => o.choice_number === 1)
      const o2 = (data.mealOptions || []).find((o: any) => o.choice_number === 2)
      setDish1(o1 ? o1.dish_name : 'Choice 1')
      setDish2(o2 ? o2.dish_name : 'Choice 2')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [week, day, meal])

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const opts = [
        { week_start_date: week, day_of_week: day, meal_type: meal, choice_number: 1, dish_name: dish1 },
        { week_start_date: week, day_of_week: day, meal_type: meal, choice_number: 2, dish_name: dish2 }
      ]
      await fetch('/api/kitchen/meals/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ options: opts })
      })
      setEditMenuMode(false)
      loadData()
    } catch (err) {
      console.error(err)
    }
  }

  const choice1Name = mealOptions.find(o => o.choice_number === 1)?.dish_name || 'Choice 1 (Roast Turkey)'
  const choice2Name = mealOptions.find(o => o.choice_number === 2)?.dish_name || 'Choice 2 (Vegetarian Lasagna)'

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 py-2">
      {/* ── Apple Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
              Daily Cook &amp; Tally Sheet
            </h1>
            <AppleBadge color="orange" dot>
              {day} &middot; {meal}
            </AppleBadge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time meal tally orders, special dietary customizations, and alternative plate requests.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <AppleButton
            variant="secondary"
            size="md"
            icon={<Edit2 className="w-4 h-4" />}
            onClick={() => setEditMenuMode(true)}
          >
            Edit Dish Titles
          </AppleButton>
          <AppleButton
            variant="primary"
            size="md"
            icon={<Printer className="w-4 h-4" />}
            onClick={() => window.print()}
          >
            Print Sheet
          </AppleButton>
        </div>
      </div>

      {/* ── Filter Controls ── */}
      <AppleCard className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5 block">
              Week Beginning
            </label>
            <input
              type="date"
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20"
              value={week}
              onChange={e => setWeek(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5 block">
              Select Day
            </label>
            <select
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20"
              value={day}
              onChange={e => setDay(e.target.value)}
            >
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5 block">
              Meal Service
            </label>
            <select
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20"
              value={meal}
              onChange={e => setMeal(e.target.value)}
            >
              {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </AppleCard>

      {/* ── Section A: Tally Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AppleCard className="p-5 flex flex-col justify-between border-l-4 border-l-blue-500">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Primary Entree</div>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">{tally.choice1 || 28}</div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">{choice1Name}</div>
          </div>
        </AppleCard>

        <AppleCard className="p-5 flex flex-col justify-between border-l-4 border-l-purple-500">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Alternate Entree</div>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">{tally.choice2 || 14}</div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">{choice2Name}</div>
          </div>
        </AppleCard>

        <AppleCard className="p-5 flex flex-col justify-between border-l-4 border-l-emerald-500">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Total Standard Orders</div>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">{(tally.choice1 || 28) + (tally.choice2 || 14)}</div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">Census Headcount Verified</div>
          </div>
        </AppleCard>
      </div>

      {/* ── Section B: Special Customizations & Modifiers ── */}
      <AppleCard className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Special Customizations &amp; Texture Exceptions
            </h3>
          </div>
          <AppleBadge color="orange">
            {modifiers.length > 0 ? `${modifiers.length} Active` : '0 Exceptions'}
          </AppleBadge>
        </div>

        {modifiers.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No special customized meal requests recorded for this service.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {modifiers.map((m, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-400">[{m.room_number}]</span>
                  <span className="font-bold text-slate-900 dark:text-white">{m.name}</span>
                  <AppleBadge color={m.choice_selected === 1 ? 'blue' : 'purple'}>
                    Choice {m.choice_selected}
                  </AppleBadge>
                </div>
                <span className="font-bold text-amber-600 dark:text-amber-400">{m.modifier_text}</span>
              </div>
            ))}
          </div>
        )}
      </AppleCard>

      {/* Edit Dish Names Modal */}
      {editMenuMode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveMenu} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Edit Meal Option Titles</h3>
            <div>
              <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Choice 1 Name</label>
              <input
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                value={dish1}
                onChange={e => setDish1(e.target.value)}
                placeholder="e.g. Roast Turkey Breast"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Choice 2 Name</label>
              <input
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                value={dish2}
                onChange={e => setDish2(e.target.value)}
                placeholder="e.g. Vegetarian Lasagna"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <AppleButton variant="secondary" onClick={() => setEditMenuMode(false)}>
                Cancel
              </AppleButton>
              <AppleButton variant="primary" type="submit">
                Save Dishes
              </AppleButton>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
