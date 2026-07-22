'use client'
import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import AuthGate from './AuthGate'
import IdleLogout from './IdleLogout'
import InboundOrderAlert from './InboundOrderAlert'
import { PUBLIC_PATHS } from '../lib/publicPaths'
import ToastProvider from './ToastProvider'

// v3.1 follow-up 10i — two chromes, one layout.
//
// Every page used to render inside the same frame: nav rail on the left,
// padded `<main>` on the right. That's correct for the app, and wrong for the
// pages you see *before* you're in it — login, the landing page, the invite
// and reset screens. A signed-out visitor got a nav rail with nothing in it
// (module links are hidden until there's a session) beside a small card
// floating in a padded column.
//
// Public routes now render edge to edge with no rail, so they can carry a
// full-height branded panel. `AuthGate` still wraps both branches: it's what
// bounces a signed-in user away from /login and a signed-out one away from
// everything else, and that has to keep happening on both sides.
//
// This is a client component purely because it needs `usePathname()`; the
// root layout stays a server component so the fonts and the pre-paint theme
// script are unaffected.
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isPublic = PUBLIC_PATHS.includes(pathname)

  if (isPublic) {
    return (
      <ToastProvider>
        <div className="min-h-screen">
          <AuthGate>{children}</AuthGate>
        </div>
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <AuthGate>{children}</AuthGate>
      </main>
      {/* Only inside the app. On the login page there's no session to time out,
          and a countdown over a sign-in form would be baffling. */}
      <IdleLogout />
      {/* Announces inbound orders on every screen, not just the dashboard —
          the cashier is on the board or the new-order form, which is exactly
          where the old stale-draft alert wasn't. */}
      <InboundOrderAlert />
    </div>
    </ToastProvider>
  )
}
