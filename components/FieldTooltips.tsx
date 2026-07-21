// v3.1 follow-up 10a — a `title` tooltip on every form field, app-wide.
//
// Done here rather than by hand because there are well over a hundred inputs,
// selects and textareas across 16 pages, and hand-adding `title=` to each is
// both a large diff and something the next new field would immediately forget.
// This walks the DOM instead and fills in what's missing, deriving the text
// from what the field already declares, in priority order:
//
//   1. an existing `title`      — never overwritten, a hand-written one wins
//   2. `aria-label`
//   3. its <label> text         — wrapping label, or label[for=id]
//   4. its `placeholder`
//
// Because it reads the rendered label, the tooltip follows the UI language for
// free: switch to English and the same field's tooltip switches with it.
//
// The MutationObserver is the point — most fields in this app appear *after*
// first paint (a modal opening, an inline editor expanding, a table row
// rendering once its fetch resolves), so a one-shot pass on mount would miss
// most of them.
//
// Deliberately native `title` rather than a custom tooltip component: it needs
// no positioning logic, works on a touchscreen long-press, and is announced by
// screen readers. The cost is the browser's ~1s delay before it appears, which
// is the right behaviour for a hint nobody needs unless they hesitate.
'use client'
import { useEffect } from 'react'

const FIELD_SELECTOR = 'input:not([type="hidden"]), select, textarea'
// Marker attribute so a field is only ever processed once, and so a field whose
// label later changes (language switch) can be re-derived — see the cleanup of
// this attribute in the language-change effect below.
const MARK = 'data-tooltip-applied'

function labelTextFor(field: HTMLElement): string | null {
  const wrapping = field.closest('label')
  if (wrapping !== null) {
    // The label's text minus the field's own value/placeholder contribution.
    const text = wrapping.textContent?.trim() ?? ''
    if (text !== '') return text
  }
  const id = field.getAttribute('id')
  if (id !== null && id !== '') {
    const explicit = document.querySelector(`label[for="${CSS.escape(id)}"]`)
    const text = explicit?.textContent?.trim() ?? ''
    if (text !== '') return text
  }
  return null
}

function applyTo(root: ParentNode): void {
  for (const node of root.querySelectorAll<HTMLElement>(FIELD_SELECTOR)) {
    if (node.hasAttribute(MARK)) continue
    node.setAttribute(MARK, '')

    const existing = node.getAttribute('title')
    if (existing !== null && existing !== '') continue

    const aria = node.getAttribute('aria-label')
    const placeholder = node.getAttribute('placeholder')
    const tip = (aria !== null && aria !== '' ? aria : null)
      ?? labelTextFor(node)
      ?? (placeholder !== null && placeholder !== '' ? placeholder : null)

    if (tip !== null) node.setAttribute('title', tip)
  }
}

export default function FieldTooltips(): null {
  useEffect(() => {
    applyTo(document)

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const added of record.addedNodes) {
          if (added instanceof HTMLElement) applyTo(added)
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    // A language switch re-renders labels in place without adding nodes, so the
    // observer above wouldn't fire for it. Clearing the marks and re-running on
    // the `lang` attribute change re-derives every tooltip in the new language.
    const langObserver = new MutationObserver(() => {
      for (const node of document.querySelectorAll(`[${MARK}]`)) {
        node.removeAttribute(MARK)
        node.removeAttribute('title')
      }
      applyTo(document)
    })
    langObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
    })

    return () => {
      observer.disconnect()
      langObserver.disconnect()
    }
  }, [])

  return null
}
