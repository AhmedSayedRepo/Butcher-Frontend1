// v3.3 — a small ⓘ that carries an explanation in a tooltip instead of a
// paragraph of always-on text beside a field.
//
// The Settings email section had grown three field hints plus a section note,
// all permanently visible — a wall of grey the admin reads once and then has
// to scroll past forever. This moves that text into a hover/focus tooltip so
// the form stays scannable while the explanation is still one gesture away.
//
// Native `title` on purpose: it works with the keyboard (the icon is
// focusable) and screen readers for free, matches the tooltips already used on
// the rail and the dashboard cards, and needs no popover/positioning code. The
// fuller, step-by-step version of anything explained here lives in Help.
'use client'

export default function InfoHint({ text, label }: { text: string, label?: string }) {
  return (
    <span
      role="note"
      tabIndex={0}
      title={text}
      aria-label={label === undefined ? text : `${label}: ${text}`}
      className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-stone-300 text-[10px] font-bold leading-none text-stone-400 transition-colors hover:border-brand-400 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
    >
      i
    </span>
  )
}
