// Fix: removed the Pages-Router `i18n` block, which is invalid/ignored under
// the App Router (i18n is handled client-side via react-i18next / src/i18n.ts).
// Removed `experimental.appDir` — appDir is stable in Next 13.4, no longer experimental.

// Security audit 2026-07-21 — response headers on the HTML.
//
// The backend sets its own headers via helmet, but those only apply to JSON
// responses from Render. The headers that protect the *page* — and therefore
// the session — have to come from whatever serves the HTML, which is Vercel.
// Nothing was setting them.
//
// The important one is the Content-Security-Policy. Its job here is to limit
// the damage of an XSS rather than to prevent one: even with injected script,
// `connect-src` means it can't exfiltrate to an attacker's server, and
// `frame-ancestors 'none'` means the app can't be framed for clickjacking.
//
// `'unsafe-inline'` on script-src is required and is an honest weakness: Next's
// App Router emits inline bootstrap scripts, and this app adds its own
// pre-paint theme script (lib/theme.ts) to avoid a white flash on every
// navigation. Removing it needs per-request nonces, which needs middleware —
// worth doing, not worth blocking this on. Stated plainly rather than left
// looking stronger than it is.
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? ''

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' — see above. 'unsafe-eval' is deliberately absent.
  "script-src 'self' 'unsafe-inline'",
  // Tailwind and next/font emit inline styles.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // `data:` covers the uploaded shop logo, which is stored as a data URL.
  "img-src 'self' data: https:",
  // The single most valuable directive: where the page may send data. An
  // injected script cannot POST this shop's data to an attacker's host.
  `connect-src 'self' ${API_ORIGIN}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Belt-and-braces with frame-ancestors, for older browsers.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Don't leak the shop's subdomain to third parties via Referer — once
  // organizations are live, that subdomain identifies a customer.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // This app asks for none of these; deny them so an injected script can't.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Removes `X-Powered-By: Next.js` — free version disclosure otherwise.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  }
}
module.exports = nextConfig
