import Link from 'next/link'
export default function Page() {
  return (
    <div>
      <h1 className="text-3xl font-semibold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">Today's Orders<br/>12</div>
        <div className="bg-white p-4 rounded shadow">Stock Alerts<br/>2</div>
        <div className="bg-white p-4 rounded shadow">Average Yield<br/>78%</div>
      </div>
      <div className="mt-6">
        <Link className="text-blue-600 underline" href="/orders">Go to Orders</Link>
      </div>
    </div>
  )
}
