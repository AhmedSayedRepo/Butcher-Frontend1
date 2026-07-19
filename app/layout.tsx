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
import Navbar from '../components/Navbar'

export const metadata = {
  title: 'Butcher Cashier',
  description: 'SaaS cashier for non-countable products (meat)'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <Navbar />
        <div className="max-w-7xl mx-auto p-4">{children}</div>
      </body>
    </html>
  )
}
