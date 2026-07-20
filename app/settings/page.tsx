// v3.1 follow-up 5 (Settings page). Consolidates shop-wide config that was
// previously either buried inline on /admin (pendingOrderAlertMinutes) or
// not configurable at all — hardcoded constants duplicated across backend
// and frontend (the low-stock default) or only settable via a Render env
// var (the outgoing-email sender name, before the Gmail SMTP switch — see
// backend/src/lib/email.ts). Admin-only, same tier as PATCH /api/shop-settings
// itself; same "shown to every logged-in user, no-access message for
// everyone else" pattern as /admin/cash rather than filtering the nav.
'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { extractApiErrorMessage } from '../../lib/apiError'
import { useAuth } from '../../lib/useAuth'
import { ShopSettings } from '../../lib/types'

export default function SettingsPage() {
  const { t } = useTranslation()
  const user = useAuth()
  const isAdmin = user != null && user.role === 'admin'

  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [minutes, setMinutes] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [thresholdKg, setThresholdKg] = useState('')
  const [senderName, setSenderName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    api.get<ShopSettings>('/api/shop-settings').then(r => {
      setSettings(r.data)
      setMinutes(String(r.data.pendingOrderAlertMinutes))
      setSoundEnabled(r.data.alertSoundEnabled)
      setThresholdKg(String(r.data.defaultLowStockThresholdKg))
      setSenderName(r.data.mailSenderName)
    }).catch(() => setSettings(null))
  }, [isAdmin])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)

    const minutesValue = Number(minutes)
    const thresholdValue = Number(thresholdKg)
    if (!minutesValue || minutesValue <= 0) {
      setError(t('settings_page.error_minutes'))
      return
    }
    if (!thresholdValue || thresholdValue <= 0) {
      setError(t('settings_page.error_threshold'))
      return
    }
    if (senderName.trim() === '') {
      setError(t('settings_page.error_sender_name'))
      return
    }

    setSaving(true)
    try {
      const r = await api.patch<ShopSettings>('/api/shop-settings', {
        pendingOrderAlertMinutes: minutesValue,
        alertSoundEnabled: soundEnabled,
        defaultLowStockThresholdKg: thresholdValue,
        mailSenderName: senderName.trim()
      })
      setSettings(r.data)
      setSaved(true)
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? t('settings_page.error_save'))
    } finally {
      setSaving(false)
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
  const labelClasses = 'mb-1 block text-sm font-medium text-stone-700'

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
        <p className="text-sm text-stone-500">{t('settings_page.no_access')}</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-stone-900">{t('settings')}</h1>
      <p className="mb-6 text-stone-500">{t('settings_page.subtitle')}</p>

      {settings === null ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">{t('settings_page.loading')}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="max-w-xl space-y-6 rounded-xl border border-stone-200 bg-white p-5 shadow-card">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {saved && !error && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{t('settings_page.saved')}</div>
          )}

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">{t('settings_page.section_alerts')}</h2>
            <div className="space-y-4">
              <label>
                <span className={labelClasses}>{t('settings_page.pending_order_minutes_label')}</span>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" className={`${inputClasses} w-28`}
                    value={minutes} onChange={e => setMinutes(e.target.value)} />
                  <span className="text-sm text-stone-500">{t('admin_page.minutes')}</span>
                </div>
                <p className="mt-1 text-xs text-stone-400">{t('settings_page.pending_order_minutes_hint')}</p>
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-100" />
                <span className="text-sm text-stone-700">{t('settings_page.alert_sound_label')}</span>
              </label>

              <label>
                <span className={labelClasses}>{t('settings_page.low_stock_threshold_label')}</span>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.001" min="0.001" className={`${inputClasses} w-28`}
                    value={thresholdKg} onChange={e => setThresholdKg(e.target.value)} />
                  <span className="text-sm text-stone-500">kg</span>
                </div>
                <p className="mt-1 text-xs text-stone-400">{t('settings_page.low_stock_threshold_hint')}</p>
              </label>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">{t('settings_page.section_email')}</h2>
            <label>
              <span className={labelClasses}>{t('settings_page.sender_name_label')}</span>
              <input className={inputClasses} value={senderName} onChange={e => setSenderName(e.target.value)}
                placeholder="Butcher Cashier" />
              <p className="mt-1 text-xs text-stone-400">{t('settings_page.sender_name_hint')}</p>
            </label>
          </div>

          <button type="submit" disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? t('customers_page.saving') : t('customers_page.save')}
          </button>
        </form>
      )}
    </div>
  )
}
