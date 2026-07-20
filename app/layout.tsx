// Fix: original file had duplicate imports of globals.css, ReactNode, and Navbar
// (would fail to compile). Deduplicated below.
//
// Fix 2: '../src/i18n' (and therefore react-i18next) used to be imported
// directly here. app/layout.tsx is a Server Component by default, so that
// import chain reached react-i18next's client-only hooks (createContext,
// useRef) with no "use client" boundary in between, and `next build` failed
// with a ReactServerComponentsError. i18n is now initialized from Navbar.tsx
// instead, which is already a Client Component.
import './globals.css'
import { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import Navbar from '../components/Navbar'
import AuthGate from '../components/AuthGate'

// UI polish pass: self-hosted via next/font (no runtime request to Google,
// downloaded once at build time and served from our own domain) instead of
// the default system font stack, for a more considered look across the app.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata = {
  title: 'Butcher Cashier',
  description: 'SaaS cashier for non-countable products (meat)'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-stone-50 min-h-screen font-sans text-stone-900 antialiased">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <AuthGate>{children}</AuthGate>
        </div>
      </body>
    </html>
  )
}
