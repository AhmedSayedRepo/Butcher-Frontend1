'use client'
import { useTranslation } from 'react-i18next'

// v3.1 follow-up 10h. Extracted from AuthGate, which had this inline, so the
// permission-gated pages can show the *same* spinner while the session
// resolves rather than each inventing one — or, as they used to, rendering
// "you don't have access" because a permission check can't tell "still
// loading" from "denied".
//
// Deliberately sized to fill the content area rather than sitting inline: it
// replaces a whole page, so a small spinner floating at the top-left would
// read as a stuck page rather than a loading one.
export default function Spinner({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <svg className="h-6 w-6 animate-spin text-stone-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
      </svg>
      <span className="sr-only">{label ?? t('auth_gate.loading')}</span>
    </div>
  )
}
