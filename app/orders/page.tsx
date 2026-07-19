// Fix (ADR-003): backend returns a bare Order[] array with camelCase fields,
// not { orders: [...] } with customer_name/total_amount. Updated to match.
'use client'
import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { Order } from '../../lib/types'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<Order[]>('/api/orders')
      .then(r => setOrders(r.data))
      .catch((e) => {
        setOrders([])
        setError(e?.response?.status === 401 ? 'Please log in to view orders.' : 'Failed to load orders.')
      })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Orders</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-3">{error}</div>}
      {orders.length === 0 ? (
        <div className="bg-white p-4 rounded shadow">No orders</div>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="bg-white p-3 rounded shadow mb-2 flex justify-between">
            <div>{o.customer || 'Walk-in'}</div>
            <div>{Number(o.totalAmount).toFixed(2)}</div>
          </div>
        ))
      )}
    </div>
  )
}
