// Tech debt (ADR-002), now resolved: login used to receive { token } and
// store it in localStorage. The backend now sets an httpOnly cookie directly
// on the login response (see backend/src/routes/auth.ts) — nothing for the
// frontend to store, the browser handles it.
//
// v3.1 follow-up 10i — redesigned as a split screen, modelled on the QA Studio
// landing page. Left: the branded dark field carrying the product's pitch.
// Right: the form, on app surface, following the app theme.
//
// The split is the point. A sign-in box floating alone in an empty padded
// column told a visitor nothing about what they were signing into — and with
// per-organization subdomains coming, this page becomes the first thing a new
// shop's staff ever sees. On a phone the branded half collapses to a compact
// header so the form is still the first thing under the thumb.
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { translateApiError } from '../../lib/apiError'
import PublicField, { PublicBrand } from '../../components/PublicField'
import ThemeToggle from '../../components/ThemeToggle'

const HIGHLIGHT_KEYS = ['orders', 'stock', 'cash'] as const

export default function LoginPage() {
  const { t } = useTranslation()
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
      // Full page load, not router.push(): the session is read once by
      // AuthProvider in the root layout (lib/authContext.tsx), and a
      // client-side push reuses that already-resolved "logged out" value —
      // AuthGate would bounce the freshly-authenticated user straight back
      // here. A hard navigation remounts the provider and re-checks.
      window.location.href = '/orders'
    } catch (err) {
      setError(translateApiError(err, t, t('login_page.error_default')))
    } finally {
      setLoading(false)
    }
  }

  const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Branded half. `hidden lg:flex` for the full panel; the compact header
          below carries the same identity on small screens without pushing the
          form under the fold. */}
      <PublicField className="hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex flex-col justify-between gap-10 lg:h-full">
          <PublicBrand name={t('app_name')} />

          <div className="max-w-lg">
            <div className="pub-fade pub-fade-1 pub-pill mb-7">
              <span className="pub-dot" />
              {t('public.badge')}
            </div>
            <h1 className="pub-fade pub-fade-2 mb-6 text-4xl font-extrabold leading-[1.08] tracking-tight xl:text-5xl">
              {t('public.headline_lead')}{' '}
              <span className="pub-grad-text">{t('public.headline_accent')}</span>
            </h1>
            <p className="pub-fade pub-fade-3 text-base leading-relaxed text-[color:var(--pub-ink2)]">
              {t('public.subhead')}
            </p>

            <ul className="pub-fade pub-fade-4 mt-9 space-y-3">
              {HIGHLIGHT_KEYS.map(key => (
                <li key={key} className="flex items-start gap-3 text-sm text-[color:var(--pub-ink2)]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--pub-cyan)"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className="mt-0.5 shrink-0" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span>{t(`public.highlight_${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>

          <Link href="/welcome" className="text-sm font-semibold text-[color:var(--pub-ink3)] transition-colors hover:text-[color:var(--pub-ink)]">
            {t('public.learn_more')}{' '}
            <span aria-hidden="true" className="inline-block transition-transform rtl:rotate-180">→</span>
          </Link>
        </div>
      </PublicField>

      {/* Form half — app surface, app theme. */}
      <div className="flex flex-col bg-surface">
        <div className="flex items-center justify-between p-4 lg:justify-end lg:p-6">
          <div className="lg:hidden">
            <div className="flex items-center gap-2.5">
              <svg width="30" height="30" viewBox="0 0 34 34" fill="none" aria-hidden="true">
                <rect width="34" height="34" rx="10" fill="url(#loginLogo)" />
                <path d="M10 23 21 12M21 12h-4.8M21 12v4.8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="11.5" cy="23" r="2.2" fill="#fff" />
                <defs>
                  <linearGradient id="loginLogo" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#22D3EE" />
                    <stop offset="1" stopColor="#0891B2" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-base font-extrabold tracking-tight text-stone-900">{t('app_name')}</span>
            </div>
          </div>
          <ThemeToggle compact className="btn btn-ghost btn-icon" />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12">
          <div className="w-full max-w-sm">
            <h2 className="mb-1 text-2xl font-bold tracking-tight text-stone-900">{t('login_page.title')}</h2>
            <p className="mb-7 text-sm text-stone-500">{t('login_page.subtitle')}</p>

            {error !== null && (
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-stone-700">{t('login_page.email_placeholder')}</span>
                <input type="email" autoComplete="email" required className={inputClasses}
                  placeholder={t('login_page.email_placeholder')}
                  value={email} onChange={e => setEmail(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-stone-700">{t('login_page.password_placeholder')}</span>
                <input type="password" autoComplete="current-password" required className={inputClasses}
                  placeholder={t('login_page.password_placeholder')}
                  value={password} onChange={e => setPassword(e.target.value)} />
              </label>

              <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
                {loading && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                  </svg>
                )}
                {loading ? t('login_page.signing_in') : t('login_page.sign_in')}
              </button>

              {/* v3 follow-up: self-service password reset. Accounts are created
                  by an admin invite (see /admin/users), not open signup, so
                  there's no "create an account" link — only a way back in. */}
              <Link href="/forgot-password" className="block text-center text-sm text-stone-500 hover:text-stone-700">
                {t('login_page.forgot_password')}
              </Link>
            </form>

            <p className="mt-8 text-center text-xs text-stone-400">{t('login_page.invite_only')}</p>

            {/* The dark panel carries this link too, but it's `lg`-only and
                sits low — below `lg` the panel isn't rendered at all, so
                without this one there'd be no way to reach the landing page
                from a phone. Here it's on the form side, always visible. */}
            <div className="mt-5 border-t border-stone-200 pt-5 text-center">
              <Link href="/welcome" className="btn btn-secondary btn-sm">
                {t('public.learn_more')}
                <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
