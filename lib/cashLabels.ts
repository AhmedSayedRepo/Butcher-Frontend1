// v3.1 follow-up 10b — display translation for the cash ledger.
//
// The `category` and `note` on a CashTransaction are written by the backend as
// DATA, in English, at the moment the row is created: "sale (phone)",
// "sale_reversal (cancelled)", "Order #7", "Cancelled order #2". They're
// deliberately not translated at write time — the ledger is an append-only
// audit record (ADR-011), and a row's stored text must not change meaning when
// somebody switches the UI language months later.
//
// So translation happens here, on read, by parsing the string back into its
// parts. Anything that doesn't match a known pattern is passed through
// untouched — a manually-typed category like "test" or a supplier's name is
// the operator's own words and must never be mangled.
type Translate = (key: string, vars?: Record<string, string | number>) => string

const SALE = /^sale \(([a-z_]+)\)$/
const SALE_REVERSAL = /^sale_reversal \(([a-z_]+)\)$/
const ORDER_NOTE = /^Order #(\d+)$/
const CANCELLED_NOTE = /^Cancelled order #(\d+)$/

export function cashCategoryLabel(category: string, t: Translate): string {
  const sale = SALE.exec(category)
  if (sale !== null) {
    return t('cash_page.category_sale', { source: t(`orders_page.source_${sale[1]}`) })
  }
  const reversal = SALE_REVERSAL.exec(category)
  if (reversal !== null) return t('cash_page.category_sale_reversal')
  // The bare "sale" category predates the source suffix.
  if (category === 'sale') return t('cash_page.category_sale_plain')
  return category
}

export function cashNoteLabel(note: string | null, t: Translate): string {
  if (note === null || note === '') return '—'
  const order = ORDER_NOTE.exec(note)
  if (order !== null) return t('cash_page.note_order', { number: order[1] })
  const cancelled = CANCELLED_NOTE.exec(note)
  if (cancelled !== null) return t('cash_page.note_cancelled_order', { number: cancelled[1] })
  return note
}
