import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type {
  CommunicationThread, ThreadType, ThreadStatus,
  ThreadEntry,
  ApprovalRequest, ApprovalType, ApprovalStatus,
} from '../types/communications'

export type { ThreadType, ThreadStatus, ApprovalType, ApprovalStatus }

// CommThread is the canonical CommunicationThread — no divergence
export type CommThread = CommunicationThread

function uid() { return Math.random().toString(36).slice(2, 10) }

function toThread(row: Record<string, unknown>): CommunicationThread {
  return {
    id:            row.id          as string,
    type:          (row.type       as ThreadType) ?? 'general',
    subject:       row.subject     as string,
    status:        (row.status     as ThreadStatus) ?? 'Draft',
    createdById:   (row.created_by_id as string) ?? '',
    createdAt:     (row.created_at as string) ?? new Date().toISOString(),
    updatedAt:     (row.updated_at as string) ?? new Date().toISOString(),
    entries:       (row.entries    as ThreadEntry[]) ?? [],
    distributedTo: (row.distributed_to as string[]) ?? [],
    distributedAt: row.distributed_at as string | undefined,
    wasPrinted:    Boolean(row.was_printed ?? false),
    printedAt:     row.printed_at  as string | undefined,
    printedById:   row.printed_by_id as string | undefined,
  }
}

// Approval mirrors ApprovalRequest but exposes both spellings so the
// page (which uses .reviewNote) and the canonical type (.reviewNotes) both compile.
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
  fetch:          () => Promise<void>
  // addThread — creates a thread optimistically and returns its new ID
  addThread:      (data: Omit<CommunicationThread, 'id' | 'createdAt' | 'updatedAt' | 'entries' | 'distributedTo' | 'wasPrinted'>) => string
  // addEntry — appends a ThreadEntry to an existing thread
  addEntry:       (threadId: string, entry: Omit<ThreadEntry, 'id' | 'createdAt'>) => void
  update:         (id: string, data: Partial<CommunicationThread>) => Promise<void>
  setStatus:      (id: string, status: ThreadStatus) => Promise<void>
  distribute:     (id: string, recipientIds: string[], distributedById: string) => Promise<void>
  remove:         (id: string) => Promise<void>
  addApproval:    (data: Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt'>) => Approval
  reviewApproval: (id: string, status: 'Approved' | 'Rejected', notes?: string, reviewerId?: string) => void
  withdrawApproval: (id: string) => void
}

export const useCommunicationsStore = create<CommState>((set, get) => ({
  threads: [], approvals: [], loading: false, isLoading: false, error: null,

  fetch: async () => {
    set({ loading: true, isLoading: true, error: null })
    const { data, error } = await supabase
      .from('communications').select('*').order('created_at', { ascending: false })
    if (error) { set({ error: error.message, loading: false, isLoading: false }); return }
    set({ threads: (data ?? []).map((r: any) => toThread(r as Record<string, unknown>)), loading: false, isLoading: false })
  },

  addThread: (data) => {
    const id = uid()
    const now = new Date().toISOString()
    const thread: CommunicationThread = {
      ...data,
      id,
      entries:       [],
      distributedTo: [],
      wasPrinted:    false,
      createdAt:     now,
      updatedAt:     now,
    }
    set(s => ({ threads: [thread, ...s.threads] }))
    // fire-and-forget persist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase.from('communications') as any).insert({
      id, subject: data.subject, type: data.type,
      status: data.status, created_by_id: data.createdById,
      created_at: now, updated_at: now,
      entries: [], distributed_to: [],
    })
    return id
  },

  addEntry: (threadId, entry) => {
    const newEntry: ThreadEntry = {
      ...entry,
      id: uid(),
      createdAt: new Date().toISOString(),
    }
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
    const patch: Record<string, unknown> = {}
    if (data.subject       !== undefined) patch.subject        = data.subject
    if (data.status        !== undefined) patch.status         = data.status
    if (data.type          !== undefined) patch.type           = data.type
    if (data.distributedTo !== undefined) patch.distributed_to = data.distributedTo
    if (data.wasPrinted    !== undefined) patch.was_printed    = data.wasPrinted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('communications') as any)
      .update(patch).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ threads: s.threads.map(t => t.id === id ? toThread(r as Record<string, unknown>) : t) }))
  },

  setStatus: async (id, status) => get().update(id, { status }),

  distribute: async (id, recipientIds, _distributedById) => {
    const now = new Date().toISOString()
    set(s => ({
      threads: s.threads.map(t =>
        t.id !== id ? t : {
          ...t,
          status:        'Distributed' as ThreadStatus,
          distributedTo: recipientIds,
          distributedAt: now,
          updatedAt:     now,
        }
      ),
    }))
    await get().update(id, { status: 'Distributed', distributedTo: recipientIds })
  },

  remove: async (id) => {
    const { error } = await supabase.from('communications').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ threads: s.threads.filter(t => t.id !== id) }))
  },

  addApproval: (data) => {
    const now = new Date().toISOString()
    const approval: Approval = {
      id:            uid(),
      createdAt:     now,
      updatedAt:     now,
      requestedById: data.requestedById,
      assignedToId:  data.assignedToId,
      type:          data.type,
      status:        data.status,
      subject:       data.subject,
      description:   data.description ?? '',
      payload:       (data.payload ?? {}) as Record<string, unknown>,
    }
    set(s => ({ approvals: [approval, ...s.approvals] }))
    return approval
  },

  reviewApproval: (id, status, notes, reviewerId) => set(s => ({
    approvals: s.approvals.map(a => a.id !== id ? a : {
      ...a,
      status,
      reviewNotes:  notes,
      reviewNote:   notes,
      reviewedById: reviewerId,
      reviewedAt:   new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    }),
  })),

  withdrawApproval: (id) => set(s => ({
    approvals: s.approvals.filter(a => a.id !== id),
  })),
}))
