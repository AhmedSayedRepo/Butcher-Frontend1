// Added: Login/Logout link so the auth flow (ADR-002) is reachable from the UI.
//
// i18n init moved here from app/layout.tsx: this is the first Client
// Component in the tree (layout.tsx is a Server Component and can't import
// react-i18next directly — see the comment in layout.tsx for the build
// error that caused). The side-effect import below runs before
// useTranslation is called.
//
// Tech debt (ADR-002), now resolved: login state used to come from
// `getToken()` (localStorage). Now that the token is an httpOnly cookie,
// only the backend can say whether it's valid — see lib/useAuth.ts.
//
// Nav labels now run through `t()` instead of being hardcoded English —
// they previously weren't wired to i18n at all despite the EN/AR switcher
// already existing (see src/locales/{en,ar}.json), which was a pre-existing
// gap tracked under Phase 5 "hardcoded UI strings". Added while wiring up
// the new Help & Guide link, which needed to be bilingual from the start.
//
// App-wide RTL: this effect already set `document.documentElement.lang` on
// language change — now also sets `dir`, which cascades to every element in
// the document (flex/grid direction, text alignment, etc. via the browser's
// native bidi handling). This flips real layout direction app-wide from one
// place. Known limitation: Tailwind's physical-direction utilities (`ml-*`,
// `text-left`, etc.) used throughout the page components don't auto-flip —
// only properties that respect the `dir` attribute natively (flexbox/grid
// flow, text-align: start/end semantics browsers apply by default, form
// control alignment) do. Full RTL polish would mean migrating those
// utilities to Tailwind's logical-property variants (`ms-*`/`me-*`) — not
// done here, tracked as remaining Phase 5 work.
'use client'
import '../src/i18n'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import api from '../lib/api'
import { useAuth } from '../lib/useAuth'

// UI polish pass: added active-link highlighting (usePathname), a mobile
// hamburger menu (the original 6-link + 2-button bar had no small-screen
// handling at all and would wrap/overflow badly), a small brand mark, and a
// sticky/blurred header. Layout and i18n/RTL behavior are unchanged.
// v2 replan (Phase B.5): "batches" links to the new carcass-dismantling
// module — the label was already translated in both locale files ahead of
// this phase being built (see src/locales/{en,ar}.json).
const NAV_ITEMS = [
  { href: '/', key: 'dashboard' },
  { href: '/orders', key: 'orders' },
  { href: '/orders/new', key: 'new_order' },
  { href: '/inventory', key: 'inventory' },
  { href: '/dismantle', key: 'batches' },
  { href: '/admin', key: 'admin' },
  { href: '/help', key: 'help' },
] as const

function BrandMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="8" className="fill-brand-600" />
      <path
        d="M8 18.5 17 9.5M17 9.5h-4M17 9.5v4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="19" r="2" className="fill-white" />
    </svg>
  )
}

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const pathname = usePathname()
  const user = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  // Close the mobile menu on route change so it doesn't stay open after
  // navigating. Deliberately NOT a `useEffect([pathname])` — react-hooks'
  // set-state-in-effect rule flags synchronous setState-in-effect because it
  // causes an extra render pass; React's own docs recommend this pattern
  // instead for "reset state when a prop changes": track the previous value
  // in state and adjust *during render* (this is the one sanctioned case for
  // calling setState while rendering — it's a no-op if the values match, and
  // otherwise short-circuits straight to the corrected render, one render
  // total instead of two). See https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setMenuOpen(false)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    document.documentElement.lang = i18n.language
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr'
  }, [i18n.language])

  const switchLang = () => i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en')

  async function logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      // Full page load, not router.push() — see the matching comment in
      // app/login/page.tsx. Same stale-mounted-AuthGate problem in reverse:
      // without a hard navigation, AuthGate/useAuth still hold the
      // pre-logout "logged in" state for this mounted instance.
      window.location.href = '/login'
    }
  }

  function linkClasses(href: string) {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return [
      'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-brand-50 text-brand-700'
        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
    ].join(' ')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <BrandMark />
          <span className="text-lg font-semibold tracking-tight text-stone-900">{t('app_name')}</span>
        </Link>

        {/* Desktop nav — hidden while logged out (v2 replan: login gating).
            Every module now requires a session, so there's nothing useful to
            link to until `user` resolves truthy; AuthGate (app/layout.tsx)
            bounces any direct navigation to a module URL back to /login
            anyway, but hiding the links avoids offering dead-end clicks. */}
        {user && (
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className={linkClasses(item.href)}>
                {t(item.key)}
              </Link>
            ))}
          </nav>
        )}

        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={switchLang}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100"
          >
            EN/AR
          </button>
          {user ? (
            <button
              onClick={logout}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100"
            >
              {t('logout')}
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              {t('login')}
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="Toggle menu"
          className="lg:hidden rounded-lg p-2 text-stone-700 hover:bg-stone-100"
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu panel — module links hidden while logged out, same
          reasoning as the desktop nav above. */}
      {menuOpen && (
        <nav className="lg:hidden border-t border-stone-200 bg-white px-4 py-3 space-y-1">
          {user && NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={`block ${linkClasses(item.href)}`}>
              {t(item.key)}
            </Link>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={switchLang}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              EN/AR
            </button>
            {user ? (
              <button
                onClick={logout}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                {t('logout')}
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                {t('login')}
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}
