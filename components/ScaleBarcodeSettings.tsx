// v3.3 — the Scale barcodes section of /settings.
//
// Its own component (like ReceiptSettings) rather than more lines in the
// settings page: it owns a whole config object plus a live tester, and keeps
// its Save button separate from the Alerts/Email/Receipt forms beside it.
//
// The tester is the point of the design. A weighing-scale label is just fixed
// digit positions, but which positions vary by scale — so instead of asking
// the shop to trust that they counted right, they paste a real label, hit
// Test, and see the item code, the weight/price it read, and which product it
// maps to. Getting a position wrong shows up as "matched the wrong product"
// rather than a bad weight discovered at the counter. The tester calls the
// backend with the *unsaved* config, so it exercises the exact parser a scan
// will use.
'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { translateApiError } from '../lib/apiError'
import { ScaleBarcodeConfig, ShopSettings } from '../lib/types'
import { useToast } from './ToastProvider'

// A sensible EAN-13 starting point: prefix 2, a 5-digit item code, a 5-digit
// weight in grams, EAN check digit on. A shop with a different scale changes
// these; nobody starts from a blank form.
const DEFAULT_CONFIG: ScaleBarcodeConfig = {
  enabled: false,
  prefix: '2',
  totalLength: 13,
  itemStart: 2,
  itemLength: 5,
  valueStart: 8,
  valueLength: 5,
  valueType: 'weight',
  valueDivisor: 1000,
  validateCheckDigit: true,
}

type TestResult =
  | { matched: false }
  | { matched: true, itemCode: string, value: number, valueType: 'weight' | 'price', productName: string | null }

export default function ScaleBarcodeSettings({
  settings,
  onSaved,
}: {
  settings: ShopSettings
  onSaved: (next: ShopSettings) => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [config, setConfig] = useState<ScaleBarcodeConfig>(settings.scaleBarcodeConfig ?? DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [sample, setSample] = useState('')
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  useEffect(() => { setConfig(settings.scaleBarcodeConfig ?? DEFAULT_CONFIG) }, [settings])

  function setField<K extends keyof ScaleBarcodeConfig>(key: K, value: ScaleBarcodeConfig[K]): void {
    setConfig(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function setNumber(key: 'totalLength' | 'itemStart' | 'itemLength' | 'valueStart' | 'valueLength' | 'valueDivisor', raw: string): void {
    const parsed = Number(raw)
    setField(key, Number.isFinite(parsed) ? parsed : 0)
  }

  async function save(): Promise<void> {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const r = await api.patch<ShopSettings>('/api/shop-settings', { scaleBarcodeConfig: config })
      onSaved(r.data)
      setSaved(true)
      toast.success(t('toast.settings_saved'))
    } catch {
      // Reported by the global error toast — see the response
      // interceptor in lib/api.ts. A second inline copy would be noise.
    } finally {
      setSaving(false)
    }
  }

  async function runTest(): Promise<void> {
    setTestError(null)
    setTestResult(null)
    try {
      const r = await api.post<TestResult>('/api/shop-settings/scale-barcode/test', { config, sample: sample.trim() })
      setTestResult(r.data)
    } catch (err) {
      setTestError(translateApiError(err, t, t('settings_page.scale_test_error')))
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
  const labelClasses = 'mb-1 block text-xs font-medium text-stone-600'

  return (
    <div className="rounded-xl border border-stone-200 bg-surface p-5 shadow-card">
      <h2 className="mb-1 text-base font-bold tracking-tight text-stone-900">{t('settings_page.scale_section_title')}</h2>
      <p className="mb-4 text-xs leading-relaxed text-stone-500">{t('settings_page.scale_section_note')}</p>

      <label className="mb-4 flex items-center gap-2">
        <input type="checkbox" checked={config.enabled} onChange={e => setField('enabled', e.target.checked)} />
        <span className="text-sm font-medium text-stone-700">{t('settings_page.scale_enabled_label')}</span>
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label>
          <span className={labelClasses}>{t('settings_page.scale_prefix_label')}</span>
          <input className={inputClasses} value={config.prefix} inputMode="numeric"
            placeholder={t('settings_page.scale_prefix_hint')}
            onChange={e => setField('prefix', e.target.value)} />
        </label>
        <label>
          <span className={labelClasses}>{t('settings_page.scale_total_length_label')}</span>
          <input type="number" min="6" className={inputClasses} value={String(config.totalLength)}
            onChange={e => setNumber('totalLength', e.target.value)} />
        </label>
        <label>
          <span className={labelClasses}>{t('settings_page.scale_value_type_label')}</span>
          <select className={inputClasses} value={config.valueType}
            onChange={e => setField('valueType', e.target.value === 'price' ? 'price' : 'weight')}>
            <option value="weight">{t('settings_page.scale_value_type_weight')}</option>
            <option value="price">{t('settings_page.scale_value_type_price')}</option>
          </select>
        </label>

        <label>
          <span className={labelClasses}>{t('settings_page.scale_item_start_label')}</span>
          <input type="number" min="1" className={inputClasses} value={String(config.itemStart)}
            onChange={e => setNumber('itemStart', e.target.value)} />
        </label>
        <label>
          <span className={labelClasses}>{t('settings_page.scale_item_length_label')}</span>
          <input type="number" min="1" className={inputClasses} value={String(config.itemLength)}
            onChange={e => setNumber('itemLength', e.target.value)} />
        </label>
        <label>
          <span className={labelClasses}>{t('settings_page.scale_divisor_label')}</span>
          <input type="number" min="1" className={inputClasses} value={String(config.valueDivisor)}
            title={t('settings_page.scale_divisor_hint')}
            onChange={e => setNumber('valueDivisor', e.target.value)} />
        </label>

        <label>
          <span className={labelClasses}>{t('settings_page.scale_value_start_label')}</span>
          <input type="number" min="1" className={inputClasses} value={String(config.valueStart)}
            onChange={e => setNumber('valueStart', e.target.value)} />
        </label>
        <label>
          <span className={labelClasses}>{t('settings_page.scale_value_length_label')}</span>
          <input type="number" min="1" className={inputClasses} value={String(config.valueLength)}
            onChange={e => setNumber('valueLength', e.target.value)} />
        </label>
        <label className="flex items-end gap-2 pb-2">
          <input type="checkbox" checked={config.validateCheckDigit} onChange={e => setField('validateCheckDigit', e.target.checked)} />
          <span className="text-xs font-medium text-stone-700">{t('settings_page.scale_check_digit_label')}</span>
        </label>
      </div>

      <p className="mt-2 text-xs text-stone-400">{t('settings_page.scale_divisor_hint')}</p>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={() => { void save() }} disabled={saving} className="btn btn-primary btn-sm">
          {saving ? t('settings_page.scale_saving') : t('settings_page.scale_save')}
        </button>
        {saved && <span className="text-xs font-medium text-emerald-600">{t('settings_page.scale_saved')}</span>}
        {error !== null && <span className="text-xs text-red-600">{error}</span>}
      </div>

      {/* Tester — paste a real label, see what a scan would do. */}
      <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50 p-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">{t('settings_page.scale_test_title')}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${inputClasses} max-w-xs`} value={sample} inputMode="numeric"
            placeholder={t('settings_page.scale_test_placeholder')}
            onChange={e => setSample(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void runTest() } }} />
          <button type="button" onClick={() => { void runTest() }} disabled={sample.trim() === ''} className="btn btn-secondary btn-sm">
            {t('settings_page.scale_test_button')}
          </button>
        </div>
        {testError !== null && <p className="mt-2 text-xs text-red-600">{testError}</p>}
        {testResult !== null && !testResult.matched && (
          <p className="mt-2 text-xs font-medium text-amber-700">{t('settings_page.scale_test_no_match')}</p>
        )}
        {testResult !== null && testResult.matched && (
          <div className="mt-2 space-y-0.5 text-xs text-stone-700">
            <p>{t('settings_page.scale_test_matched', { code: testResult.itemCode })}</p>
            <p className="font-semibold">
              {testResult.valueType === 'price'
                ? t('settings_page.scale_test_value_price', { value: testResult.value.toFixed(2) })
                : t('settings_page.scale_test_value_weight', { value: testResult.value.toFixed(3) })}
            </p>
            <p className={testResult.productName === null ? 'text-amber-700' : 'text-emerald-700'}>
              {testResult.productName === null
                ? t('settings_page.scale_test_no_product')
                : t('settings_page.scale_test_product', { name: testResult.productName })}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
