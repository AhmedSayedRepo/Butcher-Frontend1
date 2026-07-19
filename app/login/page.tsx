// Tech debt (ADR-002), now resolved: login used to receive { token } and
// store it in localStorage. The backend now sets an httpOnly cookie directly
// on the login response (see backend/src/routes/auth.ts) — nothing for the
// frontend to store, the browser handles it.
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { extractApiErrorMessage } from '../../lib/apiError'

export default function LoginPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/login', { email, password })
      router.push('/orders')
      router.refresh()
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? t('login_page.error_default'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12 bg-white p-6 rounded shadow">
      <h1 className="text-xl font-semibold mb-4">{t('login_page.title')}</h1>
      {error && <div className="bg-red-50 text-red-700 p-2 rounded mb-3 text-sm">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          placeholder={t('login_page.email_placeholder')}
          className="w-full border rounded p-2"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={t('login_page.password_placeholder')}
          className="w-full border rounded p-2"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded p-2 disabled:opacity-50"
        >
          {loading ? t('login_page.signing_in') : t('login_page.sign_in')}
        </button>
      </form>
    </div>
  )
}
