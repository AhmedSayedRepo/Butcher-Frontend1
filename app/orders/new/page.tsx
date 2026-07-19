// Phase 3: new-order / cashier screen. Pick a product, enter kg, add to the
// cart, see a live total, submit POST /api/orders. Backend (routes/orders.ts)
// already validates stock and computes price server-side — this page mirrors
// that math for the live total but always trusts the server's response/errors
// as the source of truth (e.g. "Insufficient stock for X" comes back verbatim,
// untranslated — it names a real product by its stored name, not UI copy).
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import api from '../../../lib/api'
import { extractApiErrorMessage } from '../../../lib/apiError'
import { Product } from '../../../lib/types'

type CartLine = { productId: string, name: string, pricePerKg: number, kg: number }

export default function NewOrderPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [customer, setCustomer] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [kg, setKg] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get<Product[]>('/api/products')
      .then(r => {
        setProducts(r.data)
        if (r.data.length > 0) setSelectedId(r.data[0].id)
      })
      .catch(() => setError(t('new_order_page.error_load_products')))
  }, [t])

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
    setKg('')
  }

  function removeLine(productId: string) {
    setCart(prev => prev.filter(l => l.productId !== productId))
  }

  const total = cart.reduce((sum, l) => sum + l.pricePerKg * l.kg, 0)

  async function submitOrder() {
    setError(null)
    if (cart.length === 0) {
      setError(t('new_order_page.error_add_item'))
      return
    }
    setSubmitting(true)
    try {
      await api.post('/api/orders', {
        customer: customer || undefined,
        items: cart.map(l => ({ productId: l.productId, kg: l.kg }))
      })
      router.push('/orders')
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? t('new_order_page.error_submit'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t('new_order_page.title')}</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-3">{error}</div>}

      <div className="bg-white p-4 rounded shadow mb-4">
        <label className="block text-sm mb-3">
          {t('new_order_page.customer_label')}
          <input className="w-full border rounded p-2 mt-1" value={customer}
            onChange={e => setCustomer(e.target.value)} placeholder={t('new_order_page.customer_placeholder')} />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <label className="text-sm md:col-span-2">
            {t('new_order_page.product_label')}
            <select className="w-full border rounded p-2 mt-1" value={selectedId}
              onChange={e => setSelectedId(e.target.value)}>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {Number(p.pricePerKg).toFixed(2)}/kg ({Number(p.stockKg).toFixed(3)} kg {t('new_order_page.in_stock')})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t('new_order_page.kg_label')}
            <input type="number" step="0.001" min="0.001" className="w-full border rounded p-2 mt-1"
              value={kg} onChange={e => setKg(e.target.value)} />
          </label>
          <button onClick={addLine} className="px-3 py-2 border rounded bg-gray-100">{t('new_order_page.add_to_order')}</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow mb-4">
        {cart.length === 0 ? (
          <div className="text-gray-500">{t('new_order_page.no_items_yet')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1">{t('new_order_page.product_label')}</th>
                <th className="py-1">{t('new_order_page.kg_label')}</th>
                <th className="py-1">{t('inventory_page.price_label')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.map(l => (
                <tr key={l.productId} className="border-b last:border-0">
                  <td className="py-1">{l.name}</td>
                  <td className="py-1">{l.kg.toFixed(3)}</td>
                  <td className="py-1">{(l.pricePerKg * l.kg).toFixed(2)}</td>
                  <td className="py-1 text-right">
                    <button onClick={() => removeLine(l.productId)} className="text-red-600 text-xs">{t('new_order_page.remove')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-3 flex justify-between items-center font-semibold">
          <div>{t('new_order_page.total')}</div>
          <div>{total.toFixed(2)}</div>
        </div>
      </div>

      <button onClick={submitOrder} disabled={submitting || cart.length === 0}
        className="w-full bg-blue-600 text-white rounded p-3 disabled:opacity-50">
        {submitting ? t('new_order_page.submitting') : t('new_order_page.submit')}
      </button>
    </div>
  )
}
