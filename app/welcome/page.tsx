// v3.1 follow-up 10i — the public landing page.
//
// There wasn't one: `/` is the dashboard and a signed-out visitor was sent
// straight to a login box, which assumes they already know what this is. That
// assumption stops holding the moment organizations exist (see
// Butcher-Multi-Tenancy-Plan.md) — a shop owner evaluating the product, or a
// new cashier handed a subdomain, lands here first.
//
// Visual language borrowed from the QA Studio landing page: deep navy field,
// cyan→violet gradient, glass cards over a drifting glow. The shared pieces
// live in globals.css under `.pub-*` and in components/PublicField.tsx.
//
// Deliberately not a signup funnel. Accounts are created by invite, so the
// only real call to action is "sign in"; the rest is orientation, not sales.
'use client'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import PublicField, { PublicBrand } from '../../components/PublicField'
import ThemeToggle from '../../components/ThemeToggle'

const FEATURE_KEYS = ['orders', 'weight', 'cash', 'dismantle', 'receipts', 'roles'] as const
const STEP_KEYS = ['take', 'track', 'close'] as const

function FeatureIcon({ name }: { name: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'var(--pub-cyan)',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'orders': return <svg {...common}><path d="M3 6h18M3 12h18M3 18h12" /></svg>
    case 'weight': return <svg {...common}><path d="M12 3v3M6.5 21h11l-2.5-9h-6l-2.5 9Z" /><circle cx="12" cy="4.5" r="1.5" /></svg>
    case 'cash': return <svg {...common}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>
    case 'dismantle': return <svg {...common}><path d="M14 4 4 14M9 4l11 11M4 20h6" /></svg>
    case 'receipts': return <svg {...common}><path d="M6 3v18l3-2 3 2 3-2 3 2V3l-3 2-3-2-3 2-3-2Z" /><path d="M9 9h6M9 13h6" /></svg>
    default: return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M17 11h4M19 9v4" /></svg>
  }
}

export default function WelcomePage() {
  const { t } = useTranslation()

  return (
    <PublicField className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-[color:var(--pub-line)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5">
          <PublicBrand name={t('app_name')} />
          <div className="flex items-center gap-3">
            <ThemeToggle compact className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--pub-line)] bg-[rgba(255,255,255,0.04)] text-[color:var(--pub-ink2)] transition-colors hover:text-[color:var(--pub-ink)]" />
            <Link href="/login" className="pub-btn pub-btn-primary !px-4 !py-2 !text-sm">
              {t('login_page.sign_in')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-16 text-center sm:pt-24">
        <div className="pub-fade pub-fade-1 pub-pill mb-7">
          <span className="pub-dot" />
          {t('public.badge')}
        </div>
        <h1 className="pub-fade pub-fade-2 mx-auto mb-6 max-w-3xl text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl">
          {t('public.headline_lead')}{' '}
          <span className="pub-grad-text">{t('public.headline_accent')}</span>
        </h1>
        <p className="pub-fade pub-fade-3 mx-auto mb-9 max-w-2xl text-base leading-relaxed text-[color:var(--pub-ink2)] sm:text-lg">
          {t('public.subhead')}
        </p>
        <div className="pub-fade pub-fade-4 flex flex-wrap items-center justify-center gap-3.5">
          <Link href="/login" className="pub-btn pub-btn-primary">{t('public.cta_sign_in')}</Link>
          <a href="#features" className="pub-btn pub-btn-ghost">{t('public.cta_tour')}</a>
        </div>
        <p className="pub-fade pub-fade-4 mt-4 text-xs text-[color:var(--pub-ink3)]">{t('public.cta_note')}</p>
      </section>

      {/* Board preview. Hand-drawn rather than a screenshot: a screenshot goes
          stale the moment the UI changes, and would leak a real shop's
          customer names and takings onto a public page. */}
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <div className="pub-card p-5 sm:p-7">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--pub-cyan)]" />
            <span className="text-xs font-semibold text-[color:var(--pub-ink2)]">{t('public.preview_title')}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['created', 'in_progress', 'on_the_way', 'completed'] as const).map((status, columnIndex) => (
              <div key={status}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[rgba(18,181,206,0.16)] text-[11px] font-bold text-[color:var(--pub-cyan)]">
                    {[3, 2, 2, 5][columnIndex]}
                  </span>
                  <span className="truncate text-[11px] font-bold text-[color:var(--pub-ink2)]">
                    {t(`orders_page.status_${status}`)}
                  </span>
                </div>
                <div className="space-y-2">
                  {Array.from({ length: [3, 2, 2, 2][columnIndex] }).map((_, cardIndex) => (
                    <div key={cardIndex} className="rounded-lg border border-[color:var(--pub-line)] bg-[rgba(255,255,255,0.03)] p-2.5">
                      <div className="mb-1.5 h-2 w-3/5 rounded-full bg-[rgba(255,255,255,0.18)]" />
                      <div className="h-2 w-2/5 rounded-full bg-[rgba(255,255,255,0.09)]" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-5xl scroll-mt-20 px-5 pb-20">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--pub-ink3)]">
          {t('public.features_eyebrow')}
        </p>
        <h2 className="mb-9 text-2xl font-extrabold tracking-tight sm:text-3xl">{t('public.features_title')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_KEYS.map(key => (
            <div key={key} className="pub-card p-5">
              <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--pub-line)] bg-[rgba(18,181,206,0.1)]">
                <FeatureIcon name={key} />
              </div>
              <h3 className="mb-1.5 text-base font-bold">{t(`public.feature_${key}_title`)}</h3>
              <p className="text-sm leading-relaxed text-[color:var(--pub-ink2)]">{t(`public.feature_${key}_body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How a day runs */}
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--pub-ink3)]">
          {t('public.steps_eyebrow')}
        </p>
        <h2 className="mb-9 text-2xl font-extrabold tracking-tight sm:text-3xl">{t('public.steps_title')}</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEP_KEYS.map((key, index) => (
            <li key={key} className="pub-card p-5">
              <span className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[color:var(--pub-cyan)] to-[color:var(--pub-violet)] text-sm font-extrabold text-[#04121a]">
                {index + 1}
              </span>
              <h3 className="mb-1.5 text-base font-bold">{t(`public.step_${key}_title`)}</h3>
              <p className="text-sm leading-relaxed text-[color:var(--pub-ink2)]">{t(`public.step_${key}_body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Close */}
      <section className="mx-auto max-w-5xl px-5 pb-20 text-center">
        <h2 className="mb-6 text-2xl font-extrabold tracking-tight sm:text-3xl">{t('public.closing_title')}</h2>
        <Link href="/login" className="pub-btn pub-btn-primary">{t('public.cta_sign_in')}</Link>
      </section>

      <footer className="border-t border-[color:var(--pub-line)] py-7 text-center text-xs text-[color:var(--pub-ink3)]">
        {t('app_name')} · {t('public.footer_note')}
      </footer>
    </PublicField>
  )
}
