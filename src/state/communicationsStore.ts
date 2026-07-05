import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export type ThreadStatus = 'Draft' | 'Pending Review' | 'Approved' | 'Distributed' | 'Archived'

export interface CommThread {
  id: string; subject: string; body: string; status: ThreadStatus
  author?: string | null; recipients?: string[] | null
  attachments?: unknown | null; createdAt: string; updatedAt: string
}

function toThread(row: Record<string, unknown>): CommThread {
  return {
    id:          row.id as string,
    subject:     row.subject as string,
    body:        (row.body as string) ?? '',
    status:      (row.status as ThreadStatus) ?? 'Draft',
    author:      (row.author as string | null) ?? null,
    recipients:  (row.recipients as string[] | null) ?? null,
    attachments: row.attachments ?? null,
    createdAt:   row.created_at as string,
    updatedAt:   row.updated_at as string,
  }
}

type CommState = {
  threads: CommThread[]
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  add: (data: Omit<CommThread, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  update: (id: string, data: Partial<CommThread>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useCommunicationsStore = create<CommState>((set) => ({
  threads: [], loading: false, error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('communications').select('*').order('created_at', { ascending: false })
    if (error) { set({ error: error.message, loading: false }); return }
    set({ threads: (data ?? []).map(r => toThread(r as Record<string, unknown>)), loading: false })
  },

  add: async (data) => {
    const row = {
      subject:     data.subject,
      body:        data.body ?? '',
      status:      data.status ?? 'Draft',
      ...(data.author      && { author:      data.author }),
      ...(data.recipients  && { recipients:  data.recipients }),
      ...(data.attachments && { attachments: data.attachments }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('communications') as any).insert(row).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ threads: [toThread(r as Record<string, unknown>), ...s.threads] }))
  },

  update: async (id, data) => {
    const patch: Record<string, unknown> = {}
    if (data.subject     !== undefined) patch.subject     = data.subject
    if (data.body        !== undefined) patch.body        = data.body
    if (data.status      !== undefined) patch.status      = data.status
    if (data.author      !== undefined) patch.author      = data.author
    if (data.recipients  !== undefined) patch.recipients  = data.recipients
    if (data.attachments !== undefined) patch.attachments = data.attachments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('communications') as any).update(patch).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ threads: s.threads.map(t => t.id === id ? toThread(r as Record<string, unknown>) : t) }))
  },

  remove: async (id) => {
    const { error } = await supabase.from('communications').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ threads: s.threads.filter(t => t.id !== id) }))
  },
}))
