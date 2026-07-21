// Help & Guide, bilingual (EN/AR) via the existing react-i18next setup
// (src/i18n.ts, src/locales/{en,ar}.json). Content lives in the locale files
// (help_page.*), not hardcoded here, so it switches with the language toggle
// and stays in one place to edit. No local `dir` override needed — Navbar sets
// `document.documentElement.dir` app-wide on language change.
//
// v3.2 — rewritten.
//
// What was here before was twelve paragraphs describing which screen does
// what. That's close to the least valuable thing a help screen can hold,
// because the screens are already visible: anyone who opens Inventory can see
// that Inventory lists products. Nobody reads a manual to be told what's on
// screen — they read it when something surprised them.
//
// So this holds what the interface can't tell you by looking: that a draft
// hasn't moved stock yet, that a card's timer resets on every column change,
// that cash position and revenue are deliberately different numbers, that
// unticking a cashier's permissions doesn't produce a read-only account
// because permissions only ever add. The "worth knowing" line on a topic is
// that non-obvious half; a topic without one doesn't get a filler.
//
// Twenty-four topics is past the point where a wall of cards is readable,
// hence the search box and the category filter. Search matches a keywords
// field as well as the prose, so someone typing "kanban" or "باركود" reaches
// the right topic even though neither word is written in it.
'use client'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const NONE = 0

interface Topic {
  category: string
  heading: string
  body: string
  tip?: string
  keywords: string
}

// Fixed order, roughly from what a cashier needs hourly to what an owner
// needs occasionally. Groups with no topics are dropped at render time, so
// this list can name a category the locale hasn't filled in yet.
const CATEGORY_ORDER = ['daily', 'money', 'stock', 'channels', 'admin', 'trouble']

const WHITESPACE = /\s+/u

function matches(topic: Topic, categoryLabel: string, needle: string): boolean {
  if (needle === '') return true
  const haystack = [topic.heading, topic.body, topic.tip ?? '', topic.keywords, categoryLabel]
    .join(' ')
    .toLowerCase()
  // Every word must appear somewhere, in any order: "close cash" finds the
  // day-closing topic, which a single-substring match would not.
  return needle.split(WHITESPACE).every(word => haystack.includes(word))
}

export default function HelpPage() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)

  // `t()` is typed to return `string` (no resource typing is configured for
  // this project); `returnObjects: true` returns the array at runtime, so the
  // assertion goes through `unknown` — the type is known-wrong here rather
  // than merely inconvenient.
  const topics = t('help_page.topics', { returnObjects: true }) as unknown as Topic[]
  const categoryLabel = (key: string): string => t(`help_page.categories.${key}`)

  const needle = query.trim().toLowerCase()

  // Grouped, filtered, and pruned in one pass. Depends on the topics array
  // identity, which changes when the language does — so switching to Arabic
  // re-filters against the Arabic text rather than leaving a stale result set.
  const groups = useMemo(() => {
    const visible = topics.filter(topic =>
      (category === null || topic.category === category) &&
      matches(topic, t(`help_page.categories.${topic.category}`), needle)
    )
    return {
      total: visible.length,
      sections: CATEGORY_ORDER
        .map(key => ({ key, items: visible.filter(topic => topic.category === key) }))
        .filter(section => section.items.length > NONE)
    }
  }, [topics, category, needle, t])

  const filtering = needle !== '' || category !== null

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-stone-900">{t('help_page.title')}</h1>
      <p className="mb-6 text-stone-500">{t('help_page.intro')}</p>

      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={t('help_page.search_placeholder')}
        aria-label={t('help_page.search_placeholder')}
        className="mb-4 w-full max-w-lg rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-stone-100 p-0.5 text-xs font-medium">
          <button type="button" onClick={() => setCategory(null)}
            className={`seg-item ${category === null ? 'seg-item-active' : ''}`}>
            {t('help_page.all')}
          </button>
          {CATEGORY_ORDER.map(key => (
            <button key={key} type="button" onClick={() => setCategory(key)}
              className={`seg-item ${category === key ? 'seg-item-active' : ''}`}>
              {categoryLabel(key)}
            </button>
          ))}
        </div>
        {filtering && (
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span>{t('help_page.results_count', { count: groups.total })}</span>
            <button type="button" onClick={() => { setQuery(''); setCategory(null) }}
              className="font-medium text-brand-700 hover:text-brand-800">
              {t('help_page.clear')}
            </button>
          </div>
        )}
      </div>

      {groups.total === NONE && (
        <p className="rounded-xl border border-stone-200 bg-surface p-6 text-sm text-stone-500 shadow-card">
          {t('help_page.no_results')}
        </p>
      )}

      {groups.sections.map(section => (
        <section key={section.key} className="mb-8">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-500">
            {categoryLabel(section.key)}
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {section.items.map(topic => (
              <article key={topic.heading}
                className="card-hover rounded-xl border border-stone-200 bg-surface p-5 shadow-card">
                <h3 className="mb-1.5 font-semibold text-stone-900">{topic.heading}</h3>
                <p className="text-sm leading-relaxed text-stone-600">{topic.body}</p>
                {typeof topic.tip === 'string' && topic.tip !== '' && (
                  // Set apart rather than appended. The tip is the part that
                  // stops someone making the mistake, and it's exactly the
                  // part that gets skimmed if it reads as a fourth sentence.
                  // Border on the start edge, so it flips with RTL.
                  <div className="mt-3 rounded-lg border-s-2 border-brand-400 bg-brand-50/60 px-3 py-2">
                    <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-700">
                      {t('help_page.tip_label')}
                    </p>
                    <p className="text-sm leading-relaxed text-stone-700">{topic.tip}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
