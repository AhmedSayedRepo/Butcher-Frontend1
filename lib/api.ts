// ADR-002: token stored in localStorage for MVP (single-admin internal tool).
// Follow-up ticket exists to migrate to an httpOnly cookie before multi-role launch.
import axios from 'axios'

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || '' })

const TOKEN_KEY = 'butcher_token'

export function setToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token)
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY)
}

api.interceptors.request.use((config) => {
  // Fix: axios's InternalAxiosRequestConfig types `headers` as an
  // AxiosHeaders instance, not a plain object — `config.headers || {}` no
  // longer type-checks (a {} isn't assignable to AxiosHeaders). `config.headers`
  // is always already defined here, so just call its `.set` method instead
  // of reassigning it.
  const token = getToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

export default api
