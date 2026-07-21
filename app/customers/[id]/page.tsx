// v3 replan (Phase H — CRM). Profile view: order history, total spend, last
// order date — "who is this and what have they ordered before," per the v3
// plan's deliberately minimal scope (no campaigns/segments/tags).
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import api from '../../../lib/api'
import { translateApiError } from '../../../lib/apiError'
import { Customer, CustomerProfile } from '../../../lib/types'
import Spinner from '../../../components/Spinner'

export default function CustomerProfilePage() {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // v3 follow-up: profile view previously had no way to edit anything after
  // creation (not even the `notes` field, which the backend already
  // accepted but no UI ever set) — added alongside the new `address` field.
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<CustomerProfile>(`/api/customers/${params.id}`)
      .then(r => setProfile(r.data))
      .catch((err) => setError(translateApiError(err, t, t('customers_page.error_load'))))
  }, [params.id, t])

  function startEdit() {
    if (profile === null) return
    setEditName(profile.name)
    setEditPhone(profile.phone ?? '')
    setEditAddress(profile.address ?? '')
    setEditNotes(profile.notes ?? '')
    setEditing(true)
  }

  async function saveEdit() {
    if (editName.trim() === '') return
    setSaving(true)
    setError(null)
    try {
      const r = await api.patch<Customer>(`/api/customers/${params.id}`, {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        address: editAddress.trim() || undefined,
        notes: editNotes.trim() || undefined
      })
      setProfile(prev => prev === null ? prev : { ...prev, ...r.data })
      setEditing(false)
    } catch (err) {
      setError(translateApiError(err, t, t('customers_page.error_save')))
    } finally {
      setSaving(false)
    }
  }

  async function deleteCustomer() {
    setDeleting(true)
    setError(null)
    try {
      await api.delete(`/api/customers/${params.id}`, { data: { confirm: true } })
      router.push('/customers')
    } catch (err) {
      setError(translateApiError(err, t, t('customers_page.error_delete')))
      setDeleting(false)
    }
  }

  if (error !== null) {
    return <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
  }
  if (profile === null) {
    // v3.1 follow-up 10k: was a bare line of grey text; now the same spinner
    // every other page uses while it waits.
    return <Spinner label={t('customers_page.loading')} />
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        {editing ? (
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <input className={inputClasses} placeholder={t('customers_page.name_placeholder')} value={editName} onChange={e => setEditName(e.target.value)} required />
            <input className={inputClasses} placeholder={t('customers_page.phone_placeholder')} value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            <input className={inputClasses} placeholder={t('customers_page.address_placeholder')} value={editAddress} onChange={e => setEditAddress(e.target.value)} />
            <textarea className={inputClasses} rows={2} placeholder={t('customers_page.notes_placeholder')} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{profile.name}</h1>
            {profile.phone !== null && <p className="text-sm text-stone-500">{profile.phone}</p>}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="btn btn-secondary">
                {t('customers_page.cancel')}
              </button>
              <button onClick={saveEdit} disabled={saving} className="btn btn-primary">
                {saving ? t('customers_page.saving') : t('customers_page.save')}
              </button>
            </>
          ) : (
            <button onClick={startEdit} className="btn btn-secondary">
              {t('customers_page.edit_customer')}
            </button>
          )}
          {!confirmingDelete ? (
            <button onClick={() => setConfirmingDelete(true)}
              className="btn btn-ghost-danger">
              {t('customers_page.delete_customer')}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-700">{t('customers_page.delete_confirm')}</span>
              <button onClick={deleteCustomer} disabled={deleting}
                className="btn btn-danger">
                {deleting ? t('customers_page.deleting') : t('customers_page.confirm_delete')}
              </button>
              <button onClick={() => setConfirmingDelete(false)}
                className="btn btn-secondary">
                {t('customers_page.cancel')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-surface p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t('customers_page.total_spend')}</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{Number(profile.totalSpend).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-surface p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t('customers_page.last_order')}</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">
            {profile.lastOrderAt !== null ? new Date(profile.lastOrderAt).toLocaleDateString() : '—'}
          </p>
        </div>
      </div>

      {!editing && profile.address !== null && profile.address !== '' && (
        <div className="mb-6 rounded-xl border border-stone-200 bg-surface p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t('customers_page.address')}</p>
          <p className="mt-1 text-sm text-stone-700">{profile.address}</p>
        </div>
      )}

      {!editing && profile.notes !== null && profile.notes !== '' && (
        <div className="mb-6 rounded-xl border border-stone-200 bg-surface p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t('customers_page.notes')}</p>
          <p className="mt-1 text-sm text-stone-700">{profile.notes}</p>
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{t('customers_page.order_history')}</h2>
      {profile.orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-surface p-8 text-center text-sm text-stone-400">
          {t('customers_page.no_orders_yet')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-surface shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100 text-start text-[11px] font-bold uppercase tracking-[0.08em] text-stone-500">
                <th className="px-4 py-2.5 text-start">{t('orders_page.status_created')}</th>
                <th className="w-32 px-4 py-2.5 text-end">{t('new_order_page.total')}</th>
                <th className="px-4 py-2.5 text-end"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {profile.orders.map(o => (
                <tr key={o.id}>
                  <td className="px-4 py-2.5 text-stone-600">{new Date(o.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-medium text-stone-900">{Number(o.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-stone-500">{t(`orders_page.status_${o.status.toLowerCase()}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
