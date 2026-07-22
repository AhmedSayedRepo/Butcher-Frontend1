'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { Order, ShopSettings } from '../lib/types'
import { useAuth } from '../lib/useAuth'

// v3.2 — telling the cashier an order just arrived.
//
// The problem: a WhatsApp order lands as a DRAFT, silently. The dashboard's
// existing alert only fires once a draft has gone STALE — past the shop's
// pending-order threshold — which is the opposite of what's wanted. By then
// the customer has been waiting the whole threshold. And it only exists on the
// dashboard, so a cashier standing on the orders board or the new-order screen
// (i.e. the two screens they actually use) sees nothing at all.
//
// So this lives in the app shell and runs on every screen. It announces the
// arrival, not the delay.
//
// Deliberately polling rather than websockets/SSE: the backend is a single
// Render instance that sleeps on the free tier, and every other live figure in
// this app already polls. One more small request every 20 seconds is a much
// smaller thing to own than a socket layer with its own reconnect logic.

const POLL_MS = 20_000
const NONE = 0
// Sources that arrive without a human on this end. A cashier keying an order
// in at the counter doesn't need telling that it exists.
const INBOUND_SOURCES = new Set(['whatsapp', 'social', 'phone'])

// A short, quiet two-tone chime built with WebAudio rather than shipped as an
// audio file: no asset to load, no autoplay-policy fight over a <audio> src,
// and it's ~20 lines. Fails silently — a shop with no speakers, or a browser
// that blocks audio until first interaction, should still get the visual.
function playChime(): void {
  try {
    const AudioCtor = window.AudioContext
    const ctx = new AudioCtor()
    const gain = ctx.createGain()
    gain.gain.value = 0.06
    gain.connect(ctx.destination)
    const notes = [880, 1174]
    notes.forEach((frequency, index) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = frequency
      osc.connect(gain)
      const start = ctx.currentTime + index * 0.18
      osc.start(start)
      osc.stop(start + 0.16)
    })
    window.setTimeout(() => { void ctx.close() }, 1000)
  } catch {
    // No audio available. The banner still shows.
  }
}

export default function InboundOrderAlert() {
  const { t } = useTranslation()
  const user = useAuth()
  const [arrivals, setArrivals] = useState<Order[]>([])
  const [soundEnabled, setSoundEnabled] = useState(false)

  // The ids we've already announced. A ref, not state: updating it must not
  // re-render, and it must survive between polls without being a dependency.
  //
  // Seeded on the FIRST poll rather than starting empty — otherwise every
  // draft already sitting on the board would be announced as "new" the moment
  // someone opens the app, which is noise that teaches staff to ignore it.
  const seenRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (user === null || user === undefined) return
    api.get<ShopSettings>('/api/shop-settings', { silentError: true })
      .then(r => setSoundEnabled(r.data.alertSoundEnabled))
      .catch(() => setSoundEnabled(false))
  }, [user])

  const check = useCallback(() => {
    api.get<Order[]>('/api/orders', { silentError: true })
      .then((r) => {
        const inbound = r.data.filter(o => o.status === 'DRAFT' && INBOUND_SOURCES.has(o.source))

        if (seenRef.current === null) {
          seenRef.current = new Set(inbound.map(o => o.id))
          return
        }

        const seen = seenRef.current
        const fresh = inbound.filter(o => !seen.has(o.id))
        if (fresh.length === NONE) return

        for (const order of fresh) seen.add(order.id)
        setArrivals(previous => [...fresh, ...previous])
        if (soundEnabled) playChime()
      })
      .catch(() => undefined)
  }, [soundEnabled])

  useEffect(() => {
    if (user === null || user === undefined) return
    check()
    const id = setInterval(check, POLL_MS)
    return () => { clearInterval(id) }
  }, [user, check])

  if (arrivals.length === NONE) return null

  return (
    // Bottom corner, not a modal: an order arriving is information, not an
    // interruption. A cashier mid-sale must not have to dismiss anything.
    <div className="fixed bottom-4 end-4 z-40 w-full max-w-xs space-y-2" role="status" aria-live="polite">
      {arrivals.map(order => (
        <div key={order.id} className="card-hover rounded-xl border border-brand-300 bg-surface p-3 shadow-card">
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-700">
              {t(`orders_page.source_${order.source}`)}
            </p>
            <button
              type="button"
              aria-label={t('inbound.dismiss')}
              className="btn btn-ghost btn-icon -mt-1 -me-1"
              onClick={() => setArrivals(a => a.filter(o => o.id !== order.id))}
            >
              ✕
            </button>
          </div>
          <p className="truncate text-sm font-semibold text-stone-900">
            {order.customer !== null && order.customer !== '' ? order.customer : t('orders_page.walk_in')}
          </p>
          {typeof order.unmatchedItems === 'string' && order.unmatchedItems !== '' && (
            <p className="mt-1 text-[11px] font-semibold text-amber-700">
              {t('inbound.needs_check')}
            </p>
          )}
          <Link
            href="/orders"
            className="btn btn-primary btn-sm mt-2 w-full"
            onClick={() => setArrivals(a => a.filter(o => o.id !== order.id))}
          >
            {t('inbound.open')}
          </Link>
        </div>
      ))}
    </div>
  )
}
