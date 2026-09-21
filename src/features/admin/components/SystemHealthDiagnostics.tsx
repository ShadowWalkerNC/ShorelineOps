import React, { useEffect, useState } from 'react'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import { tokenManager } from '@/security/tokenManager'
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Wrench,
  Database,
  Users,
  Thermometer,
  Layers,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  Clock,
} from 'lucide-react'

export interface DiagnosticCheckResult {
  dimension: string
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL'
  details: string
  remedied: boolean
  remedyAction?: string
}

export interface SelfHealingAuditReport {
  timestamp: string
  overallStatus: 'OPERATIONAL' | 'DEGRADED' | 'ATTENTION_REQUIRED'
  healthScorePct: number
  checks: DiagnosticCheckResult[]
  activeResidentCount: number
  autoRemediationsApplied: number
}

export default function SystemHealthDiagnostics() {
  const [report, setReport] = useState<SelfHealingAuditReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<string | null>(null)

  const fetchDiagnostics = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = tokenManager.getAccessToken()
      const res = await fetch('/api/admin/diagnostics', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch diagnostics: ${res.statusText}`)
      }
      const data: SelfHealingAuditReport = await res.json()
      setReport(data)
      setLastChecked(new Date().toLocaleTimeString())
    } catch (err: any) {
      setReport(null)
      setError(err?.message || 'Unable to load live diagnostics.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelfRepair = async () => {
    setRepairing(true)
    setError(null)
    try {
      const token = tokenManager.getAccessToken()
      const res = await fetch('/api/admin/repair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!res.ok) {
        throw new Error(`Safe repair failed: ${res.statusText}`)
      }
      const data: SelfHealingAuditReport = await res.json()
      setReport(data)
      setLastChecked(new Date().toLocaleTimeString())
    } catch (err: any) {
      setError(err?.message || 'Unable to run the server repair workflow.')
    } finally {
      setRepairing(false)
    }
  }

  useEffect(() => {
    fetchDiagnostics()
  }, [])

  const getDimensionIcon = (dimension: string) => {
    if (dimension.includes('Database')) return <Database className="w-5 h-5 text-blue-500" />
    if (dimension.includes('Census')) return <Users className="w-5 h-5 text-emerald-500" />
    if (dimension.includes('HACCP')) return <Thermometer className="w-5 h-5 text-amber-500" />
    if (dimension.includes('Cache')) return <Layers className="w-5 h-5 text-purple-500" />
    return <TrendingDown className="w-5 h-5 text-indigo-500" />
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header with Title & Contextual Purpose */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-sans tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-primary" />
            System Health &amp; Automated Self-Repair
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time diagnostics inspect your clinical database, kitchen HACCP temperature logs, memory cache, and food vendor catalogs. Any detected discrepancies can be repaired with 1 click.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <AppleButton
            variant="secondary"
            onClick={fetchDiagnostics}
            disabled={loading || repairing}
            className="text-xs font-semibold px-3 py-2 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Run Diagnostics
          </AppleButton>

          <AppleButton
            variant="primary"
            onClick={handleSelfRepair}
            disabled={loading || repairing}
            className="text-xs font-semibold px-4 py-2 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Wrench className={`w-3.5 h-3.5 ${repairing ? 'animate-spin' : ''}`} />
            {repairing ? 'Repairing…' : 'Safe 1-Click Repair'}
          </AppleButton>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* System Health Score Banner */}
      {report && (
        <AppleCard className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shrink-0 ${
                  report.healthScorePct >= 90
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : report.healthScorePct >= 70
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                }`}
              >
                {report.healthScorePct}%
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {report.overallStatus === 'OPERATIONAL'
                      ? 'All Systems Fully Operational'
                      : report.overallStatus === 'DEGRADED'
                      ? 'Minor Discrepancies Detected'
                      : 'Attention Required'}
                  </h3>
                  <AppleBadge
                    color={
                      report.overallStatus === 'OPERATIONAL'
                        ? 'green'
                        : report.overallStatus === 'DEGRADED'
                        ? 'orange'
                        : 'red'
                    }
                  >
                    {report.overallStatus}
                  </AppleBadge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Monitoring {report.activeResidentCount} active resident clinical profiles across all dining halls.
                  {lastChecked && ` Last verified at ${lastChecked}.`}
                </p>
              </div>
            </div>

            {report.autoRemediationsApplied > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>{report.autoRemediationsApplied} Auto-Remediation(s) Applied</span>
              </div>
            )}
          </div>

          {/* Subsystem Health Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            {report.checks.map((check, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xs">
                      {getDimensionIcon(check.dimension)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {check.dimension}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {check.status === 'HEALTHY' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                          </span>
                        ) : check.status === 'WARNING' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5" /> Warning
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                            <XCircle className="w-3.5 h-3.5" /> Critical
                          </span>
                        )}
                        {check.remedied && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                            ✓ Self-Repaired
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {check.details}
                </p>

                {check.remedyAction && (
                  <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-md border border-emerald-200 dark:border-emerald-800/40">
                    <span className="font-bold">Remedy:</span> {check.remedyAction}
                  </div>
                )}
              </div>
            ))}
          </div>
        </AppleCard>
      )}

      {/* Plain-Language Operational Guidance */}
      <AppleCard className="p-5 space-y-3 bg-blue-50/30 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Automated Operations Guarantee
          </h4>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Shoreline Care OS runs continuous automated background integrity audits. When network interruptions or clinical changes occur, the self-healing daemon automatically re-links orphaned records, refreshes invalid cache entries, and ensures full CMS-2567 compliance. You never have to manually run database migrations or SQL maintenance scripts.
        </p>
      </AppleCard>
    </div>
  )
}
