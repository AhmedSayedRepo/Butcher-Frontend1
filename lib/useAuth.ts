// Replaces the old `getToken()` (localStorage) check used to gate login-only
// UI. Since the token is now an httpOnly cookie (ADR-002, resolved), frontend
// JS can't read it directly to decide "am I logged in?" — the only way to know
// is to ask the backend, via GET /auth/me, which reads the cookie server-side
// and returns the current user (or 401).
//
// v3.1 follow-up 10h: the implementation moved to lib/authContext.tsx so that
// answer is fetched **once for the whole app** rather than once per component
// — see the comment there for the "no access" flash it was causing on every
// navigation.
//
// This file stays as a re-export purely so the existing
// `import { useAuth } from '.../useAuth'` lines don't all have to change. New
// code can import from either path; they're the same thing.
export { useAuth, useAuthLoading } from './authContext'
export type { CurrentUser, AuthState } from './authContext'
