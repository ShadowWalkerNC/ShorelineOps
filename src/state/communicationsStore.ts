// ============================================================
// COMMUNICATIONS STORE — Zustand
// ============================================================
// Manages:
//   threads      — CommunicationThread list
//   approvals    — ApprovalRequest list
//
// All mutations are local-first (no API yet).
// fetch() seeds from SEED data if store is empty.
// ============================================================
import { create } from 'zustand'
import type {
  CommunicationThread, ThreadType, ThreadStatus, ThreadEntry,
  ApprovalRequest, ApprovalStatus,
} from '../types/communications'

const TODAY = new Date().toISOString()
const D = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

function uid() { return Math.random().toString(36).slice(2, 10) }

// ── Seed threads ─────────────────────────────────────────────
const SEED_THREADS: CommunicationThread[] = [
  {
    id: 'th1',
    type: 'resident_council',
    subject: 'June Resident Council Meeting Notes',
    status: 'Approved',
    createdById: 'staff-1',
    createdAt: D(5),
    updatedAt: D(3),
    distributedTo: ['staff-1', 'staff-2', 'staff-3'],
    distributedAt: D(3),
    wasPrinted: true,
    printedAt: D(3),
    printedById: 'staff-2',
    entries: [
      {
        id: 'e1', authorId: 'staff-1', authorRole: 'activities',
        body: 'Residents requested more outdoor activities during morning hours. Vote: 12-2 in favor of Tuesday garden walks.\n\nFood comments: Several residents praised the new salmon entrée. Two residents (Rm 104, Rm 211) requested additional seasoning options at the table.',
        createdAt: D(5), isInternal: false,
      },
      {
        id: 'e2', authorId: 'staff-2', authorRole: 'manager',
        body: 'Approved for distribution. Will follow up with dietary team re: seasoning options. Garden walk schedule to be added to July activities calendar.',
        createdAt: D(3), isInternal: false,
      },
      {
        id: 'e3', authorId: 'staff-2', authorRole: 'manager',
        body: 'INTERNAL: Rm 104 resident (Mrs. Henderson) has been escalating complaints. Flag for next care conference.',
        createdAt: D(3), isInternal: true,
      },
    ],
  },
  {
    id: 'th2',
    type: 'staff_meeting',
    subject: 'Dietary Department Meeting — July 1',
    status: 'Distributed',
    createdById: 'staff-2',
    createdAt: D(3),
    updatedAt: D(2),
    distributedTo: ['staff-1', 'staff-2', 'staff-3', 'staff-4'],
    distributedAt: D(2),
    wasPrinted: false,
    entries: [
      {
        id: 'e4', authorId: 'staff-2', authorRole: 'manager',
        body: 'Agenda:\n1. Review July menu changes\n2. Texture-modified diet update (2 new honey-thick residents)\n3. Truck order schedule for holiday week\n4. Waste reduction target: goal < $40/day\n5. Open floor',
        createdAt: D(3), isInternal: false,
      },
      {
        id: 'e5', authorId: 'staff-3', authorRole: 'dietary',
        body: 'Texture modified update confirmed. SLP visit scheduled for Rm 118 and Rm 302 on Thursday. Forms updated in resident profiles.',
        createdAt: D(2), isInternal: false,
      },
    ],
  },
  {
    id: 'th3',
    type: 'memo',
    subject: 'Holiday Week Coverage — July 4th',
    status: 'Pending Review',
    createdById: 'staff-2',
    createdAt: D(1),
    updatedAt: D(1),
    distributedTo: [],
    wasPrinted: false,
    entries: [
      {
        id: 'e6', authorId: 'staff-2', authorRole: 'manager',
        body: 'Coverage plan for July 4th weekend:\n• Morning shift: Cook A + Server 1\n• Evening shift: Cook B + Server 2\n• No dietary aide coverage Saturday — all staff to assist as needed\n\nAll call-out requests after June 30 are denied unless medical.',
        createdAt: D(1), isInternal: false,
      },
    ],
  },
  {
    id: 'th4',
    type: 'policy_change',
    subject: 'Updated Allergen Labeling Policy',
    status: 'Draft',
    createdById: 'staff-2',
    createdAt: D(0),
    updatedAt: D(0),
    distributedTo: [],
    wasPrinted: false,
    entries: [
      {
        id: 'e7', authorId: 'staff-2', authorRole: 'manager',
        body: 'Effective August 1: all tray tickets must include Top-8 allergen callouts for each item. Template update in progress. Training session TBD.',
        createdAt: D(0), isInternal: false,
      },
    ],
  },
]

// ── Seed approvals ────────────────────────────────────────────
const SEED_APPROVALS: ApprovalRequest[] = [
  {
    id: 'ap1',
    type: 'truck_order',
    requestedById: 'staff-3',
    assignedToId: 'staff-2',
    status: 'Pending',
    subject: 'Emergency Truck Order — Gluten-Free Bread + Ensure Plus',
    description: 'Stock critically low. Gluten-free bread at 1 loaf (min 3). Ensure Plus at 6 cans (min 12). Requesting same-day Sysco delivery.',
    payload: {
      vendor: 'Sysco',
      items: [
        { name: 'Gluten-Free Bread', qty: 6, unit: 'loaves', estimatedCost: 39.00 },
        { name: 'Ensure Plus (Chocolate)', qty: 24, unit: 'cans', estimatedCost: 74.40 },
      ],
      estimatedTotal: 113.40,
      urgency: 'same-day',
    },
    createdAt: D(0),
    updatedAt: D(0),
  },
  {
    id: 'ap2',
    type: 'menu_change',
    requestedById: 'staff-3',
    assignedToId: 'staff-2',
    status: 'Pending',
    subject: 'Swap Thursday Dinner — Pork Loin → Chicken Breast',
    description: 'Pork loin stock below par. Requesting swap for this Thursday only. Chicken breast fully stocked.',
    payload: {
      week: '2026-W28',
      day: 'Thursday',
      meal: 'Dinner',
      currentItem: 'Pork Loin Chops',
      proposedItem: 'Roasted Chicken Breast',
    },
    createdAt: D(1),
    updatedAt: D(1),
  },
  {
    id: 'ap3',
    type: 'inventory_adjustment',
    requestedById: 'staff-4',
    assignedToId: 'staff-2',
    status: 'Approved',
    subject: 'Write-off: Expired Whole Milk (0.5 gal)',
    description: 'Found during morning count. Expired 2026-07-01. Writing off inventory.',
    payload: { item: 'Whole Milk', qty: 0.5, unit: 'gallons', reason: 'Expired', estimatedLoss: 2.05 },
    reviewedAt: D(0),
    reviewNote: 'Approved. Update waste log as well.',
    createdAt: D(1),
    updatedAt: D(0),
  },
  {
    id: 'ap4',
    type: 'budget_override',
    requestedById: 'staff-2',
    assignedToId: 'staff-1',
    status: 'Rejected',
    subject: 'Budget Override — Extra Protein Order Q3',
    description: 'Requesting $240 over protein budget line for Q3 due to increased census.',
    payload: { line: 'Proteins', overage: 240, reason: 'Census increase +3 residents' },
    reviewedAt: D(2),
    reviewNote: 'Denied. Resubmit with census documentation and revised Q3 forecast.',
    createdAt: D(4),
    updatedAt: D(2),
  },
]

// ── Store ─────────────────────────────────────────────────────
interface CommsState {
  threads:   CommunicationThread[]
  approvals: ApprovalRequest[]
  isLoading: boolean

  fetch: () => void

  // Thread mutations
  addThread:    (t: Omit<CommunicationThread, 'id' | 'createdAt' | 'updatedAt' | 'entries' | 'distributedTo' | 'wasPrinted'>) => string
  addEntry:     (threadId: string, entry: Omit<ThreadEntry, 'id' | 'createdAt'>) => void
  setStatus:    (threadId: string, status: ThreadStatus) => void
  distribute:   (threadId: string, toIds: string[], printedById?: string) => void

  // Approval mutations
  addApproval:  (a: Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt'>) => string
  reviewApproval: (id: string, status: 'Approved' | 'Rejected', note?: string) => void
  withdrawApproval: (id: string) => void
}

export const useCommunicationsStore = create<CommsState>((set, get) => ({
  threads:   [],
  approvals: [],
  isLoading: false,

  fetch() {
    if (get().threads.length > 0) return
    set({ isLoading: true })
    setTimeout(() => {
      set({
        threads:   JSON.parse(JSON.stringify(SEED_THREADS)),
        approvals: JSON.parse(JSON.stringify(SEED_APPROVALS)),
        isLoading: false,
      })
    }, 180)
  },

  addThread(t) {
    const id = uid()
    const now = new Date().toISOString()
    set(s => ({
      threads: [
        { ...t, id, createdAt: now, updatedAt: now, entries: [], distributedTo: [], wasPrinted: false },
        ...s.threads,
      ],
    }))
    return id
  },

  addEntry(threadId, entry) {
    const now = new Date().toISOString()
    set(s => ({
      threads: s.threads.map(t =>
        t.id !== threadId ? t : {
          ...t,
          updatedAt: now,
          entries: [...t.entries, { ...entry, id: uid(), createdAt: now }],
        }
      ),
    }))
  },

  setStatus(threadId, status) {
    set(s => ({
      threads: s.threads.map(t =>
        t.id !== threadId ? t : { ...t, status, updatedAt: new Date().toISOString() }
      ),
    }))
  },

  distribute(threadId, toIds, printedById) {
    const now = new Date().toISOString()
    set(s => ({
      threads: s.threads.map(t =>
        t.id !== threadId ? t : {
          ...t,
          status: 'Distributed' as ThreadStatus,
          distributedTo: toIds,
          distributedAt: now,
          updatedAt: now,
          wasPrinted: !!printedById,
          printedAt: printedById ? now : undefined,
          printedById,
        }
      ),
    }))
  },

  addApproval(a) {
    const id = uid()
    const now = new Date().toISOString()
    set(s => ({
      approvals: [{ ...a, id, createdAt: now, updatedAt: now }, ...s.approvals],
    }))
    return id
  },

  reviewApproval(id, status, note) {
    const now = new Date().toISOString()
    set(s => ({
      approvals: s.approvals.map(a =>
        a.id !== id ? a : { ...a, status, reviewedAt: now, reviewNote: note, updatedAt: now }
      ),
    }))
  },

  withdrawApproval(id) {
    const now = new Date().toISOString()
    set(s => ({
      approvals: s.approvals.map(a =>
        a.id !== id ? a : { ...a, status: 'Withdrawn' as ApprovalStatus, updatedAt: now }
      ),
    }))
  },
}))
