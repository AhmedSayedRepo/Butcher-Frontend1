// Mirrors Butcher-Backend's real API shapes (see ../CONTRACT.md). Decimal fields
// come over the wire as strings — always Number(...) before formatting/math.

export type Product = {
  id: string
  name: string
  unit: string
  pricePerKg: string
  stockKg: string
  createdAt: string
  updatedAt: string
}

export type OrderItem = {
  id: string
  orderId: string
  productId: string
  kg: string
  price: string
}

export type Order = {
  id: string
  customer: string | null
  totalAmount: string
  createdAt: string
  userId: string
  items: OrderItem[]
}

export type ApiError = {
  error: string | Record<string, unknown>
}
