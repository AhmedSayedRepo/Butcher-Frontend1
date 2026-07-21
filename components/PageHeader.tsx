// Page header shell, modelled on qa-studio's screen headers: a big bold title,
// a small brand-tinted code chip beside it, and a one-line subtitle underneath
// explaining what the screen is for. Optional `actions` sit on the far end of
// the same row (the "+ New order" button and friends).
//
// Why a component rather than repeating the markup: every page in this app had
// grown its own slightly different heading — different sizes, some with a
// subtitle, some without, none with the chip — so screens didn't read as one
// product. This makes the shell one import and one shape.
//
// RTL: uses flex + logical spacing only, so it mirrors with `dir="rtl"` without
// a second set of styles.
import { ReactNode } from 'react'

export default function PageHeader({
  title,
  code,
  subtitle,
  actions,
}: {
  title: string
  /** Short uppercase index, e.g. "OR" for Orders. qa-studio's `ix`. */
  code?: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
            {title}
          </h1>
          {code !== undefined && code !== '' && (
            <span
              aria-hidden="true"
              className="tabular rounded-md bg-brand-100 px-2 py-1 text-xs font-bold uppercase tracking-wider text-brand-800"
            >
              {code}
            </span>
          )}
        </div>
        {subtitle !== undefined && subtitle !== '' && (
          <p className="mt-1.5 text-sm text-stone-500">{subtitle}</p>
        )}
      </div>
      {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
