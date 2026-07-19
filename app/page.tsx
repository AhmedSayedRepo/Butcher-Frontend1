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

  const hasAlerts = (stockAlerts ?? 0) > 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">{t('dashboard')}</h1>
        <p className="mt-1 text-sm text-stone-500">{t('app_name')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t('dashboard_page.todays_orders')}
          value={loggedIn ? todaysOrders : null}
          pending={!loggedIn}
          pendingLabel={t('dashboard_page.log_in_to_view')}
          icon={<ReceiptIcon />}
          accent="brand"
        />
        <StatCard
          label={t('dashboard_page.stock_alerts', { threshold: LOW_STOCK_THRESHOLD_KG })}
          value={stockAlerts}
          icon={<AlertIcon />}
          accent={hasAlerts ? 'amber' : 'green'}
        />
        <StatCard
          label={t('dashboard_page.products_tracked')}
          value={productCount}
          icon={<BoxIcon />}
          accent="stone"
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/orders/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          {t('new_order')}
        </Link>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          {t('dashboard_page.go_to_orders')}
        </Link>
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          {t('dashboard_page.go_to_inventory')}
        </Link>
      </div>
    </div>
  )
}

const ACCENT_STYLES = {
  brand: 'bg-brand-50 text-brand-600',
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-emerald-50 text-emerald-600',
  stone: 'bg-stone-100 text-stone-600',
} as const

function StatCard({
  label,
  value,
  icon,
  accent,
  pending,
  pendingLabel,
}: {
  label: string
  value: number | null
  icon: React.ReactNode
  accent: keyof typeof ACCENT_STYLES
  pending?: boolean
  pendingLabel?: string
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-stone-500">{label}</p>
          {pending ? (
            <p className="mt-2 text-sm text-stone-400">{pendingLabel}</p>
          ) : (
            <p className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">{value ?? '—'}</p>
          )}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ACCENT_STYLES[accent]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function ReceiptIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L14.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  )
}

function BoxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21 8-9-5-9 5 9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  )
}
