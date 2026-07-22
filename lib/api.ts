// ADR-002 tech debt, now resolved: the JWT used to be handed to the frontend
// as JSON and kept in localStorage, attached manually via an axios request
// interceptor. It's now an httpOnly cookie set directly by the backend
// (see backend/src/routes/auth.ts) — invisible to and untouchable by frontend
// JS, which is the point (mitigates XSS token theft). `withCredentials: true`
// is what makes axios actually send/receive that cookie on cross-origin
// requests (frontend and backend are different origins in dev, and different
// sites entirely once deployed to Vercel + Railway).
import axios from 'axios'
import { emitToast } from './toastBus'

// Lets a caller opt a request out of the automatic error toast (see the
// response interceptor at the bottom). Declared here so `silentError` is a
// real, typed option rather than a stringly-typed convention.
declare module 'axios' {
  interface AxiosRequestConfig {
    silentError?: boolean
  }
}

// v3.1 follow-up 10: no timeout meant a genuinely hung backend request
// (e.g. an SMTP connection that never resolves) left the calling UI stuck
// indefinitely too, with no way to recover except reloading the page —
// reported live via the admin-invite button never leaving its "Inviting…"
// state. 30s comfortably covers every real request this app makes (plain
// CRUD, nothing long-running/streaming) while still failing predictably
// instead of hanging forever.
const REQUEST_TIMEOUT_MS = 30_000

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '',
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS
})

// Multi-tenancy phase 3 (Butcher-Multi-Tenancy-Plan.md §3) — tells the API
// which shop's subdomain this tab was loaded from.
//
// ONLY sent when `NEXT_PUBLIC_ROOT_DOMAIN` is configured AND the hostname is
// genuinely a subdomain of it. Both halves matter.
//
// The first version guessed: "three or more labels means the first one is the
// shop". That is wrong for almost every PaaS hostname, and it broke production
// immediately — `butcher-frontend-eight.vercel.app` has three labels, so every
// request went out claiming to be for a shop called `butcher-frontend-eight`.
// No such organization exists, the backend saw a mismatch against the user's
// real one, and **every non-super-admin login was refused** with
// WRONG_ORGANIZATION. (Super admins are exempt from that check, which is the
// only reason it wasn't obvious straight away — the one account still able to
// sign in was the one account that skipped the check.)
//
// So: no guessing. Until the wildcard domain is live and this variable is set,
// no header is sent and the deployment behaves exactly as a single-tenant one.
//
// This header does not decide which data the caller gets; the session does,
// server-side. All it can do is cause a mismatch to be refused. Spoofing it
// achieves nothing except locking yourself out.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase() ?? ''

function currentOrganizationSlug(): string | null {
  if (typeof window === 'undefined' || ROOT_DOMAIN === '') return null

  const host = window.location.hostname.toLowerCase()
  const suffix = `.${ROOT_DOMAIN}`
  if (!host.endsWith(suffix)) return null

  const slug = host.slice(0, -suffix.length)
  // One label only. `a.b.example.com` is not a shop called "a".
  return slug === '' || slug.includes('.') ? null : slug
}

api.interceptors.request.use((config) => {
  const slug = currentOrganizationSlug()
  if (slug !== null) config.headers.set('x-organization-slug', slug)
  return config
})

// v3.5 — every failed request raises an error toast, from one place.
//
// The alternative was adding a toast call to ~70 catch blocks, which fails the
// moment someone writes the 71st. Here it's structural: a request cannot fail
// without being reported, including on screens written later.
//
// Two exemptions, both deliberate:
//
//   401 — the session expired. AuthGate is already redirecting to /login, and
//   several polls are usually in flight, so toasting would stack "unauthorized"
//   on top of a screen that's mid-navigation. The redirect is the message.
//
//   `silentError` — for background polling (the orders poll, the inbound-order
//   check). Those run every 20–45s unprompted; on a dropped connection they'd
//   toast forever about something the cashier didn't ask for and can't act on.
//   Set it per-request: `api.get(url, { silentError: true })`.
//
// The rejection is still re-thrown, so existing catch blocks keep working —
// this only adds the notification, it never swallows.
const UNAUTHORIZED = 401

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const failed = error as { response?: { status?: number }, config?: { silentError?: boolean } }
    const status = failed.response?.status
    const silent = failed.config?.silentError === true
    if (!silent && status !== UNAUTHORIZED) {
      emitToast({ kind: 'error', error })
    }
    return await Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
)

export default api
