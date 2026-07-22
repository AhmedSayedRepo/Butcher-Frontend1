// v3.5 — a tiny pub/sub so non-React code can raise a toast.
//
// The axios error interceptor is the reason this exists. It's the one place
// that sees *every* failed request, which makes it the only way to guarantee no
// error is ever silent — but it lives outside the React tree and so can't call
// a hook. It emits here instead, and ToastProvider (which is inside the tree,
// and has `t`) subscribes and does the rendering and translating.
//
// Deliberately a single listener rather than a set: there is exactly one
// ToastProvider, mounted once in the app shell. A second one would be a bug,
// and last-one-wins surfaces that immediately instead of double-toasting.

export type ToastKind = 'success' | 'error'

export interface ToastRequest {
  kind: ToastKind
  // Either a ready-made message, or a raw error for the provider to translate
  // (it owns `t`; this module must stay free of React and i18n).
  message?: string
  error?: unknown
}

type Listener = (request: ToastRequest) => void

let listener: Listener | null = null

export function setToastListener(next: Listener | null): void {
  listener = next
}

export function emitToast(request: ToastRequest): void {
  // No listener means no provider mounted yet (or already torn down). Dropping
  // the toast is correct — there's nowhere to show it, and throwing here would
  // turn a cosmetic gap into a crash inside an error handler.
  listener?.(request)
}
