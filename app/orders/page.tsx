'use client'
import { useEffect, useState } from 'react'
import api from '../../lib/api'
export default function OrdersPage(){
  const [orders,setOrders]=useState([])
  useEffect(()=>{ api.get('/api/orders').then(r=>setOrders(r.data.orders||[])).catch(()=>setOrders([])) },[])
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Orders</h1>
      {orders.length===0 ? <div className="bg-white p-4 rounded shadow">No orders</div> : orders.map((o:any)=>(
        <div key={o.id} className="bg-white p-3 rounded shadow mb-2 flex justify-between">
          <div>{o.customer_name}</div><div>{o.total_amount}</div>
        </div>
      ))}
    </div>
  )
}
