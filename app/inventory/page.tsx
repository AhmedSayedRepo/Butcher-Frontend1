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
import { translateApiError } from '../../lib/apiError'
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
      .catch((err: unknown) => {
        setProducts([])
        setError(translateApiError(err, t, t('inventory_page.error_load')))
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
      setError(translateApiError(err, t, t('inventory_page.error_create')))
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
      setError(translateApiError(err, t, t('inventory_page.error_save')))
    } finally {
      setSaving(false)
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
  const labelClasses = 'mb-1 block text-sm font-medium text-stone-700'
  // Smaller sibling for the inline card editor, where the same six labels have
  // to fit in half the width without pushing the fields off the card.
  const editLabelClasses = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-stone-500'

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
              className="btn btn-primary">
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

      {/* `items-start` — grid items stretch to the tallest row by default, so
          opening the inline editor on one product stretched the card *beside*
          it to the same height, which looked like the other card had expanded
          too. Each card now sizes to its own content. */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
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
                  /* v3.1 follow-up 10f: every field carries a visible label and
                     a `title` tooltip. It used to be six bare boxes with a
                     placeholder on three of them — once you typed a value the
                     placeholder vanished, so a half-filled edit form was a
                     column of unlabelled numbers with no way to tell price
                     from stock from threshold. */
                  <div className="grid grid-cols-2 gap-2">
                    <label className="col-span-2">
                      <span className={editLabelClasses}>{t('inventory_page.name_label')}</span>
                      <input className={inputClasses} value={editDraft.name}
                        title={t('inventory_page.name_label')}
                        onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} />
                    </label>
                    <label>
                      <span className={editLabelClasses}>{t('inventory_page.category_label')}</span>
                      <input className={inputClasses} value={editDraft.category} list="inventory-categories"
                        title={t('inventory_page.category_label')}
                        placeholder={t('inventory_page.category_label')}
                        onChange={e => setEditDraft({ ...editDraft, category: e.target.value })} />
                    </label>
                    <label>
                      <span className={editLabelClasses}>{t('inventory_page.price_label')}</span>
                      <input type="number" step="0.01" min="0.01" className={inputClasses} value={editDraft.pricePerKg}
                        title={t('inventory_page.price_label')}
                        onChange={e => setEditDraft({ ...editDraft, pricePerKg: e.target.value })} />
                    </label>
                    <label>
                      <span className={editLabelClasses}>{t('inventory_page.stock_label')}</span>
                      <input type="number" step="0.001" min="0" className={inputClasses} value={editDraft.stockKg}
                        title={t('inventory_page.stock_label')}
                        onChange={e => setEditDraft({ ...editDraft, stockKg: e.target.value })} />
                    </label>
                    <label>
                      <span className={editLabelClasses}>{t('inventory_page.threshold_label')}</span>
                      <input type="number" step="0.001" min="0" className={inputClasses} value={editDraft.lowStockAlertKg}
                        title={t('inventory_page.threshold_label')}
                        placeholder={t('inventory_page.threshold_label')}
                        onChange={e => setEditDraft({ ...editDraft, lowStockAlertKg: e.target.value })} />
                    </label>
                    <label className="col-span-2">
                      <span className={editLabelClasses}>{t('inventory_page.barcode_label')}</span>
                      <input className={inputClasses} value={editDraft.barcode}
                        title={t('inventory_page.barcode_label')}
                        placeholder={t('inventory_page.barcode_label')}
                        onChange={e => setEditDraft({ ...editDraft, barcode: e.target.value })} />
                    </label>
                    {stockWillChange(p) && (
                      <label className="col-span-2">
                        <span className={editLabelClasses}>{t('inventory_page.reason_placeholder')}</span>
                        <input className={inputClasses} value={editReason}
                          title={t('inventory_page.reason_placeholder')}
                          placeholder={t('inventory_page.reason_placeholder')}
                          onChange={e => setEditReason(e.target.value)} />
                      </label>
                    )}
                    <div className="col-span-2 flex justify-end gap-2 pt-1">
                      <button onClick={() => setEditingId(null)}
                        className="btn btn-secondary">
                        {t('inventory_page.cancel')}
                      </button>
                      <button onClick={() => onSaveEdit(p)} disabled={saving}
                        className="btn btn-primary">
                        {saving ? t('inventory_page.saving') : t('inventory_page.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* v3.1 follow-up 10f: the card used to compress everything
                     into one line — "129.000 kg @ 15.00/kg · category" — which
                     assumed you already knew what each number meant, and hid
                     the barcode and the per-product low-stock threshold
                     entirely. Now every stored field is shown with its own
                     label, and fields the product doesn't have say so rather
                     than silently disappearing. */
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-stone-900" title={p.name}>{p.name}</p>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                        {[
                          { label: t('inventory_page.stock_label'), value: `${Number(p.stockKg).toFixed(3)} ${p.unit}` },
                          { label: t('inventory_page.price_label'), value: `${Number(p.pricePerKg).toFixed(2)} / ${p.unit}` },
                          { label: t('inventory_page.category_label'), value: p.category },
                          { label: t('inventory_page.threshold_label'), value: p.lowStockAlertKg === null ? null : `${Number(p.lowStockAlertKg).toFixed(3)} ${p.unit}` },
                          { label: t('inventory_page.barcode_label'), value: p.barcode },
                        ].map(({ label, value }) => (
                          <div key={label} className="min-w-0">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</dt>
                            <dd className="truncate font-num text-stone-800" title={value ?? undefined}>
                              {value === null || value === '' ? <span className="text-stone-400">—</span> : value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {lowStock && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {t('inventory_page.low_stock_tag')}
                        </span>
                      )}
                      {canManageInventory && (
                        <button onClick={() => startEdit(p)}
                          className="btn btn-secondary btn-sm">
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
