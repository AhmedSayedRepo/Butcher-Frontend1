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

export default api
