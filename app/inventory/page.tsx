// Fix (same contract mismatch as orders/page.tsx, ADR-003): this page was
// coded against a demo shape ({ products: [...] }, available_kg) that never
// matched the real backend, which returns a bare Product[] with pricePerKg/
// stockKg. This file was missed during the initial consolidation pass —
// it only turned up once backend/frontend were linked to their real git
// history and `git status` showed it as a pending delete.
//
// Phase 3: extended with create/edit UI, now that the backend has a
// PATCH /api/products/:id endpoint (previously only GET/POST existed).
'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { extractApiErrorMessage } from '../../lib/apiError'
import { useAuth } from '../../lib/useAuth'
import { Product } from '../../lib/types'

type Draft = { name: string, unit: string, pricePerKg: string, stockKg: string }

const EMPTY_DRAFT: Draft = { name: '', unit: 'kg', pricePerKg: '', stockKg: '' }

export default function InventoryPage() {
  const { t } = useTranslation()
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState<string | null>(null)
  const user = useAuth()
  const loggedIn = !!user
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)

  function load() {
    api.get<Product[]>('/api/products')
      .then(r => setProducts(r.data))
      .catch(() => {
        setProducts([])
        setError(t('inventory_page.error_load'))
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is defined fresh each render but only needs to run once on mount.
  }, [])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCreating(true)
    try {
      await api.post('/api/products', {
        name: newDraft.name,
        unit: newDraft.unit,
        pricePerKg: Number(newDraft.pricePerKg),
        stockKg: Number(newDraft.stockKg)
      })
      setNewDraft(EMPTY_DRAFT)
      load()
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? t('inventory_page.error_create'))
    } finally {
      setCreating(false)
    }
  }

  function startEdit(p: Product) {
    setEditingId(p.id)
    setEditDraft({ name: p.name, unit: p.unit, pricePerKg: p.pricePerKg, stockKg: p.stockKg })
  }

  async function onSaveEdit(id: string) {
    setError(null)
    setSaving(true)
    try {
      await api.patch(`/api/products/${id}`, {
        name: editDraft.name,
        unit: editDraft.unit,
        pricePerKg: Number(editDraft.pricePerKg),
        stockKg: Number(editDraft.stockKg)
      })
      setEditingId(null)
      load()
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? t('inventory_page.error_save'))
    } finally {
      setSaving(false)
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
  const labelClasses = 'mb-1 block text-sm font-medium text-stone-700'
  const LOW_STOCK_THRESHOLD_KG = 5

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">{t('inventory')}</h1>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loggedIn && (
        <form onSubmit={onCreate} className="mb-6 rounded-xl border border-stone-200 bg-white p-5 shadow-card">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:items-end">
            <label>
              <span className={labelClasses}>{t('inventory_page.name_label')}</span>
              <input className={inputClasses} value={newDraft.name}
                onChange={e => setNewDraft({ ...newDraft, name: e.target.value })} required />
            </label>
            <label>
              <span className={labelClasses}>{t('inventory_page.unit_label')}</span>
              <input className={inputClasses} value={newDraft.unit}
                onChange={e => setNewDraft({ ...newDraft, unit: e.target.value })} required />
            </label>
            <label>
              <span className={labelClasses}>{t('inventory_page.price_label')}</span>
              <input type="number" step="0.01" min="0.01" className={inputClasses} value={newDraft.pricePerKg}
                onChange={e => setNewDraft({ ...newDraft, pricePerKg: e.target.value })} required />
            </label>
            <label>
              <span className={labelClasses}>{t('inventory_page.stock_label')}</span>
              <input type="number" step="0.001" min="0" className={inputClasses} value={newDraft.stockKg}
                onChange={e => setNewDraft({ ...newDraft, stockKg: e.target.value })} required />
            </label>
            <button type="submit" disabled={creating}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
              {creating ? t('inventory_page.adding') : t('inventory_page.add_product')}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {products.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">
            {t('inventory_page.no_products')}
          </div>
        ) : (
          products.map((p) => {
            const lowStock = Number(p.stockKg) < LOW_STOCK_THRESHOLD_KG
            return (
              <div key={p.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover">
                {editingId === p.id ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input className={`${inputClasses} col-span-2`} value={editDraft.name}
                      onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} />
                    <input type="number" step="0.01" min="0.01" className={inputClasses} value={editDraft.pricePerKg}
                      onChange={e => setEditDraft({ ...editDraft, pricePerKg: e.target.value })} />
                    <input type="number" step="0.001" min="0" className={inputClasses} value={editDraft.stockKg}
                      onChange={e => setEditDraft({ ...editDraft, stockKg: e.target.value })} />
                    <div className="col-span-2 flex justify-end gap-2 pt-1">
                      <button onClick={() => setEditingId(null)}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
                        {t('inventory_page.cancel')}
                      </button>
                      <button onClick={() => onSaveEdit(p.id)} disabled={saving}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                        {saving ? t('inventory_page.saving') : t('inventory_page.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-stone-900">{p.name}</p>
                      <p className="text-sm text-stone-500">
                        {Number(p.stockKg).toFixed(3)} kg @ {Number(p.pricePerKg).toFixed(2)}/kg
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {lowStock && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          low stock
                        </span>
                      )}
                      {loggedIn && (
                        <button onClick={() => startEdit(p)}
                          className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50">
                          {t('inventory_page.edit')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
