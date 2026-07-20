// v3 replan (Phase K — cash management, ADR-011/ADR-012). Manual entry
// (deposits, supplier payments, petty cash, corrections) + a reporting
// screen showing cash position and total revenue as two separate figures —
// never merged, see ADR-011. Gated server-side by `manage_cash`; the
// client-side cap check below just avoids showing a form that would 403.
'use client'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import api from '../../../lib/api'
import { extractApiErrorMessage } from '../../../lib/apiError'
import { useAuth } from '../../../lib/useAuth'
import { CashSummary, CashTransaction, CashTransactionType } from '../../../lib/types'

const RANGES = ['day', 'week', 'month', 'year'] as const
// v3 follow-up: each summary card now links to the records that make up its
// number — "Cash in"/"Cash out" filter the ledger table below to that
// transaction type, "Net position" clears the filter back to everything,
// and "Total revenue" is a different index entirely (Order, not
// CashTransaction — see ADR-011, they're deliberately never the same
// table), so it navigates to /orders instead of filtering in place.
type CardFilter = 'ALL' | 'IN' | 'OUT'

export default function CashManagementPage() {
  const { t } = useTranslation()
  const user = useAuth()
  const canManageCash = user != null && Array.isArray(user.caps) && user.caps.includes('manage_cash')

  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [summary, setSummary] = useState<CashSummary | null>(null)
  const [range, setRange] = useState<(typeof RANGES)[number]>('week')
  const [cardFilter, setCardFilter] = useState<CardFilter>('ALL')
  const [type, setType] = useState<CashTransactionType>('IN')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function load() {
    api.get<CashTransaction[]>('/api/cash-transactions').then(r => setTransactions(r.data)).catch(() => setTransactions([]))
    api.get<CashSummary>('/api/cash-transactions/summary', { params: { range } }).then(r => setSummary(r.data)).catch(() => setSummary(null))
  }

  useEffect(() => {
    if (!canManageCash) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is defined fresh each render, only `range`/`canManageCash` should retrigger this.
  }, [range, canManageCash])

  async function addTransaction(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = Number(amount)
    if (category.trim() === '' || !amountNum || amountNum <= 0) return
    setSaving(true)
    setError(null)
    try {
      await api.post('/api/cash-transactions', {
        type, category: category.trim(), amount: amountNum, note: note.trim() || undefined
      }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })
      setCategory('')
      setAmount('')
      setNote('')
      load()
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? t('cash_page.error_save'))
    } finally {
      setSaving(false)
    }
  }

  const visibleTransactions = useMemo(
    () => cardFilter === 'ALL' ? transactions : transactions.filter(tx => tx.type === cardFilter),
    [transactions, cardFilter]
  )

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

  if (!canManageCash) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
        <p className="text-sm text-stone-500">{t('cash_page.no_access')}</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">{t('cash_page.title')}</h1>
      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mb-6 flex gap-1 rounded-lg bg-stone-100 p-0.5 text-xs font-medium w-fit">
        {RANGES.map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`rounded-md px-3 py-1.5 transition-colors ${range === r ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
            {t(`cash_page.range_${r}`)}
          </button>
        ))}
      </div>

      {/* ADR-011: cash position and revenue shown as two visibly separate
          figures, never combined into one number. Each card also links to
          the records behind it — Cash in/out filter the ledger table
          below, Net position clears the filter, and Total revenue jumps to
          /orders since revenue lives on a different index (Order, not
          CashTransaction) entirely. */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label={t('cash_page.cash_in')} value={summary?.cashIn} accent="green"
          active={cardFilter === 'IN'} onClick={() => setCardFilter('IN')} />
        <SummaryCard label={t('cash_page.cash_out')} value={summary?.cashOut} accent="amber"
          active={cardFilter === 'OUT'} onClick={() => setCardFilter('OUT')} />
        <SummaryCard label={t('cash_page.net_position')} value={summary?.netPosition} accent="brand"
          active={cardFilter === 'ALL'} onClick={() => setCardFilter('ALL')} />
        <SummaryCard label={t('cash_page.total_revenue')} value={summary?.totalRevenue} accent="stone" href="/orders" />
      </div>

      <form onSubmit={addTransaction} className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-white p-5 shadow-card sm:grid-cols-5">
        <select className={inputClasses} value={type} onChange={e => setType(e.target.value as CashTransactionType)}>
          <option value="IN">{t('cash_page.type_in')}</option>
          <option value="OUT">{t('cash_page.type_out')}</option>
        </select>
        <input className={inputClasses} placeholder={t('cash_page.category_placeholder')} value={category} onChange={e => setCategory(e.target.value)} required />
        <input type="number" step="0.01" min="0.01" className={inputClasses} placeholder={t('cash_page.amount_placeholder')} value={amount} onChange={e => setAmount(e.target.value)} required />
        <input className={inputClasses} placeholder={t('cash_page.note_placeholder')} value={note} onChange={e => setNote(e.target.value)} />
        <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50">
          {saving ? t('cash_page.saving') : t('cash_page.add_entry')}
        </button>
      </form>

      {cardFilter !== 'ALL' && (
        <div className="mb-3 flex items-center gap-2 text-xs text-stone-500">
          <span>{t(cardFilter === 'IN' ? 'cash_page.filter_showing_in' : 'cash_page.filter_showing_out')}</span>
          <button onClick={() => setCardFilter('ALL')} className="font-medium text-brand-700 hover:text-brand-800">
            {t('cash_page.filter_clear')}
          </button>
        </div>
      )}

      {visibleTransactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-400">
          {t('cash_page.no_entries')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                <th className="px-4 py-2.5">{t('cash_page.category_placeholder')}</th>
                <th className="px-4 py-2.5">{t('new_order_page.total')}</th>
                <th className="px-4 py-2.5">{t('cash_page.note_placeholder')}</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visibleTransactions.map(tx => (
                <tr key={tx.id}>
                  <td className="px-4 py-2.5 font-medium text-stone-900">{tx.category}</td>
                  <td className={`px-4 py-2.5 font-medium ${tx.type === 'IN' ? 'text-emerald-700' : 'text-red-600'}`}>
                    {tx.type === 'IN' ? '+' : '−'}{Number(tx.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-stone-500">{tx.note ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-stone-400">{new Date(tx.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const ACCENT: Record<string, string> = {
  green: 'text-emerald-700',
  amber: 'text-amber-700',
  brand: 'text-brand-700',
  stone: 'text-stone-700'
}

// v3 follow-up: every summary card is now clickable and links to the
// records behind its number — either filtering the ledger table on this
// same page (`onClick` + `active`) or navigating to a different index
// entirely (`href`, used for Total Revenue → /orders). Exactly one of
// `onClick`/`href` is expected per card.
function SummaryCard({ label, value, accent, active, onClick, href }: {
  label: string
  value: string | undefined
  accent: string
  active?: boolean
  onClick?: () => void
  href?: string
}) {
  const content = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${ACCENT[accent]}`}>{value !== undefined ? Number(value).toFixed(2) : '—'}</p>
    </>
  )
  const className = `block w-full text-left rounded-xl border bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover ${
    active === true ? 'border-brand-300 ring-1 ring-brand-200' : 'border-stone-200'
  }`
  if (href !== undefined) {
    return <Link href={href} className={className}>{content}</Link>
  }
  return <button type="button" onClick={onClick} className={className}>{content}</button>
}
