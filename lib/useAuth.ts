// Replaces the old `getToken()` (localStorage) check used to gate
// login-only UI. Since the token is now an httpOnly cookie (ADR-002,
// resolved), frontend JS can't read it directly to decide "am I logged in?"
// — the only way to know is to ask the backend, via GET /auth/me, which
// reads the cookie server-side and returns the current user (or 401).
'use client'
import { useEffect, useState } from 'react'
import api from './api'

export type CurrentUser = { id: string, email: string, role: string }

// undefined = still loading, null = confirmed logged out
export function useAuth(): CurrentUser | null | undefined {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    api.get<CurrentUser>('/auth/me')
      .then(r => { if (!cancelled) setUser(r.data) })
      .catch(() => { if (!cancelled) setUser(null) })
    return () => { cancelled = true }
  }, [])

  return user
}
