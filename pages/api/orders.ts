import type { NextApiRequest, NextApiResponse } from 'next'
export default function handler(req: NextApiRequest, res: NextApiResponse){
  const orders = [ { id:'o1', customer_name:'Ali', total_amount:45, created_at: new Date() } ];
  res.status(200).json({ orders })
}
