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
import { translateApiError } from '../../../lib/apiError'
import { Customer, Order, Product, ScanResult, ShopSettings } from '../../../lib/types'
import Receipt from '../../../components/Receipt'
import { useToast } from '../../../components/ToastProvider'

type CartLine = { productId: string, name: string, pricePerKg: number, kg: number }

const KG_PRESETS = [0.25, 0.5, 1, 2, 5]
const RECENT_PRODUCTS_LIMIT = 6
const CUSTOMER_SEARCH_MIN_LENGTH = 2
const CUSTOMER_SEARCH_DEBOUNCE_MS = 300

export default function NewOrderPage() {
  const { t } = useTranslation()
  const toast = useToast()
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
  // v3.1 follow-up 10: the printed receipt's shape (paper size, font scale,
  // header/footer, which fields show) is admin-configurable at /settings.
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null)
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
      .catch((err: unknown) => setError(translateApiError(err, t, t('new_order_page.error_load_products'))))
  }, [t])

  // Fetched up front rather than when the receipt appears: a failed or slow
  // settings request must never stand between finishing a sale and handing
  // over the slip. Receipt falls back to defaults if this is still null.
  useEffect(() => {
    api.get<ShopSettings>('/api/shop-settings', { silentError: true })
      .then(r => setShopSettings(r.data))
      .catch(() => setShopSettings(null))
  }, [])

  useEffect(() => {
    if (customerQuery.trim().length < CUSTOMER_SEARCH_MIN_LENGTH) {
      setCustomerResults([])
      return
    }
    const handle = setTimeout(() => {
      api.get<Customer[]>('/api/customers', { params: { q: customerQuery }, silentError: true })
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
      // v3.3: the /scan endpoint handles both a plain product barcode and a
      // weighing-scale label. For a scale label it returns the exact weight
      // (kg); for a plain barcode kg is null and we fall back to the 1 kg
      // default the cashier then adjusts.
      const res = await api.get<ScanResult>(`/api/products/scan/${encodeURIComponent(code)}`, { silentError: true })
      addProductToCart(res.data.product, res.data.kg ?? BARCODE_DEFAULT_KG)
    } catch (err) {
      // translateApiError surfaces the specific case — scale item not found,
      // price-mode with no rate, or plain barcode not found — via the
      // `errors.*` keys, falling back to the generic not-found message.
      setBarcodeError(translateApiError(err, t, t('new_order_page.error_barcode_not_found', { code })))
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

  const itemsTotal = cart.reduce((sum, l) => sum + l.pricePerKg * l.kg, 0)
  // v3.4 — mirror the server's delivery-fee rule in the live total. The server
  // is still the authority (it recomputes on save); this exists so the figure
  // the cashier reads out loud matches the one that prints. Without it the
  // screen said 8.90 and the receipt said 18.90.
  const deliveryFee = isDelivery && shopSettings?.deliveryFeeEnabled === true
    ? Number(shopSettings.deliveryFee)
    : 0
  const total = itemsTotal + deliveryFee
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
        // Stated outright rather than inferred from the address — an address is
        // often blank on a delivery for a known customer, and inferring it was
        // why the fee silently didn't apply.
        isDelivery: isDelivery ? true : undefined,
        items: cart.map(l => ({ productId: l.productId, kg: l.kg }))
      }, { headers: { 'Idempotency-Key': idempotencyKeyRef.current } })
      // Attempt settled successfully — the next submit is a genuinely new
      // attempt, so it gets a fresh key. A failed attempt (catch below)
      // deliberately keeps the same key, so a retry of the *same* click
      // still dedupes against whatever the server already did with it.
      idempotencyKeyRef.current = crypto.randomUUID()
      toast.success(asDraft ? t('toast.draft_saved') : t('toast.order_created'))
      if (asDraft) {
        router.push('/orders')
      } else {
        setReceipt(res.data)
      }
    } catch {
      // Reported by the global error toast — see the response
      // interceptor in lib/api.ts. A second inline copy would be noise.
    } finally {
      setBusy(false)
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
  const labelClasses = 'mb-1 block text-sm font-medium text-stone-700'

  if (receipt !== null) {
    return (
      <div>
        <Receipt
          order={receipt}
          settings={shopSettings}
          labels={{
            receiptTitle: t('new_order_page.receipt_title'),
                deliveryFee: t('new_order_page.delivery_fee'),
            walkIn: t('orders_page.walk_in'),
            total: t('new_order_page.total'),
            receiptCode: t('new_order_page.receipt_code_label'),
            kg: t('new_order_page.kg_label'),
            customer: t('receipt_labels.customer'),
            phone: t('receipt_labels.phone'),
            address: t('receipt_labels.address')
          }}
        />
        <div className="mx-auto mt-4 flex max-w-sm gap-3">
          <button onClick={() => window.print()}
            className="btn btn-secondary btn-lg flex-1">
            {t('new_order_page.print_receipt')}
          </button>
          <button onClick={() => router.push('/orders')}
            className="btn btn-primary btn-lg flex-1">
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
                className="block w-full border-b border-stone-100 px-3 py-2 text-start text-sm last:border-b-0 hover:bg-stone-50">
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
                  className={`chip ${selectedId === p.id ? 'chip-active' : ''}`}>
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
            className="btn btn-secondary"
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
              className="btn btn-secondary min-w-[3.5rem]">
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
              <tr className="border-b border-stone-200 bg-stone-100 text-start text-[11px] font-bold uppercase tracking-[0.08em] text-stone-500">
                <th className="px-4 py-2.5 text-start">{t('new_order_page.product_label')}</th>
                <th className="w-24 px-4 py-2.5 text-end">{t('new_order_page.kg_label')}</th>
                <th className="w-28 px-4 py-2.5 text-end">{t('inventory_page.price_label')}</th>
                <th className="w-16 px-4 py-2.5 text-end"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {cart.map(l => (
                <tr key={l.productId} className="transition-colors hover:bg-stone-50">
                  <td className="px-4 py-2.5 font-medium text-stone-900">{l.name}</td>
                  <td className="px-4 py-2.5 text-stone-600">{l.kg.toFixed(3)}</td>
                  <td className="px-4 py-2.5 text-stone-600">{(l.pricePerKg * l.kg).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-end">
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
          className="btn btn-secondary btn-lg">
          {savingDraft ? t('new_order_page.saving_draft') : t('new_order_page.save_draft')}
        </button>
        <button onClick={() => submitOrder(false)} disabled={submitting || savingDraft || cart.length === 0}
          className="btn btn-primary btn-lg flex-1">
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
