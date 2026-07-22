// Design revamp (2026-07-21) — replaces the old top Navbar with a left rail.
// Structure and styling follow the sibling qa-studio desktop app (read-only
// reference; nothing there was modified):
//
//   - deep teal-navy gradient rail that stays dark under BOTH themes, so the
//     cyan accents read as neon against it. Colours come from the `.app-rail`
//     rules in globals.css (its RAIL_* tokens), not Tailwind's neutral ramp —
//     that ramp inverts with the theme and the rail must not.
//   - a "PIPELINE" group label above the primary nav, a quieter secondary group
//     below it, then the display/session controls pinned to the bottom.
//   - each primary row carries a short index chip (`ix`), right-aligned.
//   - the active row is a cyan gradient pill with a glow.
//
// Everything the old Navbar did is preserved:
//   - i18n is still initialized here via the side-effect import. This is still
//     the first Client Component in the tree, and app/layout.tsx is still a
//     Server Component that can't import react-i18next directly (that import
//     chain is what caused the original ReactServerComponentsError).
//   - the lang/dir effect still lives here, so RTL still flips app-wide from
//     one place.
//   - login/logout, active-link highlighting and the mobile menu all carry over.
//
// RTL: logical properties throughout (`border-e`, `start-0`, `ms-auto`), so the
// rail moves to the right-hand side and the chips flip with it — no second set
// of styles. That matters now that Arabic is the default language.
'use client'
import '../src/i18n'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import api from '../lib/api'
import { useAuth } from '../lib/useAuth'
import { readStoredRailCollapsed, storeRailCollapsed } from '../lib/theme'
import { safeImageUrl } from '../lib/safeImageUrl'
import ThemeToggle from './ThemeToggle'

// `ix` mirrors qa-studio's NAV entries: a one/two-letter index in a small chip
// at the end of each row. It's a fast visual anchor in a list this long, and it
// stays legible when the label is Arabic.
//
// v3 follow-up: "cash" sits in the primary nav rather than under /admin; the
// destination page itself shows a no-access message for anyone lacking the
// `manage_cash` capability, rather than this list doing per-item filtering.
// Same pattern for "admin" and "settings" in the secondary group.
const PRIMARY_ITEMS = [
  { href: '/', key: 'dashboard', ix: 'D' },
  { href: '/orders', key: 'orders', ix: 'O' },
  { href: '/orders/new', key: 'new_order', ix: 'N' },
  { href: '/orders/inbox', key: 'inbox', ix: 'In' },
  { href: '/customers', key: 'customers', ix: 'C' },
  { href: '/inventory', key: 'inventory', ix: 'Iv' },
  { href: '/dismantle', key: 'batches', ix: 'B' },
  { href: '/admin/cash', key: 'cash', ix: 'Ca' },
] as const

// Quieter group, no index chips — qa-studio does the same for Help/Settings.
const SECONDARY_ITEMS = [
  { href: '/admin', key: 'admin' },
  // Multi-tenancy phase 5. Unlike every other row here, this one is hidden
  // rather than shown-and-refused: the rest of the nav is deliberately visible
  // to everyone (the destination explains the refusal), but a shop's staff
  // seeing a link to a screen that manages *other shops* would be confusing
  // rather than informative. The API enforces it independently regardless.
  { href: '/admin/organizations', key: 'organizations', superAdminOnly: true },
  { href: '/settings', key: 'settings' },
  { href: '/help', key: 'help' },
] as const

// Type scale matched to the qa-studio reference rail: its nav labels are
// 13.5px bold, not the 16px medium this used to run at — which read larger and
// lighter than the source design. `text-sm` (14px) semibold is the closest
// web equivalent and lines the primary rows up with the footer rows, which
// were already at this size.
const ROW = 'rail-item flex items-center gap-3 px-3 py-2.5 text-sm font-semibold'
const ROW_COLLAPSED = 'rail-item flex items-center justify-center px-2 py-2.5'
const IX_CHIP_COLLAPSED = 'rail-ix flex h-8 w-8 shrink-0 items-center justify-center text-xs font-bold'
const FOOTER_ROW = 'rail-item flex w-full items-center gap-3 px-3 py-2.5 text-sm font-semibold'
const IX_CHIP = 'rail-ix ms-auto flex h-6 min-w-6 shrink-0 items-center justify-center px-1 text-[11px] font-bold'

// v3.1 follow-up 10e: the shop's own mark, when it has set one. Kept as a
// plain <img> — next/image can't serve a `data:` URL without a custom loader,
// and at 34px there's nothing to optimise.
function ShopMark({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see above.
    <img src={src} alt="" width={34} height={34}
      className="h-[34px] w-[34px] shrink-0 rounded-[10px] object-contain" />
  )
}

function BrandMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true" className="shrink-0">
      <rect width="34" height="34" rx="10" fill="url(#railLogo)" />
      <path d="M10 23 21 12M21 12h-4.8M21 12v4.8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="11.5" cy="23" r="2.2" fill="#fff" />
      {/* qa-studio's GRAD_LOGO */}
      <defs>
        <linearGradient id="railLogo" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22D3EE" />
          <stop offset="1" stopColor="#0891B2" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function Sidebar() {
  const { t, i18n } = useTranslation()
  const pathname = usePathname()
  const user = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  // Collapsed rail: icon-width strip, labels hidden, index chips centred. The
  // initial value must match the server render (always false) and is corrected
  // in the effect below — unlike the theme, a wrong first frame here is a
  // harmless width change rather than a full-page colour flash, so it doesn't
  // need a pre-paint inline script.
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => { setCollapsed(readStoredRailCollapsed()) }, [])

  // v3.1 follow-up 10e: the rail shows the shop's logo and name once they're
  // configured, falling back to the built-in mark and "Butcher Cashier". Only
  // fetched when logged in — GET /api/shop-settings requires a session, and
  // the logged-out rail shows no module links to brand anyway. Failure is
  // silent on purpose: a branding fetch must never block the nav.
  const [brand, setBrand] = useState<{ appLogoUrl: string | null, shopName: string } | null>(null)
  useEffect(() => {
    if (user === null) { setBrand(null); return }
    let live = true
    api.get<{ appLogoUrl: string | null, shopName: string }>('/api/shop-settings')
      .then(r => { if (live) setBrand({ appLogoUrl: r.data.appLogoUrl, shopName: r.data.shopName }) })
      .catch(() => { /* keep the default mark */ })
    return () => { live = false }
  }, [user])

  // Validated on read: see lib/safeImageUrl.ts. Anything that isn't an
  // https:// or data:image URL falls back to the built-in mark.
  const logoUrl = safeImageUrl(brand?.appLogoUrl)
  const brandName = brand?.shopName ?? ''
  const railTitle = brandName === '' ? t('app_name') : brandName

  function toggleCollapsed() {
    setCollapsed((v) => {
      storeRailCollapsed(!v)
      return !v
    })
  }

  // Close the drawer on route change so it doesn't stay open after navigating.
  // Deliberately NOT a `useEffect([pathname])` — React's docs recommend
  // adjusting state during render for "reset when a prop changes", which is one
  // render instead of two. See
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setMenuOpen(false)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    document.documentElement.lang = i18n.language
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr'
  }, [i18n.language])

  // Escape closes the drawer — expected of anything modal-ish, and the only way
  // out for keyboard users on a narrow screen.
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  const switchLang = () => {
    void i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en')
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      // Full page load, not router.push() — without a hard navigation,
      // AuthGate/useAuth still hold the pre-logout "logged in" state for this
      // mounted instance.
      window.location.href = '/login'
    }
  }

  // Bug fix: this used to be a plain `pathname.startsWith(href)`, which lit up
  // TWO rows at once whenever one nav path was a prefix of another — on
  // /admin/cash both "Cash" and "Admin" highlighted, and on /orders/new both
  // "New Order" and "Orders" did. Prefix matching alone can't tell "I am the
  // page" from "I am an ancestor of the page".
  //
  // Fixed by picking the single *longest* nav href that matches, so the most
  // specific route wins and every other candidate loses. The match itself is
  // also segment-aware now (`/orders` must not match a hypothetical
  // `/orders-archive`), which prefix matching got wrong too.
  const NAV_HREFS = [...PRIMARY_ITEMS, ...SECONDARY_ITEMS].map((i) => i.href)
  const matchesPath = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
  const activeHref = NAV_HREFS
    .filter(matchesPath)
    .reduce<string | null>((best, href) => (best === null || href.length > best.length ? href : best), null)

  function isActive(href: string) {
    return href === activeHref
  }

  function row(item: { href: string, key: string, ix?: string }) {
    const active = isActive(item.href)
    const label = t(item.key)
    return (
      <Link
        key={item.href}
        href={item.href}
        data-active={active}
        aria-current={active ? 'page' : undefined}
        // Native title tooltip rather than a custom one: when the rail is
        // collapsed the label is the only thing identifying the row, and a
        // browser tooltip works with the keyboard and screen readers for free.
        title={collapsed ? label : undefined}
        className={collapsed ? ROW_COLLAPSED : ROW}
      >
        {!collapsed && <span className="truncate">{label}</span>}
        {item.ix !== undefined && (
          <span aria-hidden="true" className={collapsed ? IX_CHIP_COLLAPSED : IX_CHIP}>{item.ix}</span>
        )}
        {collapsed && <span className="sr-only">{label}</span>}
      </Link>
    )
  }

  const railBody = (
    <>
      <div className={`rail-brand mb-6 flex items-center ${collapsed ? 'flex-col gap-2' : 'gap-2.5'} px-2 py-1`}>
        <Link href="/" className="flex min-w-0 items-center gap-2.5" title={collapsed ? railTitle : undefined}>
          {logoUrl === null ? <BrandMark /> : <ShopMark src={logoUrl} />}
          {/* Brand at 16px, down from 18px — the reference wordmark is 15px, so
              this sits it closer to the nav scale instead of towering over it. */}
          {!collapsed && <span className="truncate text-base font-extrabold tracking-tight">{railTitle}</span>}
        </Link>
        {/* Collapse control. Hidden on the mobile drawer (`lg:inline-flex`),
            where the rail is already full-width and closing it is what the
            scrim and Escape are for. */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('rail_expand') : t('rail_collapse')}
          title={collapsed ? t('rail_expand') : t('rail_collapse')}
          className="rail-item ms-auto hidden h-8 w-8 shrink-0 items-center justify-center lg:inline-flex"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rail-chevron">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </div>

      {/* Module links are hidden while logged out: every module requires a
          session, so there's nothing useful to link to until `user` resolves
          truthy. AuthGate bounces direct navigation back to /login anyway;
          hiding the links just avoids offering dead-end clicks. */}
      {user && (
        <>
          {!collapsed && <div className="rail-group-label mb-2 px-3">{t('nav_group_pipeline')}</div>}
          <nav className="flex flex-col gap-1">{PRIMARY_ITEMS.map(row)}</nav>
          <nav className="rail-divider mt-4 flex flex-col gap-1 border-t pt-4">
            {SECONDARY_ITEMS.filter(item => !('superAdminOnly' in item) || user?.isSuperAdmin === true).map(row)}
          </nav>
        </>
      )}

      <div className="rail-divider mt-auto flex flex-col gap-1 border-t pt-4">
        <ThemeToggle
          className={collapsed ? ROW_COLLAPSED : FOOTER_ROW}
          chipClassName={IX_CHIP}
          compact={collapsed}
        />
        <button
          type="button"
          onClick={switchLang}
          title={collapsed ? t('language') : undefined}
          className={collapsed ? ROW_COLLAPSED : FOOTER_ROW}
        >
          {!collapsed && <span>{t('language')}</span>}
          <span aria-hidden="true" className={collapsed ? IX_CHIP_COLLAPSED : IX_CHIP}>
            {i18n.language === 'ar' ? 'AR' : 'EN'}
          </span>
          {collapsed && <span className="sr-only">{t('language')}</span>}
        </button>
        {user ? (
          <button
            type="button"
            onClick={logout}
            title={collapsed ? t('logout') : undefined}
            className={collapsed ? ROW_COLLAPSED : FOOTER_ROW}
          >
            {collapsed ? (
              <>
                <span aria-hidden="true" className={IX_CHIP_COLLAPSED}>⏻</span>
                <span className="sr-only">{t('logout')}</span>
              </>
            ) : (
              <span>{t('logout')}</span>
            )}
          </button>
        ) : (
          <Link
            href="/login"
            title={collapsed ? t('login') : undefined}
            className={collapsed ? ROW_COLLAPSED : FOOTER_ROW}
          >
            {collapsed ? (
              <>
                <span aria-hidden="true" className={`${IX_CHIP_COLLAPSED} rtl:rotate-180`}>→</span>
                <span className="sr-only">{t('login')}</span>
              </>
            ) : (
              <span>{t('login')}</span>
            )}
          </Link>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Desktop rail — always present from `lg` up. `h-screen` + `sticky` keeps
          the navy running the full height of the viewport rather than stopping
          where its content ends. */}
      {/* Bug fix: this was `sticky top-0 h-screen`, which still scrolled away
          because the rail's own content is taller than the viewport — sticky
          only pins an element until its box ends, and the box was moving.
          Fixed positioning plus its own internal scroll keeps the nav on screen
          at any page scroll and any window height. The spacer <div> below
          reserves the width in the flex row that the fixed element no longer
          occupies. */}
      <aside
        data-collapsed={collapsed}
        className={`app-rail fixed inset-y-0 start-0 z-30 hidden flex-col gap-1 overflow-y-auto border-e shadow-rail transition-[width] duration-200 lg:flex ${collapsed ? 'w-[76px] p-3' : 'w-[268px] p-4'}`}
      >
        {railBody}
      </aside>
      <div aria-hidden="true" className={`hidden shrink-0 transition-[width] duration-200 lg:block ${collapsed ? 'w-[76px]' : 'w-[268px]'}`} />

      {/* Compact top bar, below `lg` only. The rail would eat most of a phone
          screen, so it becomes an off-canvas drawer behind this hamburger. */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-stone-200 bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark />
          <span className="text-base font-extrabold tracking-tight text-stone-900">{t('app_name')}</span>
        </Link>
        <button
          type="button"
          onClick={() => { setMenuOpen((v) => !v) }}
          aria-expanded={menuOpen}
          aria-label={t('toggle_menu')}
          className="btn btn-ghost btn-icon"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Scrim. `bg-overlay` is deliberately outside the neutral ramp so it
              stays dark under both themes instead of inverting to white. */}
          <button
            type="button"
            aria-label={t('toggle_menu')}
            onClick={() => { setMenuOpen(false) }}
            className="absolute inset-0 h-full w-full cursor-default bg-overlay/60"
          />
          <aside className="app-rail absolute inset-y-0 start-0 flex w-[280px] max-w-[85vw] flex-col gap-1 overflow-y-auto border-e p-4 shadow-rail">
            {railBody}
          </aside>
        </div>
      )}
    </>
  )
}
