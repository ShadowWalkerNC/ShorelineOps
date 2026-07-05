/**
 * API client — local branch stub.
 *
 * On the local branch all data lives in localStorage / cryptoStore.
 * There is no backend server and no JWT auth layer.
 *
 * This file exists solely to satisfy the import in residents.ts
 * (which is itself unused on this branch — residentsStore reads
 * directly from cs). It will be replaced with a real Supabase client
 * when the local branch is promoted to production.
 *
 * Nothing in this file makes network calls.
 */

export const api = {
  get:    async (_url: string, _opts?: unknown) => ({ data: null }),
  post:   async (_url: string, _body?: unknown) => ({ data: null }),
  put:    async (_url: string, _body?: unknown) => ({ data: null }),
  delete: async (_url: string)                  => ({ data: null }),
} as const
