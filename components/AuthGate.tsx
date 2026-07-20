// v2 replan (login gating): every module (dashboard, orders, inventory,
// dismantle, admin, help) now requires a session — /login is the only public
// route, so it's effectively the landing page for anyone who isn't
// authenticated: any other URL bounces here until they sign in, and /login
// itself bounces away to "/" once a session exists.
//
// This is a client-side redirect, not a server-side one. It can't be done in
// Next.js middleware because the auth cookie is set by the backend on its
// own domain (Render), not the frontend's (Vercel) — the browser never sends
// it to a same-origin middleware request, which is exactly why `useAuth()`
// already has to ask the backend (`GET /auth/me`) instead of reading a
// client-visible cookie. Real enforcement is unchanged: every API route is
// still independently gated server-side by `auth`/`requireCap` middleware
// (backend/src/middleware/rbac.ts) — this component only prevents the UI
// from *offering* pages a logged-out visitor can't actually use.
'use client'
import { useEffect, ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/useAuth'

// v3 follow-up: forgot-password and set-password (invite + reset landing
// page) both need to be reachable by someone who isn't logged in yet — that's
// the whole point of them.
const PUBLIC_PATHS = ['/login', '/forgot-password', '/set-password']

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <svg className="h-6 w-6 animate-spin text-stone-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  )
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const user = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const isPublicPath = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    if (user === undefined) return // GET /auth/me hasn't resolved yet
    if (user === null && !isPublicPath) {
      router.replace('/login')
    } else if (user !== null && isPublicPath) {
      router.replace('/')
    }
  }, [user, isPublicPath, router])

  // /login itself: render immediately for logged-out/loading visitors (it's
  // the landing page, no reason to make them wait on an auth check first).
  // Once `user` resolves to a real session, show a spinner while redirect
  // effect above sends them to "/" instead of flashing the login form.
  if (isPublicPath) {
    return user ? <Spinner label={t('auth_gate.loading')} /> : <>{children}</>
  }

  // Every other route: only render once we know for certain there's a
  // session. Covers both "still checking" (undefined) and "confirmed logged
  // out, about to redirect" (null) with the same spinner so protected
  // content never flashes on screen first.
  return user ? <>{children}</> : <Spinner label={t('auth_gate.loading')} />
}
