// ADR-002 tech debt, now resolved: the JWT used to be handed to the frontend
// as JSON and kept in localStorage, attached manually via an axios request
// interceptor. It's now an httpOnly cookie set directly by the backend
// (see backend/src/routes/auth.ts) — invisible to and untouchable by frontend
// JS, which is the point (mitigates XSS token theft). `withCredentials: true`
// is what makes axios actually send/receive that cookie on cross-origin
// requests (frontend and backend are different origins in dev, and different
// sites entirely once deployed to Vercel + Railway).
import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '',
  withCredentials: true
})

export default api
