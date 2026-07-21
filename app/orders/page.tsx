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
import PageHeader from '../../components/PageHeader'
import { translateApiError } from '../../lib/apiError'
import { useAuth } from '../../lib/useAuth'
import { Order, OrderStatus, Product, ShopSettings } from '../../lib/types'
import Receipt from '../../components/Receipt'
import Spinner from '../../components/Spinner'
import { formatElapsed, minutesSince, statusEnteredAt } from '../../lib/elapsed'

const COLUMNS: { status: OrderStatus, key: string }[] = [
  { status: 'CREATED', key: 'created' },
  { status: 'IN_PROGRESS', key: 'in_progress' },
  { status: 'ON_THE_WAY', key: 'on_the_way' },
  { status: 'IN_PREMISE', key: 'in_premise' },
  { status: 'COMPLETED', key: 'completed' }
]

// Statuses whose dwell time is worth a clock on the card — everything that is
// still someone's problem. See statusMinutes() below.
const TIMED_STATUSES: OrderStatus[] = ['CREATED', 'IN_PROGRESS', 'ON_THE_WAY']

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

// A minute is the smallest unit the timer displays, so a 30s tick is enough to
// keep it honest without re-rendering the board constantly.
const ELAPSED_TICK_MS = 30 * 1000

// A 401 on the board's own load just means "not signed in", which the page
// already handles with a dedicated placeholder — see the catch in load().
const UNAUTHORIZED_STATUS = 401

export default function OrdersPage() {
  const { t } = useTranslation()
  const user = useAuth()
  const loggedIn = !!user
  const canManageOrders = user != null && Array.isArray(user.caps) && user.caps.includes('manage_orders')

  // v3.1 follow-up 10k: "no rows yet" and "haven't asked yet" are different
  // answers. Starts true — the fetch fires on mount, so loading is the truth
  // on the very first render.
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  // v3.1 follow-up 10. `products` is only needed to add a line to a draft, so
  // it's fetched once here rather than by each modal instance. `printOrder`
  // renders a hidden Receipt and prints it — see printReceipt() below.
  const [products, setProducts] = useState<Product[]>([])
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null)
  const [printOrder, setPrintOrder] = useState<Order | null>(null)
  // Ticks the on-the-way timers. Independent of the order fetch so the figure
  // ages on screen instead of jumping whenever the board reloads.
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => { setNowMs(Date.now()) }, ELAPSED_TICK_MS)
    return () => { clearInterval(id) }
  }, [])

  function load() {
    api.get<Order[]>('/api/orders')
      .then(r => setOrders(r.data))
      .catch((e) => {
        setOrders([])
        // A 401 here just means "not logged in" — the `!loggedIn` branch
        // below already renders a dedicated "please log in" placeholder, so
        // showing the generic red error banner on top of it would be
        // redundant/confusing. Only surface the banner for real failures.
        if (e?.response?.status !== UNAUTHORIZED_STATUS) {
          setError(translateApiError(e, t, t('orders_page.failed_to_load')))
        }
      })
      .finally(() => setLoadingOrders(false))
  }

  useEffect(() => {
    load()
    api.get<Product[]>('/api/products').then(r => setProducts(r.data)).catch(() => setProducts([]))
    api.get<ShopSettings>('/api/shop-settings').then(r => setShopSettings(r.data)).catch(() => setShopSettings(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is defined fresh each render but only needs to run once on mount.
  }, [])

  // Printing an existing order's receipt from the board. The Receipt is
  // rendered off-screen, then `window.print()` fires once React has committed
  // it — hence the rAF rather than calling print() straight after setState,
  // which would print the previous frame (i.e. nothing).
  //
  // Deliberately not a new window/tab: popup blockers eat those, and the
  // existing @media print rules in globals.css already isolate the slip from
  // the rest of the page.
  function printReceipt(order: Order) {
    setPrintOrder(order)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print()
        setPrintOrder(null)
      })
    })
  }

  // Keeps the open popup showing live data after `load()` refreshes the
  // board (e.g. right after a scan/complete/cancel action) instead of a
  // stale snapshot from when it was opened.
  useEffect(() => {
    if (detailOrder === null) return
    const fresh = orders.find(o => o.id === detailOrder.id)
    if (fresh !== undefined && fresh !== detailOrder) setDetailOrder(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when `orders` changes; re-running on `detailOrder` itself would loop.
  }, [orders])

  // `t` typed loosely for formatElapsed, which takes a plain (key, vars) fn so
  // it stays testable without a translation runtime.
  const tt = (key: string, vars?: Record<string, number>): string => t(key, vars ?? {})
  const deliveryLabel = shopSettings?.deliveryNameLabel ?? t('orders_page.delivery_name_fallback')

  // v3.1 follow-up 10f: every order still moving through the board is timed,
  // not just deliveries. A ticket sitting in "in progress" for two hours is
  // exactly as much of a problem as a van that hasn't come back, and the board
  // gave no hint of it. Terminal columns (completed/cancelled) are excluded —
  // a finished order's age isn't actionable.
  //
  // Timed from the *status* event, so the clock restarts on each transition
  // and answers "how long has it been stuck here", not "how old is it".
  // CREATED falls back to createdAt because an order's first status may
  // predate the audit trail (rows created before Phase D shipped).
  function statusMinutes(order: Order): number | null {
    if (!TIMED_STATUSES.includes(order.status)) return null
    const at = statusEnteredAt(order, order.status)
      ?? (order.status === 'CREATED' ? new Date(order.createdAt) : null)
    return at === null ? null : minutesSince(at, nowMs)
  }
  function isOverdue(order: Order): boolean {
    const mins = statusMinutes(order)
    const threshold = shopSettings?.pendingOrderAlertMinutes
    return mins !== null && threshold !== undefined && mins >= threshold
  }

  const drafts = orders.filter(o => o.status === 'DRAFT')
  // v3.1 follow-up 10g: the live columns are queues, so they're sorted
  // oldest-first — the order that has been waiting longest sits at the top,
  // which is the one to pick up next. Sorted by how long it's been in *this*
  // status (the same figure the card's timer shows) rather than by createdAt,
  // so a card can't sit above another with a smaller number on it.
  //
  // Terminal columns keep newest-first: for completed and in-premise orders
  // the useful question is "what just happened", not "what's been waiting".
  const byColumn = (status: OrderStatus) => {
    const rows = orders.filter(o => o.status === status)
    if (!TIMED_STATUSES.includes(status)) return rows
    return [...rows].sort((a, b) => {
      const waited = (statusMinutes(b) ?? 0) - (statusMinutes(a) ?? 0)
      if (waited !== 0) return waited
      // Tiebreak by age, oldest first.
      //
      // Dwell time is whole minutes, so two orders moved into a status in the
      // same minute — which is what happens when someone advances several at
      // once — compare equal. A stable sort then leaves them in the order the
      // API sent them, which is newest-first, and the column looks like it
      // isn't sorted at all. That's exactly what it looked like.
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }

  async function advance(order: Order, next: OrderStatus) {
    setError(null)
    setBusyId(order.id)
    try {
      await api.patch(`/api/orders/${order.id}/status`, { status: next })
      load()
    } catch (err) {
      setError(translateApiError(err, t, t('orders_page.error_status')))
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
      setError(translateApiError(err, t, t('orders_page.error_status')))
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
      setError(translateApiError(err, t, t('orders_page.error_promote')))
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
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
            order.source === 'whatsapp' ? 'bg-green-50 text-green-700' : 'bg-sky-50 text-sky-700'
          }`}>
            {t(`orders_page.source_${order.source}`)}
          </span>
        )}
        {order.deliveryAddress && (
          // Full address in a tooltip — one line is all a kanban card can
          // spare, but the whole point of the field is the detail it holds.
          <p className="line-clamp-1 min-w-0 text-xs text-stone-500" title={order.deliveryAddress}>
            📍 {order.deliveryAddress}
          </p>
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
        className="cursor-pointer rounded-lg border border-stone-200 bg-surface p-3 shadow-card card-hover"
      >
        {/* Alignment: the order number is pulled out as its own fixed-width
            leading chip so customer names start on a common left edge instead
            of being pushed around by "#4" vs "#182". The name gets the flexible
            middle (and a tooltip, since it's the field most likely to truncate
            — "…ed Ibrahim" tells you nothing on its own), and the amount is
            pinned to the trailing edge in tabular figures so the decimal points
            line up down the column. */}
        <div className="mb-1.5 flex items-baseline gap-2">
          {order.dailyNumber !== null && (
            <span className="tabular shrink-0 text-xs font-bold text-stone-400">#{order.dailyNumber}</span>
          )}
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-900" title={order.customer || t('orders_page.walk_in')}>
            {order.customer || t('orders_page.walk_in')}
          </p>
          <span className="tabular shrink-0 text-sm font-bold text-stone-900">
            {Number(order.totalAmount).toFixed(2)}
          </span>
        </div>
        <p
          className="tabular mb-2 text-xs text-stone-500"
          title={new Date(order.createdAt).toLocaleString()}
        >
          {new Date(order.createdAt).toLocaleString()}
        </p>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <OrderMeta order={order} />
        </div>
        {/* How long this order has sat in its current status. Timed from the
            status event, not from createdAt — an order raised at 09:00 and
            dispatched at 14:00 has been out since 14:00. Amber past the shop's
            own pending-order threshold, so "too long" is the same number the
            dashboard alerts on rather than a second hardcoded one. */}
        {statusMinutes(order) !== null && (
          <p className={`tabular mb-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
            isOverdue(order) ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-600'
          }`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
            </svg>
            {formatElapsed(statusMinutes(order) ?? 0, tt)}
          </p>
        )}
        {order.deliveryName !== null && order.deliveryName !== undefined && order.deliveryName !== '' && (
          <p className="mb-2 truncate text-xs text-stone-500" title={`${deliveryLabel}: ${order.deliveryName}`}>
            <span className="font-semibold">{deliveryLabel}:</span> {order.deliveryName}
          </p>
        )}
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
                title={t('orders_page.advance_to', { status: t(`orders_page.status_${next.toLowerCase()}`) })}
                className="btn btn-ghost-brand btn-sm">
                {t('orders_page.advance_to', { status: t(`orders_page.status_${next.toLowerCase()}`) })}
              </button>
            ))}
            {order.status !== 'COMPLETED' && (
              <button onClick={() => cancel(order)} disabled={busyId === order.id}
                title={t('orders_page.cancel_order')}
                className="btn btn-ghost-danger btn-sm">
                {t('orders_page.cancel_order')}
              </button>
            )}
            {/* Reprint. Drafts are excluded: they have no receipt code and
                aren't a sale yet, so a slip for one would be misleading. */}
            {order.status !== 'DRAFT' && (
              <button onClick={() => printReceipt(order)}
                title={t('new_order_page.print_receipt')}
                aria-label={t('new_order_page.print_receipt')}
                className="btn btn-ghost btn-icon ms-auto">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <path d="M6 14h12v8H6z" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('orders')}
        code="OR"
        subtitle={t('orders_page.subtitle')}
        actions={
          <Link
            href="/orders/new"
            className="btn btn-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t('new_order')}
          </Link>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {!loggedIn ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-surface p-10 text-center">
          <p className="text-sm text-stone-500">{t('orders_page.please_login')}</p>
        </div>
      ) : loadingOrders ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-surface p-10 text-center">
          <p className="text-sm text-stone-500">{t('orders_page.no_orders')}</p>
        </div>
      ) : (
        <>
          {drafts.length > 0 && (
            <div className="mb-6 rounded-xl border border-stone-200 bg-stone-100/60 p-2.5">
              {/* Same panel + header treatment as the status columns below, so
                  the board reads as one thing rather than a styled list sitting
                  on top of a differently-styled board. */}
              <h2 className="mb-2.5 flex items-center gap-2.5 px-1 pb-2">
                <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-100 text-xs font-bold text-brand-800">
                  {drafts.length}
                </span>
                <span className="text-sm font-bold text-stone-900">{t('orders_page.drafts')}</span>
              </h2>
              {/* Same column count as the status board below (5 at xl), so a draft card
                  is the same width as every other order card. It was on a 4-column
                  grid, which made a single draft render noticeably wider than the
                  cards underneath it and read as a different kind of thing. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {drafts.map(o => (
                  // Bug fix: this card was a plain <div> with no click handler,
                  // so a draft could never open the detail modal — which is
                  // exactly where the edit/delete UI lives. It's now the same
                  // clickable, keyboard-reachable card as every other column.
                  <div
                    key={o.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailOrder(o)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailOrder(o) } }}
                    // Identical styling to the status-column cards. It used to
                    // be dashed-on-grey to signal "not real yet", but sitting on
                    // the same board as five columns of solid cards it just read
                    // as broken. The Draft column header and the Confirm button
                    // already say it's a draft.
                    className="cursor-pointer rounded-lg border border-stone-200 bg-surface p-3 shadow-card card-hover"
                  >
                    <div className="mb-1.5 flex items-baseline gap-2">
                      {o.dailyNumber !== null && (
                        <span className="tabular shrink-0 text-xs font-bold text-stone-400">#{o.dailyNumber}</span>
                      )}
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-900" title={o.customer || t('orders_page.walk_in')}>
                        {o.customer || t('orders_page.walk_in')}
                      </p>
                      <span className="tabular shrink-0 text-sm font-bold text-stone-900">{Number(o.totalAmount).toFixed(2)}</span>
                    </div>
                    <p className="tabular mb-2 text-xs text-stone-500" title={new Date(o.createdAt).toLocaleString()}>
                      {new Date(o.createdAt).toLocaleString()}
                    </p>
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <OrderMeta order={o} />
                    </div>
                    {o.customerMessage && (
                      <p className="mb-2 line-clamp-2 text-xs italic text-stone-500" title={o.customerMessage}>&ldquo;{o.customerMessage}&rdquo;</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => promote(o)} disabled={busyId === o.id}
                        title={t('orders_page.promote')}
                        className="btn btn-primary btn-sm">
                        {busyId === o.id ? t('orders_page.promoting') : t('orders_page.promote')}
                      </button>
                      <button onClick={() => setDetailOrder(o)}
                        title={t('orders_page.edit_draft')}
                        className="btn btn-ghost-brand btn-sm">
                        {t('orders_page.edit_draft')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* A horizontally scrolling board rather than a 5-up grid.
              Five equal columns inside the content area left each card about
              170px wide, which truncated the customer's name to "…him" — the
              end of a name, which is the least identifying part of it. Columns
              now have a real minimum width and the board scrolls sideways when
              they don't all fit, which is how every kanban handles this.
              Below `lg` it stays stacked, since a phone can't scroll two axes
              comfortably. */}
          <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2 max-lg:flex-col lg:snap-none">
            {COLUMNS.map(col => (
              // Each column is its own panel. The headers used to be bare <h2>s
              // sitting directly on the page background, which made them read as
              // one detached strip across the top of the board rather than as
              // five headers each belonging to the column under it — the header
              // and its cards had nothing visually tying them together.
              <div key={col.status} className="w-full shrink-0 snap-start rounded-xl border border-stone-200 bg-stone-100/60 p-2.5 lg:w-[19rem]">
                {/* Count chip + bold title, the way qa-studio's `ui.sec_head`
                    builds section headings. */}
                <h2 className="mb-2.5 flex items-center gap-2.5 px-1 pb-2">
                  <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-100 text-xs font-bold text-brand-800">
                    {byColumn(col.status).length}
                  </span>
                  <span className="text-sm font-bold text-stone-900">
                    {t(`orders_page.status_${col.key}`)}
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

      {/* Hidden except while printing — see printReceipt(). `fixed`/opacity-0
          rather than `display:none`, because a display:none subtree isn't laid
          out and the print stylesheet would find nothing to show. */}
      {printOrder !== null && (
        <div className="receipt-print-host pointer-events-none fixed -start-[9999px] top-0 opacity-0" aria-hidden="true">
          <Receipt
            order={printOrder}
            settings={shopSettings}
            labels={{
              receiptTitle: t('new_order_page.receipt_title'),
              walkIn: t('orders_page.walk_in'),
              total: t('new_order_page.total'),
              receiptCode: t('new_order_page.receipt_code_label'),
              kg: t('new_order_page.kg_label'),
              customer: t('receipt_labels.customer'),
              phone: t('receipt_labels.phone'),
              address: t('receipt_labels.address')
            }}
          />
        </div>
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
          products={products}
          onPrint={() => printReceipt(detailOrder)}
          onDeleted={() => { setDetailOrder(null); load() }}
          deliveryLabel={deliveryLabel}
          elapsedLabel={
            statusMinutes(detailOrder) !== null
              ? formatElapsed(statusMinutes(detailOrder) ?? 0, tt)
              : null
          }
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
  order, canManageOrders, busy, onClose, onAdvance, onCancel, onReload,
  products, onPrint, onDeleted, deliveryLabel, elapsedLabel
}: {
  order: Order
  canManageOrders: boolean
  busy: boolean
  onClose: () => void
  onAdvance: (next: OrderStatus) => void
  onCancel: () => void
  onReload: () => void
  products: Product[]
  onPrint: () => void
  onDeleted: () => void
  deliveryLabel: string
  elapsedLabel: string | null
}) {
  const { t } = useTranslation()
  const [scanCode, setScanCode] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  // v3.1 follow-up 10 — draft editing. Only drafts: they've never moved stock
  // or written a cash-ledger row, so an edit needs no reversal. The backend
  // enforces the same rule (routes/orderDrafts.ts) — this is just the UI half.
  const isDraft = order.status === 'DRAFT'
  const [editing, setEditing] = useState(false)
  const [editCustomer, setEditCustomer] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editItems, setEditItems] = useState<{ productId: string, kg: string }[]>([])
  const [editDeliveryName, setEditDeliveryName] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function startEditing() {
    setEditCustomer(order.customer ?? '')
    setEditAddress(order.deliveryAddress ?? '')
    setEditDeliveryName(order.deliveryName ?? '')
    setEditItems(order.items.map(i => ({ productId: i.productId, kg: Number(i.kg).toFixed(3) })))
    setSaveError(null)
    setEditing(true)
  }

  const editTotal = editItems.reduce((sum, line) => {
    const product = products.find(p => p.id === line.productId)
    const kg = Number(line.kg)
    if (product === undefined || !Number.isFinite(kg)) return sum
    return sum + Number(product.pricePerKg) * kg
  }, 0)

  async function saveDraft() {
    // Prices are recalculated server-side from the product table, so the total
    // shown while editing is only a preview — see routes/orderDrafts.ts.
    const items = editItems
      .map(line => ({ productId: line.productId, kg: Number(line.kg) }))
      .filter(line => Number.isFinite(line.kg) && line.kg > 0)
    if (items.length === 0) {
      setSaveError(t('orders_page.error_draft_needs_item'))
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await api.patch(`/api/orders/${order.id}`, {
        customer: editCustomer.trim() === '' ? null : editCustomer.trim(),
        deliveryAddress: editAddress.trim() === '' ? null : editAddress.trim(),
        deliveryName: editDeliveryName.trim() === '' ? null : editDeliveryName.trim(),
        items
      })
      setEditing(false)
      onReload()
    } catch (err) {
      setSaveError(translateApiError(err, t, t('orders_page.error_edit_draft')))
    } finally {
      setSaving(false)
    }
  }

  async function deleteDraft() {
    setSaving(true)
    setSaveError(null)
    try {
      await api.delete(`/api/orders/${order.id}`)
      onDeleted()
    } catch (err) {
      setSaveError(translateApiError(err, t, t('orders_page.error_delete_draft')))
      setSaving(false)
    }
  }

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
      setScanError(translateApiError(err, t, t('orders_page.error_scan_receipt')))
    } finally {
      setScanning(false)
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-surface p-5 shadow-card-hover"
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
          <div className="flex shrink-0 items-center gap-1">
            {order.status !== 'DRAFT' && (
              <button onClick={onPrint} title={t('new_order_page.print_receipt')} aria-label={t('new_order_page.print_receipt')}
                className="btn btn-ghost btn-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <path d="M6 14h12v8H6z" />
                </svg>
              </button>
            )}
            {isDraft && !editing && (
              <button onClick={startEditing} title={t('orders_page.edit_draft')}
                className="btn btn-ghost-brand btn-sm">
                {t('orders_page.edit_draft')}
              </button>
            )}
            <button onClick={onClose} title={t('orders_page.close')} aria-label={t('orders_page.close')}
              className="btn btn-ghost btn-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
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

        {editing ? (
          <div className="mb-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600">{t('new_order_page.customer_label')}</label>
              <input value={editCustomer} onChange={e => setEditCustomer(e.target.value)}
                placeholder={t('new_order_page.customer_placeholder')} autoComplete="off" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600">{t('new_order_page.delivery_address_label')}</label>
              <textarea value={editAddress} onChange={e => setEditAddress(e.target.value)} rows={2} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600">{deliveryLabel}</label>
              <input value={editDeliveryName} onChange={e => setEditDeliveryName(e.target.value)} autoComplete="off" />
            </div>

            <div className="rounded-lg border border-stone-200">
              <ul className="divide-y divide-stone-100">
                {editItems.map((line, index) => (
                  <li key={`${line.productId}-${index}`} className="flex items-center gap-2 p-2">
                    <select
                      className="min-w-0 flex-1"
                      value={line.productId}
                      onChange={e => setEditItems(items => items.map((l, i) => i === index ? { ...l, productId: e.target.value } : l))}
                    >
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input
                      className="w-24 shrink-0"
                      type="number" step="0.001" min="0" inputMode="decimal"
                      value={line.kg}
                      onChange={e => setEditItems(items => items.map((l, i) => i === index ? { ...l, kg: e.target.value } : l))}
                    />
                    <button type="button" title={t('new_order_page.remove')} aria-label={t('new_order_page.remove')}
                      onClick={() => setEditItems(items => items.filter((_, i) => i !== index))}
                      className="btn btn-ghost btn-icon shrink-0">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-stone-200 p-2">
                <button type="button" disabled={products.length === 0}
                  onClick={() => setEditItems(items => [...items, { productId: products[0]?.id ?? '', kg: '1' }])}
                  className="btn btn-ghost-brand btn-sm">
                  + {t('new_order_page.add_to_order')}
                </button>
                {/* Preview only — the server re-reads prices from the product
                    table when it saves, so a price change mid-edit wins. */}
                <span className="tabular text-sm font-bold text-stone-900">{editTotal.toFixed(2)}</span>
              </div>
            </div>

            {saveError !== null && <p className="text-xs text-red-600">{saveError}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => void saveDraft()} disabled={saving}
                className="btn btn-primary">
                {saving ? t('inventory_page.saving') : t('inventory_page.save')}
              </button>
              <button onClick={() => setEditing(false)} disabled={saving}
                className="btn btn-secondary">
                {t('inventory_page.cancel')}
              </button>
              <button onClick={() => setConfirmingDelete(true)} disabled={saving}
                className="btn btn-ghost-danger ms-auto">
                {t('orders_page.delete_draft')}
              </button>
            </div>

            {confirmingDelete && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="mb-2 text-xs text-red-700">{t('orders_page.confirm_delete_draft')}</p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirmingDelete(false)} disabled={saving}
                    className="rounded-md border border-stone-300 bg-surface px-2.5 py-1 text-xs font-semibold text-stone-700">
                    {t('inventory_page.cancel')}
                  </button>
                  <button onClick={() => void deleteDraft()} disabled={saving}
                    className="btn btn-danger btn-sm">
                    {t('orders_page.delete_draft')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-3 overflow-hidden rounded-lg border border-stone-200">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-stone-100">
                  {order.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-stone-700">{item.product?.name ?? '—'}</td>
                      <td className="tabular whitespace-nowrap px-2 py-2 text-end text-xs text-stone-500">{Number(item.kg).toFixed(3)} kg</td>
                      <td className="tabular whitespace-nowrap px-3 py-2 text-end font-semibold text-stone-900">{Number(item.price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-stone-200 bg-stone-50">
                    <td className="px-3 py-2 font-bold text-stone-900" colSpan={2}>{t('new_order_page.total')}</td>
                    <td className="tabular px-3 py-2 text-end font-bold text-stone-900">{Number(order.totalAmount).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-stone-500">{t('orders_page.payment_method_label')}</dt>
              <dd className="text-stone-700">{order.paymentMethod}</dd>
              {order.deliveryName !== null && order.deliveryName !== undefined && order.deliveryName !== '' && (
                <>
                  <dt className="text-stone-500">{deliveryLabel}</dt>
                  <dd className="text-stone-700">{order.deliveryName}</dd>
                </>
              )}
              {elapsedLabel !== null && (
                <>
                  <dt className="text-stone-500">{t('orders_page.on_the_way_for')}</dt>
                  <dd className="tabular font-semibold text-stone-700">{elapsedLabel}</dd>
                </>
              )}
              {order.receiptCode !== null && order.receiptCode !== '' && (
                <>
                  <dt className="text-stone-500">{t('new_order_page.receipt_code_label')}</dt>
                  <dd className="tabular tracking-widest text-stone-700">{order.receiptCode}</dd>
                </>
              )}
            </dl>
          </>
        )}

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
                className="btn btn-primary shrink-0">
                {scanning ? t('orders_page.scanning') : t('orders_page.scan_receipt_button')}
              </button>
            </div>
          </div>
        )}

        {canManageOrders && !editing && (
          <div className="flex flex-wrap gap-2">
            {(NEXT_STATUSES[order.status] ?? []).map((next) => (
              <button key={next} onClick={() => onAdvance(next)} disabled={busy}
                className="btn btn-primary">
                {t('orders_page.advance_to', { status: t(`orders_page.status_${next.toLowerCase()}`) })}
              </button>
            ))}
            {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
              <button onClick={onCancel} disabled={busy}
                className="btn btn-ghost-danger">
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
