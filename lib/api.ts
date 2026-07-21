// ADR-002 tech debt, now resolved: the JWT used to be handed to the frontend
// as JSON and kept in localStorage, attached manually via an axios request
// interceptor. It's now an httpOnly cookie set directly by the backend
// (see backend/src/routes/auth.ts) — invisible to and untouchable by frontend
// JS, which is the point (mitigates XSS token theft). `withCredentials: true`
// is what makes axios actually send/receive that cookie on cross-origin
// requests (frontend and backend are different origins in dev, and different
// sites entirely once deployed to Vercel + Railway).
import axios from 'axios'

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
// Read from the browser's own hostname, at request time rather than at module
// load, because the app is a static bundle served to every subdomain — there
// is no build-time value to bake in.
//
// This header does **not** decide which data the caller gets; the session
// does, server-side. All it can do is cause a mismatch to be refused, so a
// user signed into shop A can't sit on shop B's subdomain looking at A's
// numbers under B's branding. Spoofing it gains an attacker nothing: the only
// achievable outcome is locking yourself out.
//
// Sent only when there genuinely is a subdomain. `localhost` and the current
// single-host deployment have none, and an absent header means "no opinion".
const RESERVED_HOSTS = new Set(['www', 'localhost'])
const MIN_HOST_LABELS = 3

function currentOrganizationSlug(): string | null {
  if (typeof window === 'undefined') return null
  const labels = window.location.hostname.split('.')
  if (labels.length < MIN_HOST_LABELS) return null
  const [first] = labels
  return first === undefined || RESERVED_HOSTS.has(first) ? null : first.toLowerCase()
}

api.interceptors.request.use((config) => {
  const slug = currentOrganizationSlug()
  if (slug !== null) config.headers.set('x-organization-slug', slug)
  return config
})

export default api
