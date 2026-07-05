/**
 * ============================================================
 * USER MANAGER — Admin panel
 * ============================================================
 * HIPAA Security Rule §164.312(a)(2)(i) — Unique user ID
 * HIPAA Security Rule §164.312(a)(2)(ii) — Emergency access
 * SOC 2 CC6.1 — Logical and physical access controls
 *
 * All reads/writes go directly to LS_KEYS.users (AppUser[]),
 * keeping this panel in sync with AuthContext without a
 * separate store layer.
 *
 * Security self-guards:
 *   • An admin cannot lock, deactivate, or change the role of
 *     their own account (prevents accidental self-lockout).
 *   • Every write emits an audit log entry.
 * ============================================================
 */
import React, { useCallback, useEffect, useState } from 'react'
import { ls, LS_KEYS } from '../../../lib/localStorage'
import { hashPassword } from '../../../security/passwordPolicy'
import { writeAudit } from '../../../security/auditLog'
import { useAuth } from '../../../security/AuthContext'
import type { AppUser } from '../../../security/AuthContext'
import type { UserRole } from '../../../types/roles'

// ── Constants ─────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  admin:      'Admin',
  manager:    'Manager',
  dietary:    'Dietary',
  activities: 'Activities',
  server:     'Server',
  staff:      'Staff',
  readonly:   'Read-only',
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin:      'bg-red-100 text-red-700',
  manager:    'bg-orange-100 text-orange-700',
  dietary:    'bg-green-100 text-green-700',
  activities: 'bg-purple-100 text-purple-700',
  server:     'bg-yellow-100 text-yellow-700',
  staff:      'bg-blue-100 text-blue-700',
  readonly:   'bg-gray-100 text-gray-600',
}

const TEMP_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'

function generateTempPassword(): string {
  // Guarantee policy: uppercase, lowercase, digit, special, 16 chars
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower   = 'abcdefghjkmnpqrstuvwxyz'
  const digits  = '23456789'
  const special = '!@#$%'
  const arr = crypto.getRandomValues(new Uint8Array(16))
  const pool = Array.from(arr).map(b => TEMP_CHARS[b % TEMP_CHARS.length])
  // Inject one of each required class into fixed positions
  pool[0]  = upper[arr[0]  % upper.length]
  pool[1]  = lower[arr[1]  % lower.length]
  pool[2]  = digits[arr[2] % digits.length]
  pool[3]  = special[arr[3] % special.length]
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.join('')
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function passwordAgeDays(passwordSetAt: string | undefined): number | null {
  if (!passwordSetAt) return null
  return Math.floor((Date.now() - new Date(passwordSetAt).getTime()) / 86_400_000)
}

// ── Component ─────────────────────────────────────────────────────────────

interface TempPwBanner { userId: string; name: string; pw: string }

export default function UserManager() {
  const { user: actor } = useAuth()

  const [users, setUsers]       = useState<AppUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [saving, setSaving]     = useState<string | null>(null) // userId being acted on
  const [tempBanner, setTempBanner] = useState<TempPwBanner | null>(null)
  const [copied, setCopied]     = useState(false)

  // Create form
  const [form, setForm] = useState({ name: '', email: '', role: 'staff' as UserRole })

  const load = useCallback(() => {
    setLoading(true)
    const all = ls.get<AppUser[]>(LS_KEYS.users, [])
    setUsers([...all].sort((a, b) => a.name.localeCompare(b.name)))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function persist(updated: AppUser[]) {
    ls.set(LS_KEYS.users, updated)
    setUsers([...updated].sort((a, b) => a.name.localeCompare(b.name)))
  }

  // ── Create User ─────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving('new')
    try {
      const tempPw = generateTempPassword()
      const hash = await hashPassword(tempPw)
      const newUser: AppUser = {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        mfaVerified: false,
        passwordHash: hash,
        passwordHistory: [],
        passwordSetAt: new Date().toISOString(),
        failedAttempts: 0,
        lockedAt: null,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        forcePasswordReset: true,
      }
      const all = ls.get<AppUser[]>(LS_KEYS.users, [])
      persist([...all, newUser])
      writeAudit({
        action: 'user.create',
        userId: actor?.id,
        userName: actor?.name,
        resourceType: 'user',
        resourceId: newUser.id,
        outcome: 'success',
        details: { targetEmail: newUser.email, role: newUser.role },
      })
      setTempBanner({ userId: newUser.id, name: newUser.name, pw: tempPw })
      setForm({ name: '', email: '', role: 'staff' })
      setShowAdd(false)
    } finally {
      setSaving(null)
    }
  }

  // ── Change Role ─────────────────────────────────────────────────────────

  function handleRoleChange(userId: string, newRole: UserRole) {
    if (userId === actor?.id) return
    const all = ls.get<AppUser[]>(LS_KEYS.users, [])
    const prev = all.find(u => u.id === userId)
    persist(all.map(u => u.id === userId ? { ...u, role: newRole } : u))
    writeAudit({
      action: 'user.role_change',
      userId: actor?.id,
      userName: actor?.name,
      resourceType: 'user',
      resourceId: userId,
      outcome: 'success',
      details: { from: prev?.role, to: newRole },
    })
  }

  // ── Lock / Unlock ────────────────────────────────────────────────────────

  async function handleLock(userId: string) {
    if (userId === actor?.id) return
    setSaving(userId)
    try {
      const all = ls.get<AppUser[]>(LS_KEYS.users, [])
      persist(all.map(u => u.id === userId ? { ...u, lockedAt: new Date().toISOString() } : u))
      writeAudit({
        action: 'user.lock',
        userId: actor?.id,
        userName: actor?.name,
        resourceType: 'user',
        resourceId: userId,
        outcome: 'success',
      })
    } finally {
      setSaving(null)
    }
  }

  async function handleUnlock(userId: string) {
    setSaving(userId)
    try {
      const all = ls.get<AppUser[]>(LS_KEYS.users, [])
      persist(all.map(u => u.id === userId ? { ...u, lockedAt: null, failedAttempts: 0 } : u))
      writeAudit({
        action: 'user.unlock',
        userId: actor?.id,
        userName: actor?.name,
        resourceType: 'user',
        resourceId: userId,
        outcome: 'success',
      })
    } finally {
      setSaving(null)
    }
  }

  // ── Force Reset ──────────────────────────────────────────────────────────

  function handleForceReset(userId: string) {
    const all = ls.get<AppUser[]>(LS_KEYS.users, [])
    persist(all.map(u => u.id === userId ? { ...u, forcePasswordReset: true } : u))
    writeAudit({
      action: 'user.force_reset',
      userId: actor?.id,
      userName: actor?.name,
      resourceType: 'user',
      resourceId: userId,
      outcome: 'success',
    })
  }

  // ── Reset to Temp Password ───────────────────────────────────────────────

  async function handleTempPasswordReset(userId: string, name: string) {
    setSaving(userId)
    try {
      const tempPw = generateTempPassword()
      const hash = await hashPassword(tempPw)
      const all = ls.get<AppUser[]>(LS_KEYS.users, [])
      persist(all.map(u => u.id === userId
        ? {
            ...u,
            passwordHash: hash,
            passwordHistory: [u.passwordHash, ...(u.passwordHistory ?? [])].slice(0, 10),
            passwordSetAt: new Date().toISOString(),
            forcePasswordReset: true,
            failedAttempts: 0,
            lockedAt: null,
          }
        : u
      ))
      writeAudit({
        action: 'user.password_reset',
        userId: actor?.id,
        userName: actor?.name,
        resourceType: 'user',
        resourceId: userId,
        outcome: 'success',
      })
      setTempBanner({ userId, name, pw: tempPw })
    } finally {
      setSaving(null)
    }
  }

  // ── Copy helper ──────────────────────────────────────────────────────────

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select all in a hidden input
    }
  }

  // ── Status helpers ───────────────────────────────────────────────────────

  function statusBadge(u: AppUser) {
    if (u.lockedAt) return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">🔒 Locked</span>
    if (u.forcePasswordReset) return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⚠️ Reset Req.</span>
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>
  }

  const isSelf = (userId: string) => userId === actor?.id

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Temp password banner */}
      {tempBanner && (
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">
                Temporary password for <span className="font-bold">{tempBanner.name}</span>
              </p>
              <p className="text-xs text-blue-700 mb-2">
                Share this securely. The user will be required to change it on first login.
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-white border border-blue-200 rounded-lg px-3 py-1.5 text-sm font-mono tracking-wider text-blue-900 select-all">
                  {tempBanner.pw}
                </code>
                <button
                  onClick={() => copyToClipboard(tempBanner.pw)}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <button
              onClick={() => setTempBanner(null)}
              className="text-blue-400 hover:text-blue-700 text-lg leading-none flex-shrink-0"
              aria-label="Dismiss"
            >×</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Staff Accounts</h2>
        <button
          onClick={() => { setShowAdd(s => !s); setTempBanner(null) }}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          {showAdd ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {/* Create form */}
      {showAdd && (
        <form onSubmit={handleCreate} className="mb-6 p-4 border rounded-xl bg-gray-50 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-gray-500 mb-1">Full Name</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
              placeholder="Jane Smith"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
              placeholder="jane@facility.org"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving === 'new'}
            className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 transition"
          >
            {saving === 'new' ? 'Creating…' : 'Create — Auto-gen Password'}
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-gray-400 py-4">Loading…</p>}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 text-left">Name</th>
                <th className="px-4 py-2.5 text-left">Email</th>
                <th className="px-4 py-2.5 text-left">Role</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Last Login</th>
                <th className="px-4 py-2.5 text-left">Pw Age</th>
                <th className="px-4 py-2.5 text-left">Fails</th>
                <th className="px-4 py-2.5 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(u => {
                const self    = isSelf(u.id)
                const locked  = !!u.lockedAt
                const busy    = saving === u.id
                const pwAge   = passwordAgeDays(u.passwordSetAt)
                const ageWarn = pwAge !== null && pwAge >= 83

                return (
                  <tr key={u.id} className={locked ? 'bg-red-50/40' : u.forcePasswordReset ? 'bg-amber-50/40' : ''}>

                    {/* Name */}
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {u.name}
                      {self && <span className="ml-1.5 text-xs text-gray-400">(you)</span>}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={self}
                        onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border-0 ${
                          self ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                        } ${ROLE_COLORS[u.role]}`}
                      >
                        {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">{statusBadge(u)}</td>

                    {/* Last Login */}
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(u.lastLoginAt)}</td>

                    {/* Password Age */}
                    <td className={`px-4 py-3 text-xs font-medium ${
                      ageWarn ? 'text-amber-600' : 'text-gray-400'
                    }`}>
                      {pwAge !== null ? `${pwAge}d` : '—'}
                      {ageWarn && ' ⚠️'}
                    </td>

                    {/* Failed attempts */}
                    <td className={`px-4 py-3 text-xs font-medium ${
                      (u.failedAttempts ?? 0) > 0 ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {u.failedAttempts ?? 0}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">

                        {/* Lock / Unlock */}
                        {locked ? (
                          <button
                            onClick={() => handleUnlock(u.id)}
                            disabled={busy}
                            className="text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40 transition"
                          >
                            {busy ? '…' : '🔓 Unlock'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleLock(u.id)}
                            disabled={busy || self}
                            title={self ? 'You cannot lock your own account' : undefined}
                            className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                          >
                            {busy ? '…' : '🔒 Lock'}
                          </button>
                        )}

                        {/* Force password reset */}
                        <button
                          onClick={() => handleForceReset(u.id)}
                          disabled={u.forcePasswordReset}
                          title={u.forcePasswordReset ? 'Already flagged for reset' : undefined}
                          className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          ⚠️ Force Reset
                        </button>

                        {/* Reset to temp password */}
                        <button
                          onClick={() => handleTempPasswordReset(u.id, u.name)}
                          disabled={busy}
                          className="text-xs px-2 py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-40 transition"
                        >
                          {busy ? '…' : '🔑 New Temp Pw'}
                        </button>

                      </div>
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No user accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        All account actions are recorded in the audit log.
      </p>
    </div>
  )
}
