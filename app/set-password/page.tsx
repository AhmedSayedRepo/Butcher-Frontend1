// v3 follow-up: lands here from either the admin-invite email ("set your
// password") or the self-service forgot-password email ("reset your
// password") — same page and same backend endpoint either way
// (POST /auth/reset-password), since the validation is identical; only the
// email copy that got someone here differs (see backend/src/lib/email.ts).
'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import AuthCardShell from '../../components/AuthCardShell'
import api from '../../lib/api'
import { translateApiError } from '../../lib/apiError'

const MIN_PASSWORD_LENGTH = 8

type TokenState = 'checking' | 'valid' | 'invalid'

// Next.js requires any component calling `useSearchParams()` to be wrapped
// in a Suspense boundary (it can otherwise bail the whole route out of
// static rendering at build time) — this wrapper is purely to satisfy that,
// the actual page logic lives in SetPasswordForm below.
export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordForm />
    </Suspense>
  )
}

function SetPasswordForm() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [tokenState, setTokenState] = useState<TokenState>('checking')
  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (token === '') { setTokenState('invalid'); return }
    api.get<{ valid: boolean, email: string | null }>(`/auth/reset-token/${token}`)
      .then(r => { setTokenState(r.data.valid ? 'valid' : 'invalid'); setEmail(r.data.email) })
      .catch(() => setTokenState('invalid'))
  }, [token])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('set_password_page.error_too_short', { count: MIN_PASSWORD_LENGTH }))
      return
    }
    if (password !== confirmPassword) {
      setError(t('set_password_page.error_mismatch'))
      return
    }
    setSubmitting(true)
    try {
      await api.post('/auth/reset-password', { token, password }, { silentError: true })
      setDone(true)
    } catch (err) {
      setError(translateApiError(err, t, t('set_password_page.error_submit')))
    } finally {
      setSubmitting(false)
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

  return (
    <AuthCardShell title={t('set_password_page.title')}>
          {email !== null && <p className="mb-4 text-center text-sm text-stone-500">{email}</p>}
          {tokenState === 'checking' && (
            <p className="text-center text-sm text-stone-500">{t('set_password_page.checking_link')}</p>
          )}

          {tokenState === 'invalid' && (
            <div className="text-center">
              <p className="text-sm text-red-700">{t('set_password_page.invalid_link')}</p>
              <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:text-brand-800">
                {t('set_password_page.request_new_link')}
              </Link>
            </div>
          )}

          {tokenState === 'valid' && done && (
            <div className="text-center">
              <p className="text-sm text-stone-700">{t('set_password_page.success')}</p>
              <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:text-brand-800">
                {t('login')}
              </Link>
            </div>
          )}

          {tokenState === 'valid' && !done && (
            <form onSubmit={onSubmit} className="space-y-4">
              {error !== null && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
              )}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-stone-700">{t('set_password_page.new_password')}</span>
                <input type="password" className={inputClasses} value={password} onChange={e => setPassword(e.target.value)} required minLength={MIN_PASSWORD_LENGTH} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-stone-700">{t('set_password_page.confirm_password')}</span>
                <input type="password" className={inputClasses} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={MIN_PASSWORD_LENGTH} />
              </label>
              <button type="submit" disabled={submitting}
                className="btn btn-primary btn-lg w-full">
                {submitting ? t('set_password_page.saving') : t('set_password_page.save_password')}
              </button>
            </form>
          )}
    </AuthCardShell>
  )
}
