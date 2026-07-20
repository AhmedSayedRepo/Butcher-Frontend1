// v3 replan (Phase I.2/I.3 — social & phone order intake, ADR-009).
// Staff-driven manual entry: paste the DM text or jot call notes, build the
// cart via the same product picker New Order uses, save as a draft. No live
// Instagram/Messenger/telephony integration in this phase — see ADR-009 for
// why (mirrors how WhatsApp was deliberately scoped as a separate, later
// step before it got a real Cloud API integration).
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import api from '../../../lib/api'
import { extractApiErrorMessage } from '../../../lib/apiError'
import { Customer, Order, Product } from '../../../lib/types'

type CartLine = { productId: string, name: string, pricePerKg: number, kg: number }
type InboxSource = 'social' | 'phone'
// v3.1 follow-up: no live Instagram/Messenger/telephony integration exists
// (ADR-009 — same reason WhatsApp itself only got a real Cloud API
// connection as a later, separate step), so staff still have to paste in
// what the customer actually said. What used to be pure manual entry from
// there now reuses the same best-effort parser the WhatsApp webhook already
// runs on every inbound message (lib/parseOrderMessage.ts, via the existing
// public POST /api/parse-order) — "Parse message" below turns the pasted
// text into cart lines automatically, matched items get added, anything it
// couldn't confidently match is called out so staff add it by hand instead
// of silently dropping it.
type ParsedItem = { product_name: string, requested_kg: number, productId: string | null, pricePerKg: string | null }

export default function OrdersInboxPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [source, setSource] = useState<InboxSource>('social')
  const [customer, setCustomer] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerMessage, setCustomerMessage] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [kg, setKg] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)

  useEffect(() => {
    api.get<Product[]>('/api/products')
      .then(r => { setProducts(r.data); if (r.data.length > 0) setSelectedId(r.data[0].id) })
      .catch(() => setError(t('inbox_page.error_load_products')))
  }, [t])

  const CUSTOMER_SEARCH_MIN_LENGTH = 2
  const CUSTOMER_SEARCH_DEBOUNCE_MS = 300
  useEffect(() => {
    if (customerQuery.trim().length < CUSTOMER_SEARCH_MIN_LENGTH) { setCustomerResults([]); return }
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
    // Auto-fill the delivery address from the customer's saved record —
    // saves staff from retyping an address that's already on file. Still a
    // plain textarea underneath, so it can be edited/cleared per order if
    // this delivery is going somewhere different.
    if (c.address !== null && c.address !== '') {
      setDeliveryAddress(c.address)
    }
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
      if (existing) return prev.map(l => l.productId === product.id ? { ...l, kg: l.kg + amount } : l)
      return [...prev, { productId: product.id, name: product.name, pricePerKg: Number(product.pricePerKg), kg: amount }]
    })
    setKg('')
  }

  function removeLine(productId: string) {
    setCart(prev => prev.filter(l => l.productId !== productId))
  }

  async function parseMessage() {
    setError(null)
    setNotice(null)
    if (customerMessage.trim() === '') return
    setParsing(true)
    try {
      const r = await api.post<{ items: ParsedItem[], clarification_needed: boolean }>('/api/parse-order', { message: customerMessage })
      const matched = r.data.items.filter((i): i is ParsedItem & { productId: string } => i.productId !== null)
      const unmatched = r.data.items.filter(i => i.productId === null)

      if (matched.length > 0) {
        setCart(prev => {
          const byProductId = new Map(prev.map(l => [l.productId, l]))
          for (const item of matched) {
            const existing = byProductId.get(item.productId)
            byProductId.set(item.productId, existing === undefined
              ? { productId: item.productId, name: item.product_name, pricePerKg: Number(item.pricePerKg ?? 0), kg: item.requested_kg }
              : { ...existing, kg: existing.kg + item.requested_kg })
          }
          return Array.from(byProductId.values())
        })
      }

      if (unmatched.length > 0) {
        setNotice(t('inbox_page.parse_unmatched', { items: unmatched.map(i => i.product_name).join(', ') }))
      } else if (matched.length === 0) {
        setNotice(t('inbox_page.parse_no_matches'))
      }
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? t('inbox_page.error_parse'))
    } finally {
      setParsing(false)
    }
  }

  const total = cart.reduce((sum, l) => sum + l.pricePerKg * l.kg, 0)

  async function saveDraft() {
    setError(null)
    if (cart.length === 0) { setError(t('new_order_page.error_add_item')); return }
    setSaving(true)
    try {
      await api.post<Order>('/api/orders/draft', {
        customer: customer || undefined,
        customerId: selectedCustomer?.id,
        customerMessage: customerMessage || undefined,
        deliveryAddress: source === 'phone' ? (deliveryAddress || undefined) : undefined,
        source,
        items: cart.map(l => ({ productId: l.productId, kg: l.kg }))
      }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })
      router.push('/orders')
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? t('new_order_page.error_submit'))
    } finally {
      setSaving(false)
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
  const labelClasses = 'mb-1 block text-sm font-medium text-stone-700'

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">{t('inbox_page.title')}</h1>
      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">{notice}</div>}

      <div className="mb-4 rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <div className="mb-4 flex gap-2">
          {(['social', 'phone'] as const).map(s => (
            <button key={s} type="button" onClick={() => setSource(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${source === s ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'}`}>
              {t(`inbox_page.source_${s}`)}
            </button>
          ))}
        </div>

        <label className="mb-1 block">
          <span className={labelClasses}>{t('new_order_page.customer_label')}</span>
          <input className={inputClasses} value={customer}
            onChange={e => { setCustomer(e.target.value); setCustomerQuery(e.target.value); setSelectedCustomer(null) }}
            placeholder={t('new_order_page.customer_placeholder')} />
        </label>
        {customerResults.length > 0 && (
          <div className="mb-4 overflow-hidden rounded-lg border border-stone-200">
            {customerResults.map(c => (
              <button key={c.id} type="button" onClick={() => pickCustomer(c)}
                className="block w-full border-b border-stone-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-stone-50">
                <span className="font-medium text-stone-900">{c.name}</span>
                {c.phone !== null && <span className="ml-2 text-stone-500">{c.phone}</span>}
              </button>
            ))}
          </div>
        )}

        {source === 'phone' && (
          <label className="mb-4 block">
            <span className={labelClasses}>{t('inbox_page.delivery_address_label')}</span>
            <textarea className={inputClasses} rows={2} value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
          </label>
        )}

        <label className="mb-2 block">
          <span className={labelClasses}>{t(`inbox_page.message_label_${source}`)}</span>
          <textarea className={inputClasses} rows={3} value={customerMessage} onChange={e => setCustomerMessage(e.target.value)}
            placeholder={t('inbox_page.message_placeholder')} />
        </label>
        <button type="button" onClick={parseMessage} disabled={parsing || customerMessage.trim() === ''}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50">
          {parsing ? t('inbox_page.parsing') : t('inbox_page.parse_message')}
        </button>
        <p className="mb-4 -mt-3 text-xs text-stone-400">{t('inbox_page.parse_hint')}</p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
          <label className="md:col-span-2">
            <span className={labelClasses}>{t('new_order_page.product_label')}</span>
            <select className={inputClasses} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {Number(p.pricePerKg).toFixed(2)}/kg ({Number(p.stockKg).toFixed(3)} kg {t('new_order_page.in_stock')})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClasses}>{t('new_order_page.kg_label')}</span>
            <input type="number" step="0.001" min="0.001" className={inputClasses} value={kg} onChange={e => setKg(e.target.value)} />
          </label>
          <button onClick={addLine}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100">
            {t('new_order_page.add_to_order')}
          </button>
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
        {cart.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-400">{t('new_order_page.no_items_yet')}</div>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-stone-100">
              {cart.map(l => (
                <tr key={l.productId}>
                  <td className="px-4 py-2.5 font-medium text-stone-900">{l.name}</td>
                  <td className="px-4 py-2.5 text-stone-600">{l.kg.toFixed(3)} kg</td>
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

      <button onClick={saveDraft} disabled={saving || cart.length === 0}
        className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
        {saving ? t('new_order_page.saving_draft') : t('inbox_page.save_draft')}
      </button>
    </div>
  )
}
