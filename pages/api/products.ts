import type { NextApiRequest, NextApiResponse } from 'next'
export default function handler(req: NextApiRequest, res: NextApiResponse){
  const products = [
    { id: 'p1', name: 'Ribeye', available_kg: 50, price_per_kg: 20 },
    { id: 'p2', name: 'Minced Beef', available_kg: 30, price_per_kg: 8.5 }
  ]
  res.status(200).json({ products })
}
