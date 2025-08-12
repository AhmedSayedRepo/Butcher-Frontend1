'use client'
import { useEffect, useState } from 'react'
import api from '../../lib/api'
export default function InventoryPage(){
  const [products,setProducts]=useState([])
  useEffect(()=>{ api.get('/api/products').then(r=>setProducts(r.data.products||[])).catch(()=>setProducts([])) },[])
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Inventory</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.length===0 ? <div className="bg-white p-4 rounded shadow">No products</div> : products.map((p:any)=>(
          <div key={p.id} className="bg-white p-4 rounded shadow flex justify-between">
            <div>{p.name}</div><div>{p.available_kg} kg</div>
          </div>
        ))}
      </div>
    </div>
  )
}
