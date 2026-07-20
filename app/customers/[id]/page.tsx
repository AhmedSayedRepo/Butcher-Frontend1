// v3 replan (Phase H — CRM). Profile view: order history, total spend, last
// order date — "who is this and what have they ordered before," per the v3
// plan's deliberately minimal scope (no campaigns/segments/tags).
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import api from '../../../lib/api'
import { extractApiErrorMessage } from '../../../lib/apiError'
import { CustomerProfile } from '../../../lib/types'

export default function CustomerProfilePage() {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    api.get<CustomerProfile>(`/api/customers/${params.id}`)
      .then(r => setProfile(r.data))
      .catch((err) => setError(extractApiErrorMessage(err) ?? t('customers_page.error_load')))
  }, [params.id, t])

  async function deleteCustomer() {
    setDeleting(true)
    setError(null)
    try {
      await api.delete(`/api/customers/${params.id}`, { data: { confirm: true } })
      router.push('/customers')
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? t('customers_page.error_delete'))
      setDeleting(false)
    }
  }

  if (error !== null) {
    return <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
  }
  if (profile === null) {
    return <div className="text-sm text-stone-500">{t('customers_page.loading')}</div>
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{profile.name}</h1>
          {profile.phone !== null && <p className="text-sm text-stone-500">{profile.phone}</p>}
        </div>
        {!confirmingDelete ? (
          <button onClick={() => setConfirmingDelete(true)}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
            {t('customers_page.delete_customer')}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-700">{t('customers_page.delete_confirm')}</span>
            <button onClick={deleteCustomer} disabled={deleting}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {deleting ? t('customers_page.deleting') : t('customers_page.confirm_delete')}
            </button>
            <button onClick={() => setConfirmingDelete(false)}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
              {t('customers_page.cancel')}
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t('customers_page.total_spend')}</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{Number(profile.totalSpend).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t('customers_page.last_order')}</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">
            {profile.lastOrderAt !== null ? new Date(profile.lastOrderAt).toLocaleDateString() : '—'}
          </p>
        </div>
      </div>

      {profile.notes !== null && profile.notes !== '' && (
        <div className="mb-6 rounded-xl border border-stone-200 bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t('customers_page.notes')}</p>
          <p className="mt-1 text-sm text-stone-700">{profile.notes}</p>
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{t('customers_page.order_history')}</h2>
      {profile.orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-400">
          {t('customers_page.no_orders_yet')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                <th className="px-4 py-2.5">{t('orders_page.status_created')}</th>
                <th className="px-4 py-2.5">{t('new_order_page.total')}</th>
                <th className="px-4 py-2.5"></th>
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
