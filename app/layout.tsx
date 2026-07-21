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
import { Inter, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import Sidebar from '../components/Sidebar'
import AuthGate from '../components/AuthGate'
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from '../lib/theme'

// Self-hosted via next/font (downloaded at build time, served from our own
// domain) rather than a runtime request to Google. Inter carries the light
// "Clean Operator" theme; IBM Plex Sans/Mono carry the dark "Trade Floor" one,
// where figures are set in mono. All three load as CSS variables and are
// selected by --font-ui / --font-num in globals.css, so switching theme doesn't
// re-request a font.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
})
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata = {
  title: 'Butcher Cashier',
  description: 'SaaS cashier for non-countable products (meat)',
}

const fontVars = `${inter.variable} ${plexSans.variable} ${plexMono.variable}`

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
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            <AuthGate>{children}</AuthGate>
          </main>
        </div>
      </body>
    </html>
  )
}
