// v3.5 — app-wide toasts for action outcomes.
//
// Two ways a toast appears:
//   1. Automatically, for any failed API request — the axios interceptor in
//      lib/api.ts emits onto toastBus, and this component translates and shows
//      it. That's what makes "no error is ever silent" true without editing
//      seventy call sites, and it can't be forgotten on a new screen.
//   2. Explicitly, via `useToast()`, for confirmations ("Saved", "Order
//      created") — successes have no equivalent single choke point, and the
//      wording is specific to what just happened.
//
// Field-level messages stay where they are. A toast in the corner is the wrong
// place to say "this barcode doesn't exist" while the cursor is in the barcode
// box; proximity is the whole point of that message.
'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { translateApiError } from '../lib/apiError'
import { setToastListener, type ToastKind } from '../lib/toastBus'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

// Errors get longer on screen than confirmations: a confirmation is glanceable
// ("Saved"), an error has to actually be read, sometimes twice, and sometimes
// while holding a knife.
const SUCCESS_MS = 3500
const ERROR_MS = 7000
// A shop terminal on flaky wifi can fail the same request repeatedly. Beyond a
// few, extra toasts stop informing and start obscuring the screen.
const MAX_VISIBLE = 3

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (ctx === null) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(item => item.id !== id))
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback((kind: ToastKind, message: string) => {
    setToasts(prev => {
      // Collapse a repeat of what's already on screen instead of stacking it.
      // A 20-second poll failing on a dropped connection would otherwise paper
      // over the whole app with identical messages.
      const duplicate = prev.find(item => item.message === message && item.kind === kind)
      if (duplicate !== undefined) return prev

      const id = nextId.current
      nextId.current += 1
      const timer = setTimeout(() => { dismiss(id) }, kind === 'error' ? ERROR_MS : SUCCESS_MS)
      timers.current.set(id, timer)
      return [...prev, { id, kind, message }].slice(-MAX_VISIBLE)
    })
  }, [dismiss])

  const api = useMemo<ToastApi>(() => ({
    success: (message: string) => { push('success', message) },
    error: (message: string) => { push('error', message) }
  }), [push])

  // Bridge from the axios interceptor. Raw errors arrive untranslated because
  // toastBus is deliberately React- and i18n-free; `t` only exists here.
  useEffect(() => {
    setToastListener(({ kind, message, error }) => {
      const text = message ?? translateApiError(error, t, t('toast.generic_error'))
      push(kind, text)
    })
    return () => { setToastListener(null) }
  }, [t, push])

  // Clear any pending timers on unmount so a dismissed toast can't fire into a
  // torn-down tree.
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Top-end, deliberately: InboundOrderAlert already owns the bottom-end
          corner, and an order arriving must not be shoved off screen by a
          "Saved" message. Logical `end-4` so it flips with RTL. */}
      <div className="pointer-events-none fixed top-4 end-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            // Errors interrupt (assertive); confirmations don't (polite). A
            // screen reader shouldn't cut someone off to say "Saved".
            role={toast.kind === 'error' ? 'alert' : 'status'}
            aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
            className={`toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3.5 shadow-card ${
              toast.kind === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            <span aria-hidden="true" className="mt-0.5 text-sm font-bold">
              {toast.kind === 'error' ? '!' : '✓'}
            </span>
            <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed">{toast.message}</p>
            <button
              type="button"
              onClick={() => { dismiss(toast.id) }}
              aria-label={t('toast.dismiss')}
              className="-mt-1 -me-1 shrink-0 rounded p-1 text-lg leading-none opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
