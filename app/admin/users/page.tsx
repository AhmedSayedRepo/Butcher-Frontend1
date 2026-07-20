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

const ROLES = ['cashier', 'manager', 'admin'] as const
const CAPS = ['manage_users', 'manage_inventory', 'manage_orders', 'dismantle_carcass'] as const
type RoleT = (typeof ROLES)[number]
type CapT = (typeof CAPS)[number]

interface ManagedUser {
  id: string
  email: string
  role: string
  caps: unknown
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
  const [savingId, setSavingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null)

  const isAdmin = me != null && capsArray(me.caps).includes('manage_users')

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
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">
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

      <div className="space-y-3">
        {users.map((u) => {
          const draft = drafts[u.id]
          if (draft === undefined) return null
          const saving = savingId === u.id
          return (
            <div key={u.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-stone-900">{u.email}</p>
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

              {confirmTarget === u.id && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">{t('admin_users_page.confirm_demote_title')}</p>
                  <p className="mt-1 text-sm text-amber-800">{t('admin_users_page.confirm_demote_message')}</p>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => setConfirmTarget(null)}
                      className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
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
