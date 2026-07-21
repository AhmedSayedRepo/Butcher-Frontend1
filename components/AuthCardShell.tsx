'use client'
import { ReactNode } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import ThemeToggle from './ThemeToggle'

// v3.1 follow-up 10i — frame for the two secondary auth screens
// (forgot-password, set-password).
//
// They don't get the login page's split treatment: they're single-purpose
// detours, usually reached from a link in an email, and a full-height brand
// panel beside a one-field form would be all frame and no picture. But since
// public routes no longer render the nav rail (see AppShell), they'd otherwise
// be a card floating on a bare page with no indication of what app it belongs
// to — which, arriving cold from an email, matters.
export default function AuthCardShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between p-4 sm:p-6">
        <Link href="/login" className="flex items-center gap-2.5">
          <svg width="30" height="30" viewBox="0 0 34 34" fill="none" aria-hidden="true">
            <rect width="34" height="34" rx="10" fill="url(#authLogo)" />
            <path d="M10 23 21 12M21 12h-4.8M21 12v4.8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="11.5" cy="23" r="2.2" fill="#fff" />
            <defs>
              <linearGradient id="authLogo" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
                <stop stopColor="#22D3EE" />
                <stop offset="1" stopColor="#0891B2" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-base font-extrabold tracking-tight text-stone-900">{t('app_name')}</span>
        </Link>
        <ThemeToggle compact className="btn btn-ghost btn-icon" />
      </div>

      <div className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm">
          <h1 className="mb-6 text-center text-xl font-bold tracking-tight text-stone-900">{title}</h1>
          <div className="rounded-2xl border border-stone-200 bg-surface p-6 shadow-card">{children}</div>
        </div>
      </div>
    </div>
  )
}
