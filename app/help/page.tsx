// New: Help & Guide page, bilingual (EN/AR) via the existing react-i18next
// setup (src/i18n.ts, src/locales/{en,ar}.json — same mechanism the Navbar's
// EN/AR switcher already used, just not yet applied to page content). Content
// lives in the locale files (help_page.title/intro/sections), not hardcoded
// here, so it switches instantly with the rest of the UI's language toggle
// and stays in one place to edit/extend.
'use client'
import { useTranslation } from 'react-i18next'

type HelpSection = { heading: string, body: string }

export default function HelpPage() {
  const { t } = useTranslation()
  // react-i18next's `t()` is typed to return `string` by default (no custom
  // resource typing is configured for this project) — `returnObjects: true`
  // makes it actually return the array at runtime, but the type still says
  // `string`, so a direct `as HelpSection[]` doesn't compile ("neither type
  // sufficiently overlaps"). Routing through `unknown` is the correct way to
  // assert past a type that's known-wrong here, not a shortcut around a real
  // mismatch.
  const sections = t('help_page.sections', { returnObjects: true }) as unknown as HelpSection[]
  // No local `dir` override needed — Navbar sets `document.documentElement.dir`
  // app-wide on language change, which cascades here too.

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{t('help_page.title')}</h1>
      <p className="text-gray-600 mb-6">{t('help_page.intro')}</p>
      <div className="space-y-4">
        {sections.map((s) => (
          <div key={s.heading} className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-1">{s.heading}</h2>
            <p className="text-sm text-gray-700">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
