// ============================================================
// COMPLIANCE TYPES
// ============================================================
// HIPAA Administrative Safeguards §164.308
// SOC 2 CC2.1, CC4.1, CC9.1
//
// No PHI stored in compliance records — all fields are
// operational/administrative metadata only.
// ============================================================

// ── Facility ──────────────────────────────────────────────────────────────────
export interface FacilityInfo {
  name: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  npiNumber: string
  facilityType: 'snf' | 'alf' | 'memory_care' | 'adult_day' | 'other'
  bedCount: number
  timezone: string
}

// ── HIPAA Officer ─────────────────────────────────────────────────────────────
export interface HipaaOfficer {
  name: string
  title: string
  email: string
  phone: string
  /** ISO 8601 — date the officer was formally designated */
  designatedAt: string
}

// ── Business Associate Agreement ─────────────────────────────────────────────
export interface BaaAcknowledgment {
  /** Display name of the user who acknowledged */
  acknowledgedBy: string
  /** Auth user ID of the acknowledging user */
  acknowledgedById: string
  /** ISO 8601 */
  acknowledgedAt: string
  /** Version identifier, e.g. '2025-01' */
  baaVersion: string
  ipAddress: string | null
}

// ── Risk Assessment ───────────────────────────────────────────────────────────
export interface RiskAssessment {
  id: string
  /** ISO 8601 date */
  conductedAt: string
  conductedBy: string
  summary: string
  riskLevel: 'low' | 'medium' | 'high'
  /** File name or location note for the assessment document */
  documentRef: string
  /** ISO 8601 date — annual renewal deadline */
  nextDueDate: string
  remediationNotes: string
}

// ── Workforce Training Acknowledgment ────────────────────────────────────────
export interface WorkforceAcknowledgment {
  id: string
  userId: string
  userName: string
  policyType:
    | 'hipaa_training'
    | 'sanction_policy'
    | 'workstation_use'
    | 'device_policy'
    | 'incident_response'
  /** ISO 8601 */
  acknowledgedAt: string
  /** ISO 8601 — annual renewal */
  expiresAt: string
}

// ── Breach Incident ───────────────────────────────────────────────────────────
export type BreachSeverity = 'low' | 'medium' | 'high' | 'critical'
export type BreachStatus   = 'open' | 'investigating' | 'contained' | 'reported' | 'closed'

export interface BreachIncident {
  id: string
  /** ISO 8601 */
  discoveredAt: string
  discoveredBy: string
  discoveredById: string
  description: string
  affectedRecords: number
  /** Resident IDs only — no names stored here */
  affectedResidentIds: string[]
  severity: BreachSeverity
  status: BreachStatus
  /** discoveredAt + 60 days — HHS notification window */
  hhsNotificationDue: string
  hhsNotifiedAt: string | null
  remediationSteps: string
  closedAt: string | null
  notes: string
}

// ── Compliance Status (dashboard) ────────────────────────────────────────────
export type ComplianceStatusColor = 'green' | 'amber' | 'red'

export interface ComplianceStatusItem {
  category: string
  status: ComplianceStatusColor
  message: string
}

// ── Top-level Record ──────────────────────────────────────────────────────────
/** Single document stored under LS_KEYS.complianceRecord */
export interface ComplianceRecord {
  facilityInfo:             FacilityInfo | null
  hipaaOfficer:             HipaaOfficer | null
  /** US state abbreviation, e.g. 'TX' */
  jurisdiction:             string | null
  baaAcknowledgment:        BaaAcknowledgment | null
  riskAssessments:          RiskAssessment[]
  workforceAcknowledgments: WorkforceAcknowledgment[]
  breachIncidents:          BreachIncident[]
  /** ISO 8601 date of last completed annual review */
  lastComplianceReview:     string | null
  /** ISO 8601 date next review is due */
  nextReviewDue:            string | null
  /** ISO 8601 — set when admin completes initial setup wizard */
  setupCompletedAt:         string | null
}
