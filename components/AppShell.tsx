'use client'
import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import AuthGate from './AuthGate'
import { PUBLIC_PATHS } from '../lib/publicPaths'

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
      <div className="min-h-screen">
        <AuthGate>{children}</AuthGate>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <AuthGate>{children}</AuthGate>
      </main>
    </div>
  )
}
