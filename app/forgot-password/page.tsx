// v3 follow-up: self-service "forgot password" — mirrors login/page.tsx's
// styling. Deliberately shows the same success message whether or not the
// email matched an account (the backend does the same thing server-side,
// POST /auth/forgot-password always 200s) — a different message here would
// re-introduce the account-enumeration leak the backend was built to avoid.
'use client'
import { useState } from 'react'
import Link from 'next/link'
import AuthCardShell from '../../components/AuthCardShell'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/auth/forgot-password', { email }, { silentError: true })
    } finally {
      // Shown regardless of success/failure — a network error here still
      // shouldn't reveal anything different than the "check your email"
      // message an unknown-email submission gets.
      setSubmitting(false)
      setSubmitted(true)
    }
  }

  return (
    <AuthCardShell title={t('forgot_password_page.title')}>
          {submitted ? (
            <div className="text-center">
              <p className="text-sm text-stone-700">{t('forgot_password_page.submitted_message')}</p>
              <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:text-brand-800">
                {t('forgot_password_page.back_to_login')}
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-stone-700">{t('login_page.email_placeholder')}</span>
                <input
                  type="email"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary btn-lg w-full"
              >
                {submitting ? t('forgot_password_page.sending') : t('forgot_password_page.send_link')}
              </button>
              <Link href="/login" className="block text-center text-sm text-stone-500 hover:text-stone-700">
                {t('forgot_password_page.back_to_login')}
              </Link>
            </form>
          )}
    </AuthCardShell>
  )
}
