'use client'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { useAuth } from '../../lib/useAuth'

// v2 replan, Phase D: was a static placeholder ("still a static placeholder,
// no real users/branding/settings functionality" — ROADMAP.md). Now links to
// the real /admin/users screen.
// v3.1 follow-up 5: the inline shop-settings form (Phase J's alert
// threshold) that used to live here moved to its own /settings page —
// same reasoning as the earlier Cash Management move below: a shop-wide
// config screen deserves a real primary-nav destination, not a card buried
// under /admin, especially now that it also covers the low-stock default
// and the outgoing-email sender name (not just the one alert field).
export default function AdminPage(){
  const { t } = useTranslation()
  const user = useAuth()
  const caps = user != null && Array.isArray(user.caps) ? user.caps : []
  const canManageUsers = caps.includes('manage_users')
  const isAdmin = user != null && user.role === 'admin'

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">{t('admin')}</h1>

      {canManageUsers && (
        <Link
          href="/admin/users"
          className="mb-4 flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover"
        >
          <span className="font-medium text-stone-900">{t('admin_page.manage_users')}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      )}

      {/* v3 follow-up: Cash Management moved to the primary top nav (see
          components/Navbar.tsx) instead of living only as a card here —
          it's now reachable from anywhere, not buried under /admin. */}

      {/* v3.1 follow-up 5: same move for shop-wide Settings (alert
          threshold, low-stock default, email sender name). */}
      {isAdmin && (
        <Link
          href="/settings"
          className="mb-4 flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover"
        >
          <span className="font-medium text-stone-900">{t('settings')}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      )}

      <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <p className="text-sm text-stone-500">{t('admin_page.subtitle')}</p>
      </div>
    </div>
  )
}
