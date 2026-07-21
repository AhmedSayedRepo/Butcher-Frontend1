// Security audit 2026-07-21 — defence in depth for anything rendered into an
// `<img src>`.
//
// The backend already validates logo URLs on write (`LOGO_URL_PATTERN` in
// routes/shopSettings.ts). This is the second check, on read, and it exists
// for three reasons that the write-side check can't cover:
//
//   1. `receiptLogoUrl` shipped BEFORE that validation did. Any value stored
//      in that window was never checked. (Audited on 2026-07-21: the live rows
//      are all legitimate PNG data URLs — but "we looked once" is not a
//      control.)
//   2. Rows can arrive by other routes — a hand-written SQL fix, a restored
//      backup, a future import.
//   3. The value is rendered on the *receipt*, which is printed and read by
//      customers, and in the nav rail on every page.
//
// React escapes text, so an attribute like this is one of the few places a
// stored string reaches the browser as something other than text. A
// `javascript:` URL in an `<img src>` doesn't execute in modern browsers, but
// `data:text/html` in other contexts does, and relying on "the browser
// probably won't" is not a security argument.

// Deliberately an allow-list. A deny-list of dangerous schemes ("block
// javascript:") loses to the first encoding trick; an allow-list fails closed
// against schemes nobody has thought of yet.
// `u` rather than `v`: the frontend's tsconfig targets ES2020, and the `v`
// flag needs ES2024. `u` gives the same semantics for this pattern.
const ALLOWED = /^(?:https?:\/\/|data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,)/u

/**
 * The URL if it's safe to render, otherwise `null` — so callers fall back to
 * the built-in mark rather than rendering a broken or hostile image.
 */
export function safeImageUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  return ALLOWED.test(trimmed) ? trimmed : null
}
