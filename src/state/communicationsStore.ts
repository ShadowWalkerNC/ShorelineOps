// ============================================================
// COMMUNICATIONS STORE
// ============================================================
// Manages CommunicationThreads and ApprovalRequests.
// Seed data covers realistic LTC dietary-department scenarios.
// ============================================================
import { create } from 'zustand'
import type {
  CommunicationThread, ThreadType, ThreadStatus,
  ApprovalRequest, ApprovalStatus,
} from '../types/communications'

function uid() { return Math.random().toString(36).slice(2, 10) }
const now = () => new Date().toISOString()

// ── Seed threads ──────────────────────────────────────────────
const TODAY = new Date