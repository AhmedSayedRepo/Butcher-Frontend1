// Fix (ADR-003): backend returns a bare Order[] array with camelCase fields,
// not { orders: [...] } with customer_name/total_amount. Updated to match.
//
// v2 replan (Phase C): rebuilt from a flat list into a kanban board —
// Created → In Progress → On the Way → In Premise, plus a separate Drafts
// section (draft orders haven't consumed stock yet and aren't really "in
// the pipeline", see the plan). Moving a card between columns needs the
// `manage_orders` capability (backend/src/routes/orders.ts's PATCH
// /:id/status); everyone logged in can still promote their own drafts,
// since that's the same permission level as creating an order in the first
// place (POST /api/orders only ever required plain auth).
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { extractApiErrorMessage } from '../../lib/apiError'
import { useAuth } from '../../lib/useAuth'
import { Order, OrderStatus } from '../../lib/types'

const COLUMNS: { status: OrderStatus, key: string }[] = [
  { status: 'CREATED', key: 'created' },
  { status: 'IN_PROGRESS', key: 'in_progress' },
  { status: 'ON_THE_WAY', key: 'on_the_way' },
  { status: 'IN_PREMISE', key: 'in_premise' }
]

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  CREATED: 'IN_PROGRESS',
  IN_PROGRESS: 'ON_THE_WAY',
  ON_THE_WAY: 'IN_PREMISE'
}

export default function OrdersPage() {
  const { t } = useTranslation()
  const user = useAuth()
  const loggedIn = !!user
  const canManageOrders = user != null && Array.isArray(user.caps) && user.caps.includes('manage_orders')

  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function load() {
    api.get<Order[]>('/api/orders')
      .then(r => setOrders(r.data))
      .catch((e) => {
        setOrders([])
        // A 401 here just means "not logged in" — the `!loggedIn` branch
        // below already renders a dedicated "please log in" placeholder, so
        // showing the generic red error banner on top of it would be
        // redundant/confusing. Only surface the banner for real failures.
        if (e?.response?.status !== 401) {
          setError(t('orders_page.failed_to_load'))
        }
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is defined fresh each render but only needs to run once on mount.
  }, [])

  const drafts = orders.filter(o => o.status === 'DRAFT')
  const byColumn = (status: OrderStatus) => orders.filter(o => o.status === status)

  async function advance(order: Order) {
    const next = NEXT_STATUS[order.status]
    if (next === undefined) return
    setError(null)
    setBusyId(order.id)
    try {
      await api.patch(`/api/orders/${order.id}/status`, { status: next })
      load()
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? t('orders_page.error_status'))
    } finally {
      setBusyId(null)
    }
  }

  async function cancel(order: Order) {
    setError(null)
    setBusyId(order.id)
    try {
      await api.patch(`/api/orders/${order.id}/status`, { status: 'CANCELLED' })
      load()
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? t('orders_page.error_status'))
    } finally {
      setBusyId(null)
    }
  }

  async function promote(order: Order) {
    setError(null)
    setBusyId(order.id)
    try {
      await api.post(`/api/orders/${order.id}/promote`)
      load()
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? t('orders_page.error_promote'))
    } finally {
      setBusyId(null)
    }
  }

  function OrderCard({ order }: { order: Order }) {
    const next = NEXT_STATUS[order.status]
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-card">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-stone-900">{order.customer || t('orders_page.walk_in')}</p>
          <span className="shrink-0 text-sm font-semibold text-stone-900">{Number(order.totalAmount).toFixed(2)}</span>
        </div>
        <p className="mb-2 text-xs text-stone-500">{new Date(order.createdAt).toLocaleString()}</p>
        {canManageOrders && next !== undefined && (
          <div className="flex gap-2">
            <button onClick={() => advance(order)} disabled={busyId === order.id}
              className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50">
              {t('orders_page.advance_to', { status: t(`orders_page.status_${NEXT_STATUS[order.status]?.toLowerCase()}`) })}
            </button>
            <button onClick={() => cancel(order)} disabled={busyId === order.id}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
              {t('orders_page.cancel_order')}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{t('orders')}</h1>
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

      {!loggedIn ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">{t('orders_page.please_login')}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">{t('orders_page.no_orders')}</p>
        </div>
      ) : (
        <>
          {drafts.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{t('orders_page.drafts')}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {drafts.map(o => (
                  <div key={o.id} className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-stone-900">{o.customer || t('orders_page.walk_in')}</p>
                      <span className="shrink-0 text-sm font-semibold text-stone-900">{Number(o.totalAmount).toFixed(2)}</span>
                    </div>
                    {/* v3 replan (Phase I): source badge for every non-cashier
                        source, not just WhatsApp — in_premise orders don't
                        get a badge (they're the walk-in default, same as
                        before this phase). */}
                    {o.source !== 'cashier' && o.source !== 'in_premise' && (
                      <span className={`mb-1 inline-block rounded-full px-1.5 py-0.5 text-xs font-medium ${
                        o.source === 'whatsapp' ? 'bg-green-50 text-green-700' : 'bg-sky-50 text-sky-700'
                      }`}>
                        {t(`orders_page.source_${o.source}`)}
                      </span>
                    )}
                    {o.customerMessage && (
                      <p className="mb-1 line-clamp-2 text-xs italic text-stone-500">&ldquo;{o.customerMessage}&rdquo;</p>
                    )}
                    {o.deliveryAddress && (
                      <p className="mb-2 line-clamp-1 text-xs text-stone-500">📍 {o.deliveryAddress}</p>
                    )}
                    <button onClick={() => promote(o)} disabled={busyId === o.id}
                      className="mt-1 rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                      {busyId === o.id ? t('orders_page.promoting') : t('orders_page.promote')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {COLUMNS.map(col => (
              <div key={col.status}>
                <h2 className="mb-2 flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-stone-500">
                  {t(`orders_page.status_${col.key}`)}
                  <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-xs font-normal text-stone-500">
                    {byColumn(col.status).length}
                  </span>
                </h2>
                <div className="space-y-2">
                  {byColumn(col.status).map(o => <OrderCard key={o.id} order={o} />)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
