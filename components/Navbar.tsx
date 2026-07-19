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
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '../lib/api'
import { useAuth } from '../lib/useAuth'

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const user = useAuth()

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
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <header className="bg-white shadow p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="text-lg font-semibold">{t('app_name')}</div>
        <nav className="flex items-center gap-3">
          <Link href="/" className="px-3 py-1">{t('dashboard')}</Link>
          <Link href="/orders" className="px-3 py-1">{t('orders')}</Link>
          <Link href="/orders/new" className="px-3 py-1">{t('new_order')}</Link>
          <Link href="/inventory" className="px-3 py-1">{t('inventory')}</Link>
          <Link href="/admin" className="px-3 py-1">{t('admin')}</Link>
          <Link href="/help" className="px-3 py-1">{t('help')}</Link>
          <button onClick={switchLang} className="px-3 py-1 border rounded">EN/AR</button>
          {user ? (
            <button onClick={logout} className="px-3 py-1 border rounded">{t('logout')}</button>
          ) : (
            <Link href="/login" className="px-3 py-1 border rounded">{t('login')}</Link>
          )}
        </nav>
      </div>
    </header>
  )
}
