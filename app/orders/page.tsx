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
//
// v3.1 follow-up 6 (final order state + receipt confirmation): added a
// COMPLETED column — the one true "done" state. IN_PREMISE reaches it with
// a plain manual button (same as every other transition); ON_THE_WAY can
// only reach it by scanning the order's receipt code (POST
// /:id/scan-receipt), since a delivery order's cash isn't confirmed until
// the receipt physically comes back — see backend/src/routes/orders.ts's
// PATCH /:id/status guard for the server-side half of that rule. Also
// added a click-to-open detail popup (every card, not just drafts) showing
// the full order — source/address/message were previously draft-only —
// and that popup is where the scan-receipt/mark-completed actions live.
'use client'
import { useState, useEffect } from 'react'
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
  { status: 'IN_PREMISE', key: 'in_premise' },
  { status: 'COMPLETED', key: 'completed' }
]

// v3.1 follow-up: ON_THE_WAY and IN_PREMISE are alternate terminal branches
// (delivery vs. walk-in/pickup), not a forced chain — a delivery order was
// previously stuck being marched through "On the Way" *then* "In Premise"
// even though it never physically sits in the shop, and an in-premise order
// had no path to "On the Way" at all. IN_PROGRESS now offers both as a
// branching choice; the backend already allowed setting either status
// regardless of the current one (routes/orders.ts's PROMOTABLE_STATUSES),
// so this was purely a frontend restriction.
//
// v3.1 follow-up 6: IN_PREMISE now also offers COMPLETED as a normal manual
// button, same as everything else here. ON_THE_WAY deliberately has no
// entry — there is no quick button to complete a delivery order; the only
// path is the receipt-scan flow inside the detail popup (see
// OrderDetailModal below), enforced both here and server-side.
const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  CREATED: ['IN_PROGRESS'],
  IN_PROGRESS: ['ON_THE_WAY', 'IN_PREMISE'],
  IN_PREMISE: ['COMPLETED']
}

export default function OrdersPage() {
  const { t } = useTranslation()
  const user = useAuth()
  const loggedIn = !!user
  const canManageOrders = user != null && Array.isArray(user.caps) && user.caps.includes('manage_orders')

  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)

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

  // Keeps the open popup showing live data after `load()` refreshes the
  // board (e.g. right after a scan/complete/cancel action) instead of a
  // stale snapshot from when it was opened.
  useEffect(() => {
    if (detailOrder === null) return
    const fresh = orders.find(o => o.id === detailOrder.id)
    if (fresh !== undefined && fresh !== detailOrder) setDetailOrder(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when `orders` changes; re-running on `detailOrder` itself would loop.
  }, [orders])

  const drafts = orders.filter(o => o.status === 'DRAFT')
  const byColumn = (status: OrderStatus) => orders.filter(o => o.status === status)

  async function advance(order: Order, next: OrderStatus) {
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

  // v3.1 follow-up 6: source badge + delivery address + customer message —
  // used to be draft-card-only. Now shared by every card in every status
  // column too.
  function OrderMeta({ order }: { order: Order }) {
    return (
      <>
        {order.source !== 'cashier' && order.source !== 'in_premise' && (
          <span className={`mb-1 inline-block rounded-full px-1.5 py-0.5 text-xs font-medium ${
            order.source === 'whatsapp' ? 'bg-green-50 text-green-700' : 'bg-sky-50 text-sky-700'
          }`}>
            {t(`orders_page.source_${order.source}`)}
          </span>
        )}
        {order.deliveryAddress && (
          <p className="line-clamp-1 text-xs text-stone-500">📍 {order.deliveryAddress}</p>
        )}
      </>
    )
  }

  function OrderCard({ order }: { order: Order }) {
    const nextOptions = NEXT_STATUSES[order.status] ?? []
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setDetailOrder(order)}
        onKeyDown={e => { if (e.key === 'Enter') setDetailOrder(order) }}
        className="cursor-pointer rounded-lg border border-stone-200 bg-white p-3 shadow-card transition-shadow hover:shadow-card-hover"
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-stone-900">
            {order.dailyNumber !== null && <span className="text-stone-400">#{order.dailyNumber} · </span>}
            {order.customer || t('orders_page.walk_in')}
          </p>
          <span className="shrink-0 text-sm font-semibold text-stone-900">{Number(order.totalAmount).toFixed(2)}</span>
        </div>
        <p className="mb-1 text-xs text-stone-500">{new Date(order.createdAt).toLocaleString()}</p>
        <div className="mb-2">
          <OrderMeta order={order} />
        </div>
        {canManageOrders && (nextOptions.length > 0 || order.status !== 'COMPLETED') && (
          // v3.1 follow-up: Cancel is no longer bundled behind "has a next
          // status" — previously that meant ON_THE_WAY/IN_PREMISE orders
          // (both now terminal branches, not just IN_PREMISE) had no
          // actions at all once they got there. Any non-cancelled,
          // non-completed order can be cancelled regardless of stage; only
          // the advance button(s) depend on what's next. ON_THE_WAY
          // deliberately has no advance button here — see OrderDetailModal.
          <div className="flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
            {nextOptions.map((next) => (
              <button key={next} onClick={() => advance(order, next)} disabled={busyId === order.id}
                className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50">
                {t('orders_page.advance_to', { status: t(`orders_page.status_${next.toLowerCase()}`) })}
              </button>
            ))}
            {order.status !== 'COMPLETED' && (
              <button onClick={() => cancel(order)} disabled={busyId === order.id}
                className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                {t('orders_page.cancel_order')}
              </button>
            )}
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
                      <p className="truncate text-sm font-medium text-stone-900">
                        {o.dailyNumber !== null && <span className="text-stone-400">#{o.dailyNumber} · </span>}
                        {o.customer || t('orders_page.walk_in')}
                      </p>
                      <span className="shrink-0 text-sm font-semibold text-stone-900">{Number(o.totalAmount).toFixed(2)}</span>
                    </div>
                    <OrderMeta order={o} />
                    {o.customerMessage && (
                      <p className="mb-1 mt-1 line-clamp-2 text-xs italic text-stone-500">&ldquo;{o.customerMessage}&rdquo;</p>
                    )}
                    <button onClick={() => promote(o)} disabled={busyId === o.id}
                      className="mt-2 rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                      {busyId === o.id ? t('orders_page.promoting') : t('orders_page.promote')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

      {detailOrder !== null && (
        <OrderDetailModal
          order={detailOrder}
          canManageOrders={canManageOrders}
          busy={busyId === detailOrder.id}
          onClose={() => setDetailOrder(null)}
          onAdvance={(next) => advance(detailOrder, next)}
          onCancel={() => cancel(detailOrder)}
          onReload={load}
        />
      )}
    </div>
  )
}

// v3.1 follow-up 6. Full order details on click, plus the two ways a
// fulfillment order reaches COMPLETED: a plain button for IN_PREMISE, and
// the receipt-scan confirmation for ON_THE_WAY (the only path — see the
// backend guard in routes/orders.ts's PATCH /:id/status).
function OrderDetailModal({
  order, canManageOrders, busy, onClose, onAdvance, onCancel, onReload
}: {
  order: Order
  canManageOrders: boolean
  busy: boolean
  onClose: () => void
  onAdvance: (next: OrderStatus) => void
  onCancel: () => void
  onReload: () => void
}) {
  const { t } = useTranslation()
  const [scanCode, setScanCode] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  async function confirmReceipt() {
    const code = scanCode.trim()
    if (code === '') return
    setScanning(true)
    setScanError(null)
    try {
      await api.post(`/api/orders/${order.id}/scan-receipt`, { code })
      setScanCode('')
      onReload()
      onClose()
    } catch (err) {
      setScanError(extractApiErrorMessage(err) ?? t('orders_page.error_scan_receipt'))
    } finally {
      setScanning(false)
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-card-hover"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              {order.dailyNumber !== null && <span className="text-stone-400">#{order.dailyNumber} · </span>}
              {order.customer || t('orders_page.walk_in')}
            </h2>
            <p className="text-xs text-stone-500">{new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
            {t(`orders_page.status_${order.status.toLowerCase()}`)}
          </span>
          <OrderMetaStandalone order={order} />
        </div>

        {order.customerMessage && (
          <p className="mb-3 rounded-lg bg-stone-50 p-2 text-xs italic text-stone-600">&ldquo;{order.customerMessage}&rdquo;</p>
        )}

        <div className="mb-3 rounded-lg border border-stone-200">
          <ul className="divide-y divide-stone-100">
            {order.items.map(item => (
              <li key={item.id} className="flex justify-between px-3 py-2 text-sm">
                <span className="text-stone-700">{item.product?.name ?? '—'} · {Number(item.kg).toFixed(3)} kg</span>
                <span className="font-medium text-stone-900">{Number(item.price).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-stone-200 px-3 py-2 text-sm font-semibold text-stone-900">
            <span>{t('new_order_page.total')}</span>
            <span>{Number(order.totalAmount).toFixed(2)}</span>
          </div>
        </div>

        <p className="mb-4 text-xs text-stone-500">{t('orders_page.payment_method_label')}: {order.paymentMethod}</p>

        {canManageOrders && order.status === 'ON_THE_WAY' && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-sm font-medium text-amber-800">{t('orders_page.scan_receipt_label')}</p>
            <p className="mb-2 text-xs text-amber-700">{t('orders_page.scan_receipt_hint')}</p>
            {scanError !== null && <p className="mb-2 text-xs text-red-600">{scanError}</p>}
            <div className="flex gap-2">
              <input
                className={inputClasses}
                value={scanCode}
                onChange={e => setScanCode(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void confirmReceipt() } }}
                placeholder={t('orders_page.scan_receipt_placeholder')}
                autoComplete="off"
              />
              <button onClick={() => void confirmReceipt()} disabled={scanning || scanCode.trim() === ''}
                className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
                {scanning ? t('orders_page.scanning') : t('orders_page.scan_receipt_button')}
              </button>
            </div>
          </div>
        )}

        {canManageOrders && (
          <div className="flex flex-wrap gap-2">
            {(NEXT_STATUSES[order.status] ?? []).map((next) => (
              <button key={next} onClick={() => onAdvance(next)} disabled={busy}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {t('orders_page.advance_to', { status: t(`orders_page.status_${next.toLowerCase()}`) })}
              </button>
            ))}
            {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
              <button onClick={onCancel} disabled={busy}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                {t('orders_page.cancel_order')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Small standalone copy of the OrdersPage-local OrderMeta (source badge +
// address) — this component lives outside OrdersPage's closure, so it
// can't reuse that one directly.
function OrderMetaStandalone({ order }: { order: Order }) {
  const { t } = useTranslation()
  return (
    <>
      {order.source !== 'cashier' && order.source !== 'in_premise' && (
        <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
          order.source === 'whatsapp' ? 'bg-green-50 text-green-700' : 'bg-sky-50 text-sky-700'
        }`}>
          {t(`orders_page.source_${order.source}`)}
        </span>
      )}
      {order.deliveryAddress && (
        <span className="text-xs text-stone-500">📍 {order.deliveryAddress}</span>
      )}
    </>
  )
}
