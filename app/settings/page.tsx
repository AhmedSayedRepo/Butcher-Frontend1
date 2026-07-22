// v3.1 follow-up 5 (Settings page). Consolidates shop-wide config that was
// previously either buried inline on /admin (pendingOrderAlertMinutes) or
// not configurable at all — hardcoded constants duplicated across backend
// and frontend (the low-stock default) or only settable via a Render env
// var (the outgoing-email sender — see backend/src/lib/email.ts; ADR-017
// covers why that's Brevo's HTTP API rather than Gmail SMTP). Admin-only,
// same tier as PATCH /api/shop-settings itself; same "shown to every
// logged-in user, no-access message for everyone else" pattern as
// /admin/cash rather than filtering the nav.
'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { translateApiError } from '../../lib/apiError'
import { useAuth, useAuthLoading } from '../../lib/useAuth'
import Spinner from '../../components/Spinner'
import { ShopSettings } from '../../lib/types'
import ReceiptSettings from '../../components/ReceiptSettings'
import ScaleBarcodeSettings from '../../components/ScaleBarcodeSettings'
import InfoHint from '../../components/InfoHint'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-3.08 4.32M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  )
}

// v3.1 follow-up 9 (ADR-016). One card per field, each independently
// saved via its own "Update" button — mirrors a reference design you
// shared, rather than this page's original single-shared-Save-button form.
// Scoped to the email fields only; Alerts & Stock below keeps the
// original shared form, since that's not what the reference covered.
function SettingsFieldCard({ label, badge, hint, value, type = 'text', placeholder, onUpdate, clearOnSave = false, skipEmptyUpdate = false }: {
  label: string
  badge?: string
  hint?: string
  value: string
  type?: 'text' | 'email' | 'password'
  placeholder?: string
  onUpdate: (nextValue: string) => Promise<void>
  clearOnSave?: boolean
  skipEmptyUpdate?: boolean
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(value)
  const [revealed, setRevealed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [fieldSaved, setFieldSaved] = useState(false)

  useEffect(() => { setDraft(value) }, [value])

  async function handleUpdate() {
    setFieldError(null)
    setFieldSaved(false)
    // The Brevo API key field never sends an empty value to the server —
    // "leave blank" means "don't touch the saved key", not "clear it".
    // Without this guard, an admin who clicks Update without typing
    // anything would silently wipe the stored key (the backend treats an
    // explicit '' as "clear").
    if (skipEmptyUpdate && draft.trim() === '') return
    setSaving(true)
    try {
      await onUpdate(draft)
      setFieldSaved(true)
      // Never leave a just-typed password sitting in the field after a
      // successful save — text fields (Email Sender, Sender name) skip
      // this and keep showing the value that was just confirmed saved.
      if (clearOnSave) setDraft('')
    } catch (err) {
      setFieldError(translateApiError(err, t, t('settings_page.error_save')))
    } finally {
      setSaving(false)
    }
  }

  const isPassword = type === 'password'
  const inputType = isPassword && !revealed ? 'password' : 'text'

  return (
    <div className="rounded-lg border border-stone-200 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        {/* The hint moved from an always-visible paragraph into this ⓘ tooltip
            — the form reads as a list of fields, not a wall of grey text. */}
        {hint !== undefined && <InfoHint text={hint} label={label} />}
        {badge !== undefined && (
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{badge}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            className={`w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ${isPassword ? 'pe-9' : ''}`}
            type={inputType}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={placeholder}
            autoComplete={isPassword ? 'new-password' : undefined}
          />
          {isPassword && (
            <button type="button" onClick={() => setRevealed(r => !r)}
              className="absolute inset-y-0 end-2 flex items-center text-stone-400 hover:text-stone-600">
              <EyeIcon open={revealed} />
            </button>
          )}
        </div>
        <button type="button" onClick={() => { void handleUpdate() }} disabled={saving}
          className="btn btn-secondary shrink-0">
          {saving ? t('settings_page.updating') : t('settings_page.update')}
        </button>
      </div>
      {fieldError !== null && <p className="mt-1.5 text-xs text-red-600">{fieldError}</p>}
      {fieldSaved && fieldError === null && <p className="mt-1.5 text-xs text-green-600">{t('settings_page.saved')}</p>}
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const user = useAuth()
  const authLoading = useAuthLoading()
  const isAdmin = user != null && user.role === 'admin'

  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [minutes, setMinutes] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  // v3.1 follow-up 10b: what this shop calls whoever takes a delivery out.
  const [deliveryLabel, setDeliveryLabel] = useState('Delivery')
  const [thresholdKg, setThresholdKg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    api.get<ShopSettings>('/api/shop-settings').then(r => {
      setSettings(r.data)
      setMinutes(String(r.data.pendingOrderAlertMinutes))
      setSoundEnabled(r.data.alertSoundEnabled)
      setDeliveryLabel(r.data.deliveryNameLabel)
      setThresholdKg(String(r.data.defaultLowStockThresholdKg))
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

    setSaving(true)
    try {
      const r = await api.patch<ShopSettings>('/api/shop-settings', {
        pendingOrderAlertMinutes: minutesValue,
        alertSoundEnabled: soundEnabled,
        defaultLowStockThresholdKg: thresholdValue,
        deliveryNameLabel: deliveryLabel.trim() === '' ? undefined : deliveryLabel.trim()
      })
      setSettings(r.data)
      setSaved(true)
    } catch (err) {
      setError(translateApiError(err, t, t('settings_page.error_save')))
    } finally {
      setSaving(false)
    }
  }

  // v3.1 follow-up 9 (ADR-016), renamed by ADR-017 (Gmail SMTP -> Brevo):
  // each email field below saves independently via SettingsFieldCard's own
  // "Update" button — these three functions are just thin PATCH wrappers,
  // one per field, so a change to one doesn't touch the other two.
  // `updateBrevoApiKey`'s card sets `skipEmptyUpdate`, so this only ever
  // runs with a real non-empty value — there's currently no UI path that
  // sends `''` to explicitly clear a saved API key.
  async function updateBrevoSenderEmail(nextValue: string): Promise<void> {
    const r = await api.patch<ShopSettings>('/api/shop-settings', { brevoSenderEmail: nextValue.trim() })
    setSettings(r.data)
  }
  async function updateSenderName(nextValue: string): Promise<void> {
    const r = await api.patch<ShopSettings>('/api/shop-settings', { mailSenderName: nextValue.trim() })
    setSettings(r.data)
  }
  async function updateBrevoApiKey(nextValue: string): Promise<void> {
    const r = await api.patch<ShopSettings>('/api/shop-settings', { brevoApiKey: nextValue.trim() })
    setSettings(r.data)
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
  const labelClasses = 'mb-1 block text-sm font-medium text-stone-700'

  // v3.1 follow-up 10h: "still checking" is not "denied". Without this the
  // permission check below is false while GET /auth/me is in flight, so the
  // page announced no access and then replaced it with the real content.
  if (authLoading) return <Spinner />

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-surface p-10 text-center">
        <p className="text-sm text-stone-500">{t('settings_page.no_access')}</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-stone-900">{t('settings')}</h1>
      <p className="mb-6 text-stone-500">{t('settings_page.subtitle')}</p>

      {settings === null ? (
        /* v3.1 follow-up 10k: the same spinner every other page waits with,
           instead of a dashed box containing the word "loading". */
        <Spinner label={t('settings_page.loading')} />
      ) : (
        <div className="max-w-4xl space-y-6">
          <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-stone-200 bg-surface p-5 shadow-card">
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

                <label>
                  <span className={labelClasses}>{t('settings_page.delivery_name_label')}</span>
                  <input className={inputClasses} value={deliveryLabel}
                    onChange={e => setDeliveryLabel(e.target.value)} />
                  <p className="mt-1 text-xs text-stone-400">{t('settings_page.delivery_name_hint')}</p>
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

            <button type="submit" disabled={saving}
              className="btn btn-primary">
              {saving ? t('customers_page.saving') : t('customers_page.save')}
            </button>
          </form>

          {/* v3.1 follow-up 9 (ADR-016), relabeled by ADR-017 (Gmail SMTP ->
              Brevo — Render's free tier blocks outbound SMTP ports entirely):
              each field below saves independently (its own "Update" button)
              rather than sharing the form above — matches a reference design
              shared for this section specifically. */}
          <div className="rounded-xl border border-stone-200 bg-surface p-5 shadow-card">
            {/* v3.3: the long section note and the per-field hints are now
                ⓘ tooltips, not paragraphs — the full step-by-step lives in Help
                → "Setting up outgoing email". */}
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{t('settings_page.section_email')}</h2>
              <InfoHint text={t('settings_page.section_email_note')} />
            </div>
            <div className="space-y-3">
              <SettingsFieldCard
                label={t('settings_page.brevo_sender_label')}
                badge={t('settings_page.optional_badge')}
                hint={t('settings_page.brevo_sender_hint')}
                value={settings.brevoSenderEmail ?? ''}
                type="email"
                placeholder="you@yourshop.com"
                onUpdate={updateBrevoSenderEmail}
              />
              <SettingsFieldCard
                label={t('settings_page.sender_name_label')}
                hint={t('settings_page.sender_name_hint')}
                value={settings.mailSenderName}
                placeholder="Butcher Cashier"
                onUpdate={updateSenderName}
              />
              <SettingsFieldCard
                label={t('settings_page.brevo_api_key_label')}
                badge={t('settings_page.optional_badge')}
                hint={settings.brevoApiKeySet ? t('settings_page.brevo_api_key_hint_configured') : t('settings_page.brevo_api_key_hint_unconfigured')}
                value=""
                type="password"
                placeholder={settings.brevoApiKeySet ? t('settings_page.brevo_api_key_placeholder_set') : t('settings_page.brevo_api_key_placeholder_unset')}
                onUpdate={updateBrevoApiKey}
                clearOnSave
                skipEmptyUpdate
              />
            </div>
          </div>

          <ReceiptSettings settings={settings} onSaved={setSettings} />

          <ScaleBarcodeSettings settings={settings} onSaved={setSettings} />
        </div>
      )}
    </div>
  )
}
