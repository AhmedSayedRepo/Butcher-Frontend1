// Phase 3: wired to real data from GET /api/orders and GET /api/products
// instead of hardcoded "12 orders / 2 alerts / 78%". Note: the schema has no
// "yield" concept at all (no waste/yield fields anywhere in prisma/schema.prisma),
// so that stat was pure fiction — replaced with "Products Tracked", a number
// that actually exists. Orders requires auth (GET /api/orders is behind the
// `auth` middleware), so logged-out visitors see a prompt instead of a 401-driven
// blank stat.
//
// v2 replan (Phase A — Dashboard 2.0): adds a "currently in progress" KPI
// card (each card links to the relevant filtered view, per the plan), plus
// two charts computed client-side from the same GET /api/orders response
// already fetched here — a 7/30-day revenue line chart and a top-5
// products-by-kg-sold bar chart. No new backend endpoint yet (see the plan's
// note on a future server-side /api/dashboard/summary aggregate once client-
// side aggregation gets slow).
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts'
import api from '../lib/api'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../lib/useAuth'
import { Order, Product, ShopSettings } from '../lib/types'

// Revamp follow-up: Recharts takes colours as props rather than classes, so
// these never picked up the theme — they were hardcoded hex and stayed the old
// brand red under both themes, with axis text that was unreadable on a dark
// card. Pointing them at the CSS variables (defined per theme in globals.css)
// makes the charts follow the theme like everything else. `var()` is valid in
// SVG presentation attributes and inline styles, which is all Recharts does
// with these, so no re-render on theme change is needed — the browser
// re-resolves them when the `data-theme` attribute flips.
const CHART = {
  series: 'var(--chart-series)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  tick: 'var(--chart-tick)',
  ink: 'var(--chart-ink)',
  tooltip: {
    background: 'var(--chart-tooltip-bg)',
    border: '1px solid var(--chart-axis)',
    borderRadius: 'var(--radius-card)',
    color: 'var(--chart-ink)',
  },
} as const

// v3.1 follow-up 5 (Settings page): fallback only — the real value now
// comes from ShopSettings.defaultLowStockThresholdKg (editable at
// /settings), fetched below. Only used for the brief window before that
// fetch resolves.
const FALLBACK_LOW_STOCK_THRESHOLD_KG = 5
const DAYS_7 = 7
const DAYS_30 = 30
const TOP_PRODUCTS_LIMIT = 5
const MS_PER_DAY = 24 * 60 * 60 * 1000
const RANGE_OPTIONS: Array<typeof DAYS_7 | typeof DAYS_30> = [DAYS_7, DAYS_30]
// v3 replan (Phase J — pending-order alerting, ADR-010). Polling interval
// for re-fetching orders while the dashboard tab is open — same
// "in-app/browser only, no push provider" default the ADR settled on.
const ORDERS_POLL_MS = 45 * 1000
const MS_PER_MINUTE = 60 * 1000
const SOURCE_LABELS = ['in_premise', 'social', 'phone', 'whatsapp', 'cashier'] as const

export default function Page() {
  const { t } = useTranslation()
  const user = useAuth()
  const loggedIn = !!user
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [rangeDays, setRangeDays] = useState<typeof DAYS_7 | typeof DAYS_30>(DAYS_7)

  useEffect(() => {
    api.get<Product[]>('/api/products').then(r => setProducts(r.data)).catch(() => setProducts([]))
  }, [])

  useEffect(() => {
    // `useAuth()` resolves asynchronously (it has to ask the backend — the
    // cookie isn't readable client-side), so this only fires once `loggedIn`
    // flips true, rather than racing it on mount.
    if (!loggedIn) return
    function fetchOrders() {
      api.get<Order[]>('/api/orders').then(r => setOrders(r.data)).catch(() => setOrders(null))
    }
    fetchOrders()
    // v3 replan (Phase J, ADR-010): polls the same existing endpoint the
    // rest of this page already uses — no new aggregate endpoint, no
    // websockets. Stops the moment this component unmounts.
    const interval = setInterval(fetchOrders, ORDERS_POLL_MS)
    return () => clearInterval(interval)
  }, [loggedIn])

  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null)
  useEffect(() => {
    if (!loggedIn) return
    api.get<ShopSettings>('/api/shop-settings').then(r => setShopSettings(r.data)).catch(() => setShopSettings(null))
  }, [loggedIn])

  const drafts = useMemo(() => (orders ?? []).filter(o => o.status === 'DRAFT'), [orders])
  const draftsBySource = useMemo(() => {
    const counts = new Map<string, number>()
    for (const o of drafts) counts.set(o.source, (counts.get(o.source) ?? 0) + 1)
    return counts
  }, [drafts])
  const alertThresholdMinutes = shopSettings?.pendingOrderAlertMinutes ?? null
  const staleDrafts = useMemo(() => {
    if (alertThresholdMinutes === null) return []
    const cutoff = Date.now() - alertThresholdMinutes * MS_PER_MINUTE
    return drafts.filter(o => new Date(o.createdAt).getTime() < cutoff)
  }, [drafts, alertThresholdMinutes])

  // v3 replan (Phase J, ADR-010): optional browser Notification, permission
  // requested once a stale draft actually exists (not eagerly on page load —
  // asking for a permission with no immediate reason is exactly the kind of
  // prompt users reflexively dismiss). Fires at most once per render of a
  // newly-stale set, not on every poll tick, via the ref below.
  const notifiedCountRef = useRef(0)
  useEffect(() => {
    if (staleDrafts.length === 0 || typeof Notification === 'undefined') return
    if (staleDrafts.length <= notifiedCountRef.current) return
    notifiedCountRef.current = staleDrafts.length
    if (Notification.permission === 'granted') {
      new Notification(t('dashboard_page.stale_orders_notification', { count: staleDrafts.length }))
    } else if (Notification.permission !== 'denied') {
      void Notification.requestPermission()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is stable enough here; re-running on every translation-fn identity change isn't the intent.
  }, [staleDrafts.length])

  const lowStockThresholdKg = shopSettings === null ? FALLBACK_LOW_STOCK_THRESHOLD_KG : Number(shopSettings.defaultLowStockThresholdKg)
  const stockAlerts = products.filter(p => {
    const threshold = p.lowStockAlertKg === null || p.lowStockAlertKg === '' ? lowStockThresholdKg : Number(p.lowStockAlertKg)
    return Number(p.stockKg) < threshold
  }).length
  const hasAlerts = stockAlerts > 0
  const productCount = products.length

  const today = new Date().toDateString()
  const nonCancelled = useMemo(() => (orders ?? []).filter(o => o.status !== 'CANCELLED' && o.status !== 'DRAFT'), [orders])
  const todaysOrders = orders === null ? null : nonCancelled.filter(o => new Date(o.createdAt).toDateString() === today).length
  const inProgressCount = orders === null ? null : orders.filter(o => o.status === 'IN_PROGRESS').length

  const revenueByDay = useMemo(() => {
    const days: { date: string, label: string, revenue: number }[] = []
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * MS_PER_DAY)
      const key = d.toDateString()
      const revenue = nonCancelled
        .filter(o => new Date(o.createdAt).toDateString() === key)
        .reduce((sum, o) => sum + Number(o.totalAmount), 0)
      days.push({ date: key, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), revenue })
    }
    return days
  }, [nonCancelled, rangeDays])

  const topProducts = useMemo(() => {
    const nameById = new Map(products.map(p => [p.id, p.name]))
    const kgById = new Map<string, number>()
    for (const o of nonCancelled) {
      for (const item of o.items) {
        kgById.set(item.productId, (kgById.get(item.productId) ?? 0) + Number(item.kg))
      }
    }
    return Array.from(kgById.entries())
      .map(([productId, kg]) => ({ name: nameById.get(productId) ?? productId, kg: Number(kg.toFixed(2)) }))
      .sort((a, b) => b.kg - a.kg)
      .slice(0, TOP_PRODUCTS_LIMIT)
  }, [nonCancelled, products])

  return (
    <div>
      <PageHeader title={t('dashboard')} code="DB" subtitle={t('dashboard_page.subtitle')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          href="/orders"
          label={t('dashboard_page.todays_orders')}
          value={loggedIn ? todaysOrders : null}
          pending={!loggedIn}
          pendingLabel={t('dashboard_page.log_in_to_view')}
          icon={<ReceiptIcon />}
          accent="brand"
        />
        <StatCard
          href="/orders"
          label={t('dashboard_page.orders_in_progress')}
          value={loggedIn ? inProgressCount : null}
          pending={!loggedIn}
          pendingLabel={t('dashboard_page.log_in_to_view')}
          icon={<ClockIcon />}
          accent="brand"
        />
        <StatCard
          href="/inventory"
          label={t('dashboard_page.stock_alerts', { threshold: lowStockThresholdKg })}
          value={stockAlerts}
          icon={<AlertIcon />}
          accent={hasAlerts ? 'amber' : 'green'}
        />
        <StatCard
          href="/inventory"
          label={t('dashboard_page.products_tracked')}
          value={productCount}
          icon={<BoxIcon />}
          accent="stone"
        />
      </div>

      {/* v3 replan (Phase J — dashboard source segmentation + alerts).
          Derived client-side from the same GET /api/orders response as
          everything else on this page — no new aggregate endpoint. */}
      {loggedIn && drafts.length > 0 && (
        <div className="mt-6 rounded-xl border border-stone-200 bg-surface p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900">{t('dashboard_page.pending_by_source_title')}</h2>
            {staleDrafts.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                <AlertIcon />
                {t('dashboard_page.stale_orders_badge', { count: staleDrafts.length, minutes: alertThresholdMinutes })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {SOURCE_LABELS.filter(s => (draftsBySource.get(s) ?? 0) > 0).map(s => (
              <Link key={s} href="/orders"
                className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm hover:bg-stone-100">
                <span className="font-medium text-stone-900">{draftsBySource.get(s)}</span>
                <span className="text-stone-500">{t(`orders_page.source_${s}`)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {loggedIn && orders !== null && orders.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-surface p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-900">{t('dashboard_page.revenue_chart_title')}</h2>
              <div className="flex gap-1 rounded-lg bg-stone-100 p-0.5 text-xs font-medium">
                {RANGE_OPTIONS.map(d => (
                  <button key={d} onClick={() => setRangeDays(d)}
                    className={`rounded-md px-2 py-1 transition-colors ${rangeDays === d ? 'bg-surface text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
                    {t('dashboard_page.days', { count: d })}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: CHART.tick }} tickLine={false} axisLine={{ stroke: CHART.axis }} />
                <YAxis tick={{ fontSize: 12, fill: CHART.tick }} tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(value: number) => value.toFixed(2)} contentStyle={CHART.tooltip} labelStyle={{ color: CHART.ink }} />
                <Line type="monotone" dataKey="revenue" stroke={CHART.series} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-stone-200 bg-surface p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold text-stone-900">{t('dashboard_page.top_products_chart_title')}</h2>
            {topProducts.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-stone-400">{t('dashboard_page.no_sales_yet')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topProducts} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: CHART.tick }} tickLine={false} axisLine={{ stroke: CHART.axis }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: CHART.tick }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip formatter={(value: number) => `${value} kg`} contentStyle={CHART.tooltip} labelStyle={{ color: CHART.ink }} />
                  <Bar dataKey="kg" fill={CHART.series} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/orders/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          {t('new_order')}
        </Link>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-surface px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          {t('dashboard_page.go_to_orders')}
        </Link>
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-surface px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
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
  href,
  label,
  value,
  icon,
  accent,
  pending,
  pendingLabel,
}: {
  href: string
  label: string
  value: number | null
  icon: React.ReactNode
  accent: keyof typeof ACCENT_STYLES
  pending?: boolean
  pendingLabel?: string
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-stone-200 bg-surface p-5 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-stone-500">{label}</p>
          {/* Revamp: KPI figures are the thing this screen exists to show, so
              they follow the mockups — heavier weight, tighter tracking, and
              `tabular`, which selects Plex Mono under the dark theme (the UI
              font under the light one) and locks digit width so the numbers
              don't jitter as they refresh. */}
          {pending ? (
            <p className="mt-2 text-sm text-stone-400">{pendingLabel}</p>
          ) : (
            <p className="tabular mt-1 text-3xl font-extrabold tracking-tight text-stone-900">{value ?? '—'}</p>
          )}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ACCENT_STYLES[accent]}`}>
          {icon}
        </div>
      </div>
    </Link>
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

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
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
