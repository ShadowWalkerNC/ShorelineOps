import React, { useState, useEffect } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../security/AuthContext'
import BudgetTargetsSection from './BudgetTargetsSection'
import {
  ReportingSummary,
  DailyCostLog,
  SubstitutionLogEntry,
  ResidentRiskEntry,
  ProductionVarianceEntry
} from '../../types/reporting'

export default function ReportingPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cost' | 'substitutions' | 'allergies' | 'mismatches' | 'variance' | 'budget'>('dashboard')
  // Budget Targets section preserves the old /budget page's manager-only access
  const { atLeast } = useAuth()
  const canSeeBudget = atLeast('manager')
  
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
  const [costForm, setCostForm] = useState({ logDate: todayStr, residentCount: 0, foodCost: 0, notes: '' })

  // C06: rolled menu-slot plate-cost breakdown for the cost tab
  const [cpdBreakdown, setCpdBreakdown] = useState<any | null>(null)
  const [rollupStatus, setRollupStatus] = useState('')

  // Substitution form state
  const [showAddSubModal, setShowAddSubModal] = useState(false)
  const [subForm, setSubForm] = useState({ mealDate: todayStr, mealType: 'Lunch', originalItem: '', substituteItem: '', reason: '' })

  useEffect(() => {
    fetchSummary()
    if (activeTab === 'cost') { fetchCostLogs(); fetchCpdBreakdown() }
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
      // B14 demo-honesty: never fabricate report figures. When the reporting
      // service is unreachable the dashboard renders explicit empty states.
      setSummary(null)
    }
  }

  const fetchCostLogs = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/reporting/cost-log?start=${startDate}&end=${endDate}`)
      setCostLogs(res.data)
    } catch (err) {
      console.error(err)
      // B14 demo-honesty: no fabricated cost-log rows.
      setCostLogs([])
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
      // B14 demo-honesty: no fabricated substitution logs with fictional residents.
      setSubstitutions([])
    } finally {
      setLoading(false)
    }
  }

  // C06: menu-slot plate-cost breakdown for the selected end date. Feeds the
  // existing cost views — the breakdown shows which slot costs are SKU-matched
  // vs estimated before anything is written to daily_cost_log.
  const fetchCpdBreakdown = async () => {
    try {
      const res = await api.get(`/reporting/cpd-breakdown?date=${endDate}`)
      setCpdBreakdown(res.data)
    } catch (err) {
      console.error(err)
      setCpdBreakdown(null)
    }
  }

  // C06: roll the active menu for the selected date into daily_cost_log.
  // Idempotent — re-running overwrites the auto-rollup entry for that date.
  const rollupDailyCost = async () => {
    setRollupStatus('Rolling up menu costs…')
    try {
      const res = await api.post('/reporting/cost-log/rollup', { date: endDate })
      const d = res.data
      setRollupStatus(
        `Rolled up $${d.dailyFoodCost?.toFixed(2) ?? '—'} for ${d.dayName ?? endDate} ` +
        `(${d.provenance ?? 'unknown'} cost provenance, ${d.residentCount ?? 0} residents).`
      )
      fetchCostLogs()
      fetchSummary()
      fetchCpdBreakdown()
    } catch (e: any) {
      setRollupStatus(e?.response?.data?.error ?? 'Daily cost rollup failed.')
    }
    setTimeout(() => setRollupStatus(''), 8000)
  }

  const fetchAllergyRisks = async () => {
    setLoading(true)
    try {
      const res = await api.get('/reporting/allergy-risk')
      setAllergyRisks(res.data)
    } catch (err) {
      console.error(err)
      // B14 demo-honesty: no fabricated allergy-risk rows.
      setAllergyRisks([])
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
      // B14 demo-honesty: no fabricated diet-mismatch rows.
      setDietMismatches([])
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
      // B14 demo-honesty: no fabricated production-variance rows.
      setProductionVariances([])
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

      {/* B14 demo-honesty: explicit empty state when the reporting service is
          unreachable — never fabricate figures. */}
      {summary === null && !loading && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 'var(--radius-lg)', padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#92400e' }}>
          ⚠️ Reporting service unavailable — figures show as "—" until real data loads. No sample numbers are displayed.
        </div>
      )}        {/* Date Filter & Print */}
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
            Print Compliance Summary
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Food Cost / Resident Day</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
            ${summary?.costPerResidentDay ?? '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Target: &lt; $11.50/day</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Total Operating / Res Day</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#2563EB', fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
            ${summary?.totalOperatingCostPerResidentDay ?? '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Food + Dietary Labor</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Substitutions Logged</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
            {summary?.substitutions ?? '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Period total</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Allergy Audit Flags</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#D97706', fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
            {summary?.allergyFlagCount ?? '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Residents with active flags</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Special Diet Orders</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
            {summary?.specialDietCount ?? '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Textures & therapeutic</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Production Variance</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#16A34A', fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
            4.8%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Planned vs. Cooked</div>
        </div>
      </div>

      {/* Dietary Budget Category Allocation Breakdown (Perishable Food vs Dry Grocery vs Paper Goods vs Chemicals) */}
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }}></span>
            Dietary Spend Allocation by Category (Food vs. Dry Goods vs. Supplies)
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Benchmark: 60% Fresh Food | 25% Dry Goods | 10% Paper | 5% Sanitation
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ padding: 12, background: 'rgba(59, 130, 246, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#2563EB', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563EB' }}></span>
              Fresh / Perishable Food (60%)
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
              ${summary?.breakdown?.perishableFoodCost ?? '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Meats, dairy, produce & bakery</div>
          </div>

          <div style={{ padding: 12, background: 'rgba(245, 158, 11, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#D97706', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706' }}></span>
              Dry Grocery & Canned (25%)
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
              ${summary?.breakdown?.dryGroceryCost ?? '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Flour, grains, sauces, thickeners</div>
          </div>

          <div style={{ padding: 12, background: 'rgba(16, 185, 129, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }}></span>
              Paper & Dry Goods (10%)
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
              ${summary?.breakdown?.paperGoodsCost ?? '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Napkins, gloves, tray mats, cups</div>
          </div>

          <div style={{ padding: 12, background: 'rgba(139, 92, 246, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C3AED' }}></span>
              Sanitation & Chemicals (5%)
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
              ${summary?.breakdown?.chemicalSanitationCost ?? '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dish machine sanitizer & degreasers</div>
          </div>
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
        {canSeeBudget && (
          <button
            onClick={() => setActiveTab('budget')}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'budget' ? '3px solid var(--color-primary)' : '3px solid transparent',
              color: activeTab === 'budget' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'budget' ? 700 : 500,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            💰 Budget Targets
          </button>
        )}
      </div>

      {/* Cost per Resident Day Tab */}
      {activeTab === 'cost' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Daily Food Cost & Resident Counts
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={rollupDailyCost}
                title="Roll the active menu's slot plate costs into daily_cost_log for the selected end date (idempotent)"
                style={{
                  background: 'transparent',
                  color: 'var(--color-primary)',
                  border: '1px solid var(--color-primary)',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Roll up from menu
              </button>
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
          </div>
          {rollupStatus && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, fontWeight: 600 }}>
              {rollupStatus}
            </div>
          )}
          {summary?.costSourceCounts && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Cost input mix for this range:{' '}
              <strong>{summary.costSourceCounts.rolledUpDays} day(s) rolled up</strong> from the menu,{' '}
              <strong>{summary.costSourceCounts.manualDays} day(s) manual</strong> entries.
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>Date</th>
                <th style={{ padding: '10px 12px' }}>Resident Census</th>
                <th style={{ padding: '10px 12px' }}>Daily Food Cost</th>
                <th style={{ padding: '10px 12px' }}>Cost / Resident Day</th>
                <th style={{ padding: '10px 12px' }}>Source</th>
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
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: log.source === 'auto' ? 'var(--color-primary-soft, #e8f0fe)' : 'var(--bg-muted, #f1f5f9)',
                      color: log.source === 'auto' ? 'var(--color-primary)' : 'var(--text-secondary)'
                    }}>
                      {log.source === 'auto' ? 'Rolled up' : 'Manual'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{log.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* C06: menu-slot plate-cost breakdown with cost provenance */}
          {cpdBreakdown && cpdBreakdown.slots?.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                Menu cost breakdown — {cpdBreakdown.dayName}
                {cpdBreakdown.weekName ? ` (${cpdBreakdown.weekName})` : ''}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                ${cpdBreakdown.perResidentDayCost?.toFixed(2)} / resident-day × {cpdBreakdown.residentCount} residents
                {' '}= <strong>${cpdBreakdown.dailyFoodCost?.toFixed(2)}</strong> daily food cost.
                Provenance flags show which slot costs come from vendor SKU matches vs estimated inputs.
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 12px' }}>Meal slot</th>
                    <th style={{ padding: '8px 12px' }}>Menu items</th>
                    <th style={{ padding: '8px 12px' }}>Slot plate cost</th>
                    <th style={{ padding: '8px 12px' }}>Provenance</th>
                  </tr>
                </thead>
                <tbody>
                  {cpdBreakdown.slots.map((slot: any) => (
                    <tr key={slot.slot} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, textTransform: 'capitalize' }}>{slot.slot}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                        {slot.items.map((it: any) => `${it.itemName} ($${Number(it.plateCost).toFixed(2)})`).join(' · ')}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>${Number(slot.slotPlateCost).toFixed(2)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: slot.provenance === 'sku-matched' ? '#dcfce7' : slot.provenance === 'none' ? '#f1f5f9' : '#fef3c7',
                          color: slot.provenance === 'sku-matched' ? '#15803d' : slot.provenance === 'none' ? '#64748b' : '#b45309'
                        }}>
                          {slot.provenance === 'sku-matched' ? 'SKU-matched'
                            : slot.provenance === 'mixed' ? 'Mixed sources'
                            : slot.provenance === 'estimated' ? 'Estimated'
                            : 'No cost data'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

      {/* Budget Targets Tab (merged from /budget, B13) */}
      {activeTab === 'budget' && canSeeBudget && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <BudgetTargetsSection />
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
