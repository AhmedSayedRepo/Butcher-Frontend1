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
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import api from '../../../lib/api'
import { extractApiErrorMessage } from '../../../lib/apiError'
import { Order, Product } from '../../../lib/types'

type CartLine = { productId: string, name: string, pricePerKg: number, kg: number }

const KG_PRESETS = [0.25, 0.5, 1, 2, 5]
const RECENT_PRODUCTS_LIMIT = 6

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

  useEffect(() => {
    api.get<Product[]>('/api/products')
      .then(r => {
        setProducts(r.data)
        if (r.data.length > 0) setSelectedId(r.data[0].id)
      })
      .catch(() => setError(t('new_order_page.error_load_products')))
  }, [t])

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
    setCart(prev => {
      const existing = prev.find(l => l.productId === product.id)
      if (existing) {
        return prev.map(l => l.productId === product.id ? { ...l, kg: l.kg + amount } : l)
      }
      return [...prev, { productId: product.id, name: product.name, pricePerKg: Number(product.pricePerKg), kg: amount }]
    })
    setRecentIds(prev => [product.id, ...prev.filter(id => id !== product.id)].slice(0, RECENT_PRODUCTS_LIMIT))
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
        items: cart.map(l => ({ productId: l.productId, kg: l.kg }))
      })
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
        <div className="receipt-print-area mx-auto max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-card">
          <h1 className="mb-1 text-lg font-semibold text-stone-900">{t('new_order_page.receipt_title')}</h1>
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
        </div>
        <div className="mx-auto mt-4 flex max-w-sm gap-3">
          <button onClick={() => window.print()}
            className="flex-1 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50">
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

      <div className="mb-4 rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <label className="mb-4 block">
          <span className={labelClasses}>{t('new_order_page.customer_label')}</span>
          <input className={inputClasses} value={customer}
            onChange={e => setCustomer(e.target.value)} placeholder={t('new_order_page.customer_placeholder')} />
        </label>

        {recentProducts.length > 0 && (
          <div className="mb-4">
            <span className={labelClasses}>{t('new_order_page.recent_products')}</span>
            <div className="flex flex-wrap gap-2">
              {recentProducts.map(p => (
                <button key={p.id} type="button" onClick={() => pickProduct(p.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selectedId === p.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'}`}>
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
              className="min-w-[3.5rem] rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100">
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
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
          className="flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">
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
