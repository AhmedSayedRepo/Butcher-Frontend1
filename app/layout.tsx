// Fix: original file had duplicate imports of globals.css, ReactNode, and Navbar
// (would fail to compile). Deduplicated below.
//
// Fix 2: '../src/i18n' (and therefore react-i18next) used to be imported
// directly here. app/layout.tsx is a Server Component by default, so that
// import chain reached react-i18next's client-only hooks (createContext,
// useRef) with no "use client" boundary in between, and `next build` failed
// with a ReactServerComponentsError. i18n is initialized from the sidebar
// instead, which is already a Client Component.
//
// Design revamp (2026-07-21): the top Navbar became a left rail (Sidebar), so
// the shell is now a two-column flex row rather than a stacked header + centred
// container. Also adds the two-theme system — see lib/theme.ts and globals.css.
import './globals.css'
import { ReactNode } from 'react'
import { Manrope, IBM_Plex_Sans_Arabic, JetBrains_Mono } from 'next/font/google'
import AppShell from '../components/AppShell'
import { AuthProvider } from '../lib/authContext'
import FieldTooltips from '../components/FieldTooltips'
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from '../lib/theme'

// Self-hosted via next/font (downloaded at build time, served from our own
// domain) rather than a runtime request to Google. The three families are
// qa-studio's F_UI / F_AR / F_MONO, so the two products set type identically:
// Manrope for UI, IBM Plex Sans Arabic for Arabic text (which Manrope has no
// coverage for — it sits second in the --font-ui stack and the browser falls
// through to it per-glyph), JetBrains Mono for figures.
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' })
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
})
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata = {
  title: 'Butcher Cashier',
  description: 'SaaS cashier for non-countable products (meat)',
}

const fontVars = `${manrope.variable} ${plexArabic.variable} ${jetbrains.variable}`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // lang/dir are corrected client-side by Sidebar's effect once i18n resolves.
    // They're seeded to Arabic/RTL here because that's now the default language
    // (src/i18n.ts) — seeding them to English would mean every first paint
    // rendered LTR and then flipped.
    //
    // suppressHydrationWarning: the inline theme script mutates
    // documentElement.dataset.theme before React hydrates, so server and client
    // markup legitimately differ on this one attribute.
    <html lang="ar" dir="rtl" data-theme={DEFAULT_THEME} className={fontVars} suppressHydrationWarning>
      <head>
        {/* Runs before first paint so dark-theme users don't get a white flash
            on every navigation. See THEME_INIT_SCRIPT in lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-stone-50 font-sans text-stone-900 antialiased">
        {/* Fills in a `title` tooltip on every form field app-wide — see the
            component for why this is a DOM pass rather than a per-field edit. */}
        <FieldTooltips />
        {/* v3.1 follow-up 10h: one GET /auth/me for the whole app. The rail,
            the gate and every page read the same resolved value, so a page
            mounted by a navigation never re-enters the "still loading" state
            that its permission checks read as "denied". */}
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
