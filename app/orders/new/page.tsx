// Phase 3: new-order / cashier screen. Pick a product, enter kg, add to the
// cart, see a live total, submit POST /api/orders. Backend (routes/orders.ts)
// already validates stock and computes price server-side — this page mirrors
// that math for the live total but always trusts the server's response/errors
// as the source of truth (e.g. "Insufficient stock for X" comes back verbatim,
// untranslated — it names a real product by its stored name, not UI copy).
//
// v2 replan (Phase E — cashier module polish):
// - Recent products: the last few distinct products added this session are
//   pinned above the picker as quick-tap buttons — session-only (not
//   persisted), since "recent" for a cashier mid-shift is what they just
//   rang up, not a long-term preference to sync across devices.
// - Kg quick-presets: common weights (0.25/0.5/1/2/5 kg) as large tap
//   targets, since the plain number input alone is awkward on a shop
//   tablet/register (the plan's "current version is fine on desktop,
//   awkward on a shop tablet" note).
// - Receipt: after a real (non-draft) submit, shows a printable order
//   summary instead of redirecting immediately — window.print() via
//   app/globals.css's `.receipt-print-area` rule, not a generated PDF.
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import api from '../../../lib/api'
import { extractApiErrorMessage } from '../../../lib/apiError'
import { Customer, Order, Product } from '../../../lib/types'

type CartLine = { productId: string, name: string, pricePerKg: number, kg: number }

const KG_PRESETS = [0.25, 0.5, 1, 2, 5]
const RECENT_PRODUCTS_LIMIT = 6
const CUSTOMER_SEARCH_MIN_LENGTH = 2
const CUSTOMER_SEARCH_DEBOUNCE_MS = 300

export default function NewOrderPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [customer, setCustomer] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [kg, setKg] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [receipt, setReceipt] = useState<Order | null>(null)
  // v3 replan (Phase I.1 — barcode scanning, ADR-008): a scanner is a
  // keyboard-emulation device — it types the code into this input then sends
  // Enter, same as a person typing + pressing Enter. No device SDK involved.
  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeError, setBarcodeError] = useState<string | null>(null)
  // v3 replan (Phase H — CRM): optional link to a real Customer record,
  // alongside the existing free-text `customer` field above (untouched).
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  // v3.1 follow-up 8: this screen was originally walk-in-only (source
  // always defaulted to "cashier" server-side, no address field at all) —
  // added so a cashier taking a phone-in delivery order doesn't have to
  // switch to /orders/inbox for it. Off by default so the plain walk-in
  // flow is unchanged; when on, the order is submitted with source "phone"
  // (an existing, already-supported source value) and the address.
  const [isDelivery, setIsDelivery] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  // v3 replan — idempotency guard: one UUID per submit *attempt*, so a
  // retried request (network hiccup, double-click before the button
  // disables) replays the same order instead of creating a second one. A
  // fresh click after a completed attempt gets a fresh UUID.
  const idempotencyKeyRef = useRef(crypto.randomUUID())

  useEffect(() => {
    api.get<Product[]>('/api/products')
      .then(r => {
        setProducts(r.data)
        if (r.data.length > 0) setSelectedId(r.data[0].id)
      })
      .catch(() => setError(t('new_order_page.error_load_products')))
  }, [t])

  useEffect(() => {
    if (customerQuery.trim().length < CUSTOMER_SEARCH_MIN_LENGTH) {
      setCustomerResults([])
      return
    }
    const handle = setTimeout(() => {
      api.get<Customer[]>('/api/customers', { params: { q: customerQuery } })
        .then(r => setCustomerResults(r.data))
        .catch(() => setCustomerResults([]))
    }, CUSTOMER_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [customerQuery])

  function pickCustomer(c: Customer) {
    setSelectedCustomer(c)
    setCustomer(c.name)
    setCustomerQuery('')
    setCustomerResults([])
    // Prefills the address field regardless of whether delivery is toggled
    // on yet — harmless if it stays hidden, and already there if the
    // cashier flips the toggle on afterward. Same behavior as the Inbox
    // page's customer picker.
    if (c.address !== null && c.address !== '') {
      setDeliveryAddress(c.address)
    }
  }

  function addProductToCart(product: Product, amount: number) {
    setCart(prev => {
      const existing = prev.find(l => l.productId === product.id)
      if (existing) {
        return prev.map(l => l.productId === product.id ? { ...l, kg: l.kg + amount } : l)
      }
      return [...prev, { productId: product.id, name: product.name, pricePerKg: Number(product.pricePerKg), kg: amount }]
    })
    setRecentIds(prev => [product.id, ...prev.filter(id => id !== product.id)].slice(0, RECENT_PRODUCTS_LIMIT))
  }

  const BARCODE_DEFAULT_KG = 1

  async function submitBarcode() {
    const code = barcodeInput.trim()
    setBarcodeInput('')
    if (code === '') return
    setBarcodeError(null)
    try {
      const res = await api.get<Product>(`/api/products/by-barcode/${encodeURIComponent(code)}`)
      addProductToCart(res.data, BARCODE_DEFAULT_KG)
    } catch {
      setBarcodeError(t('new_order_page.error_barcode_not_found', { code }))
    }
  }

  function pickProduct(productId: string) {
    setSelectedId(productId)
  }

  function addLine() {
    setError(null)
    const product = products.find(p => p.id === selectedId)
    const amount = Number(kg)
    if (!product || !amount || amount <= 0) {
      setError(t('new_order_page.error_pick_product'))
      return
    }
    addProductToCart(product, amount)
    setKg('')
  }

  function removeLine(productId: string) {
    setCart(prev => prev.filter(l => l.productId !== productId))
  }

  const total = cart.reduce((sum, l) => sum + l.pricePerKg * l.kg, 0)
  const recentProducts = recentIds
    .map(id => products.find(p => p.id === id))
    .filter((p): p is Product => p !== undefined)

  async function submitOrder(asDraft: boolean) {
    setError(null)
    if (cart.length === 0) {
      setError(t('new_order_page.error_add_item'))
      return
    }
    const setBusy = asDraft ? setSavingDraft : setSubmitting
    setBusy(true)
    try {
      const res = await api.post<Order>(asDraft ? '/api/orders/draft' : '/api/orders', {
        customer: customer || undefined,
        customerId: selectedCustomer?.id,
        // Leaving source/deliveryAddress undefined when the delivery toggle
        // is off keeps this identical to the pre-existing walk-in behavior
        // (backend defaults source to "cashier"). "phone" is an existing,
        // already-supported source value — same one /orders/inbox uses.
        source: isDelivery ? 'phone' : undefined,
        deliveryAddress: isDelivery ? (deliveryAddress || undefined) : undefined,
        items: cart.map(l => ({ productId: l.productId, kg: l.kg }))
      }, { headers: { 'Idempotency-Key': idempotencyKeyRef.current } })
      // Attempt settled successfully — the next submit is a genuinely new
      // attempt, so it gets a fresh key. A failed attempt (catch below)
      // deliberately keeps the same key, so a retry of the *same* click
      // still dedupes against whatever the server already did with it.
      idempotencyKeyRef.current = crypto.randomUUID()
      if (asDraft) {
        router.push('/orders')
      } else {
        setReceipt(res.data)
      }
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? t('new_order_page.error_submit'))
    } finally {
      setBusy(false)
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
  const labelClasses = 'mb-1 block text-sm font-medium text-stone-700'

  if (receipt !== null) {
    return (
      <div>
        <div className="receipt-print-area mx-auto max-w-sm rounded-xl border border-stone-200 bg-surface p-6 shadow-card">
          <h1 className="mb-1 text-lg font-semibold text-stone-900">
            {t('new_order_page.receipt_title')}
            {receipt.dailyNumber !== null && <span className="ms-2 text-stone-400">#{receipt.dailyNumber}</span>}
          </h1>
          <p className="mb-4 text-xs text-stone-500">
            {receipt.customer || t('orders_page.walk_in')} · {new Date(receipt.createdAt).toLocaleString()}
          </p>
          <ul className="mb-4 divide-y divide-stone-100 border-y border-stone-100">
            {receipt.items.map(item => (
              <li key={item.id} className="flex justify-between py-2 text-sm">
                <span className="text-stone-700">{Number(item.kg).toFixed(3)} kg</span>
                <span className="font-medium text-stone-900">{Number(item.price).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between text-base font-semibold text-stone-900">
            <span>{t('new_order_page.total')}</span>
            <span>{Number(receipt.totalAmount).toFixed(2)}</span>
          </div>
          {/* v3.1 follow-up 6: printed so an on-the-way order's receipt code
              can be scanned/typed back in later (POST /:id/scan-receipt) to
              confirm the order and complete it — the only way that path
              reaches COMPLETED. Not shown for in-premise orders' receipts;
              harmless either way since it's simply unused for that flow. */}
          {receipt.receiptCode !== null && (
            <p className="mt-4 text-center text-xs text-stone-400">
              {t('new_order_page.receipt_code_label')}: <span className="font-mono tracking-widest text-stone-600">{receipt.receiptCode}</span>
            </p>
          )}
        </div>
        <div className="mx-auto mt-4 flex max-w-sm gap-3">
          <button onClick={() => window.print()}
            className="flex-1 rounded-lg border border-stone-300 bg-surface px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50">
            {t('new_order_page.print_receipt')}
          </button>
          <button onClick={() => router.push('/orders')}
            className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700">
            {t('new_order_page.done')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">{t('new_order_page.title')}</h1>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-4 rounded-xl border border-stone-200 bg-surface p-5 shadow-card">
        <label className="mb-1 block">
          <span className={labelClasses}>{t('new_order_page.customer_label')}</span>
          <input className={inputClasses} value={customer}
            onChange={e => { setCustomer(e.target.value); setCustomerQuery(e.target.value); setSelectedCustomer(null) }}
            placeholder={t('new_order_page.customer_placeholder')} />
        </label>
        {/* v3 replan (Phase H — CRM): typeahead against GET /api/customers.
            Picking a result links the order to a real Customer record on
            top of the free-text name above; typing without picking still
            works exactly as before. */}
        {customerResults.length > 0 && (
          <div className="mb-2 overflow-hidden rounded-lg border border-stone-200">
            {customerResults.map(c => (
              <button key={c.id} type="button" onClick={() => pickCustomer(c)}
                className="block w-full border-b border-stone-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-stone-50">
                <span className="font-medium text-stone-900">{c.name}</span>
                {c.phone !== null && <span className="ml-2 text-stone-500">{c.phone}</span>}
              </button>
            ))}
          </div>
        )}
        {selectedCustomer !== null && (
          <div className="mb-4 text-xs text-brand-700">{t('new_order_page.customer_linked', { name: selectedCustomer.name })}</div>
        )}
        {selectedCustomer === null && customerResults.length === 0 && <div className="mb-4" />}

        {/* v3.1 follow-up 8: off by default so plain walk-in checkout is
            unchanged; toggling on reveals the address field and tags the
            order source "phone" on submit. */}
        <label className="mb-4 flex items-center gap-2 text-sm font-medium text-stone-700">
          <input type="checkbox" checked={isDelivery}
            onChange={e => setIsDelivery(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500" />
          {t('new_order_page.delivery_toggle_label')}
        </label>
        {isDelivery && (
          <label className="mb-4 block">
            <span className={labelClasses}>{t('new_order_page.delivery_address_label')}</span>
            <textarea className={inputClasses} rows={2} value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)} />
          </label>
        )}

        {/* v3 replan (Phase I.1 — barcode scanning, ADR-008). A USB/Bluetooth
            scanner types the code as keystrokes and sends Enter — this is a
            plain text input that submits on Enter, same as a person typing
            a code by hand. Degrades gracefully with no scanner attached. */}
        <label className="mb-4 block">
          <span className={labelClasses}>{t('new_order_page.barcode_label')}</span>
          <input
            className={inputClasses}
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void submitBarcode() } }}
            placeholder={t('new_order_page.barcode_placeholder')}
            autoComplete="off"
          />
          {barcodeError !== null && <span className="mt-1 block text-xs text-red-600">{barcodeError}</span>}
        </label>

        {recentProducts.length > 0 && (
          <div className="mb-4">
            <span className={labelClasses}>{t('new_order_page.recent_products')}</span>
            <div className="flex flex-wrap gap-2">
              {recentProducts.map(p => (
                <button key={p.id} type="button" onClick={() => pickProduct(p.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selectedId === p.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-stone-300 bg-surface text-stone-700 hover:bg-stone-50'}`}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
          <label className="md:col-span-2">
            <span className={labelClasses}>{t('new_order_page.product_label')}</span>
            <select className={inputClasses} value={selectedId}
              onChange={e => setSelectedId(e.target.value)}>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {Number(p.pricePerKg).toFixed(2)}/kg ({Number(p.stockKg).toFixed(3)} kg {t('new_order_page.in_stock')})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClasses}>{t('new_order_page.kg_label')}</span>
            <input type="number" step="0.001" min="0.001" className={inputClasses}
              value={kg} onChange={e => setKg(e.target.value)} />
          </label>
          <button
            onClick={addLine}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t('new_order_page.add_to_order')}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {KG_PRESETS.map(preset => (
            <button key={preset} type="button" onClick={() => setKg(String(preset))}
              className="min-w-[3.5rem] rounded-lg border border-stone-300 bg-surface px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100">
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border border-stone-200 bg-surface shadow-card">
        {cart.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-400">{t('new_order_page.no_items_yet')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                <th className="px-4 py-2.5">{t('new_order_page.product_label')}</th>
                <th className="px-4 py-2.5">{t('new_order_page.kg_label')}</th>
                <th className="px-4 py-2.5">{t('inventory_page.price_label')}</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {cart.map(l => (
                <tr key={l.productId} className="transition-colors hover:bg-stone-50">
                  <td className="px-4 py-2.5 font-medium text-stone-900">{l.name}</td>
                  <td className="px-4 py-2.5 text-stone-600">{l.kg.toFixed(3)}</td>
                  <td className="px-4 py-2.5 text-stone-600">{(l.pricePerKg * l.kg).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => removeLine(l.productId)} className="text-xs font-medium text-red-600 hover:text-red-700">{t('new_order_page.remove')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-4 py-3">
          <div className="text-sm font-medium text-stone-600">{t('new_order_page.total')}</div>
          <div className="text-lg font-semibold text-stone-900">{total.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => submitOrder(true)} disabled={submitting || savingDraft || cart.length === 0}
          className="flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-surface px-4 py-3 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">
          {savingDraft ? t('new_order_page.saving_draft') : t('new_order_page.save_draft')}
        </button>
        <button onClick={() => submitOrder(false)} disabled={submitting || savingDraft || cart.length === 0}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
          {submitting && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
            </svg>
          )}
          {submitting ? t('new_order_page.submitting') : t('new_order_page.submit')}
        </button>
      </div>
    </div>
  )
}
