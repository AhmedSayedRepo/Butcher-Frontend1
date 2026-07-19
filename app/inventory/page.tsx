// Fix (same contract mismatch as orders/page.tsx, ADR-003): this page was
// coded against a demo shape ({ products: [...] }, available_kg) that never
// matched the real backend, which returns a bare Product[] with pricePerKg/
// stockKg. This file was missed during the initial consolidation pass —
// it only turned up once backend/frontend were linked to their real git
// history and `git status` showed it as a pending delete.
'use client'
import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { Product } from '../../lib/types'

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<Product[]>('/api/products')
      .then(r => setProducts(r.data))
      .catch(() => {
        setProducts([])
        setError('Failed to load inventory.')
      })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Inventory</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-3">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.length === 0 ? (
          <div className="bg-white p-4 rounded shadow">No products</div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="bg-white p-4 rounded shadow flex justify-between">
              <div>{p.name}</div>
              <div>{Number(p.stockKg).toFixed(3)} kg @ {Number(p.pricePerKg).toFixed(2)}/kg</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
