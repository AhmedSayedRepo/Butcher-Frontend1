'use client'
import { ReactNode } from 'react'

// v3.1 follow-up 10i — the branded dark surface shared by the landing page and
// the left half of the auth screens.
//
// Just the field: the gradient wash, the blueprint grid (a ::before in
// globals.css) and the drifting conic glow. Content goes in as children and is
// lifted above both by `.pub-above`, so callers never have to think about
// z-index against the decoration.
export default function PublicField({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`pub-field ${className}`}>
      <div className="pub-sweep" aria-hidden="true">
        <div className="pub-sweep-in" />
      </div>
      <div className="pub-above">{children}</div>
    </div>
  )
}

/** The wordmark, used in the rail-dark palette on the public surface. */
export function PublicBrand({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3">
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true" className="shrink-0">
        <rect width="34" height="34" rx="10" fill="url(#pubLogo)" />
        <path d="M10 23 21 12M21 12h-4.8M21 12v4.8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="11.5" cy="23" r="2.2" fill="#fff" />
        <defs>
          <linearGradient id="pubLogo" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22D3EE" />
            <stop offset="1" stopColor="#0891B2" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-lg font-extrabold tracking-tight text-[color:var(--pub-ink)]">{name}</span>
    </div>
  )
}
