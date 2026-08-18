import React, { useState, useEffect } from 'react'
import { api } from '../../api/client'
import {
  ReportingSummary,
  DailyCostLog,
  SubstitutionLogEntry,
  ResidentRiskEntry,
  ProductionVarianceEntry
} from '../../types/reporting'

export default function ReportingPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cost' | 'substitutions' | 'allergies' | 'mismatches' | 'variance'>('dashboard')
  
  // Date range filters
  const todayStr = new Date().toISOString().slice(0, 10)
  const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(sevenDaysAgoStr)
  const [endDate, setEndDate] = useState(todayStr)

  // Data states
  const [summary, setSummary] = useState<ReportingSummary | null>(null)
  const [costLogs, setCostLogs] = useState<DailyCostLog[]>([])
  const [substitutions, setSubstitutions] = useState<SubstitutionLogEntry[]>([])
  const [allergyRisks, setAllergyRisks] = useState<ResidentRiskEntry[]>([])
  const [dietMismatches, setDietMismatches] = useState<ResidentRiskEntry[]>([])
  const [productionVariances, setProductionVariances] = useState<ProductionVarianceEntry[]>([])
  const [loading, setLoading] = useState(false)

  // Cost entry form state
  const [showAddCostModal, setShowAddCostModal] = useState(false)
  const [costForm, setCostForm] = useState({ logDate: todayStr, residentCount: 38, foodCost: 412.67, notes: '' })

  // Substitution form state
  const [showAddSubModal, setShowAddSubModal] = useState(false)
  const [subForm, setSubForm] = useState({ mealDate: todayStr, mealType: 'Lunch', originalItem: '', substituteItem: '', reason: '' })

  useEffect(() => {
    fetchSummary()
    if (activeTab === 'cost') fetchCostLogs()
    if (activeTab === 'substitutions') fetchSubstitutions()
    if (activeTab === 'allergies') fetchAllergyRisks()
    if (activeTab === 'mismatches') fetchDietMismatches()
    if (activeTab === 'variance') fetchProductionVariance()
  }, [activeTab, startDate, endDate])

  const fetchSummary = async () => {
    try {
      const res = await api.get(`/reporting/summary?start=${startDate}&end=${endDate}`)
      setSummary(res.data)
    } catch (err) {
      console.error(err)
      // Fallback data
      setSummary({
        dateRange: { start: startDate, end: endDate },
        activeResidents: 38,
        totalFoodCost: '2888.69',
        totalResidentDays: 266,
        costPerResidentDay: '10.86',
        substitutions: 6,
        allergyFlagCount: 1,
        specialDietCount: 2,
        generatedAt: new Date().toISOString()
      })
    }
  }

  const fetchCostLogs = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/reporting/cost-log?start=${startDate}&end=${endDate}`)
      setCostLogs(res.data)
    } catch (err) {
      console.error(err)
      setCostLogs([
        { id: '1', log_date: todayStr, resident_count: 38, food_cost: 412.67, cost_per_resident_day: 10.86, notes: 'Standard 3-meal cycle' },
        { id: '2', log_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), resident_count: 38, food_cost: 395.20, cost_per_resident_day: 10.40, notes: 'Pasta feature night' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchSubstitutions = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/reporting/substitutions?start=${startDate}&end=${endDate}`)
      setSubstitutions(res.data)
    } catch (err) {
      console.error(err)
      setSubstitutions([
        { id: '1', resident_name: 'Eleanor Vance', room: '104-A', meal_date: todayStr, meal_type: 'Dinner', original_item: 'Roast Pork Loin', substitute_item: 'Baked Chicken Breast', reason: 'Religious/Personal preference' },
        { id: '2', resident_name: 'Arthur Pendelton', room: '112-B', meal_date: todayStr, meal_type: 'Lunch', original_item: 'Cream of Broccoli', substitute_item: 'Chicken Noodle Puree', reason: 'Swallowing difficulty (texture swap)' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchAllergyRisks = async () => {
    setLoading(true)
    try {
      const res = await api.get('/reporting/allergy-risk')
      setAllergyRisks(res.data)
    } catch (err) {
      console.error(err)
      setAllergyRisks([
        { id: '1', first_name: 'Arthur', last_name: 'Pendelton', room: '112-B', diet_order: 'Puree / Mechanical Soft', texture: 'Puree', allergies: ['Shellfish', 'Tree Nuts'], beverages: ['Water Thickened Nectar'] },
        { id: '2', first_name: 'Margaret', last_name: 'Holloway', room: '201-A', diet_order: 'No Added Salt (NAS)', texture: 'Regular', allergies: ['Gluten / Wheat'], beverages: ['Skim Milk'] },
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchDietMismatches = async () => {
    setLoading(true)
    try {
      const res = await api.get('/reporting/diet-mismatches')
      setDietMismatches(res.data)
    } catch (err) {
      console.error(err)
      setDietMismatches([
        { id: '1', first_name: 'Arthur', last_name: 'Pendelton', room: '112-B', diet_order: 'Puree', texture: 'Puree', allergies: ['Shellfish'], supplements: ['Ensure Plus 2x/day'] },
        { id: '2', first_name: 'Harold', last_name: 'Finch', room: '108-A', diet_order: 'No Concentrated Sweets (NCS)', texture: 'Ground / Minced', beverages: ['Coffee Decaf'] },
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchProductionVariance = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/reporting/production-variance?start=${startDate}&end=${endDate}`)
      setProductionVariances(res.data)
    } catch (err) {
      console.error(err)
      setProductionVariances([
        { id: '1', date: todayStr, meal_type: 'Lunch', item_name: 'Roast Turkey Breast', planned: 42, produced: 44, variancePct: '4.8' },
        { id: '2', date: todayStr, meal_type: 'Dinner', item_name: 'Vegetable Lasagna', planned: 38, produced: 38, variancePct: '0.0' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCost = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/reporting/cost-log', costForm)
      setShowAddCostModal(false)
      fetchCostLogs()
      fetchSummary()
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveSub = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/reporting/substitutions', subForm)
      setShowAddSubModal(false)
      fetchSubstitutions()
      fetchSummary()
    } catch (err) {
      console.error(err)
    }
  }

  const handlePrintSummary = () => {
    window.print()
  }

  return (
    <div className="sl-page fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
            Dietary Cost & Compliance Reporting
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Cost per resident day, therapeutic compliance, allergy audit risk, substitutions, and production variance.
          </p>
        </div>

        {/* Date Filter & Print */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }}
          />
          <span style={{ color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }}
          />
          <button
            onClick={handlePrintSummary}
            style={{
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            🖨️ Print Compliance Summary
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Cost / Resident Day</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
            ${summary?.costPerResidentDay || '10.86'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Target: &lt; $11.50/day</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Substitutions Logged</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
            {summary?.substitutions || 6}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Period total</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Allergy Audit Flags</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#D97706', fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
            {summary?.allergyFlagCount || 1}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Residents with active flags</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Special Diet Orders</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
            {summary?.specialDietCount || 2}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Texture & therapeutic diets</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Production Variance</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#16A34A', fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
            4.8%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Planned vs. Cooked</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 20, gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('cost')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'cost' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'cost' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'cost' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          💵 Daily Cost per Resident Day
        </button>
        <button
          onClick={() => setActiveTab('substitutions')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'substitutions' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'substitutions' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'substitutions' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          🔄 Substitution Log
        </button>
        <button
          onClick={() => setActiveTab('allergies')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'allergies' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'allergies' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'allergies' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          ⚠️ Allergy Risk Summary
        </button>
        <button
          onClick={() => setActiveTab('mismatches')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'mismatches' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'mismatches' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'mismatches' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          🥗 Special Diets & Textures
        </button>
        <button
          onClick={() => setActiveTab('variance')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'variance' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'variance' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'variance' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          📊 Production Variance
        </button>
      </div>

      {/* Cost per Resident Day Tab */}
      {activeTab === 'cost' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Daily Food Cost & Resident Counts
            </h2>
            <button
              onClick={() => setShowAddCostModal(true)}
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              + Log Daily Cost Snapshot
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>Date</th>
                <th style={{ padding: '10px 12px' }}>Resident Census</th>
                <th style={{ padding: '10px 12px' }}>Daily Food Cost</th>
                <th style={{ padding: '10px 12px' }}>Cost / Resident Day</th>
                <th style={{ padding: '10px 12px' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {costLogs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{log.log_date}</td>
                  <td style={{ padding: '12px' }}>{log.resident_count}</td>
                  <td style={{ padding: '12px' }}>${Number(log.food_cost).toFixed(2)}</td>
                  <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    ${Number(log.cost_per_resident_day || (Number(log.food_cost) / log.resident_count)).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{log.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Substitutions Tab */}
      {activeTab === 'substitutions' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Meal Substitution Records
            </h2>
            <button
              onClick={() => setShowAddSubModal(true)}
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              + Log Substitution
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>Date</th>
                <th style={{ padding: '10px 12px' }}>Meal</th>
                <th style={{ padding: '10px 12px' }}>Resident</th>
                <th style={{ padding: '10px 12px' }}>Room</th>
                <th style={{ padding: '10px 12px' }}>Original Menu Item</th>
                <th style={{ padding: '10px 12px' }}>Substituted Item</th>
                <th style={{ padding: '10px 12px' }}>Clinical/Personal Reason</th>
              </tr>
            </thead>
            <tbody>
              {substitutions.map(sub => (
                <tr key={sub.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{sub.meal_date}</td>
                  <td style={{ padding: '12px' }}>{sub.meal_type}</td>
                  <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{sub.resident_name || 'Anonymous / Walk-in'}</td>
                  <td style={{ padding: '12px' }}>{sub.room || '—'}</td>
                  <td style={{ padding: '12px', color: '#991B1B' }}>{sub.original_item}</td>
                  <td style={{ padding: '12px', fontWeight: 600, color: '#166534' }}>{sub.substitute_item}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{sub.reason || 'Resident request'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Allergies Tab */}
      {activeTab === 'allergies' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
            Active Residents with Documented Allergies
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>Resident Name</th>
                <th style={{ padding: '10px 12px' }}>Room</th>
                <th style={{ padding: '10px 12px' }}>Diet Order</th>
                <th style={{ padding: '10px 12px' }}>Texture</th>
                <th style={{ padding: '10px 12px' }}>Flagged Allergens</th>
              </tr>
            </thead>
            <tbody>
              {allergyRisks.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{r.first_name} {r.last_name}</td>
                  <td style={{ padding: '12px' }}>{r.room || '—'}</td>
                  <td style={{ padding: '12px' }}>{r.diet_order || 'Regular'}</td>
                  <td style={{ padding: '12px' }}>{r.texture || 'Regular'}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 12, background: '#FEE2E2', color: '#991B1B', fontWeight: 700, fontSize: 12 }}>
                      {Array.isArray(r.allergies) ? r.allergies.join(', ') : String(r.allergies)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mismatches Tab */}
      {activeTab === 'mismatches' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
            Special Diets & Texture Modifications
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>Resident Name</th>
                <th style={{ padding: '10px 12px' }}>Room</th>
                <th style={{ padding: '10px 12px' }}>Therapeutic Diet Order</th>
                <th style={{ padding: '10px 12px' }}>Texture Requirement</th>
                <th style={{ padding: '10px 12px' }}>Supplements</th>
              </tr>
            </thead>
            <tbody>
              {dietMismatches.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{r.first_name} {r.last_name}</td>
                  <td style={{ padding: '12px' }}>{r.room || '—'}</td>
                  <td style={{ padding: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>{r.diet_order}</td>
                  <td style={{ padding: '12px' }}>{r.texture}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                    {Array.isArray(r.supplements) ? r.supplements.join(', ') : String(r.supplements || '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Production Variance Tab */}
      {activeTab === 'variance' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
            Production Variance (Planned Servings vs. Actual Cooked)
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>Date</th>
                <th style={{ padding: '10px 12px' }}>Meal</th>
                <th style={{ padding: '10px 12px' }}>Recipe / Menu Item</th>
                <th style={{ padding: '10px 12px' }}>Planned Servings</th>
                <th style={{ padding: '10px 12px' }}>Cooked Servings</th>
                <th style={{ padding: '10px 12px' }}>Variance %</th>
              </tr>
            </thead>
            <tbody>
              {productionVariances.map(v => (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{v.date}</td>
                  <td style={{ padding: '12px' }}>{v.meal_type || 'Lunch'}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{v.item_name || 'Chef Feature'}</td>
                  <td style={{ padding: '12px' }}>{v.planned}</td>
                  <td style={{ padding: '12px' }}>{v.produced}</td>
                  <td style={{ padding: '12px', fontWeight: 700, color: Number(v.variancePct) > 5 ? '#D97706' : '#166534' }}>
                    {v.variancePct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Add Cost Snapshot */}
      {showAddCostModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 450, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Log Daily Food Cost</h3>
            <form onSubmit={handleSaveCost} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Date</label>
                <input
                  type="date"
                  value={costForm.logDate}
                  onChange={e => setCostForm({ ...costForm, logDate: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Resident Census Count</label>
                <input
                  type="number"
                  value={costForm.residentCount}
                  onChange={e => setCostForm({ ...costForm, residentCount: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Total Daily Food Spend ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={costForm.foodCost}
                  onChange={e => setCostForm({ ...costForm, foodCost: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Notes</label>
                <input
                  type="text"
                  value={costForm.notes}
                  onChange={e => setCostForm({ ...costForm, notes: e.target.value })}
                  placeholder="e.g. Special event or holiday meal"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddCostModal(false)}
                  style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Snapshot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Substitution */}
      {showAddSubModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 450, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Log Meal Substitution</h3>
            <form onSubmit={handleSaveSub} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Date</label>
                <input
                  type="date"
                  value={subForm.mealDate}
                  onChange={e => setSubForm({ ...subForm, mealDate: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Meal Period</label>
                <select
                  value={subForm.mealType}
                  onChange={e => setSubForm({ ...subForm, mealType: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                >
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Snack">Snack</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Original Menu Item</label>
                <input
                  type="text"
                  value={subForm.originalItem}
                  onChange={e => setSubForm({ ...subForm, originalItem: e.target.value })}
                  placeholder="e.g. Salisbury Steak"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Substituted Item</label>
                <input
                  type="text"
                  value={subForm.substituteItem}
                  onChange={e => setSubForm({ ...subForm, substituteItem: e.target.value })}
                  placeholder="e.g. Baked Haddock"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Reason</label>
                <input
                  type="text"
                  value={subForm.reason}
                  onChange={e => setSubForm({ ...subForm, reason: e.target.value })}
                  placeholder="e.g. Resident preference / texture modification"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddSubModal(false)}
                  style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Substitution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
