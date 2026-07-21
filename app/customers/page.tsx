// v3 replan (Phase H — CRM). Search/list + inline "add customer" — the
// profile view (order history, total spend) lives at /customers/[id].
// Deliberately not a full marketing CRM (no campaigns/segments/tags), per
// ADR-013's "Customer data is minimal" note.
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { translateApiError } from '../../lib/apiError'
import { useAuth } from '../../lib/useAuth'
import Spinner from '../../components/Spinner'
import { Customer } from '../../lib/types'

export default function CustomersPage() {
  const { t } = useTranslation()
  const user = useAuth()
  const loggedIn = !!user

  // v3.1 follow-up 10k: "no rows yet" and "haven't asked yet" are different
  // answers, and rendering the first while the second is true is how a page
  // ends up announcing "no customers" a beat before showing twelve of them.
  // Starts true — the fetch is fired on mount, so loading is the truth on the
  // very first render.
  const [loadingList, setLoadingList] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function load(q: string) {
    api.get<Customer[]>('/api/customers', { params: q ? { q } : {} })
      .then(r => setCustomers(r.data))
      .catch(() => setCustomers([]))
      .finally(() => setLoadingList(false))
  }

  useEffect(() => {
    if (!loggedIn) return
    const handle = setTimeout(() => load(query), 250)
    return () => clearTimeout(handle)
  }, [query, loggedIn])

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim() === '') return
    setSaving(true)
    setError(null)
    try {
      await api.post('/api/customers', {
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined
      })
      setName('')
      setPhone('')
      setAddress('')
      setNotes('')
      setShowAdd(false)
      load(query)
    } catch (err) {
      setError(translateApiError(err, t, t('customers_page.error_save')))
    } finally {
      setSaving(false)
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{t('customers_page.title')}</h1>
        <button onClick={() => setShowAdd(v => !v)}
          className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          {t('customers_page.add_customer')}
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {showAdd && (
        <form onSubmit={addCustomer} className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-surface p-5 shadow-card sm:grid-cols-3">
          <input className={inputClasses} placeholder={t('customers_page.name_placeholder')} value={name} onChange={e => setName(e.target.value)} required />
          <input className={inputClasses} placeholder={t('customers_page.phone_placeholder')} value={phone} onChange={e => setPhone(e.target.value)} />
          <input className={inputClasses} placeholder={t('customers_page.address_placeholder')} value={address} onChange={e => setAddress(e.target.value)} />
          <textarea className={`${inputClasses} sm:col-span-2`} rows={2} placeholder={t('customers_page.notes_placeholder')} value={notes} onChange={e => setNotes(e.target.value)} />
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? t('customers_page.saving') : t('customers_page.save')}
          </button>
        </form>
      )}

      <input className={`${inputClasses} mb-4`} placeholder={t('customers_page.search_placeholder')} value={query} onChange={e => setQuery(e.target.value)} />

      {!loggedIn ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-surface p-10 text-center">
          <p className="text-sm text-stone-500">{t('orders_page.please_login')}</p>
        </div>
      ) : loadingList ? (
        <Spinner />
      ) : customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-surface p-10 text-center">
          <p className="text-sm text-stone-500">{t('customers_page.no_customers')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-surface shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100 text-start text-[11px] font-bold uppercase tracking-[0.08em] text-stone-500">
                <th className="px-4 py-2.5 text-start">{t('customers_page.name_placeholder')}</th>
                <th className="px-4 py-2.5 text-start">{t('customers_page.phone_placeholder')}</th>
                {/* Action column: no label, but it must still carry the same
                    end alignment as the cell beneath it. */}
                <th className="w-28 px-4 py-2.5 text-end"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {customers.map(c => (
                <tr key={c.id} className="transition-colors hover:bg-stone-50">
                  <td className="px-4 py-2.5 font-medium text-stone-900">{c.name}</td>
                  <td className="px-4 py-2.5 text-stone-600">{c.phone ?? '—'}</td>
                  <td className="px-4 py-2.5 text-end">
                    <Link href={`/customers/${c.id}`} className="text-xs font-medium text-brand-700 hover:text-brand-800">
                      {t('customers_page.view_profile')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
