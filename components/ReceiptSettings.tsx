// v3.1 follow-up 10 — the Receipt section of /settings.
//
// Split into its own component rather than growing app/settings/page.tsx: that
// file was already at 300 lines with two different save patterns in it, and
// this section adds sixteen fields. It owns its own draft state and Save
// button, so nothing here touches the Alerts/Email forms beside it.
//
// A live preview sits next to the form, rendered by the *same* Receipt
// component the printer uses — so what's on screen is what comes out of the
// printer, rather than a hand-maintained mock that drifts.
'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { translateApiError } from '../lib/apiError'
import { Order, ShopSettings } from '../lib/types'
import Receipt from './Receipt'
import LogoInput from './LogoInput'

const TOGGLES = [
  'receiptShowShopName',
  'receiptShowPhone',
  'receiptShowAddress',
  'receiptShowOrderNo',
  'receiptShowDateTime',
  'receiptShowCashier',
  'receiptShowCode',
  'receiptShowItems',
  'receiptShowCustomer',
  'receiptShowAddressOfCustomer',
] as const

type ToggleKey = (typeof TOGGLES)[number]

// A stand-in order for the preview — deliberately fake rather than the shop's
// most recent real one, so opening Settings never leaks a customer's name and
// spend onto a screen that might be facing the counter.
const PREVIEW_ORDER = {
  id: 'preview',
  dailyNumber: 42,
  customer: 'Preview',
  createdAt: new Date().toISOString(),
  totalAmount: '137.50',
  paymentMethod: 'cash',
  status: 'COMPLETED',
  source: 'cashier',
  receiptCode: 'K7M2QX94',
  deliveryAddress: null,
  customerMessage: null,
  items: [
    { id: 'p1', productId: 'p1', kg: '1.250', price: '87.50', product: { name: 'Beef · Kandoz', unit: 'kg' } },
    { id: 'p2', productId: 'p2', kg: '0.500', price: '50.00', product: { name: 'Lamb shoulder', unit: 'kg' } },
  ],
} as unknown as Order

export default function ReceiptSettings({
  settings,
  onSaved,
}: {
  settings: ShopSettings
  onSaved: (next: ShopSettings) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<ShopSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Re-sync if the parent reloads settings (e.g. after an email field saves).
  useEffect(() => { setDraft(settings) }, [settings])

  function set<K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) {
    setSaved(false)
    setDraft(d => ({ ...d, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const payload = {
        receiptWidthMm: Number(draft.receiptWidthMm),
        // Empty height means "as tall as the content needs" — a continuous
        // roll — which the API models as null rather than 0.
        receiptHeightMm: draft.receiptHeightMm === null ? null : Number(draft.receiptHeightMm),
        receiptFontScale: Number(draft.receiptFontScale),
        receiptHeaderText: draft.receiptHeaderText === '' ? null : draft.receiptHeaderText,
        receiptFooterText: draft.receiptFooterText === '' ? null : draft.receiptFooterText,
        receiptLogoUrl: draft.receiptLogoUrl === '' ? null : draft.receiptLogoUrl,
        appLogoUrl: draft.appLogoUrl === '' ? null : draft.appLogoUrl,
        shopName: draft.shopName,
        shopPhone: draft.shopPhone === '' ? null : draft.shopPhone,
        shopAddress: draft.shopAddress === '' ? null : draft.shopAddress,
        // Decimal-as-string on the way in, number on the way out — the API
        // takes a number here, same as the other numeric settings.
        deliveryFeeEnabled: draft.deliveryFeeEnabled,
        deliveryFee: Number(draft.deliveryFee),
        ...Object.fromEntries(TOGGLES.map(key => [key, draft[key]])),
      }
      const r = await api.patch<ShopSettings>('/api/shop-settings', payload)
      onSaved(r.data)
      setSaved(true)
    } catch (err) {
      setError(translateApiError(err, t, t('settings_page.receipt.error_save')))
    } finally {
      setSaving(false)
    }
  }

  const label = 'mb-1 block text-xs font-semibold text-stone-600'

  return (
    <div className="rounded-xl border border-stone-200 bg-surface p-5 shadow-card">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.08em] text-stone-500">
        {t('settings_page.receipt.title')}
      </h2>
      <p className="mb-4 text-xs text-stone-400">{t('settings_page.receipt.hint')}</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label>
              <span className={label}>{t('settings_page.receipt.width')}</span>
              <input type="number" min="40" max="210" value={draft.receiptWidthMm}
                onChange={e => set('receiptWidthMm', Number(e.target.value))} />
            </label>
            <label>
              <span className={label}>{t('settings_page.receipt.height')}</span>
              <input type="number" min="40" max="2000" value={draft.receiptHeightMm ?? ''}
                placeholder={t('settings_page.receipt.height_auto')}
                onChange={e => set('receiptHeightMm', e.target.value === '' ? null : Number(e.target.value))} />
            </label>
            <label>
              <span className={label}>{t('settings_page.receipt.font_scale')}</span>
              <input type="number" min="0.6" max="2" step="0.05" value={draft.receiptFontScale}
                onChange={e => set('receiptFontScale', e.target.value)} />
            </label>
          </div>

          {/* v3.4 — flat delivery fee. Off by default; when on it's added to
              the total of any order that has a delivery address, and printed
              as its own line above the total. The amount stays editable while
              disabled so a shop can set it up before switching it on. */}
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="w-auto" checked={draft.deliveryFeeEnabled}
                onChange={e => set('deliveryFeeEnabled', e.target.checked)} />
              <span className="text-sm font-medium text-stone-700">{t('settings_page.receipt.delivery_fee_enabled')}</span>
            </label>
            <label className="mt-2 block max-w-[12rem]">
              <span className={label}>{t('settings_page.receipt.delivery_fee')}</span>
              <input type="number" min="0" step="0.01" value={draft.deliveryFee}
                disabled={!draft.deliveryFeeEnabled}
                onChange={e => set('deliveryFee', e.target.value)} />
            </label>
            <p className="mt-1.5 text-xs text-stone-500">{t('settings_page.receipt.delivery_fee_hint')}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={label}>{t('settings_page.receipt.shop_name')}</span>
              <input value={draft.shopName} onChange={e => set('shopName', e.target.value)} />
            </label>
            <label>
              <span className={label}>{t('settings_page.receipt.shop_phone')}</span>
              <input value={draft.shopPhone ?? ''} onChange={e => set('shopPhone', e.target.value)} />
            </label>
          </div>

          <label className="block">
            <span className={label}>{t('settings_page.receipt.shop_address')}</span>
            <textarea rows={2} value={draft.shopAddress ?? ''} onChange={e => set('shopAddress', e.target.value)} />
          </label>

          {/* v3.1 follow-up 10e: two logos, not one. The receipt mark is
              printed by a thermal printer — usually a small, high-contrast
              version — while the app mark sits in the nav rail at 28px in
              full colour. Same picker, different targets. */}
          <LogoInput
            label={t('settings_page.receipt.logo_url')}
            hint={t('settings_page.logo.receipt_hint')}
            value={draft.receiptLogoUrl ?? null}
            onChange={v => set('receiptLogoUrl', v)}
          />

          <LogoInput
            label={t('settings_page.logo.app_label')}
            hint={t('settings_page.logo.app_hint')}
            value={draft.appLogoUrl ?? null}
            onChange={v => set('appLogoUrl', v)}
          />

          <label className="block">
            <span className={label}>{t('settings_page.receipt.header_text')}</span>
            <textarea rows={2} value={draft.receiptHeaderText ?? ''}
              onChange={e => set('receiptHeaderText', e.target.value)} />
          </label>

          <label className="block">
            <span className={label}>{t('settings_page.receipt.footer_text')}</span>
            <textarea rows={2} value={draft.receiptFooterText ?? ''}
              onChange={e => set('receiptFooterText', e.target.value)} />
          </label>

          <fieldset>
            <legend className={label}>{t('settings_page.receipt.show_fields')}</legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {TOGGLES.map(key => (
                <label key={key} className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" className="h-4 w-4"
                    checked={draft[key] as boolean}
                    onChange={e => set(key as ToggleKey, e.target.checked as ShopSettings[ToggleKey])} />
                  {t(`settings_page.receipt.field_${key}`)}
                </label>
              ))}
            </div>
          </fieldset>

          {error !== null && <p className="text-sm text-red-700">{error}</p>}
          {saved && error === null && (
            <p className="text-sm text-green-700">{t('settings_page.saved')}</p>
          )}

          <button onClick={() => void save()} disabled={saving}
            className="btn btn-primary">
            {saving ? t('inventory_page.saving') : t('inventory_page.save')}
          </button>
        </div>

        {/* Live preview, rendered by the same component the printer uses. The
            outer div scrolls rather than the receipt shrinking, so a 210mm
            setting looks 210mm wide instead of silently fitting the panel. */}
        <div className="min-w-0 overflow-x-auto">
          <p className={label}>{t('settings_page.receipt.preview')}</p>
          <div className="inline-block rounded-lg border border-stone-200 bg-surface shadow-card">
            <Receipt
              order={PREVIEW_ORDER}
              settings={draft}
              cashierName={t('settings_page.receipt.preview_cashier')}
              labels={{
                receiptTitle: t('new_order_page.receipt_title'),
                deliveryFee: t('new_order_page.delivery_fee'),
                walkIn: t('orders_page.walk_in'),
                total: t('new_order_page.total'),
                receiptCode: t('new_order_page.receipt_code_label'),
                kg: t('new_order_page.kg_label'),
                customer: t('receipt_labels.customer'),
                phone: t('receipt_labels.phone'),
                address: t('receipt_labels.address'),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
