// Fix: removed the Pages-Router `i18n` block, which is invalid/ignored under
// the App Router (i18n is handled client-side via react-i18next / src/i18n.ts).
// Removed `experimental.appDir` — appDir is stable in Next 13.4, no longer experimental.
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true
}
module.exports = nextConfig
