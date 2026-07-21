// Fix (same contract mismatch as orders/page.tsx, ADR-003): this page was
// coded against a demo shape ({ products: [...] }, available_kg) that never
// matched the real backend, which returns a bare Product[] with pricePerKg/
// stockKg. This file was missed during the initial consolidation pass —
// it only turned up once backend/frontend were linked to their real git
// history and `git status` showed it as a pending delete.
//
// Phase 3: extended with create/edit UI, now that the backend has a
// PATCH /api/products/:id endpoint (previously only GET/POST existed).
//
// v2 replan (Phase B): category filter, per-product low-stock threshold
// (falls back to the same global default the backend uses when unset — see
// backend/src/lib/lowStock.ts), and a required reason whenever stockKg is
// edited directly (backend/src/routes/products.ts rejects the PATCH
// otherwise and records the reason as a StockAdjustment row).
'use client'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { extractApiErrorMessage } from '../../lib/apiError'
import { useAuth } from '../../lib/useAuth'
import { Product, ShopSettings } from '../../lib/types'

type Draft = { name: string, unit: string, category: string, pricePerKg: string, stockKg: string, lowStockAlertKg: string, barcode: string }

const EMPTY_DRAFT: Draft = { name: '', unit: 'kg', category: '', pricePerKg: '', stockKg: '', lowStockAlertKg: '', barcode: '' }
// v3.1 follow-up 5 (Settings page): fallback only, for the brief window
// before GET /api/shop-settings resolves — the real default now lives at
// ShopSettings.defaultLowStockThresholdKg, editable at /settings.
const FALLBACK_LOW_STOCK_THRESHOLD_KG = 5
const ALL_CATEGORIES = '__all__'

function effectiveThreshold(p: Product, shopDefaultKg: number): number {
  return p.lowStockAlertKg === null || p.lowStockAlertKg === '' ? shopDefaultKg : Number(p.lowStockAlertKg)
}

export default function InventoryPage() {
  const { t } = useTranslation()
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState<string | null>(null)
  const user = useAuth()
  // v2 replan (Phase E): cashier role gating — a cashier (no `manage_inventory`
  // cap by default, see backend/src/lib/caps.ts) gets read-only inventory,
  // matching what the backend already enforces on POST/PATCH /api/products.
  // Manager/admin still see the same create/edit UI as before.
  const canManageInventory = user != null && Array.isArray(user.caps) && user.caps.includes('manage_inventory')
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT)
  const [editReason, setEditReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES)
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null)
  const shopDefaultThresholdKg = shopSettings === null ? FALLBACK_LOW_STOCK_THRESHOLD_KG : Number(shopSettings.defaultLowStockThresholdKg)

  useEffect(() => {
    api.get<ShopSettings>('/api/shop-settings').then(r => setShopSettings(r.data)).catch(() => setShopSettings(null))
  }, [])

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

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) {
      if (p.category !== null && p.category !== '') set.add(p.category)
    }
    return Array.from(set).sort()
  }, [products])

  const visibleProducts = categoryFilter === ALL_CATEGORIES
    ? products
    : products.filter(p => p.category === categoryFilter)

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCreating(true)
    try {
      await api.post('/api/products', {
        name: newDraft.name,
        unit: newDraft.unit,
        category: newDraft.category === '' ? undefined : newDraft.category,
        pricePerKg: Number(newDraft.pricePerKg),
        stockKg: Number(newDraft.stockKg),
        lowStockAlertKg: newDraft.lowStockAlertKg === '' ? undefined : Number(newDraft.lowStockAlertKg),
        barcode: newDraft.barcode === '' ? undefined : newDraft.barcode
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
    setEditReason('')
    setEditDraft({
      name: p.name,
      unit: p.unit,
      category: p.category ?? '',
      pricePerKg: p.pricePerKg,
      stockKg: p.stockKg,
      lowStockAlertKg: p.lowStockAlertKg ?? '',
      barcode: p.barcode ?? ''
    })
  }

  function stockWillChange(p: Product): boolean {
    return Number(editDraft.stockKg) !== Number(p.stockKg)
  }

  async function onSaveEdit(p: Product) {
    setError(null)
    if (stockWillChange(p) && editReason.trim() === '') {
      setError(t('inventory_page.error_reason_required'))
      return
    }
    setSaving(true)
    try {
      await api.patch(`/api/products/${p.id}`, {
        name: editDraft.name,
        unit: editDraft.unit,
        category: editDraft.category === '' ? undefined : editDraft.category,
        pricePerKg: Number(editDraft.pricePerKg),
        stockKg: Number(editDraft.stockKg),
        lowStockAlertKg: editDraft.lowStockAlertKg === '' ? undefined : Number(editDraft.lowStockAlertKg),
        barcode: editDraft.barcode === '' ? undefined : editDraft.barcode,
        reason: stockWillChange(p) ? editReason.trim() : undefined
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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{t('inventory')}</h1>
        {categories.length > 0 && (
          <select
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value={ALL_CATEGORIES}>{t('inventory_page.all_categories')}</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {canManageInventory && (
        <form onSubmit={onCreate} className="mb-6 rounded-xl border border-stone-200 bg-surface p-5 shadow-card">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6 md:items-end">
            <label>
              <span className={labelClasses}>{t('inventory_page.name_label')}</span>
              <input className={inputClasses} value={newDraft.name}
                onChange={e => setNewDraft({ ...newDraft, name: e.target.value })} required />
            </label>
            <label>
              <span className={labelClasses}>{t('inventory_page.category_label')}</span>
              <input className={inputClasses} value={newDraft.category} list="inventory-categories"
                onChange={e => setNewDraft({ ...newDraft, category: e.target.value })} />
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
          <div className="mt-3 grid grid-cols-2 gap-3 md:max-w-md">
            <label>
              <span className={labelClasses}>{t('inventory_page.threshold_label')}</span>
              <input type="number" step="0.001" min="0" className={inputClasses} value={newDraft.lowStockAlertKg}
                placeholder={String(shopDefaultThresholdKg)}
                onChange={e => setNewDraft({ ...newDraft, lowStockAlertKg: e.target.value })} />
            </label>
            <label>
              <span className={labelClasses}>{t('inventory_page.barcode_label')}</span>
              <input className={inputClasses} value={newDraft.barcode}
                onChange={e => setNewDraft({ ...newDraft, barcode: e.target.value })} />
            </label>
          </div>
          <datalist id="inventory-categories">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visibleProducts.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-stone-300 bg-surface p-10 text-center text-sm text-stone-500">
            {t('inventory_page.no_products')}
          </div>
        ) : (
          visibleProducts.map((p) => {
            const lowStock = Number(p.stockKg) < effectiveThreshold(p, shopDefaultThresholdKg)
            return (
              <div key={p.id} className="rounded-xl border border-stone-200 bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover">
                {editingId === p.id ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input className={`${inputClasses} col-span-2`} value={editDraft.name}
                      onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} />
                    <input className={inputClasses} value={editDraft.category} list="inventory-categories"
                      placeholder={t('inventory_page.category_label')}
                      onChange={e => setEditDraft({ ...editDraft, category: e.target.value })} />
                    <input type="number" step="0.01" min="0.01" className={inputClasses} value={editDraft.pricePerKg}
                      onChange={e => setEditDraft({ ...editDraft, pricePerKg: e.target.value })} />
                    <input type="number" step="0.001" min="0" className={inputClasses} value={editDraft.stockKg}
                      onChange={e => setEditDraft({ ...editDraft, stockKg: e.target.value })} />
                    <input type="number" step="0.001" min="0" className={inputClasses} value={editDraft.lowStockAlertKg}
                      placeholder={t('inventory_page.threshold_label')}
                      onChange={e => setEditDraft({ ...editDraft, lowStockAlertKg: e.target.value })} />
                    <input className={inputClasses} value={editDraft.barcode}
                      placeholder={t('inventory_page.barcode_label')}
                      onChange={e => setEditDraft({ ...editDraft, barcode: e.target.value })} />
                    {stockWillChange(p) && (
                      <input className={`${inputClasses} col-span-2`} value={editReason}
                        placeholder={t('inventory_page.reason_placeholder')}
                        onChange={e => setEditReason(e.target.value)} />
                    )}
                    <div className="col-span-2 flex justify-end gap-2 pt-1">
                      <button onClick={() => setEditingId(null)}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
                        {t('inventory_page.cancel')}
                      </button>
                      <button onClick={() => onSaveEdit(p)} disabled={saving}
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
                        {p.category !== null && p.category !== '' && <span className="text-stone-400"> · {p.category}</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {lowStock && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {t('inventory_page.low_stock_tag')}
                        </span>
                      )}
                      {canManageInventory && (
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
