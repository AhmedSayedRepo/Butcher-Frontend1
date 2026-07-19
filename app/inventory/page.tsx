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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t('inventory')}</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-3">{error}</div>}

      {loggedIn && (
        <form onSubmit={onCreate} className="bg-white p-4 rounded shadow mb-4 grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
          <label className="text-sm">
            {t('inventory_page.name_label')}
            <input className="w-full border rounded p-2" value={newDraft.name}
              onChange={e => setNewDraft({ ...newDraft, name: e.target.value })} required />
          </label>
          <label className="text-sm">
            {t('inventory_page.unit_label')}
            <input className="w-full border rounded p-2" value={newDraft.unit}
              onChange={e => setNewDraft({ ...newDraft, unit: e.target.value })} required />
          </label>
          <label className="text-sm">
            {t('inventory_page.price_label')}
            <input type="number" step="0.01" min="0.01" className="w-full border rounded p-2" value={newDraft.pricePerKg}
              onChange={e => setNewDraft({ ...newDraft, pricePerKg: e.target.value })} required />
          </label>
          <label className="text-sm">
            {t('inventory_page.stock_label')}
            <input type="number" step="0.001" min="0" className="w-full border rounded p-2" value={newDraft.stockKg}
              onChange={e => setNewDraft({ ...newDraft, stockKg: e.target.value })} required />
          </label>
          <button type="submit" disabled={creating} className="bg-blue-600 text-white rounded p-2 disabled:opacity-50">
            {creating ? t('inventory_page.adding') : t('inventory_page.add_product')}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.length === 0 ? (
          <div className="bg-white p-4 rounded shadow">{t('inventory_page.no_products')}</div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="bg-white p-4 rounded shadow">
              {editingId === p.id ? (
                <div className="grid grid-cols-2 gap-2">
                  <input className="border rounded p-2 col-span-2" value={editDraft.name}
                    onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} />
                  <input type="number" step="0.01" min="0.01" className="border rounded p-2" value={editDraft.pricePerKg}
                    onChange={e => setEditDraft({ ...editDraft, pricePerKg: e.target.value })} />
                  <input type="number" step="0.001" min="0" className="border rounded p-2" value={editDraft.stockKg}
                    onChange={e => setEditDraft({ ...editDraft, stockKg: e.target.value })} />
                  <div className="col-span-2 flex gap-2 justify-end">
                    <button onClick={() => setEditingId(null)} className="px-3 py-1 border rounded">{t('inventory_page.cancel')}</button>
                    <button onClick={() => onSaveEdit(p.id)} disabled={saving}
                      className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50">
                      {saving ? t('inventory_page.saving') : t('inventory_page.save')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div>{p.name}</div>
                  <div className="flex items-center gap-3">
                    <div>{Number(p.stockKg).toFixed(3)} kg @ {Number(p.pricePerKg).toFixed(2)}/kg</div>
                    {loggedIn && (
                      <button onClick={() => startEdit(p)} className="px-2 py-1 border rounded text-sm">{t('inventory_page.edit')}</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
