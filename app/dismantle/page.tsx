// v2 replan (Phase B.5) — carcass dismantling module. Pick a seeded template
// (12 across calf/sheep/goat, see Butcher-Project-Plan-v2.md), record a
// carcass breakdown against it, and see the auto-calculated yield variance
// the backend computes on read (content-per-kilo per cut, waste % overall —
// see backend/src/routes/dismantleEvents.ts's withComputedFields).
'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { translateApiError } from '../../lib/apiError'
import { useAuth, useAuthLoading } from '../../lib/useAuth'
import Spinner from '../../components/Spinner'
import { DismantleEvent, DismantleTemplate, Product } from '../../lib/types'
import { ANIMAL_TYPE_AR, CUT_NAME_AR, TEMPLATE_NAME_AR, localizedName } from '../../lib/dismantleNames'

type CutInput = { actualWeightKg: string, productId: string }
const PERCENT_MULTIPLIER = 100
const WEIGHT_DECIMALS = 3

export default function DismantlePage() {
  const { t, i18n } = useTranslation()
  const user = useAuth()
  const authLoading = useAuthLoading()
  const canDismantle = user != null && Array.isArray(user.caps) && user.caps.includes('dismantle_carcass')

  const [templates, setTemplates] = useState<DismantleTemplate[]>([])
  const [products, setProducts] = useState<Product[]>([])
  // v3.1 follow-up 10k: "no rows yet" and "haven't asked yet" are different
  // answers. Starts true — the fetch fires on mount, so loading is the truth
  // on the very first render.
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [events, setEvents] = useState<DismantleEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  const [templateId, setTemplateId] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [inputWeightKg, setInputWeightKg] = useState('')
  const [cutInputs, setCutInputs] = useState<Record<string, CutInput>>({})
  const [submitting, setSubmitting] = useState(false)

  // v3.1 follow-up 13: inline edit/delete for a recorded breakdown. Only one
  // event can be in edit mode at a time — editDraft is null when nothing's
  // being edited, keyed by editingEventId otherwise.
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editSourceLabel, setEditSourceLabel] = useState('')
  const [editInputWeightKg, setEditInputWeightKg] = useState('')
  const [editOutputWeights, setEditOutputWeights] = useState<Record<string, string>>({})
  const [eventBusyId, setEventBusyId] = useState<string | null>(null)

  useEffect(() => {
    api.get<DismantleTemplate[]>('/api/dismantle-templates')
      .then(r => {
        setTemplates(r.data)
        if (r.data.length > 0) setTemplateId(r.data[0].id)
      })
      .catch((err: unknown) => setError(translateApiError(err, t, t('dismantle_page.error_load_templates'))))
    api.get<Product[]>('/api/products').then(r => setProducts(r.data)).catch(() => undefined)
  }, [t])

  function loadEvents() {
    if (!canDismantle) return
    api.get<DismantleEvent[]>('/api/dismantle-events')
      .then(r => setEvents(r.data))
      .catch((err: unknown) => setError(translateApiError(err, t, t('dismantle_page.error_load_events'))))
      .finally(() => setLoadingEvents(false))
  }

  useEffect(() => {
    loadEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the capability itself changes, not on every render
  }, [canDismantle])

  const selectedTemplate = templates.find(tpl => tpl.id === templateId) ?? null

  // v3.1 follow-up: pre-fill each cut's actual weight from the carcass
  // weight × the template's expected yield %, so staff start from a
  // realistic estimate instead of a blank field for every cut. Still fully
  // editable per cut afterward — this is a starting point, not a lock; the
  // whole point of recording an *actual* weight is capturing when it
  // differs from the expectation. Deliberately keyed only on
  // `inputWeightKg`/`templateId` (not `cutInputs`/`cutInput`), so editing
  // one cut's actual weight by hand doesn't get overwritten by this effect
  // re-running — only changing the total weight or switching templates does.
  useEffect(() => {
    const weight = Number(inputWeightKg)
    if (selectedTemplate === null || inputWeightKg.trim() === '' || weight <= 0) return
    setCutInputs(prev => {
      const next = { ...prev }
      for (const cut of selectedTemplate.cuts) {
        const pct = Number(cut.expectedYieldPct)
        const estimated = (weight * pct / PERCENT_MULTIPLIER).toFixed(WEIGHT_DECIMALS)
        const current = prev[cut.cutName] ?? { actualWeightKg: '', productId: '' }
        next[cut.cutName] = { ...current, actualWeightKg: estimated }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately excludes cutInputs/cutInput; see comment above.
  }, [inputWeightKg, templateId])

  function cutInput(cutName: string): CutInput {
    return cutInputs[cutName] ?? { actualWeightKg: '', productId: '' }
  }

  function setCutInput(cutName: string, next: Partial<CutInput>) {
    setCutInputs(prev => ({ ...prev, [cutName]: { ...cutInput(cutName), ...next } }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (selectedTemplate === null) return

    const outputs = selectedTemplate.cuts
      .map(cut => {
        const input = cutInput(cut.cutName)
        const weight = Number(input.actualWeightKg)
        if (!input.actualWeightKg || weight <= 0) return null
        return {
          cutName: cut.cutName,
          actualWeightKg: weight,
          isOffal: cut.isOffal,
          isByproduct: cut.isByproduct,
          productId: input.productId === '' ? undefined : input.productId
        }
      })
      .filter((o): o is NonNullable<typeof o> => o !== null)

    if (outputs.length === 0) {
      setError(t('dismantle_page.error_no_outputs'))
      return
    }

    setSubmitting(true)
    try {
      await api.post('/api/dismantle-events', {
        templateId,
        sourceLabel,
        inputWeightKg: Number(inputWeightKg),
        outputs
      })
      setSourceLabel('')
      setInputWeightKg('')
      setCutInputs({})
      loadEvents()
    } catch {
      // Reported by the global error toast — see the response
      // interceptor in lib/api.ts. A second inline copy would be noise.
    } finally {
      setSubmitting(false)
    }
  }

  function startEditEvent(ev: DismantleEvent) {
    setEditingEventId(ev.id)
    setEditSourceLabel(ev.sourceLabel)
    setEditInputWeightKg(ev.inputWeightKg)
    setEditOutputWeights(Object.fromEntries(ev.outputs.map(o => [o.id, o.actualWeightKg])))
    setError(null)
  }

  function cancelEditEvent() {
    setEditingEventId(null)
  }

  async function saveEditEvent(ev: DismantleEvent) {
    setEventBusyId(ev.id)
    setError(null)
    try {
      await api.patch(`/api/dismantle-events/${ev.id}`, {
        sourceLabel: editSourceLabel,
        inputWeightKg: Number(editInputWeightKg),
        outputs: ev.outputs.map(o => ({ id: o.id, actualWeightKg: Number(editOutputWeights[o.id] ?? o.actualWeightKg) }))
      })
      setEditingEventId(null)
      loadEvents()
    } catch {
      // Reported by the global error toast — see the response
      // interceptor in lib/api.ts. A second inline copy would be noise.
    } finally {
      setEventBusyId(null)
    }
  }

  async function deleteEvent(ev: DismantleEvent) {
    if (!window.confirm(t('dismantle_page.confirm_delete_event'))) return
    setEventBusyId(ev.id)
    setError(null)
    try {
      await api.delete(`/api/dismantle-events/${ev.id}`)
      loadEvents()
    } catch {
      // Reported by the global error toast — see the response
      // interceptor in lib/api.ts. A second inline copy would be noise.
    } finally {
      setEventBusyId(null)
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
  const labelClasses = 'mb-1 block text-sm font-medium text-stone-700'

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-stone-900">{t('batches')}</h1>
      <p className="mb-6 text-stone-500">{t('dismantle_page.subtitle')}</p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* v3.1 follow-up 10h: only claim "no access" once the session is
          actually known — while it's loading, `canDismantle` is false for the
          same reason a denied user's is, and the page used to say so. */}
      {authLoading && <Spinner />}
      {!authLoading && !canDismantle && (
        <div className="mb-6 rounded-xl border border-dashed border-stone-300 bg-surface p-6 text-center text-sm text-stone-500">
          {t('dismantle_page.no_access')}
        </div>
      )}

      {canDismantle && (
        <form onSubmit={onSubmit} className="mb-8 rounded-xl border border-stone-200 bg-surface p-5 shadow-card">
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label>
              <span className={labelClasses}>{t('dismantle_page.template_label')}</span>
              <select className={inputClasses} value={templateId} onChange={e => { setTemplateId(e.target.value); setCutInputs({}) }}>
                {templates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>
                    {localizedName(tpl.animalType, i18n.language, ANIMAL_TYPE_AR)} — {localizedName(tpl.name, i18n.language, TEMPLATE_NAME_AR)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClasses}>{t('dismantle_page.source_label')}</span>
              <input className={inputClasses} value={sourceLabel} onChange={e => setSourceLabel(e.target.value)}
                placeholder={t('dismantle_page.source_placeholder')} required />
            </label>
            <label>
              <span className={labelClasses}>{t('dismantle_page.input_weight_label')}</span>
              <input type="number" step="0.001" min="0.001" className={inputClasses} value={inputWeightKg}
                onChange={e => setInputWeightKg(e.target.value)} required />
            </label>
          </div>

          {selectedTemplate !== null && (
            <div className="overflow-hidden rounded-lg border border-stone-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-100 text-start text-[11px] font-bold uppercase tracking-[0.08em] text-stone-500">
                    <th className="px-3 py-2 text-start">{t('dismantle_page.cut_label')}</th>
                    <th className="w-28 px-3 py-2 text-end">{t('dismantle_page.expected_yield_label')}</th>
                    <th className="px-3 py-2">
                      {t('dismantle_page.actual_weight_label')}
                      <span className="ms-1 font-normal normal-case text-stone-400">({t('dismantle_page.actual_weight_hint')})</span>
                    </th>
                    <th className="px-3 py-2">{t('dismantle_page.stock_into_label')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {selectedTemplate.cuts.map(cut => (
                    <tr key={cut.id}>
                      <td className="px-3 py-2 font-medium text-stone-900">
                        {localizedName(cut.cutName, i18n.language, CUT_NAME_AR)}
                        {cut.isOffal && <span className="ms-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">{t('dismantle_page.offal_tag')}</span>}
                        {cut.isByproduct && <span className="ms-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">{t('dismantle_page.byproduct_tag')}</span>}
                      </td>
                      <td className="px-3 py-2 text-stone-500">{Number(cut.expectedYieldPct).toFixed(1)}%</td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.001" min="0" className={`${inputClasses} w-28`}
                          value={cutInput(cut.cutName).actualWeightKg}
                          onChange={e => setCutInput(cut.cutName, { actualWeightKg: e.target.value })} />
                      </td>
                      <td className="px-3 py-2">
                        <select className={`${inputClasses} w-40`} value={cutInput(cut.cutName).productId}
                          onChange={e => setCutInput(cut.cutName, { productId: e.target.value })}>
                          <option value="">{t('dismantle_page.record_only')}</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="btn btn-primary mt-4">
            {submitting ? t('dismantle_page.submitting') : t('dismantle_page.submit')}
          </button>
        </form>
      )}

      {canDismantle && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">{t('dismantle_page.recent_events')}</h2>
          {loadingEvents ? (
            <Spinner />
          ) : events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-surface p-8 text-center text-sm text-stone-500">
              {t('dismantle_page.no_events')}
            </div>
          ) : (
            <div className="space-y-3">
              {events.map(ev => {
                const isEditing = editingEventId === ev.id
                const isBusy = eventBusyId === ev.id
                return (
                  <div key={ev.id} className="rounded-xl border border-stone-200 bg-surface p-4 shadow-card">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:max-w-md">
                            <input className={inputClasses} value={editSourceLabel}
                              onChange={e => setEditSourceLabel(e.target.value)} />
                            <input type="number" step="0.001" min="0.001" className={inputClasses}
                              value={editInputWeightKg} onChange={e => setEditInputWeightKg(e.target.value)} />
                          </div>
                        ) : (
                          <>
                            <p className="font-medium text-stone-900">{ev.sourceLabel}</p>
                            <p className="text-xs text-stone-500">
                              {localizedName(ev.template.animalType, i18n.language, ANIMAL_TYPE_AR)} — {localizedName(ev.template.name, i18n.language, TEMPLATE_NAME_AR)} · {Number(ev.inputWeightKg).toFixed(3)} kg
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isEditing && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ev.wastePct > PERCENT_MULTIPLIER / 10 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                            {t('dismantle_page.waste')}: {ev.wastePct.toFixed(1)}%
                          </span>
                        )}
                        {isEditing ? (
                          <>
                            <button type="button" onClick={() => saveEditEvent(ev)} disabled={isBusy}
                              className="btn btn-primary btn-sm">
                              {isBusy ? t('dismantle_page.saving_event') : t('dismantle_page.save_event')}
                            </button>
                            <button type="button" onClick={cancelEditEvent} disabled={isBusy}
                              className="btn btn-ghost btn-sm">
                              {t('dismantle_page.cancel_edit')}
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => startEditEvent(ev)} disabled={isBusy}
                              className="btn btn-ghost-brand btn-sm">
                              {t('dismantle_page.edit_event')}
                            </button>
                            <button type="button" onClick={() => deleteEvent(ev)} disabled={isBusy}
                              className="btn btn-ghost-danger btn-sm">
                              {isBusy ? t('dismantle_page.deleting_event') : t('dismantle_page.delete_event')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <ul className="space-y-1 text-sm text-stone-600">
                      {ev.outputs.map(o => (
                        <li key={o.id} className="flex items-center justify-between gap-2">
                          <span>{localizedName(o.cutName, i18n.language, CUT_NAME_AR)}</span>
                          {isEditing ? (
                            <input type="number" step="0.001" min="0.001" className={`${inputClasses} w-28`}
                              value={editOutputWeights[o.id] ?? o.actualWeightKg}
                              onChange={e => setEditOutputWeights(prev => ({ ...prev, [o.id]: e.target.value }))} />
                          ) : (
                            <span>{Number(o.actualWeightKg).toFixed(3)} kg ({(o.contentPerKiloKg * PERCENT_MULTIPLIER).toFixed(1)}% {t('dismantle_page.per_kilo')})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
