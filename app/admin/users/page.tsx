// v2 replan, Phase D — admin-only user management, modeled on qa-studio's
// role-plus-capability-toggle "Users" screen (see Butcher-Project-Plan-v2.md
// and qa-studio/ADMIN_USERS_SETUP.md/users_screen.py for the pattern this is
// based on). Every mutation is enforced server-side by
// backend/src/middleware/rbac.ts's requireRole('admin') — this page's own
// "Admins only" gate below is a UX nicety, not the actual security boundary.
'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../../lib/api'
import { extractApiErrorMessage } from '../../../lib/apiError'
import { useAuth } from '../../../lib/useAuth'

// v3.1 follow-up 10d: `viewer` is new — a role with no default capabilities,
// which is the only way to make a read-only account now that creating an
// order is itself a capability (per-user caps can only add, never subtract).
const ROLES = ['viewer', 'cashier', 'manager', 'admin'] as const
// v3 replan (Phase K, ADR-012): `manage_cash` added — must mirror
// backend/src/lib/caps.ts's CAPS list exactly, same as before.
const CAPS = ['manage_users', 'manage_inventory', 'manage_orders', 'dismantle_carcass', 'manage_cash', 'create_orders'] as const
type RoleT = (typeof ROLES)[number]
type CapT = (typeof CAPS)[number]

interface ManagedUser {
  id: string
  email: string
  role: string
  caps: unknown
  // v3 follow-up: false for an account an admin invited that hasn't
  // finished the "set your password" step yet.
  passwordSet: boolean
  // v3.1 follow-up 10c: null = active, a timestamp = banned.
  bannedAt?: string | null
  createdAt: string
}

// Narrowed the same cast-free way as the backend's own `unknown`-typed
// cookie/error handling (see backend/src/middleware/auth.ts) — `caps` comes
// back from the API as `unknown` from this component's point of view even
// though the backend types it as Json.
function capsArray(caps: unknown): string[] {
  return Array.isArray(caps) ? caps.filter((c): c is string => typeof c === 'string') : []
}

// True when the PATCH failure was specifically the self-demotion
// confirmation gate (409, `{ error: 'confirmation_required' }') rather than
// a validation error or something unexpected — narrowed the same
// unknown-first way as lib/apiError.ts, since that helper only extracts a
// message, not this specific error code.
function isConfirmationRequired(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('response' in err)) return false
  const { response } = err
  if (typeof response !== 'object' || response === null || !('data' in response)) return false
  const { data } = response
  if (typeof data !== 'object' || data === null || !('error' in data)) return false
  return data.error === 'confirmation_required'
}

export default function AdminUsersPage() {
  const { t } = useTranslation()
  const me = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { role: RoleT, caps: string[] }>>({})
  // v3.1 follow-up 10c: per-row action state. `actionError` is shown against
  // the row that produced it rather than at the top of the page — the backend's
  // refusals here ("only active admin", "has history, ban instead") are about a
  // specific user and are useless floating somewhere else.
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<{ id: string, message: string } | null>(null)
  const [resetLink, setResetLink] = useState<{ id: string, url: string, emailSent: boolean } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null)

  const isAdmin = me != null && capsArray(me.caps).includes('manage_users')

  // v3 follow-up: admin-invite flow (Ahmed's "admin invites, user sets
  // password" choice — no open self-signup anywhere in this app).
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<RoleT>('cashier')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ email: string, setPasswordUrl: string, emailSent: boolean } | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function load() {
    api.get<ManagedUser[]>('/api/users')
      .then((r) => {
        setUsers(r.data)
        const next: Record<string, { role: RoleT, caps: string[] }> = {}
        for (const u of r.data) {
          next[u.id] = { role: (ROLES as readonly string[]).includes(u.role) ? (u.role as RoleT) : 'cashier', caps: capsArray(u.caps) }
        }
        setDrafts(next)
      })
      .catch(() => setError(t('admin_users_page.error_load')))
  }

  useEffect(() => {
    if (isAdmin) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only needs to (re-)run when admin-ness resolves, not on every `t`/load identity change.
  }, [isAdmin])

  function setDraftRole(id: string, role: RoleT) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], role } }))
  }

  function toggleDraftCap(id: string, cap: CapT) {
    setDrafts((prev) => {
      const current = prev[id]
      const has = current.caps.includes(cap)
      const caps = has ? current.caps.filter((c) => c !== cap) : [...current.caps, cap]
      return { ...prev, [id]: { ...current, caps } }
    })
  }

  async function inviteUser(e: React.FormEvent) {
    e.preventDefault()
    if (inviteEmail.trim() === '') return
    setInviting(true)
    setInviteError(null)
    setInviteResult(null)
    setCopied(false)
    try {
      const r = await api.post<{ user: ManagedUser, setPasswordUrl: string, emailSent: boolean }>('/api/users', {
        email: inviteEmail.trim(),
        role: inviteRole
      })
      setInviteResult({ email: inviteEmail.trim(), setPasswordUrl: r.data.setPasswordUrl, emailSent: r.data.emailSent })
      setInviteEmail('')
      load()
    } catch (err) {
      setInviteError(extractApiErrorMessage(err) ?? t('admin_users_page.error_invite'))
    } finally {
      setInviting(false)
    }
  }

  function copyInviteLink() {
    if (inviteResult === null) return
    void navigator.clipboard.writeText(inviteResult.setPasswordUrl).then(() => setCopied(true))
  }

  async function runAction(id: string, run: () => Promise<void>) {
    setActionId(id)
    setActionError(null)
    try {
      await run()
    } catch (err) {
      setActionError({ id, message: extractApiErrorMessage(err) ?? t('admin_users_page.error_action') })
    } finally {
      setActionId(null)
    }
  }

  async function generateResetLink(id: string) {
    await runAction(id, async () => {
      const r = await api.post<{ resetUrl: string, emailSent: boolean }>(`/api/users/${id}/reset-link`)
      setResetLink({ id, url: r.data.resetUrl, emailSent: r.data.emailSent })
    })
  }

  async function toggleBan(u: ManagedUser) {
    const banned = u.bannedAt !== null && u.bannedAt !== undefined
    await runAction(u.id, async () => {
      await api.post(`/api/users/${u.id}/${banned ? 'unban' : 'ban'}`)
      load()
    })
  }

  async function deleteUser(id: string) {
    await runAction(id, async () => {
      await api.delete(`/api/users/${id}`)
      setConfirmDelete(null)
      load()
    })
  }

  async function save(id: string, confirm: boolean) {
    setError(null)
    setSavingId(id)
    try {
      const draft = drafts[id]
      await api.patch(`/api/users/${id}`, { role: draft.role, caps: draft.caps, ...(confirm ? { confirm: true } : {}) })
      setConfirmTarget(null)
      load()
    } catch (err) {
      if (isConfirmationRequired(err)) {
        setConfirmTarget(id)
      } else {
        setError(extractApiErrorMessage(err) ?? t('admin_users_page.error_save'))
      }
    } finally {
      setSavingId(null)
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

  if (me === undefined) return null
  if (!isAdmin) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">{t('admin_users_page.title')}</h1>
        <div className="rounded-xl border border-dashed border-stone-300 bg-surface p-10 text-center text-sm text-stone-500">
          {t('admin_users_page.no_access')}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{t('admin_users_page.title')}</h1>
        <p className="mt-1 text-sm text-stone-500">{t('admin_users_page.subtitle')}</p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* v3 follow-up: the only way a new account gets created — admin
          invites by email, invitee sets their own password via the emailed
          link. No open self-signup route exists anywhere in this app. */}
      <form onSubmit={inviteUser} className="mb-6 rounded-xl border border-stone-200 bg-surface p-4 shadow-card">
        <p className="mb-3 text-sm font-medium text-stone-900">{t('admin_users_page.invite_title')}</p>
        {inviteError !== null && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{inviteError}</div>}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="email"
            className={`${inputClasses} max-w-xs`}
            placeholder={t('login_page.email_placeholder')}
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <select className={inputClasses} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as RoleT)} style={{ width: 'auto' }}>
            {ROLES.map((r) => <option key={r} value={r}>{t(`admin_users_page.role_${r}`)}</option>)}
          </select>
          <button type="submit" disabled={inviting}
            className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
            {inviting ? t('admin_users_page.inviting') : t('admin_users_page.invite_user')}
          </button>
        </div>
        {inviteResult !== null && (
          <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="text-sm text-stone-700">
              {inviteResult.emailSent
                ? t('admin_users_page.invite_sent', { email: inviteResult.email })
                : t('admin_users_page.invite_email_failed', { email: inviteResult.email })}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-surface px-2 py-1 text-xs text-stone-600">{inviteResult.setPasswordUrl}</code>
              <button type="button" onClick={copyInviteLink} className="shrink-0 rounded-md border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-surface">
                {copied ? t('admin_users_page.copied') : t('admin_users_page.copy_link')}
              </button>
            </div>
          </div>
        )}
      </form>

      <div className="space-y-3">
        {users.map((u) => {
          const draft = drafts[u.id]
          if (draft === undefined) return null
          const saving = savingId === u.id
          return (
            <div key={u.id} className="rounded-xl border border-stone-200 bg-surface p-4 shadow-card">
              {/* Destructive/recovery actions, kept visually separate from the
                  role/caps editor above so a ban is never a stray click while
                  adjusting permissions. */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-stone-900">{u.email}</p>
                    {!u.passwordSet && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {t('admin_users_page.pending_invite')}
                      </span>
                    )}
                    {u.bannedAt !== null && u.bannedAt !== undefined && (
                      <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700"
                        title={new Date(u.bannedAt).toLocaleString()}>
                        {t('admin_users_page.banned')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">{t('admin_users_page.col_created')}: {new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    {t('admin_users_page.col_role')}
                    <select
                      className={inputClasses}
                      value={draft.role}
                      onChange={(e) => setDraftRole(u.id, e.target.value as RoleT)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{t(`admin_users_page.role_${r}`)}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => save(u.id, false)}
                    disabled={saving}
                    className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? t('admin_users_page.saving') : t('admin_users_page.save')}
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-stone-100 pt-3">
                <span className="text-xs font-medium uppercase tracking-wide text-stone-400">{t('admin_users_page.col_caps')}</span>
                {CAPS.map((cap) => (
                  <label key={cap} className="flex items-center gap-1.5 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={draft.caps.includes(cap)}
                      onChange={() => toggleDraftCap(u.id, cap)}
                      className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                    />
                    {t(`admin_users_page.cap_${cap}`)}
                  </label>
                ))}
              </div>

              {/* Account actions. `me?.id === u.id` disables both destructive
                  ones on your own row — the backend refuses it anyway, but a
                  disabled button explains why better than an error after the
                  fact. */}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
                <button
                  onClick={() => void generateResetLink(u.id)}
                  disabled={actionId === u.id}
                  title={t('admin_users_page.reset_link_hint')}
                  className="rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  {t('admin_users_page.reset_link')}
                </button>
                <button
                  onClick={() => void toggleBan(u)}
                  disabled={actionId === u.id || me?.id === u.id}
                  title={me?.id === u.id ? t('admin_users_page.cannot_self') : undefined}
                  className="rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  {u.bannedAt !== null && u.bannedAt !== undefined
                    ? t('admin_users_page.unban')
                    : t('admin_users_page.ban')}
                </button>
                <button
                  onClick={() => setConfirmDelete(u.id)}
                  disabled={actionId === u.id || me?.id === u.id}
                  title={me?.id === u.id ? t('admin_users_page.cannot_self') : undefined}
                  className="ms-auto rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {t('admin_users_page.delete')}
                </button>
              </div>

              {actionError?.id === u.id && (
                <p className="mt-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{actionError.message}</p>
              )}

              {resetLink?.id === u.id && (
                <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <p className="mb-2 text-xs text-stone-600">
                    {resetLink.emailSent
                      ? t('admin_users_page.reset_link_sent')
                      : t('admin_users_page.reset_link_not_sent')}
                  </p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={resetLink.url} className="tabular flex-1 text-xs"
                      onFocus={e => e.currentTarget.select()} />
                    <button
                      onClick={() => void navigator.clipboard.writeText(resetLink.url)}
                      className="shrink-0 rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                    >
                      {t('admin_users_page.copy_link')}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-stone-400">{t('admin_users_page.reset_link_expiry')}</p>
                </div>
              )}

              {confirmDelete === u.id && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-semibold text-red-700">{t('admin_users_page.confirm_delete_title')}</p>
                  <p className="mt-1 text-xs text-red-700">{t('admin_users_page.confirm_delete_message')}</p>
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => setConfirmDelete(null)}
                      className="rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
                      {t('admin_users_page.confirm_demote_cancel')}
                    </button>
                    <button onClick={() => void deleteUser(u.id)} disabled={actionId === u.id}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                      {t('admin_users_page.delete')}
                    </button>
                  </div>
                </div>
              )}

              {confirmTarget === u.id && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">{t('admin_users_page.confirm_demote_title')}</p>
                  <p className="mt-1 text-sm text-amber-800">{t('admin_users_page.confirm_demote_message')}</p>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => setConfirmTarget(null)}
                      className="rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                    >
                      {t('admin_users_page.confirm_demote_cancel')}
                    </button>
                    <button
                      onClick={() => save(u.id, true)}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      {t('admin_users_page.confirm_demote_confirm')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
