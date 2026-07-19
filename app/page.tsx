// Phase 3: wired to real data from GET /api/orders and GET /api/products
// instead of hardcoded "12 orders / 2 alerts / 78%". Note: the schema has no
// "yield" concept at all (no waste/yield fields anywhere in prisma/schema.prisma),
// so that stat was pure fiction — replaced with "Products Tracked", a number
// that actually exists. Orders requires auth (GET /api/orders is behind the
// `auth` middleware), so logged-out visitors see a prompt instead of a 401-driven
// blank stat.
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { useAuth } from '../lib/useAuth'
import { Order, Product } from '../lib/types'

const LOW_STOCK_THRESHOLD_KG = 5

export default function Page() {
  const { t } = useTranslation()
  const user = useAuth()
  const loggedIn = !!user
  const [todaysOrders, setTodaysOrders] = useState<number | null>(null)
  const [stockAlerts, setStockAlerts] = useState<number | null>(null)
  const [productCount, setProductCount] = useState<number | null>(null)

  useEffect(() => {
    api.get<Product[]>('/api/products')
      .then(r => {
        setProductCount(r.data.length)
        setStockAlerts(r.data.filter(p => Number(p.stockKg) < LOW_STOCK_THRESHOLD_KG).length)
      })
      .catch(() => {
        setProductCount(null)
        setStockAlerts(null)
      })
  }, [])

  useEffect(() => {
    // `useAuth()` resolves asynchronously (it has to ask the backend — the
    // cookie isn't readable client-side), so this only fires once `loggedIn`
    // flips true, rather than racing it on mount.
    if (!loggedIn) return
    api.get<Order[]>('/api/orders')
      .then(r => {
        const today = new Date().toDateString()
        setTodaysOrders(r.data.filter(o => new Date(o.createdAt).toDateString() === today).length)
      })
      .catch(() => setTodaysOrders(null))
  }, [loggedIn])

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-4">{t('dashboard')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          {t('dashboard_page.todays_orders')}<br/>
          {loggedIn ? (todaysOrders ?? '…') : <span className="text-sm text-gray-500">{t('dashboard_page.log_in_to_view')}</span>}
        </div>
        <div className="bg-white p-4 rounded shadow">{t('dashboard_page.stock_alerts', { threshold: LOW_STOCK_THRESHOLD_KG })}<br/>{stockAlerts ?? '…'}</div>
        <div className="bg-white p-4 rounded shadow">{t('dashboard_page.products_tracked')}<br/>{productCount ?? '…'}</div>
      </div>
      <div className="mt-6 flex gap-4">
        <Link className="text-blue-600 underline" href="/orders">{t('dashboard_page.go_to_orders')}</Link>
        <Link className="text-blue-600 underline" href="/inventory">{t('dashboard_page.go_to_inventory')}</Link>
      </div>
    </div>
  )
}
