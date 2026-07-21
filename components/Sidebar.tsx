// Design revamp (2026-07-21) — replaces the old top Navbar with a left rail,
// per both Claude-design mockups (Clean Operator / Trade Floor). Everything
// Navbar.tsx did is preserved; only the shape changed:
//
//   - i18n is still initialized here via the side-effect import. This is still
//     the first Client Component in the tree, and app/layout.tsx is still a
//     Server Component that can't import react-i18next directly (that import
//     chain is what caused the original ReactServerComponentsError).
//   - the lang/dir effect still lives here, so RTL still flips app-wide from
//     one place.
//   - login/logout, active-link highlighting and the mobile menu all carry over.
//
// New: a theme toggle in the footer, and the rail collapses into an off-canvas
// drawer below `lg` instead of an inline dropdown panel.
//
// RTL: the rail uses logical properties (`border-e`, `start-0`) rather than
// physical ones, so it moves to the right-hand side under `dir="rtl"` without a
// second set of styles. That matters more than it used to now that Arabic is
// the default language.
'use client'
import '../src/i18n'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import api from '../lib/api'
import { useAuth } from '../lib/useAuth'
import ThemeToggle from './ThemeToggle'

// v3 follow-up: "cash" sits in the primary nav rather than under /admin; the
// destination page itself shows a no-access message for anyone lacking the
// `manage_cash` capability, rather than this list doing per-item filtering.
// Same pattern for "admin" and "settings".
const NAV_ITEMS = [
  { href: '/', key: 'dashboard' },
  { href: '/orders', key: 'orders' },
  { href: '/orders/new', key: 'new_order' },
  { href: '/orders/inbox', key: 'inbox' },
  { href: '/customers', key: 'customers' },
  { href: '/inventory', key: 'inventory' },
  { href: '/dismantle', key: 'batches' },
  { href: '/admin/cash', key: 'cash' },
  { href: '/admin', key: 'admin' },
  { href: '/settings', key: 'settings' },
  { href: '/help', key: 'help' },
] as const

const FOOTER_BUTTON =
  'rail-item flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-900'

function BrandMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true" className="shrink-0">
      <rect width="30" height="30" rx="9" className="fill-brand-600" />
      <path d="M9 20 18.5 10.5M18.5 10.5h-4.2M18.5 10.5v4.2" stroke="currentColor" className="text-white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="20.5" r="2" fill="currentColor" className="text-white" />
    </svg>
  )
}

export default function Sidebar() {
  const { t, i18n } = useTranslation()
  const pathname = usePathname()
  const user = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  // Close the drawer on route change so it doesn't stay open after navigating.
  // Deliberately NOT a `useEffect([pathname])` — React's docs recommend
  // adjusting state during render for "reset when a prop changes", which is one
  // render instead of two. See
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
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

  // Escape closes the drawer — expected of anything modal-ish, and the only way
  // out for keyboard users on a narrow screen.
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  const switchLang = () => {
    void i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en')
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      // Full page load, not router.push() — without a hard navigation,
      // AuthGate/useAuth still hold the pre-logout "logged in" state for this
      // mounted instance.
      window.location.href = '/login'
    }
  }

  function itemClasses(href: string) {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return [
      'rail-item flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm',
      active
        ? 'bg-brand-50 font-bold text-brand-700'
        : 'font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-900',
    ].join(' ')
  }

  function itemDot(href: string) {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return (
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-sm ${active ? 'bg-brand-600' : 'bg-stone-400 opacity-40'}`}
      />
    )
  }

  const railBody = (
    <>
      <Link href="/" className="mb-5 flex items-center gap-2.5 px-2.5 py-1.5">
        <BrandMark />
        <span className="text-base font-extrabold tracking-tight text-stone-900">{t('app_name')}</span>
      </Link>

      {/* Module links are hidden while logged out: every module requires a
          session, so there's nothing useful to link to until `user` resolves
          truthy. AuthGate bounces direct navigation back to /login anyway;
          hiding the links just avoids offering dead-end clicks. */}
      {user && (
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={itemClasses(item.href)}>
              {itemDot(item.href)}
              {t(item.key)}
            </Link>
          ))}
        </nav>
      )}

      <div className="mt-auto flex flex-col gap-1 border-t border-stone-200 pt-3">
        <ThemeToggle className={FOOTER_BUTTON} />
        <button type="button" onClick={switchLang} className={FOOTER_BUTTON}>
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-sm bg-stone-400 opacity-40" />
          EN / AR
        </button>
        {user ? (
          <button type="button" onClick={logout} className={FOOTER_BUTTON}>
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-sm bg-stone-400 opacity-40" />
            {t('logout')}
          </button>
        ) : (
          <Link href="/login" className={FOOTER_BUTTON}>
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-sm bg-stone-400 opacity-40" />
            {t('login')}
          </Link>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Desktop rail — always present from `lg` up. */}
      <aside className="app-rail sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col gap-1 border-e border-stone-200 bg-surface p-4 shadow-rail lg:flex">
        {railBody}
      </aside>

      {/* Compact top bar, below `lg` only. The rail would eat most of a phone
          screen, so it becomes an off-canvas drawer behind this hamburger. */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-stone-200 bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark />
          <span className="text-base font-extrabold tracking-tight text-stone-900">{t('app_name')}</span>
        </Link>
        <button
          type="button"
          onClick={() => { setMenuOpen((v) => !v) }}
          aria-expanded={menuOpen}
          aria-label={t('toggle_menu')}
          className="rounded-lg p-2 text-stone-700 hover:bg-stone-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Scrim. `bg-overlay` is deliberately outside the neutral ramp so it
              stays dark under both themes instead of inverting to white. */}
          <button
            type="button"
            aria-label={t('toggle_menu')}
            onClick={() => { setMenuOpen(false) }}
            className="absolute inset-0 h-full w-full cursor-default bg-overlay/50"
          />
          <aside className="app-rail absolute inset-y-0 start-0 flex w-[260px] max-w-[85vw] flex-col gap-1 border-e border-stone-200 bg-surface p-4 shadow-rail">
            {railBody}
          </aside>
        </div>
      )}
    </>
  )
}
