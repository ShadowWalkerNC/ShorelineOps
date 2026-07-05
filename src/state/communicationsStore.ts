import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export type ThreadStatus = 'Draft' | 'Pending Review' | 'Approved' | 'Distributed' | 'Archived'
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn'
export type ApprovalType = 'truck_order' | 'menu_change' | 'budget_request' | 'general'

export interface CommThread {
  id: string
  subject: string
  body: string
  status: ThreadStatus
  type?: string
  author?: string | null
  recipients?: string[] | null
  attachments?: unknown | null
  createdAt: string
  updatedAt: string
}

export interface Approval {
  id: string
  type: ApprovalType
  requestedById: string
  assignedToId: string
  status: ApprovalStatus
  subject: string
  description?: string
  payload?: unknown
  createdAt: string
  reviewedAt?: string
  reviewedById?: string
  reviewNotes?: string
}

function uid() { return Math.random().toString(36).slice(2, 10) }

function toThread(row: Record<string, unknown>): CommThread {
  return {
    id:          row.id as string,
    subject:     row.subject as string,
    body:        (row.body as string) ?? '',
    status:      (row.status as ThreadStatus) ?? 'Draft',
    type:        (row.type as string | undefined) ?? undefined,
    author:      (row.author as string | null) ?? null,
    recipients:  (row.recipients as string[] | null) ?? null,
    attachments: row.attachments ?? null,
    createdAt:   (row.created_at as string) ?? new Date().toISOString(),
    updatedAt:   (row.updated_at as string) ?? new Date().toISOString(),
  }
}

export interface CommState {
  threads:   CommThread[]
  approvals: Approval[]
  loading:   boolean
  isLoading: boolean   // alias
  error:     string | null
  // thread actions (page uses both 'add' and 'addThread' / 'addEntry')
  fetch:      () => Promise<void>
  add:        (data: Omit<CommThread, 'id' | 'createdAt' | 'updatedAt'>) => Promise<CommThread>
  addThread:  (data: Omit<CommThread, 'id' | 'createdAt' | 'updatedAt'>) => Promise<CommThread>
  addEntry:   (data: Omit<CommThread, 'id' | 'createdAt' | 'updatedAt'>) => Promise<CommThread>
  update:     (id: string, data: Partial<CommThread>) => Promise<void>
  setStatus:  (id: string, status: ThreadStatus) => Promise<void>
  distribute: (id: string) => Promise<void>
  remove:     (id: string) => Promise<void>
  // approval actions
  addApproval:      (data: Omit<Approval, 'id' | 'createdAt'>) => Approval
  reviewApproval:   (id: string, status: 'Approved' | 'Rejected', notes?: string, reviewerId?: string) => void
  withdrawApproval: (id: string) => void
}

export const useCommunicationsStore = create<CommState>((set, get) => ({
  threads: [], approvals: [], loading: false, isLoading: false, error: null,

  fetch: async () => {
    set({ loading: true, isLoading: true, error: null })
    const { data, error } = await supabase
      .from('communications').select('*').order('created_at', { ascending: false })
    if (error) { set({ error: error.message, loading: false, isLoading: false }); return }
    set({ threads: (data ?? []).map(r => toThread(r as Record<string, unknown>)), loading: false, isLoading: false })
  },

  add: async (data) => {
    const row: Record<string, unknown> = {
      subject: data.subject,
      body:    data.body ?? '',
      status:  data.status ?? 'Draft',
      ...(data.type        && { type:        data.type }),
      ...(data.author      && { author:      data.author }),
      ...(data.recipients  && { recipients:  data.recipients }),
      ...(data.attachments && { attachments: data.attachments }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('communications') as any).insert(row).select().single()
    if (error) throw new Error(error.message)
    const thread = toThread(r as Record<string, unknown>)
    set(s => ({ threads: [thread, ...s.threads] }))
    return thread
  },

  addThread: async (data) => get().add(data),
  addEntry:  async (data) => get().add(data),

  update: async (id, data) => {
    const patch: Record<string, unknown> = {}
    if (data.subject     !== undefined) patch.subject     = data.subject
    if (data.body        !== undefined) patch.body        = data.body
    if (data.status      !== undefined) patch.status      = data.status
    if (data.type        !== undefined) patch.type        = data.type
    if (data.author      !== undefined) patch.author      = data.author
    if (data.recipients  !== undefined) patch.recipients  = data.recipients
    if (data.attachments !== undefined) patch.attachments = data.attachments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('communications') as any).update(patch).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ threads: s.threads.map(t => t.id === id ? toThread(r as Record<string, unknown>) : t) }))
  },

  setStatus: async (id, status) => get().update(id, { status }),
  distribute: async (id) => get().update(id, { status: 'Distributed' }),

  remove: async (id) => {
    const { error } = await supabase.from('communications').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ threads: s.threads.filter(t => t.id !== id) }))
  },

  addApproval: (data) => {
    const approval: Approval = { ...data, id: uid(), createdAt: new Date().toISOString() }
    set(s => ({ approvals: [approval, ...s.approvals] }))
    return approval
  },
  reviewApproval: (id, status, notes, reviewerId) => set(s => ({
    approvals: s.approvals.map(a => a.id !== id ? a : {
      ...a, status, reviewNotes: notes, reviewedById: reviewerId,
      reviewedAt: new Date().toISOString(),
    })
  })),
  withdrawApproval: (id) => set(s => ({
    approvals: s.approvals.filter(a => a.id !== id)
  })),
}))
