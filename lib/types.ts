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
  // v3 replan (Phase I.1 — barcode scanning, ADR-008).
  barcode: string | null
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
  // v3 replan (Phase I.2): raw inbound text for WhatsApp-originated drafts,
  // null for every other order.
  customerMessage: string | null
  // v3 replan (Phase H — CRM): optional link to a Customer record.
  customerId: string | null
  // v3 replan (Phase I.3 — phone delivery orders).
  deliveryAddress: string | null
  // v3 replan (Phase K — cash management). Defaults "cash" on every order.
  paymentMethod: string
  createdAt: string
  userId: string
  items: OrderItem[]
}

// v3 replan (Phase H — CRM). Deliberately minimal — see ADR-013.
export type Customer = {
  id: string
  name: string
  phone: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

// Returned by GET /api/customers/:id — the Customer record plus its
// computed order-history summary (see routes/customers.ts).
export type CustomerProfile = Customer & {
  orders: Order[]
  totalSpend: string
  lastOrderAt: string | null
}

// v3 replan (Phase K — cash management, ADR-011). Append-only ledger,
// tracked separately from Order.totalAmount — see the ADR for why these two
// figures are never merged.
export type CashTransactionType = 'IN' | 'OUT'

export type CashTransaction = {
  id: string
  type: CashTransactionType
  category: string
  amount: string
  note: string | null
  userId: string
  createdAt: string
}

export type CashSummary = {
  cashIn: string
  cashOut: string
  netPosition: string
  totalRevenue: string
}

// v3 replan (Phase J — pending-order alerting). Single-row shop-wide config.
export type ShopSettings = {
  id: string
  pendingOrderAlertMinutes: number
  alertSoundEnabled: boolean
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
