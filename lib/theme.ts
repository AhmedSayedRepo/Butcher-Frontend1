// Design revamp (2026-07-21): light/dark theme state.
//
// Two themes, from the Claude-design mockups: 'light' (Clean Operator) and
// 'dark' (Trade Floor). Light is the default — both because it's what the shop
// sees today and because an unset preference should land somewhere calm.
//
// Deliberately NOT following `prefers-color-scheme` by default: this is a
// shared shop terminal, not a personal device, and staff would have no idea why
// the till went dark at sunset if the OS happened to be on auto. The toggle is
// explicit and sticky instead.
//
// Storage is localStorage rather than a cookie or ShopSettings row: it's a
// per-device display preference, not shop data, and two terminals in the same
// shop can reasonably differ (the counter screen vs. the back-office laptop).
// That also keeps it off the server entirely — no migration, no API call.
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'butcher-theme'
export const DEFAULT_THEME: Theme = 'light'

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : DEFAULT_THEME
  } catch {
    // Private-browsing / storage-disabled: fall back rather than crash the app.
    return DEFAULT_THEME
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

export function storeTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Non-fatal: the theme still applies for this session, it just won't stick.
  }
}

// Inlined into <head> before first paint (see app/layout.tsx). Without it the
// page renders light, then flips to dark once React hydrates — a white flash on
// every single navigation for dark-theme users. Kept as a compact string
// because it ships in every HTML response.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.dataset.theme=(t==='dark'||t==='light')?t:'${DEFAULT_THEME}'}catch(e){document.documentElement.dataset.theme='${DEFAULT_THEME}'}})()`

// ── Rail collapse ───────────────────────────────────────────────────────────
// v3.1 follow-up 10: the rail can be collapsed to an icon-width strip so the
// content area gets ~200px back — worth having on a 1366px shop terminal where
// the orders board is five columns wide. Same storage reasoning as the theme:
// a per-device display preference, not shop data.
export const RAIL_STORAGE_KEY = 'butcher-rail-collapsed'

export function readStoredRailCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(RAIL_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function storeRailCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RAIL_STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    // Non-fatal — the choice just won't persist.
  }
}
