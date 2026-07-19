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
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{t('orders')}</h1>
        <Link href="/orders/new" className="px-3 py-1 bg-blue-600 text-white rounded text-sm">{t('new_order')}</Link>
      </div>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-3">{error}</div>}
      {orders.length === 0 ? (
        <div className="bg-white p-4 rounded shadow">{t('orders_page.no_orders')}</div>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="bg-white p-3 rounded shadow mb-2 flex justify-between">
            <div>{o.customer || t('orders_page.walk_in')}</div>
            <div>{Number(o.totalAmount).toFixed(2)}</div>
          </div>
        ))
      )}
    </div>
  )
}
