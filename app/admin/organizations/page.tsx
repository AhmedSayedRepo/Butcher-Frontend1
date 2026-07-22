// Multi-tenancy phase 5 — the super admin's Organizations screen
// (Butcher-Multi-Tenancy-Plan.md §6).
//
// Deliberately the *last* thing built in this plan and the smallest part of
// it. The work that matters is the tenant scoping underneath; this is a form
// over it. It's also the only screen in the app that isn't scoped to one shop,
// which is why it sits behind its own flag rather than under the existing
// admin area.
//
// What it deliberately does not do: show any shop's actual data. Counts only —
// enough to answer "is this one being used?" without opening a customer list.
'use client'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../../lib/api'
import { translateApiError } from '../../../lib/apiError'
import { useAuth, useAuthLoading } from '../../../lib/useAuth'
import Spinner from '../../../components/Spinner'
import PageHeader from '../../../components/PageHeader'

const PLANS = ['trial', 'basic', 'pro'] as const
const BILLING_STATUSES = ['active', 'past_due', 'suspended', 'cancelled'] as const

interface Organization {
  id: string
  slug: string
  name: string
  email: string
  phone: string | null
  address: string | null
  plan: string
  billingStatus: string
  trialEndsAt: string | null
  billingEmail: string | null
  archivedAt: string | null
  createdAt: string
  _count?: { users: number, orders: number, products: number }
}

interface CreateResponse extends Organization {
  inviteUrl: string | null
  inviteEmailSent: boolean
}

const EMPTY_DRAFT = {
  slug: '', name: '', email: '', phone: '', address: '',
  plan: 'trial' as string, adminEmail: ''
}

const STATUS_TONE: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  past_due: 'bg-amber-50 text-amber-700',
  suspended: 'bg-red-50 text-red-700',
  cancelled: 'bg-stone-100 text-stone-600'
}

export default function OrganizationsPage() {
  const { t } = useTranslation()
  const user = useAuth()
  const authLoading = useAuthLoading()
  const isSuperAdmin = user?.isSuperAdmin === true

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [invite, setInvite] = useState<{ url: string, emailSent: boolean } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  function load() {
    api.get<Organization[]>('/api/organizations')
      .then(r => setOrganizations(r.data))
      .catch((err: unknown) => setError(translateApiError(err, t, t('organizations_page.error_load'))))
      .finally(() => setLoadingList(false))
  }

  useEffect(() => {
    if (!isSuperAdmin) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is redefined each render; only the gate should retrigger it.
  }, [isSuperAdmin])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (needle === '') return organizations
    return organizations.filter(o =>
      `${o.name} ${o.slug} ${o.email}`.toLowerCase().includes(needle))
  }, [organizations, search])

  async function createOrganization(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setInvite(null)
    setCreating(true)
    try {
      const r = await api.post<CreateResponse>('/api/organizations', {
        slug: draft.slug.trim().toLowerCase(),
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim() === '' ? null : draft.phone.trim(),
        address: draft.address.trim() === '' ? null : draft.address.trim(),
        plan: draft.plan,
        ...(draft.adminEmail.trim() === '' ? {} : { adminEmail: draft.adminEmail.trim() })
      })
      if (r.data.inviteUrl !== null) {
        setInvite({ url: r.data.inviteUrl, emailSent: r.data.inviteEmailSent })
      }
      setDraft(EMPTY_DRAFT)
      load()
    } catch (err) {
      setCreateError(translateApiError(err, t, t('organizations_page.error_create')))
    } finally {
      setCreating(false)
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id)
    setError(null)
    try {
      await api.patch(`/api/organizations/${id}`, body)
      load()
    } catch {
      // Reported by the global error toast — see the response
      // interceptor in lib/api.ts. A second inline copy would be noise.
    } finally {
      setBusyId(null)
    }
  }

  async function setArchived(id: string, archived: boolean) {
    setBusyId(id)
    setError(null)
    try {
      await api.post(`/api/organizations/${id}/${archived ? 'archive' : 'unarchive'}`)
      load()
    } catch {
      // Reported by the global error toast — see the response
      // interceptor in lib/api.ts. A second inline copy would be noise.
    } finally {
      setBusyId(null)
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
  const labelClasses = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-stone-500'

  if (authLoading) return <Spinner />

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader title={t('organizations_page.title')} subtitle={t('organizations_page.subtitle')} />
        <div className="rounded-xl border border-dashed border-stone-300 bg-surface p-10 text-center text-sm text-stone-500">
          {t('organizations_page.no_access')}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={t('organizations_page.title')} subtitle={t('organizations_page.subtitle')} />

      {error !== null && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={createOrganization} className="mb-6 rounded-xl border border-stone-200 bg-surface p-4 shadow-card">
        <p className="mb-3 text-sm font-medium text-stone-900">{t('organizations_page.create_title')}</p>
        {createError !== null && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{createError}</div>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label>
            <span className={labelClasses}>{t('organizations_page.slug')}</span>
            <input className={inputClasses} required value={draft.slug} placeholder="alaqsa"
              onChange={e => setDraft({ ...draft, slug: e.target.value })} />
            <span className="mt-1 block text-[11px] text-stone-400">{t('organizations_page.slug_hint')}</span>
          </label>
          <label>
            <span className={labelClasses}>{t('organizations_page.name')}</span>
            <input className={inputClasses} required value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label>
            <span className={labelClasses}>{t('organizations_page.email')}</span>
            <input type="email" className={inputClasses} required value={draft.email}
              onChange={e => setDraft({ ...draft, email: e.target.value })} />
          </label>
          <label>
            <span className={labelClasses}>{t('organizations_page.phone')}</span>
            <input className={inputClasses} value={draft.phone}
              onChange={e => setDraft({ ...draft, phone: e.target.value })} />
          </label>
          <label>
            <span className={labelClasses}>{t('organizations_page.address')}</span>
            <input className={inputClasses} value={draft.address}
              onChange={e => setDraft({ ...draft, address: e.target.value })} />
          </label>
          <label>
            <span className={labelClasses}>{t('organizations_page.plan')}</span>
            <select className={inputClasses} value={draft.plan}
              onChange={e => setDraft({ ...draft, plan: e.target.value })}>
              {PLANS.map(p => <option key={p} value={p}>{t(`organizations_page.plan_${p}`)}</option>)}
            </select>
          </label>
          <label className="sm:col-span-2 lg:col-span-3">
            <span className={labelClasses}>{t('organizations_page.admin_email')}</span>
            <input type="email" className={inputClasses} value={draft.adminEmail}
              onChange={e => setDraft({ ...draft, adminEmail: e.target.value })} />
            <span className="mt-1 block text-[11px] text-stone-400">{t('organizations_page.admin_email_hint')}</span>
          </label>
        </div>

        <div className="mt-3">
          <button type="submit" disabled={creating} className="btn btn-primary">
            {creating ? t('organizations_page.creating') : t('organizations_page.create')}
          </button>
        </div>

        {/* Same reasoning as the admin reset-link flow: the link is shown as
            well as emailed, because only an authenticated super admin sees this
            response and email is not reliable enough to be the only way in. */}
        {invite !== null && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="mb-2 text-sm font-medium text-green-800">
              {invite.emailSent ? t('organizations_page.invite_sent') : t('organizations_page.invite_not_sent')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 text-xs text-stone-700">{invite.url}</code>
              <button type="button" className="btn btn-secondary btn-sm"
                onClick={() => { void navigator.clipboard.writeText(invite.url) }}>
                {t('organizations_page.copy')}
              </button>
            </div>
          </div>
        )}
      </form>

      <div className="mb-3">
        <input type="search" className={`${inputClasses} max-w-sm`} value={search}
          placeholder={t('organizations_page.search_placeholder')}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {loadingList ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-surface p-10 text-center text-sm text-stone-500">
          {t('organizations_page.none')}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(org => (
            <div key={org.id}
              className={`card-hover rounded-xl border bg-surface p-4 shadow-card ${org.archivedAt === null ? 'border-stone-200' : 'border-stone-300 opacity-70'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-stone-900">
                    {org.name}
                    <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-normal text-stone-600">{org.slug}</code>
                    {org.archivedAt !== null && (
                      <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
                        {t('organizations_page.archived')}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">{org.email}</p>
                  {org._count !== undefined && (
                    <p className="tabular mt-1 text-xs text-stone-400">
                      {t('organizations_page.counts', {
                        users: org._count.users, orders: org._count.orders, products: org._count.products
                      })}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase text-stone-500">{t('organizations_page.plan')}</span>
                    <select className="rounded-lg border border-stone-300 px-2 py-1 text-xs" value={org.plan}
                      disabled={busyId === org.id}
                      onChange={e => { void patch(org.id, { plan: e.target.value }) }}>
                      {PLANS.map(p => <option key={p} value={p}>{t(`organizations_page.plan_${p}`)}</option>)}
                    </select>
                  </label>

                  <label className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase text-stone-500">{t('organizations_page.billing')}</span>
                    <select className={`rounded-lg px-2 py-1 text-xs font-semibold ${STATUS_TONE[org.billingStatus] ?? ''}`}
                      value={org.billingStatus} disabled={busyId === org.id}
                      onChange={e => { void patch(org.id, { billingStatus: e.target.value }) }}>
                      {BILLING_STATUSES.map(s => <option key={s} value={s}>{t(`organizations_page.billing_${s}`)}</option>)}
                    </select>
                  </label>

                  <button type="button" disabled={busyId === org.id}
                    className={org.archivedAt === null ? 'btn btn-ghost-danger btn-sm' : 'btn btn-secondary btn-sm'}
                    onClick={() => { void setArchived(org.id, org.archivedAt === null) }}>
                    {org.archivedAt === null ? t('organizations_page.archive') : t('organizations_page.unarchive')}
                  </button>
                </div>
              </div>

              {org.billingStatus === 'suspended' && (
                <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                  {t('organizations_page.suspended_note')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
