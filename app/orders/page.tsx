// Fix (ADR-003): backend returns a bare Order[] array with camelCase fields,
// not { orders: [...] } with customer_name/total_amount. Updated to match.
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { Order } from '../../lib/types'

export default function OrdersPage() {
  const { t } = useTranslation()
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<Order[]>('/api/orders')
      .then(r => setOrders(r.data))
      .catch((e) => {
        setOrders([])
        setError(e?.response?.status === 401 ? t('orders_page.please_login') : t('orders_page.failed_to_load'))
      })
  }, [t])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{t('orders')}</h1>
        </div>
        <Link
          href="/orders/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t('new_order')}
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">{t('orders_page.no_orders')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
          <ul className="divide-y divide-stone-100">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-stone-50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                    {(o.customer || t('orders_page.walk_in')).slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900">{o.customer || t('orders_page.walk_in')}</p>
                    <p className="text-xs text-stone-500">{new Date(o.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="shrink-0 text-sm font-semibold text-stone-900">{Number(o.totalAmount).toFixed(2)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
