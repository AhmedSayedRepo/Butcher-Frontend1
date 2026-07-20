'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import api from '../../lib/api'
import { useAuth } from '../../lib/useAuth'
import { ShopSettings } from '../../lib/types'

// v2 replan, Phase D: was a static placeholder ("still a static placeholder,
// no real users/branding/settings functionality" — ROADMAP.md). Now links to
// the real /admin/users screen, plus (v3 replan) /admin/cash and this page's
// own inline shop-settings form for Phase J's alert threshold.
export default function AdminPage(){
  const { t } = useTranslation()
  const user = useAuth()
  const caps = user != null && Array.isArray(user.caps) ? user.caps : []
  const canManageUsers = caps.includes('manage_users')
  const canManageCash = caps.includes('manage_cash')
  const isAdmin = user != null && user.role === 'admin'

  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [minutes, setMinutes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    api.get<ShopSettings>('/api/shop-settings').then(r => { setSettings(r.data); setMinutes(String(r.data.pendingOrderAlertMinutes)) }).catch(() => setSettings(null))
  }, [isAdmin])

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    const value = Number(minutes)
    if (!value || value <= 0) return
    setSaving(true)
    try {
      const r = await api.patch<ShopSettings>('/api/shop-settings', { pendingOrderAlertMinutes: value })
      setSettings(r.data)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">{t('admin')}</h1>

      {canManageUsers && (
        <Link
          href="/admin/users"
          className="mb-4 flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover"
        >
          <span className="font-medium text-stone-900">{t('admin_page.manage_users')}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      )}

      {canManageCash && (
        <Link
          href="/admin/cash"
          className="mb-4 flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover"
        >
          <span className="font-medium text-stone-900">{t('admin_page.manage_cash')}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      )}

      {/* v3 replan (Phase J, ADR-010): shop-wide alert threshold — admin-only,
          same policy tier as user management. */}
      {isAdmin && settings !== null && (
        <form onSubmit={saveSettings} className="mb-4 rounded-xl border border-stone-200 bg-white p-4 shadow-card">
          <p className="mb-2 text-sm font-medium text-stone-900">{t('admin_page.alert_threshold_label')}</p>
          <div className="flex items-center gap-2">
            <input type="number" min="1" className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              value={minutes} onChange={e => setMinutes(e.target.value)} />
            <span className="text-sm text-stone-500">{t('admin_page.minutes')}</span>
            <button type="submit" disabled={saving} className="ml-auto rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? t('customers_page.saving') : t('customers_page.save')}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <p className="text-sm text-stone-500">{t('admin_page.subtitle')}</p>
      </div>
    </div>
  )
}
