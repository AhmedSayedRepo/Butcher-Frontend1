// v3 follow-up: self-service "forgot password" — mirrors login/page.tsx's
// styling. Deliberately shows the same success message whether or not the
// email matched an account (the backend does the same thing server-side,
// POST /auth/forgot-password always 200s) — a different message here would
// re-introduce the account-enumeration leak the backend was built to avoid.
'use client'
import { useState } from 'react'
import Link from 'next/link'
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
      await api.post('/auth/forgot-password', { email })
    } finally {
      // Shown regardless of success/failure — a network error here still
      // shouldn't reveal anything different than the "check your email"
      // message an unknown-email submission gets.
      setSubmitting(false)
      setSubmitted(true)
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">{t('forgot_password_page.title')}</h1>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-card">
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
                className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? t('forgot_password_page.sending') : t('forgot_password_page.send_link')}
              </button>
              <Link href="/login" className="block text-center text-sm text-stone-500 hover:text-stone-700">
                {t('forgot_password_page.back_to_login')}
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
