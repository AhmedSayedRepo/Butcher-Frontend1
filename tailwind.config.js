/** @type {import('tailwindcss').Config} */

// Design revamp (2026-07-21): every colour below resolves to a CSS custom
// property defined in app/globals.css, which is swapped wholesale by the
// `data-theme` attribute on <html>. See the long comment at the top of that
// file for why the palette is redefined here rather than the ~700 colour
// utilities being rewritten across the app's 16 pages.
//
// The `<alpha-value>` placeholder is what lets Tailwind's opacity modifiers
// (`bg-surface/90`, `text-stone-900/60`) keep working against a variable —
// Tailwind substitutes the modifier into it at build time.
const themed = (name) => `oklch(var(--${name}) / <alpha-value>)`

const ramp = (prefix, steps) =>
  Object.fromEntries(steps.map((step) => [step, themed(`${prefix}-${step}`)]))

const NEUTRAL_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
const BRAND_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        // Card/panel background. Replaces the literal `bg-white` the app used
        // before the revamp — `white` itself now means "readable on accent".
        surface: themed('surface'),
        // Always-dark modal scrim. Kept out of the neutral ramp so it doesn't
        // invert into a white flash under the dark theme.
        overlay: themed('overlay'),
        white: themed('white'),
        stone: ramp('stone', NEUTRAL_STEPS),
        brand: ramp('brand', BRAND_STEPS),
        // Status colours. Aliased onto Tailwind's stock names so the badge
        // markup already scattered through the pages (`bg-green-50`,
        // `text-amber-700`, `text-red-700`, …) themes itself.
        green: { 50: themed('ok-50'), 600: themed('ok-600'), 700: themed('ok-700') },
        emerald: { 50: themed('ok-50'), 600: themed('ok-600'), 700: themed('ok-700') },
        amber: {
          50: themed('warn-50'),
          200: themed('warn-200'),
          600: themed('warn-600'),
          700: themed('warn-700'),
          800: themed('warn-800'),
          900: themed('warn-900'),
        },
        red: {
          50: themed('bad-50'),
          200: themed('bad-200'),
          600: themed('bad-600'),
          700: themed('bad-700'),
        },
        sky: { 50: themed('info-50'), 600: themed('info-600'), 700: themed('info-700') },
      },
      fontFamily: {
        sans: ['var(--font-ui)'],
        // Figures. Plex Mono under Trade Floor, the UI font under Clean
        // Operator — the variable decides, so `font-num` is safe everywhere.
        num: ['var(--font-num)'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        rail: 'var(--shadow-rail)',
      },
      borderRadius: {
        // Clean Operator is soft (14px); Trade Floor is sharp (6px).
        xl: 'var(--radius-card)',
      },
    },
  },
  plugins: [],
}
