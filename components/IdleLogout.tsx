'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

// Idle logout — security audit follow-up, 2026-07-21.
//
// The threat this addresses is the realistic one for this product: a shop
// terminal shared by several cashiers, left signed in, in a room customers
// and suppliers walk through. The server-side session is now ~12 hours with
// sliding renewal, which handles "stolen cookie" — this handles "walked away
// from the till".
//
// **It warns before acting.** A cashier three items into an order who gets
// silently logged out will lose the order, blame the software, and start
// leaving the password on a sticky note — which is worse than no timeout at
// all. So: a countdown, an explicit "I'm still here", and only then a logout.
//
// The activity signals are deliberately broad (pointer, keyboard, touch,
// scroll, and returning to the tab). Someone reading the orders board without
// clicking is still working, and `visibilitychange` covers coming back to a
// tab that was behind the scale software.
//
// Not configurable per shop yet. The natural home is `ShopSettings` alongside
// the other shop-policy knobs — a counter terminal and a back-office PC want
// different numbers — but that needs a migration, and this is worth shipping
// with the rest of the security fixes rather than after them.

const MINUTES_TO_MS = 60_000
const DEFAULT_IDLE_MINUTES = 30
const WARNING_SECONDS = 60
const TICK_MS = 1000
const NO_TIME_LEFT = 0

function idleLimitMs(): number {
  const configured = Number(process.env.NEXT_PUBLIC_IDLE_MINUTES ?? '')
  const minutes = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_IDLE_MINUTES
  return minutes * MINUTES_TO_MS
}

// `visibilitychange` is on `document`; the rest are cheap, passive listeners.
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const

export default function IdleLogout() {
  const { t } = useTranslation()
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const lastActivityRef = useRef(Date.now())

  const signOut = useCallback(() => {
    // Best-effort server-side clear, then a hard navigation regardless —
    // getting the user off the screen matters more than the request's outcome,
    // and a hard load also drops every bit of shop data held in memory.
    api.post('/auth/logout')
      .catch(() => undefined)
      .finally(() => { window.location.href = '/login?idle=1' })
  }, [])

  const markActive = useCallback(() => {
    lastActivityRef.current = Date.now()
    setSecondsLeft(null)
  }, [])

  useEffect(() => {
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true })
    }
    document.addEventListener('visibilitychange', markActive)

    const interval = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current
      const remaining = idleLimitMs() - idleFor

      if (remaining <= NO_TIME_LEFT) {
        signOut()
        return
      }
      // Inside the warning window: show the countdown. Outside it: nothing,
      // and `secondsLeft` stays null so the dialog isn't mounted at all.
      const remainingSeconds = Math.ceil(remaining / TICK_MS)
      setSecondsLeft(remainingSeconds <= WARNING_SECONDS ? remainingSeconds : null)
    }, TICK_MS)

    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActive)
      document.removeEventListener('visibilitychange', markActive)
      clearInterval(interval)
    }
  }, [markActive, signOut])

  if (secondsLeft === null) return null

  return (
    // `alertdialog` rather than `dialog`: this interrupts to warn, which is
    // what the role means, and screen readers announce it immediately.
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-surface p-6 text-center shadow-card">
        <h2 id="idle-title" className="mb-2 text-lg font-bold text-stone-900">
          {t('idle.title')}
        </h2>
        <p className="mb-1 text-sm text-stone-600">{t('idle.body')}</p>
        <p className="tabular mb-5 text-3xl font-extrabold text-amber-700">{secondsLeft}</p>
        <div className="flex gap-2">
          {/* The primary action is staying, not leaving — the common case is a
              cashier who stepped away for a moment, not one who's finished. */}
          <button type="button" onClick={markActive} className="btn btn-primary flex-1">
            {t('idle.stay')}
          </button>
          <button type="button" onClick={signOut} className="btn btn-secondary">
            {t('idle.logout_now')}
          </button>
        </div>
      </div>
    </div>
  )
}
