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
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 shadow-sm">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3.13a4 4 0 0 1 0 7.75M8 3.13a4 4 0 0 0 0 7.75" />
              <path d="M12 12v9M8 21h8" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">{t('login_page.title')}</h1>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-card">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">{t('login_page.email_placeholder')}</span>
              <input
                type="email"
                placeholder={t('login_page.email_placeholder')}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">{t('login_page.password_placeholder')}</span>
              <input
                type="password"
                placeholder={t('login_page.password_placeholder')}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                </svg>
              )}
              {loading ? t('login_page.signing_in') : t('login_page.sign_in')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
