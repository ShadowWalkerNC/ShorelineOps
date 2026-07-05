import { create } from 'zustand'
import { ls, LS_KEYS } from '@/lib/localStorage'
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
  addThread:        (data: Omit<CommunicationThread, 'id' | 'createdAt' | 'updatedAt' | 'entries' | 'distributedTo' | 'wasPrinted'>) => string
  addEntry:         (threadId: string, entry: Omit<ThreadEntry, 'id' | 'createdAt'>) => void
  update:           (id: string, data: Partial<CommunicationThread>) => Promise<void>
  setStatus:        (id: string, status: ThreadStatus) => Promise<void>
  distribute:       (id: string, recipientIds: string[], distributedById: string) => Promise<void>
  remove:           (id: string) => Promise<void>
  addApproval:      (data: Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt'>) => Approval
  reviewApproval:   (id: string, status: 'Approved' | 'Rejected', notes?: string, reviewerId?: string) => void
  withdrawApproval: (id: string) => void
}

export const useCommunicationsStore = create<CommState>((set, get) => ({
  threads:   ls.get<CommunicationThread[]>(LS_KEYS.threads, []),
  approvals: ls.get<Approval[]>(LS_KEYS.approvals, []),
  loading:   false,
  isLoading: false,
  error:     null,

  fetch: async () => {
    set({ loading: true, isLoading: true, error: null })
    const threads = [...ls.get<CommunicationThread[]>(LS_KEYS.threads, [])]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    set({ threads, loading: false, isLoading: false })
  },

  addThread: (data) => {
    const id  = uid()
    const now = new Date().toISOString()
    const thread: CommunicationThread = {
      ...data, id,
      entries: [], distributedTo: [], wasPrinted: false,
      createdAt: now, updatedAt: now,
    }
    const all = [thread, ...ls.get<CommunicationThread[]>(LS_KEYS.threads, [])]
    ls.set(LS_KEYS.threads, all)
    set(s => ({ threads: [thread, ...s.threads] }))
    return id
  },

  addEntry: (threadId, entry) => {
    const newEntry: ThreadEntry = { ...entry, id: uid(), createdAt: new Date().toISOString() }
    const all = ls.get<CommunicationThread[]>(LS_KEYS.threads, []).map(t =>
      t.id !== threadId ? t : {
        ...t,
        entries:   [...t.entries, newEntry],
        updatedAt: newEntry.createdAt,
      }
    )
    ls.set(LS_KEYS.threads, all)
    set(s => ({
      threads: s.threads.map(t =>
        t.id !== threadId ? t : {
          ...t,
          entries:   [...t.entries, newEntry],
          updatedAt: newEntry.createdAt,
        }
      ),
    }))
  },

  update: async (id, data) => {
    const all = ls.get<CommunicationThread[]>(LS_KEYS.threads, []).map(t =>
      t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t
    )
    ls.set(LS_KEYS.threads, all)
    set(s => ({ threads: s.threads.map(t => t.id === id ? { ...t, ...data } : t) }))
  },

  setStatus: async (id, status) => get().update(id, { status }),

  distribute: async (id, recipientIds, _distributedById) => {
    const now = new Date().toISOString()
    await get().update(id, {
      status: 'Distributed' as ThreadStatus,
      distributedTo: recipientIds,
      distributedAt: now,
    })
  },

  remove: async (id) => {
    const all = ls.get<CommunicationThread[]>(LS_KEYS.threads, []).filter(t => t.id !== id)
    ls.set(LS_KEYS.threads, all)
    set(s => ({ threads: s.threads.filter(t => t.id !== id) }))
  },

  addApproval: (data) => {
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
    const all = [approval, ...ls.get<Approval[]>(LS_KEYS.approvals, [])]
    ls.set(LS_KEYS.approvals, all)
    set(s => ({ approvals: [approval, ...s.approvals] }))
    return approval
  },

  reviewApproval: (id, status, notes, reviewerId) => {
    const all = ls.get<Approval[]>(LS_KEYS.approvals, []).map(a =>
      a.id !== id ? a : {
        ...a, status,
        reviewNotes: notes, reviewNote: notes,
        reviewedById: reviewerId,
        reviewedAt:   new Date().toISOString(),
        updatedAt:    new Date().toISOString(),
      }
    )
    ls.set(LS_KEYS.approvals, all)
    set(s => ({
      approvals: s.approvals.map(a => a.id !== id ? a : {
        ...a, status,
        reviewNotes: notes, reviewNote: notes,
        reviewedById: reviewerId,
        reviewedAt:   new Date().toISOString(),
        updatedAt:    new Date().toISOString(),
      }),
    }))
  },

  withdrawApproval: (id) => {
    const all = ls.get<Approval[]>(LS_KEYS.approvals, []).filter(a => a.id !== id)
    ls.set(LS_KEYS.approvals, all)
    set(s => ({ approvals: s.approvals.filter(a => a.id !== id) }))
  },
}))
