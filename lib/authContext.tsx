// v3.1 follow-up 10h — one session, fetched once.
//
// `useAuth()` used to be a self-contained hook: every component that called it
// held its own state, starting at `undefined`, and fired its own
// GET /auth/me. With 26 call sites across the app that had two visible
// consequences:
//
//   1. **The "no access" flash.** AuthGate resolves the session before it
//      renders a page, but the page then mounts its *own* useAuth, which
//      starts at `undefined` all over again. Permission checks are written as
//      `user != null && user.caps.includes('manage_cash')` — which is `false`
//      while loading, indistinguishable from "denied". So navigating to Cash
//      or Settings showed "You don't have access to this" for a moment and
//      then replaced it with the real page. The user reported this as the app
//      telling them they had no access until the backend responded, which is
//      exactly what it was doing.
//   2. **A redundant request per navigation**, sometimes several on one page.
//
// A context fixes both: the fetch happens once, in the provider, and every
// consumer reads the already-resolved value. A page mounted after a
// navigation sees the real user on its first render, so there is no window in
// which "loading" can be mistaken for "denied".
//
// Kept as three states rather than a boolean-plus-user, because the third
// state is the whole point:
//   undefined → still asking
//   null      → asked, definitely signed out
//   object    → signed in
'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import api from './api'

// v2 replan (Phase D): `caps` mirrors backend/src/lib/caps.ts's effective-caps
// computation (role defaults + per-user overrides), already resolved
// server-side by GET /auth/me — the frontend never re-derives caps from role
// itself, so exactly one place decides what a role implies.
export interface CurrentUser {
  id: string
  email: string
  role: string
  caps: string[]
  // Multi-tenancy phase 4. Shown only so the rail can offer the Organizations
  // link; the API enforces it independently, as always.
  isSuperAdmin?: boolean
  organizationId?: string | null
}

export type AuthState = CurrentUser | null | undefined

// There is deliberately no `refresh()` on this context. The only two events
// that change who's signed in — login and logout — both do a full page load
// (`window.location.href`, see app/login/page.tsx and Sidebar's logout), which
// remounts the provider and re-runs the check. A refresh function would be
// dead code that looks like it's load-bearing.
const AuthContext = createContext<AuthState>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState>(undefined)

  useEffect(() => {
    let cancelled = false
    api.get<CurrentUser>('/auth/me')
      .then(r => { if (!cancelled) setUser(r.data) })
      .catch(() => { if (!cancelled) setUser(null) })
    return () => { cancelled = true }
  }, [])

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>
}

/** The current session. `undefined` while the first check is in flight. */
export function useAuth(): AuthState {
  return useContext(AuthContext)
}

/**
 * True only while we genuinely don't know yet. Pages use this to show a
 * spinner instead of a permission error — the distinction the old hook
 * couldn't express.
 */
export function useAuthLoading(): boolean {
  return useContext(AuthContext) === undefined
}
