import type { NextApiRequest, NextApiResponse } from 'next'
export default function handler(req: NextApiRequest, res: NextApiResponse){
  const { message } = req.body || {}
  const items = []
  ;(message||'').toLowerCase().split(/and|,|;/).forEach((t:string)=>{ const m = t.match(/([0-9]*\\.?[0-9]+)\\s*kg\\s*(.+)/); if (m) items.push({ product_name: m[2].trim(), requested_kg: parseFloat(m[1]) }) })
  res.status(200).json({ items, clarification_needed: items.length===0 })
}
