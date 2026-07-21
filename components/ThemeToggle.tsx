// Design revamp (2026-07-21): the light/dark switch.
//
// Sits in the rail footer next to the language switch and logout, matching
// qa-studio's placement — and, like its version, the row is labelled with the
// mode you'd switch *to* while a chip on the trailing edge shows the mode
// you're currently in ("Dark mode … LIGHT").
'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Theme, applyTheme, readStoredTheme, storeTheme } from '../lib/theme'

export default function ThemeToggle({
  className,
  chipClassName,
  compact = false,
}: {
  className?: string
  chipClassName?: string
  /** Collapsed rail: icon only, label moves into a tooltip. */
  compact?: boolean
}) {
  const { t } = useTranslation()
  // Rendered on the server too, so the first render must match the markup the
  // no-flash script produced. It starts from the default and corrects itself in
  // the effect below — the *attribute* was already set pre-paint by that
  // script, so this only ever syncs React's copy of the state, never the pixels.
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    setTheme(readStoredTheme())
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    storeTheme(next)
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      // The control is an on/off switch over a single setting, so it's a
      // switch, not a plain button — screen readers announce the state rather
      // than just the label.
      role="switch"
      aria-checked={isDark}
      aria-label={t('theme_toggle')}
      title={compact ? (isDark ? t('theme_light_mode') : t('theme_dark_mode')) : undefined}
      className={className}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
      {!compact && (
        <>
          <span>{isDark ? t('theme_light_mode') : t('theme_dark_mode')}</span>
          <span aria-hidden="true" className={chipClassName}>
            {isDark ? t('theme_dark') : t('theme_light')}
          </span>
        </>
      )}
    </button>
  )
}
