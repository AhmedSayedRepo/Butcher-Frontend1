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
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts'
import api from '../lib/api'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import { useAuth } from '../lib/useAuth'
import { Order, OrderStatus, Product, ShopSettings } from '../lib/types'
import { formatElapsed, minutesSince, statusEnteredAt } from '../lib/elapsed'

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
  // Axis labels sit on a card, not on the chart's own fill, so they can take
  // the stronger ink colour rather than the muted tick grey — at 11px muted
  // they were close to unreadable, especially the Arabic product names on the
  // bar chart's category axis.
  tooltipBg: 'var(--chart-tooltip-bg)',
} as const

// v3.2 — the charts were correct and plain: a 2px line on a full crosshatch
// grid, and a bar chart whose values you had to read off an axis. Both now
// look like the rest of the app rather than like Recharts' defaults.
//
// The changes are not only cosmetic. The revenue panel gained the total for
// the period and its change against the period before, because a trend line
// answers "which direction" and never "how much" — the number everyone
// actually asks for was the one number not on screen. The bar chart prints
// each weight on its own row and drops the axis, which is strictly less ink
// for strictly more information.
const BAR_RADIUS: [number, number, number, number] = [4, 4, 4, 4]
const THOUSAND = 1000
const PERCENT = 100
const ONE_DECIMAL = 1

// Axis labels: 12,400 becomes 12.4k. At 11px, a five-digit figure repeated
// down a Y axis is most of what the eye lands on, and none of it is the
// point of the chart.
function compactNumber(value: number): string {
  if (Math.abs(value) < THOUSAND) return String(Math.round(value))
  return `${(value / THOUSAND).toFixed(ONE_DECIMAL)}k`
}

interface TooltipPayloadEntry { value: number }
interface ChartTooltipProps {
  active?: boolean
  label?: string | number
  payload?: TooltipPayloadEntry[]
  format: (value: number) => string
}

// A component rather than `contentStyle`, so the tooltip picks up the app's
// card shadow and type scale instead of Recharts' default panel — which is a
// 1px box with 12px system text and looks like a different product.
function ChartTooltip({ active, label, payload, format }: ChartTooltipProps) {
  if (active !== true || payload === undefined || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-stone-200 bg-surface px-3 py-2 shadow-card">
      <p className="text-[11px] font-medium text-stone-500">{label}</p>
      <p className="tabular text-sm font-bold text-stone-900">{format(payload[0].value)}</p>
    </div>
  )
}

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
const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
// The badge shows a live-ageing wait time, so it needs its own tick independent
// of the 45s order poll — a minute is the smallest unit it displays.
const STALE_TICK_MS = 30 * 1000
// The board's live stages, in pipeline order. Terminal states and drafts are
// deliberately absent — this panel is "what's moving", not a full board.
const DASHBOARD_COLUMNS: OrderStatus[] = ['CREATED', 'IN_PROGRESS', 'ON_THE_WAY']
// Enough to see the shape of the queue without the dashboard turning into a
// second orders page; both panels link through for the full list.
const DASHBOARD_COLUMN_LIMIT = 4
const DASHBOARD_INVENTORY_LIMIT = 8
// Late orders are the one list you'd want in full, but a dashboard that can
// grow to fifty rows stops being a dashboard. Overflow is counted in a line
// under the table, with the board a click away.
const DASHBOARD_LATE_LIMIT = 10
// Statuses where an order is still someone's responsibility, so sitting in one
// too long is worth surfacing. DRAFT is included — an unconfirmed order that
// nobody has picked up is the original stale case.
const LATE_WATCH_STATUSES: OrderStatus[] = ['DRAFT', 'CREATED', 'IN_PROGRESS', 'ON_THE_WAY']

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

  // How long the *worst* of them has actually been waiting. The badge used to
  // echo the configured threshold back — "over 1 minute" no matter whether the
  // order had been sitting for two minutes or two days — which is the one
  // number the reader already knows and the one they can't act on. `nowMs`
  // ticks so the figure ages on screen rather than freezing at whatever it was
  // when the orders last loaded (a 45s poll would otherwise make it jump).
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => { setNowMs(Date.now()) }, STALE_TICK_MS)
    return () => { clearInterval(id) }
  }, [])

  const oldestStaleMinutes = useMemo(() => {
    if (staleDrafts.length === 0) return null
    const oldest = Math.min(...staleDrafts.map(o => new Date(o.createdAt).getTime()))
    return Math.floor((nowMs - oldest) / MS_PER_MINUTE)
  }, [staleDrafts, nowMs])

  // Minutes alone stops being readable somewhere past an hour — "waiting 4291m"
  // is a number you have to do arithmetic on before it means anything.
  function formatWait(totalMinutes: number): string {
    if (totalMinutes < MINUTES_PER_HOUR) return t('dashboard_page.wait_minutes', { count: totalMinutes })
    const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
    if (hours < HOURS_PER_DAY) {
      const minutes = totalMinutes % MINUTES_PER_HOUR
      return minutes === 0
        ? t('dashboard_page.wait_hours', { count: hours })
        : t('dashboard_page.wait_hours_minutes', { hours, minutes })
    }
    return t('dashboard_page.wait_days', { count: Math.floor(hours / HOURS_PER_DAY) })
  }

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
  // Per-product override wins over the shop-wide default — same rule the
  // Inventory page and the backend's lib/lowStock.ts apply.
  function isLowStock(p: Product): boolean {
    const threshold = p.lowStockAlertKg === null || p.lowStockAlertKg === '' ? lowStockThresholdKg : Number(p.lowStockAlertKg)
    return Number(p.stockKg) < threshold
  }
  const stockAlerts = products.filter(isLowStock).length

  // The three live stages, mirroring /orders. DRAFT and the two terminal
  // states are excluded: this panel answers "what's moving right now".
  const inProgressColumns = useMemo(() => {
    const all = orders ?? []
    return DASHBOARD_COLUMNS.map(status => ({ status, orders: all.filter(o => o.status === status) }))
  }, [orders])

  // v3.1 follow-up 10f: how long each order has sat in its current status,
  // shared with the orders board via lib/elapsed so the two can't disagree.
  // Falls back to createdAt when the audit trail has no event for the current
  // status — true for rows that predate the trail, and for DRAFT, which is
  // where an order starts rather than somewhere it moves to.
  function statusMinutes(order: Order): number {
    const at = statusEnteredAt(order, order.status) ?? new Date(order.createdAt)
    return minutesSince(at, nowMs)
  }

  // Every order that has been in its current status longer than the shop's
  // alert threshold — not just stale drafts. The badge above counts drafts
  // because that's where the notification logic lives; this lists the whole
  // set, because "which ones are late" is the question a badge saying "3" makes
  // you go and ask. Sorted worst-first: the top row is the one to deal with.
  const lateOrders = useMemo(() => {
    if (alertThresholdMinutes === null) return []
    const live = (orders ?? []).filter(o => LATE_WATCH_STATUSES.includes(o.status))
    return live
      .map(o => ({ order: o, minutes: statusMinutes(o) }))
      .filter(row => row.minutes >= alertThresholdMinutes)
      .sort((a, b) => b.minutes - a.minutes)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- statusMinutes is redefined each render; nowMs is the input that actually changes.
  }, [orders, alertThresholdMinutes, nowMs])

  // `t` narrowed to the plain (key, vars) shape formatElapsed expects, so that
  // helper stays free of the translation runtime.
  const tt = (key: string, vars?: Record<string, number>): string => t(key, vars ?? {})

  function itemsSummary(order: Order): string {
    return order.items
      .map(i => `${Number(i.kg).toFixed(3)}${t('new_order_page.kg_label')} ${i.product?.name ?? ''}`.trim())
      .join(' · ')
  }
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

  // Total for the visible window, and how it compares with the window
  // immediately before it. `deltaPercent` is null when the previous period had
  // no revenue at all — the honest answer there is "no comparison", not
  // "+100%" or "+∞", both of which a new shop would see on its second week and
  // reasonably take for a bug.
  const revenueTrend = useMemo(() => {
    const total = revenueByDay.reduce((sum, day) => sum + day.revenue, 0)
    const windowStart = Date.now() - rangeDays * MS_PER_DAY
    const previousStart = windowStart - rangeDays * MS_PER_DAY
    const previous = nonCancelled
      .filter(o => {
        const at = new Date(o.createdAt).getTime()
        return at >= previousStart && at < windowStart
      })
      .reduce((sum, o) => sum + Number(o.totalAmount), 0)
    return {
      total,
      deltaPercent: previous === 0 ? null : ((total - previous) / previous) * PERCENT
    }
  }, [revenueByDay, nonCancelled, rangeDays])

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
                {t('dashboard_page.stale_orders_badge', {
                  count: staleDrafts.length,
                  wait: oldestStaleMinutes === null ? '' : formatWait(oldestStaleMinutes)
                })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {SOURCE_LABELS.filter(s => (draftsBySource.get(s) ?? 0) > 0).map(s => (
              <Link key={s} href="/orders"
                className="card-hover-sm flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
                <span className="font-medium text-stone-900">{draftsBySource.get(s)}</span>
                <span className="text-stone-500">{t(`orders_page.source_${s}`)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* v3.1 follow-up 10b — the two sections from the design mockup: a compact
          read-only mirror of the orders board, and the inventory table. Both are
          derived from data this page already fetches (`orders`, `products`), so
          neither adds a request. Deliberately read-only and link-through: the
          dashboard is a glance, and duplicating the board's actions here would
          mean two places to keep in step. */}
      {loggedIn && (
        <div className="mt-6 rounded-xl border border-stone-200 bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-stone-900">{t('dashboard_page.orders_in_progress_title')}</h2>
            <Link href="/orders" className="text-xs font-semibold text-brand-700 hover:underline">
              {t('dashboard_page.go_to_orders')}
            </Link>
          </div>
          {/* v3.1 follow-up 10k: `orders` is null until the fetch lands, and
              `orders ?? []` made that look identical to "nothing in progress".
              The null check has to come first. */}
          {orders === null ? (
            <Spinner />
          ) : inProgressColumns.every(col => col.orders.length === 0) ? (
            <p className="py-4 text-center text-sm text-stone-400">{t('dashboard_page.no_orders_in_progress')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inProgressColumns.map(col => (
                <div key={col.status}>
                  <h3 className="mb-2 flex items-center gap-2">
                    <span className="tabular flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-100 text-[11px] font-bold text-brand-800">
                      {col.orders.length}
                    </span>
                    <span className="text-xs font-bold text-stone-700">
                      {t(`orders_page.status_${col.status.toLowerCase()}`)}
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {col.orders.slice(0, DASHBOARD_COLUMN_LIMIT).map(o => (
                      // v3.2: same hover gesture as the rest of the app, in
                      // the compact variant — these are cards inside a card,
                      // and a dozen of them in a grid.
                      <Link key={o.id} href="/orders"
                        className="card-hover-sm block rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                        <p className="flex items-baseline gap-2 text-sm font-semibold text-stone-900">
                          {o.dailyNumber !== null && <span className="tabular text-xs text-stone-400">#{o.dailyNumber}</span>}
                          <span className="min-w-0 flex-1 truncate" title={o.customer ?? undefined}>
                            {o.customer !== null && o.customer !== '' ? o.customer : t('orders_page.walk_in')}
                          </span>
                          <span className="tabular text-xs font-bold">{Number(o.totalAmount).toFixed(2)}</span>
                        </p>
                        <p className="truncate text-xs text-stone-500">{itemsSummary(o)}</p>
                        {/* v3.1 follow-up 10f: dwell time, matching the clock
                            on the orders board. Amber once it crosses the
                            shop's own alert threshold — the same number the
                            late list below uses, not a second hardcoded one. */}
                        <p className={`tabular mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold ${
                          alertThresholdMinutes !== null && statusMinutes(o) >= alertThresholdMinutes
                            ? 'bg-amber-50 text-amber-800'
                            : 'text-stone-400'
                        }`}>
                          {formatElapsed(statusMinutes(o), tt)}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* v3.1 follow-up 10f — every late order, not a count of them. The badge
          on the panel above says how many drafts are stale; this says which
          orders they are, what status each is stuck in and for how long, across
          the whole live pipeline rather than drafts alone. Same threshold, same
          data already on the page — no extra request. */}
      {loggedIn && lateOrders.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-amber-200 bg-surface shadow-card">
          <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-amber-900">
              <AlertIcon />
              {t('dashboard_page.late_orders_title', { count: lateOrders.length })}
            </h2>
            <span className="text-xs font-semibold text-amber-800">
              {t('dashboard_page.late_orders_threshold', { count: alertThresholdMinutes ?? 0 })}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-100 text-[11px] font-bold uppercase tracking-[0.08em] text-stone-500">
                  <th className="px-5 py-2.5 text-start">{t('dashboard_page.col_order')}</th>
                  <th className="px-5 py-2.5 text-start">{t('dashboard_page.col_status')}</th>
                  <th className="w-32 px-5 py-2.5 text-end">{t('dashboard_page.col_waiting')}</th>
                  <th className="w-28 px-5 py-2.5 text-end">{t('dashboard_page.col_total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lateOrders.slice(0, DASHBOARD_LATE_LIMIT).map(({ order: o, minutes }) => (
                  <tr key={o.id} className="hover:bg-stone-50">
                    <td className="px-5 py-2.5">
                      <Link href="/orders" className="flex items-baseline gap-2 font-medium text-stone-900 hover:underline">
                        {o.dailyNumber !== null && <span className="tabular text-xs text-stone-400">#{o.dailyNumber}</span>}
                        <span className="truncate" title={o.customer ?? undefined}>
                          {o.customer !== null && o.customer !== '' ? o.customer : t('orders_page.walk_in')}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-2.5 text-xs font-semibold text-stone-600">
                      {t(`orders_page.status_${o.status.toLowerCase()}`)}
                    </td>
                    <td className="tabular px-5 py-2.5 text-end font-bold text-amber-800">{formatElapsed(minutes, tt)}</td>
                    <td className="tabular px-5 py-2.5 text-end text-stone-700">{Number(o.totalAmount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lateOrders.length > DASHBOARD_LATE_LIMIT && (
            <p className="px-5 py-2.5 text-xs text-stone-500">
              {t('dashboard_page.late_orders_more', { count: lateOrders.length - DASHBOARD_LATE_LIMIT })}
            </p>
          )}
        </div>
      )}

      {products.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-surface shadow-card">
          <div className="flex items-center justify-between gap-2 p-5 pb-3">
            <h2 className="text-base font-bold text-stone-900">{t('dashboard_page.inventory_title')}</h2>
            <Link href="/inventory" className="text-xs font-semibold text-brand-700 hover:underline">
              {t('dashboard_page.go_to_inventory')}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-stone-200 bg-stone-100 text-[11px] font-bold uppercase tracking-[0.08em] text-stone-500">
                  <th className="px-5 py-2.5 text-start">{t('dashboard_page.col_product')}</th>
                  <th className="w-32 px-5 py-2.5 text-end">{t('dashboard_page.col_in_stock')}</th>
                  <th className="w-32 px-5 py-2.5 text-end">{t('dashboard_page.col_status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {products.slice(0, DASHBOARD_INVENTORY_LIMIT).map(p => {
                  const low = isLowStock(p)
                  return (
                    <tr key={p.id}>
                      <td className="px-5 py-2.5 font-semibold text-stone-900" title={p.name}>{p.name}</td>
                      <td className="tabular whitespace-nowrap px-5 py-2.5 text-end text-stone-700">
                        {Number(p.stockKg).toFixed(1)} {p.unit}
                      </td>
                      <td className="px-5 py-2.5 text-end">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          low ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-700'
                        }`}>
                          {low ? t('dashboard_page.status_low') : t('dashboard_page.status_healthy')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loggedIn && orders !== null && orders.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-surface p-5 shadow-card">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-stone-500">{t('dashboard_page.revenue_chart_title')}</h2>
                {/* The headline the chart was missing. A trend line answers
                    "which way", never "how much" — you had to read values off
                    an axis to get the one number anyone asks for. */}
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="tabular text-2xl font-extrabold tracking-tight text-stone-900">
                    {revenueTrend.total.toFixed(2)}
                  </p>
                  {revenueTrend.deltaPercent !== null && (
                    <span className={`tabular inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                      revenueTrend.deltaPercent >= 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-800'
                    }`}>
                      {revenueTrend.deltaPercent >= 0 ? '▲' : '▼'}
                      {Math.abs(revenueTrend.deltaPercent).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-stone-400">
                  {t('dashboard_page.vs_previous_period', { count: rangeDays })}
                </p>
              </div>
              <div className="flex gap-1 rounded-lg bg-stone-100 p-0.5 text-xs font-medium">
                {RANGE_OPTIONS.map(d => (
                  <button key={d} onClick={() => setRangeDays(d)}
                    className={`seg-item ${rangeDays === d ? 'seg-item-active' : ''}`}>
                    {t('dashboard_page.days', { count: d })}
                  </button>
                ))}
              </div>
            </div>
            {/* v3.2: area with a gradient fade rather than a bare 2px line.
                The filled shape carries the magnitude, which a hairline
                doesn't, and it survives the small size these render at on a
                phone. Horizontal grid only — vertical lines on a time axis
                are decoration; nobody reads a date off a gridline. */}
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueByDay} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.series} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={CHART.series} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="4 6" stroke={CHART.grid} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.tick, fontWeight: 600 }}
                  tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tick={{ fontSize: 11, fill: CHART.tick, fontWeight: 600 }}
                  tickLine={false} axisLine={false} width={52} tickFormatter={compactNumber} />
                <Tooltip
                  cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
                  content={<ChartTooltip format={(value) => value.toFixed(2)} />}
                />
                <Area type="monotone" dataKey="revenue" stroke={CHART.series} strokeWidth={2.5}
                  fill="url(#revenueFill)"
                  // No dots at rest — thirty of them on a 30-day range is
                  // clutter. One appears under the cursor, which is when a
                  // specific day is actually being asked about.
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.tooltipBg, fill: CHART.series }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-stone-200 bg-surface p-5 shadow-card">
            <h2 className="text-sm font-semibold text-stone-500">{t('dashboard_page.top_products_chart_title')}</h2>
            <p className="mt-0.5 mb-3 text-xs text-stone-400">{t('dashboard_page.top_products_subtitle')}</p>
            {topProducts.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-stone-400">{t('dashboard_page.no_sales_yet')}</div>
            ) : (
              // Ranked bars with the figure printed on the bar. Reading a
              // weight off an axis was always a worse way to answer "how much
              // lamb" than simply writing it down, so the axis is gone and the
              // number moved onto the row. The unfilled track behind each bar
              // shows the share of the leader at a glance.
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topProducts} layout="vertical" barCategoryGap="22%"
                  margin={{ top: 0, right: 44, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="topProductFill" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={CHART.series} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={CHART.series} stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={104}
                    tick={{ fontSize: 12, fill: CHART.ink, fontWeight: 600 }}
                    tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: CHART.grid, opacity: 0.5 }}
                    content={<ChartTooltip format={(value) => `${value} ${t('new_order_page.kg_label')}`} />} />
                  {/* The track takes no radius: Recharts types `background`
                      as a plain Rectangle whose `radius` must satisfy both
                      the tuple and `number`, which nothing can. Square ends
                      on a 20px-tall track behind a 4px-rounded bar is not a
                      difference anyone will see. */}
                  <Bar dataKey="kg" fill="url(#topProductFill)" radius={BAR_RADIUS}
                    background={{ fill: CHART.grid }} isAnimationActive={false}>
                    <LabelList dataKey="kg" position="right" offset={8}
                      style={{ fill: CHART.ink, fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/orders/new"
          className="btn btn-primary"
        >
          {t('new_order')}
        </Link>
        <Link
          href="/orders"
          className="btn btn-secondary"
        >
          {t('dashboard_page.go_to_orders')}
        </Link>
        <Link
          href="/inventory"
          className="btn btn-secondary"
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
      className="block rounded-xl border border-stone-200 bg-surface p-5 shadow-card card-hover"
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
