// Mirrors Butcher-Backend's real API shapes (see ../CONTRACT.md). Decimal fields
// come over the wire as strings — always Number(...) before formatting/math.

export type Product = {
  id: string
  name: string
  unit: string
  category: string | null
  pricePerKg: string
  stockKg: string
  lowStockAlertKg: string | null
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

// v2 replan (Phase C): DRAFT is created but not yet promoted (no stock
// decrement); CANCELLED is terminal. The other four are the kanban columns.
export type OrderStatus = 'DRAFT' | 'CREATED' | 'IN_PROGRESS' | 'ON_THE_WAY' | 'IN_PREMISE' | 'CANCELLED'

export type Order = {
  id: string
  customer: string | null
  totalAmount: string
  status: OrderStatus
  source: string
  createdAt: string
  userId: string
  items: OrderItem[]
}

// v2 replan (Phase B): audit trail row for a direct stock edit.
export type StockAdjustment = {
  id: string
  productId: string
  deltaKg: string
  reason: string
  userId: string
  createdAt: string
}

// v2 replan (Phase B.5): carcass dismantling module.
export type DismantleTemplateCut = {
  id: string
  templateId: string
  cutName: string
  expectedYieldPct: string
  isOffal: boolean
}

export type DismantleTemplate = {
  id: string
  name: string
  animalType: string
  description: string | null
  cuts: DismantleTemplateCut[]
}

export type DismantleEventOutput = {
  id: string
  eventId: string
  cutName: string
  actualWeightKg: string
  isOffal: boolean
  productId: string | null
  contentPerKiloKg: number
}

export type DismantleEvent = {
  id: string
  templateId: string
  sourceLabel: string
  inputWeightKg: string
  performedBy: string
  createdAt: string
  template: DismantleTemplate
  outputs: DismantleEventOutput[]
  wastePct: number
}

export type ApiError = {
  error: string | Record<string, unknown>
}
