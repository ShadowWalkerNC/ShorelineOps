/**
 * ============================================================
 * COMPLIANCE STORE
 * ============================================================
 * HIPAA Administrative Safeguards §164.308
 * SOC 2 CC2.1, CC4.1, CC9.1
 *
 * Holds all compliance-related records:
 *   - Facility information
 *   - HIPAA Security Officer designation
 *   - Business Associate Agreement acknowledgment
 *   - Jurisdiction (state-level privacy law)
 *   - Risk assessment log
 *   - Workforce training acknowledgments
 *   - Breach incident log
 *   - Compliance review schedule
 *
 * No PHI stored here — persisted to plain localStorage.
 * ============================================================
 */

import { create } from 'zustand'
import { ls, LS_KEYS } from '../lib/localStorage'
import { auditLog } from '../security/auditLog'
import type {
  FacilityInfo,
  HipaaOfficer,
  BaaAcknowledgment,
  RiskAssessment,
  WorkforceAcknowledgment,
  BreachIncident,
  ComplianceStatusItem,
  ComplianceRecord,
} from '@/types'

// ── Empty sentinel ────────────────────────────────────────────────────────────
const EMPTY: ComplianceRecord = {
  facilityInfo:             null,
  hipaaOfficer:             null,
  jurisdiction:             null,
  baaAcknowledgment:        null,
  riskAssessments:          [],
  workforceAcknowledgments: [],
  breachIncidents:          [],
  lastComplianceReview:     null,
  nextReviewDue:            null,
  setupCompletedAt:         null,
}

// ── Store ─────────────────────────────────────────────────────────────────────
interface ComplianceStoreState {
  record: ComplianceRecord
  load: () => void
  setFacility: (info: FacilityInfo) => void
  setOfficer: (officer: HipaaOfficer) => void
  setJurisdiction: (state: string) => void
  setBaa: (ack: Omit<BaaAcknowledgment, 'baaVersion'>) => void
  addRiskAssessment: (assessment: Omit<RiskAssessment, 'id'>) => void
  addWorkforceAck: (ack: Omit<WorkforceAcknowledgment, 'id'>) => void
  recordBreach: (incident: Omit<BreachIncident, 'id' | 'hhsNotificationDue' | 'hhsNotifiedAt' | 'closedAt'>) => void
  updateBreach: (id: string, updates: Partial<BreachIncident>) => void
  markSetupComplete: (userId: string, userName: string) => Promise<void>
  getComplianceStatus: () => ComplianceStatusItem[]
  generateBreachNotification: (incidentId: string, facilityName: string) => string
}

function persist(record: ComplianceRecord): void {
  ls.set(LS_KEYS.complianceRecord, record)
}

export const useComplianceStore = create<ComplianceStoreState>((set, get) => ({
  record: EMPTY,

  load: () => {
    const stored = ls.get<ComplianceRecord>(LS_KEYS.complianceRecord, EMPTY)
    set({ record: stored })
  },

  setFacility: (info) => {
    const record = { ...get().record, facilityInfo: info }
    persist(record)
    set({ record })
  },

  setOfficer: (officer) => {
    const record = { ...get().record, hipaaOfficer: { ...officer, designatedAt: new Date().toISOString() } }
    persist(record)
    set({ record })
  },

  setJurisdiction: (state) => {
    const record = { ...get().record, jurisdiction: state }
    persist(record)
    set({ record })
  },

  setBaa: (ack) => {
    const record = {
      ...get().record,
      baaAcknowledgment: { ...ack, baaVersion: '2025-01', acknowledgedAt: new Date().toISOString() },
    }
    persist(record)
    set({ record })
  },

  addRiskAssessment: (assessment) => {
    const entry: RiskAssessment = { ...assessment, id: crypto.randomUUID() }
    const record = { ...get().record, riskAssessments: [...get().record.riskAssessments, entry] }
    persist(record)
    set({ record })
  },

  addWorkforceAck: (ack) => {
    const entry: WorkforceAcknowledgment = { ...ack, id: crypto.randomUUID() }
    const existing = get().record.workforceAcknowledgments.filter(
      w => !(w.userId === ack.userId && w.policyType === ack.policyType)
    )
    const record = { ...get().record, workforceAcknowledgments: [...existing, entry] }
    persist(record)
    set({ record })
  },

  recordBreach: (incident) => {
    const discoveredDate = new Date(incident.discoveredAt)
    const hhsDue = new Date(discoveredDate.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
    const entry: BreachIncident = {
      ...incident,
      id: crypto.randomUUID(),
      hhsNotificationDue: hhsDue,
      hhsNotifiedAt: null,
      closedAt: null,
    }
    const record = { ...get().record, breachIncidents: [...get().record.breachIncidents, entry] }
    persist(record)
    set({ record })
    void auditLog('BREACH_RECORDED', {
      userId: incident.discoveredById,
      userName: incident.discoveredBy,
      outcome: 'success',
      details: { severity: incident.severity, affectedRecords: incident.affectedRecords },
    })
  },

  updateBreach: (id, updates) => {
    const record = {
      ...get().record,
      breachIncidents: get().record.breachIncidents.map(b => b.id === id ? { ...b, ...updates } : b),
    }
    persist(record)
    set({ record })
  },

  markSetupComplete: async (userId, userName) => {
    const now = new Date().toISOString()
    const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    const record = {
      ...get().record,
      setupCompletedAt: now,
      lastComplianceReview: now,
      nextReviewDue: nextYear,
    }
    persist(record)
    ls.set(LS_KEYS.setupComplete, true)
    set({ record })
    await auditLog('SETUP_COMPLETED', { userId, userName, outcome: 'success' })
    await auditLog('COMPLIANCE_ACKNOWLEDGED', { userId, userName, outcome: 'success',
      details: { nextReviewDue: nextYear } })
  },

  getComplianceStatus: (): ComplianceStatusItem[] => {
    const r = get().record
    const now = Date.now()
    const items: ComplianceStatusItem[] = []

    items.push(r.facilityInfo
      ? { category: 'Facility Info', status: 'green', message: 'Facility information configured' }
      : { category: 'Facility Info', status: 'red', message: 'Facility information not configured' })

    items.push(r.hipaaOfficer
      ? { category: 'HIPAA Security Officer', status: 'green', message: `Designated: ${r.hipaaOfficer.name}` }
      : { category: 'HIPAA Security Officer', status: 'red', message: 'No HIPAA Security Officer designated' })

    items.push(r.baaAcknowledgment
      ? { category: 'BAA Acknowledgment', status: 'green', message: `Acknowledged by ${r.baaAcknowledgment.acknowledgedBy}` }
      : { category: 'BAA Acknowledgment', status: 'red', message: 'Business Associate Agreement not acknowledged' })

    const latestRisk = r.riskAssessments.sort(
      (a, b) => new Date(b.conductedAt).getTime() - new Date(a.conductedAt).getTime()
    )[0]
    if (!latestRisk) {
      items.push({ category: 'Risk Assessment', status: 'red', message: 'No risk assessment on record' })
    } else {
      const dueDate = new Date(latestRisk.nextDueDate).getTime()
      const overdue = dueDate < now
      const dueSoon = dueDate - now < 30 * 24 * 60 * 60 * 1000
      items.push({
        category: 'Risk Assessment',
        status: overdue ? 'red' : dueSoon ? 'amber' : 'green',
        message: overdue ? `Risk assessment overdue (was due ${latestRisk.nextDueDate.slice(0, 10)})` :
          dueSoon ? `Risk assessment due soon (${latestRisk.nextDueDate.slice(0, 10)})` :
          `Current — next due ${latestRisk.nextDueDate.slice(0, 10)}`,
      })
    }

    const openBreaches = r.breachIncidents.filter(b => b.status !== 'closed' && b.status !== 'reported')
    const overdueBreaches = openBreaches.filter(b => new Date(b.hhsNotificationDue).getTime() < now)
    items.push(
      overdueBreaches.length > 0
        ? { category: 'Breach Incidents', status: 'red', message: `${overdueBreaches.length} breach(es) past HHS notification deadline` }
        : openBreaches.length > 0
        ? { category: 'Breach Incidents', status: 'amber', message: `${openBreaches.length} open breach incident(s)` }
        : { category: 'Breach Incidents', status: 'green', message: 'No open breach incidents' }
    )

    if (r.nextReviewDue) {
      const reviewDue = new Date(r.nextReviewDue).getTime()
      const overdue = reviewDue < now
      const dueSoon = reviewDue - now < 30 * 24 * 60 * 60 * 1000
      items.push({
        category: 'Annual Compliance Review',
        status: overdue ? 'red' : dueSoon ? 'amber' : 'green',
        message: overdue ? 'Annual compliance review overdue' :
          dueSoon ? `Review due soon (${r.nextReviewDue.slice(0, 10)})` :
          `Next review: ${r.nextReviewDue.slice(0, 10)}`,
      })
    } else {
      items.push({ category: 'Annual Compliance Review', status: 'red', message: 'No compliance review scheduled' })
    }

    return items
  },

  generateBreachNotification: (incidentId, facilityName) => {
    const incident = get().record.breachIncidents.find(b => b.id === incidentId)
    if (!incident) return ''
    const officer = get().record.hipaaOfficer
    return [
      `HIPAA BREACH NOTIFICATION`,
      `Generated: ${new Date().toISOString().slice(0, 10)}`,
      ``,
      `COVERED ENTITY: ${facilityName}`,
      `HIPAA SECURITY OFFICER: ${officer?.name ?? 'Not designated'} | ${officer?.email ?? ''}`,
      ``,
      `INCIDENT DETAILS`,
      `Discovery Date: ${incident.discoveredAt.slice(0, 10)}`,
      `Discovered By: ${incident.discoveredBy}`,
      `Severity: ${incident.severity.toUpperCase()}`,
      `Affected Records: ${incident.affectedRecords}`,
      `Status: ${incident.status}`,
      `HHS Notification Due: ${incident.hhsNotificationDue.slice(0, 10)}`,
      `HHS Notified: ${incident.hhsNotifiedAt ? incident.hhsNotifiedAt.slice(0, 10) : 'NOT YET NOTIFIED'}`,
      ``,
      `DESCRIPTION`,
      incident.description,
      ``,
      `REMEDIATION STEPS`,
      incident.remediationSteps,
      ``,
      `NOTES`,
      incident.notes,
      ``,
      `---`,
      `To report to HHS: https://www.hhs.gov/hipaa/for-professionals/breach-notification/breach-reporting/index.html`,
      `This document was generated by Shoreline LAN. Review with legal counsel before submission.`,
    ].join('\n')
  },
}))
