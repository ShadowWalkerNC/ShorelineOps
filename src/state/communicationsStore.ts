import { create } from 'zustand'
import { api } from '@/api/client'
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

function parseJsonField<T>(v: unknown, def: T): T {
  if (v == null) return def
  if (typeof v === 'object') return v as T
  try { return JSON.parse(v as string) as T } catch { return def }
}

function toThread(row: Record<string, unknown>): CommunicationThread {
  return {
    id:            row.id as string,
    type:          (row.type as ThreadType) ?? 'general',
    subject:       (row.subject as string) ?? '',
    status:        (row.status as ThreadStatus) ?? 'Draft',
    createdById:   ((row.created_by_id ?? row.createdById) as string) ?? '',
    createdAt:     ((row.created_at ?? row.createdAt) as string) ?? new Date().toISOString(),
    updatedAt:     ((row.updated_at ?? row.updatedAt) as string) ?? new Date().toISOString(),
    entries:       parseJsonField<ThreadEntry[]>(row.entries, []),
    distributedTo: parseJsonField<string[]>(row.distributed_to ?? row.distributedTo, []),
    distributedAt: (row.distributed_at ?? row.distributedAt) as string | undefined,
    wasPrinted:    Boolean(row.was_printed ?? row.wasPrinted ?? false),
    printedAt:     (row.printed_at ?? row.printedAt) as string | undefined,
    printedById:   (row.printed_by_id ?? row.printedById) as string | undefined,
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

const isDemo = import.meta.env.VITE_DEMO_MODE === 'true'

export const useCommunicationsStore = create<CommState>((set, get) => ({
  threads: [], approvals: [], loading: false, isLoading: false, error: null,

  fetch: async () => {
    set({ loading: true, isLoading: true, error: null })
    if (!isDemo) {
      try {
        const res = await api.get('/admin/communications')
        if (Array.isArray(res.data)) {
          set({
            threads: res.data.map((r: any) => toThread(r as Record<string, unknown>)),
            loading: false,
            isLoading: false,
          })
          return
        }
      } catch (err: any) {
        console.warn('[communicationsStore] Live API fetch failed, falling back to local adapter:', err?.message)
      }
    }
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

    // Live API persist with fallback
    if (!isDemo) {
      api.post('/admin/communications', thread).catch((err: any) => {
        console.warn('[communicationsStore] Live API addThread failed, falling back to local adapter:', err?.message)
        void (supabase.from('communications') as any).insert({
          id, subject: data.subject, type: data.type,
          status: data.status, created_by_id: data.createdById,
          created_at: now, updated_at: now,
          entries: [], distributed_to: [],
        })
      })
    } else {
      void (supabase.from('communications') as any).insert({
        id, subject: data.subject, type: data.type,
        status: data.status, created_by_id: data.createdById,
        created_at: now, updated_at: now,
        entries: [], distributed_to: [],
      })
    }
    return id
  },

  addEntry: (threadId, entry) => {
    const newEntry: ThreadEntry = {
      ...entry,
      id: uid(),
      createdAt: new Date().toISOString(),
    }
    let updatedEntries: ThreadEntry[] = []
    set(s => ({
      threads: s.threads.map(t => {
        if (t.id !== threadId) return t
        updatedEntries = [...t.entries, newEntry]
        return {
          ...t,
          entries:   updatedEntries,
          updatedAt: newEntry.createdAt,
        }
      }),
    }))

    if (!isDemo && updatedEntries.length > 0) {
      api.put(`/admin/communications/${threadId}`, { entries: updatedEntries }).catch((err: any) => {
        console.warn('[communicationsStore] Live API addEntry failed:', err?.message)
      })
    }
  },

  update: async (id, data) => {
    if (!isDemo) {
      try {
        const res = await api.put(`/admin/communications/${id}`, data)
        if (res.data?.id) {
          set(s => ({
            threads: s.threads.map(t => t.id === id ? toThread(res.data as Record<string, unknown>) : t),
          }))
          return
        }
      } catch (err: any) {
        console.warn('[communicationsStore] Live API update failed, falling back to local adapter:', err?.message)
      }
    }
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
    await get().update(id, { status: 'Distributed', distributedTo: recipientIds, distributedAt: now } as any)
  },

  remove: async (id) => {
    if (!isDemo) {
      try {
        await api.delete(`/admin/communications/${id}`)
        set(s => ({ threads: s.threads.filter(t => t.id !== id) }))
        return
      } catch (err: any) {
        console.warn('[communicationsStore] Live API remove failed, falling back to local adapter:', err?.message)
      }
    }
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
