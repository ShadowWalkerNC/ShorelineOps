// ============================================================
// COMMUNICATIONS STORE — AES-256-GCM encrypted at rest
// ============================================================
// HIPAA Security Rule §164.312(a)(2)(iv) — Encryption/Decryption
//
// Thread subjects and approval descriptions may contain resident
// names or care details (PHI). All reads/writes for
// LS_KEYS.threads and LS_KEYS.approvals go through cs
// (cryptoStore) which auto-encrypts with AES-256-GCM.
// ============================================================

import { create } from 'zustand'
import { cs } from '../lib/cryptoStore'
import { writeAudit } from '../security/auditLog'
import { LS_KEYS } from '../lib/localStorage'
import type {
  CommunicationThread, ThreadType, ThreadStatus,
  ThreadEntry,
  ApprovalRequest, ApprovalType, ApprovalStatus,
} from '../types/communications'

export type { ThreadType, ThreadStatus, ApprovalType, ApprovalStatus }
export type CommThread = CommunicationThread

function uid() { return crypto.randomUUID() }

export interface Approval extends Omit<ApprovalRequest, 'payload'> {
  payload: Record<string, unknown>
  reviewNote?: string
}

export interface CommState {
  threads:   CommunicationThread[]
  approvals: Approval[]
  loading:   boolean
  isLoading: boolean
  error:     string | null
  fetch:            () => Promise<void>
  addThread:        (data: Omit<CommunicationThread, 'id' | 'createdAt' | 'updatedAt' | 'entries' | 'distributedTo' | 'wasPrinted'>, actorId?: string, actorName?: string) => Promise<string>
  addEntry:         (threadId: string, entry: Omit<ThreadEntry, 'id' | 'createdAt'>, actorId?: string, actorName?: string) => Promise<void>
  update:           (id: string, data: Partial<CommunicationThread>, actorId?: string, actorName?: string) => Promise<void>
  setStatus:        (id: string, status: ThreadStatus, actorId?: string, actorName?: string) => Promise<void>
  distribute:       (id: string, recipientIds: string[], distributedById: string) => Promise<void>
  remove:           (id: string, actorId?: string, actorName?: string) => Promise<void>
  addApproval:      (data: Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt'>, actorId?: string, actorName?: string) => Promise<Approval>
  reviewApproval:   (id: string, status: 'Approved' | 'Rejected', notes?: string, reviewerId?: string, reviewerName?: string) => Promise<void>
  withdrawApproval: (id: string, actorId?: string, actorName?: string) => Promise<void>
}

export const useCommunicationsStore = create<CommState>((set, get) => ({
  threads:   [],
  approvals: [],
  loading:   false,
  isLoading: false,
  error:     null,

  fetch: async () => {
    set({ loading: true, isLoading: true, error: null })
    try {
      const threads = [...(await cs.get<CommunicationThread[]>(LS_KEYS.threads, []))]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const approvals = await cs.get<Approval[]>(LS_KEYS.approvals, [])
      set({ threads, approvals, loading: false, isLoading: false })
    } catch {
      set({ error: 'Failed to load communications.', loading: false, isLoading: false })
    }
  },

  addThread: async (data, actorId, actorName) => {
    const id  = uid()
    const now = new Date().toISOString()
    const thread: CommunicationThread = {
      ...data, id,
      entries: [], distributedTo: [], wasPrinted: false,
      createdAt: now, updatedAt: now,
    }
    const all = [thread, ...(await cs.get<CommunicationThread[]>(LS_KEYS.threads, []))]
    await cs.set(LS_KEYS.threads, all)
    set(s => ({ threads: [thread, ...s.threads] }))
    writeAudit({
      action: 'comms.thread.create',
      userId: actorId,
      userName: actorName,
      resourceType: 'commThread',
      resourceId: id,
      outcome: 'success',
    })
    return id
  },

  addEntry: async (threadId, entry, actorId, actorName) => {
    const newEntry: ThreadEntry = { ...entry, id: uid(), createdAt: new Date().toISOString() }
    const all = (await cs.get<CommunicationThread[]>(LS_KEYS.threads, [])).map(t =>
      t.id !== threadId ? t : {
        ...t,
        entries:   [...t.entries, newEntry],
        updatedAt: newEntry.createdAt,
      }
    )
    await cs.set(LS_KEYS.threads, all)
    set(s => ({
      threads: s.threads.map(t =>
        t.id !== threadId ? t : {
          ...t,
          entries:   [...t.entries, newEntry],
          updatedAt: newEntry.createdAt,
        }
      ),
    }))
    writeAudit({
      action: 'comms.thread.addEntry',
      userId: actorId,
      userName: actorName,
      resourceType: 'commThread',
      resourceId: threadId,
      outcome: 'success',
    })
  },

  update: async (id, data, actorId, actorName) => {
    const all = (await cs.get<CommunicationThread[]>(LS_KEYS.threads, [])).map(t =>
      t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t
    )
    await cs.set(LS_KEYS.threads, all)
    set(s => ({ threads: s.threads.map(t => t.id === id ? { ...t, ...data } : t) }))
    writeAudit({
      action: 'comms.thread.update',
      userId: actorId,
      userName: actorName,
      resourceType: 'commThread',
      resourceId: id,
      outcome: 'success',
    })
  },

  setStatus: async (id, status, actorId, actorName) =>
    get().update(id, { status }, actorId, actorName),

  distribute: async (id, recipientIds, distributedById) => {
    const now = new Date().toISOString()
    await get().update(id, {
      status: 'Distributed' as ThreadStatus,
      distributedTo: recipientIds,
      distributedAt: now,
    }, distributedById)
  },

  remove: async (id, actorId, actorName) => {
    const all = (await cs.get<CommunicationThread[]>(LS_KEYS.threads, [])).filter(t => t.id !== id)
    await cs.set(LS_KEYS.threads, all)
    set(s => ({ threads: s.threads.filter(t => t.id !== id) }))
    writeAudit({
      action: 'comms.thread.delete',
      userId: actorId,
      userName: actorName,
      resourceType: 'commThread',
      resourceId: id,
      outcome: 'success',
    })
  },

  addApproval: async (data, actorId, actorName) => {
    const now = new Date().toISOString()
    const approval: Approval = {
      id: uid(), createdAt: now, updatedAt: now,
      requestedById: data.requestedById,
      assignedToId:  data.assignedToId,
      type:          data.type,
      status:        data.status,
      subject:       data.subject,
      description:   data.description ?? '',
      payload:       (data.payload ?? {}) as Record<string, unknown>,
    }
    const all = [approval, ...(await cs.get<Approval[]>(LS_KEYS.approvals, []))]
    await cs.set(LS_KEYS.approvals, all)
    set(s => ({ approvals: [approval, ...s.approvals] }))
    writeAudit({
      action: 'comms.approval.create',
      userId: actorId,
      userName: actorName,
      resourceType: 'approval',
      resourceId: approval.id,
      outcome: 'success',
    })
    return approval
  },

  reviewApproval: async (id, status, notes, reviewerId, reviewerName) => {
    const all = (await cs.get<Approval[]>(LS_KEYS.approvals, [])).map(a =>
      a.id !== id ? a : {
        ...a, status,
        reviewNotes: notes, reviewNote: notes,
        reviewedById: reviewerId,
        reviewedAt:   new Date().toISOString(),
        updatedAt:    new Date().toISOString(),
      }
    )
    await cs.set(LS_KEYS.approvals, all)
    set(s => ({
      approvals: s.approvals.map(a => a.id !== id ? a : {
        ...a, status,
        reviewNotes: notes, reviewNote: notes,
        reviewedById: reviewerId,
        reviewedAt:   new Date().toISOString(),
        updatedAt:    new Date().toISOString(),
      }),
    }))
    writeAudit({
      action: status === 'Approved' ? 'comms.approval.approved' : 'comms.approval.rejected',
      userId: reviewerId,
      userName: reviewerName,
      resourceType: 'approval',
      resourceId: id,
      outcome: 'success',
    })
  },

  withdrawApproval: async (id, actorId, actorName) => {
    const all = (await cs.get<Approval[]>(LS_KEYS.approvals, [])).filter(a => a.id !== id)
    await cs.set(LS_KEYS.approvals, all)
    set(s => ({ approvals: s.approvals.filter(a => a.id !== id) }))
    writeAudit({
      action: 'comms.approval.withdraw',
      userId: actorId,
      userName: actorName,
      resourceType: 'approval',
      resourceId: id,
      outcome: 'success',
    })
  },
}))
