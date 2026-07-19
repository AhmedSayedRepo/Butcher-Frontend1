/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      // Butcher-shop brand palette: a deep, warm red as primary, replacing
      // the generic Tailwind "blue-600" used throughout the original UI.
      colors: {
        brand: {
          50: '#fdf4f3',
          100: '#fce8e6',
          200: '#f8d0cc',
          300: '#f1aca4',
          400: '#e67c6e',
          500: '#d65445',
          600: '#b8392a',
          700: '#992d21',
          800: '#7d271e',
          900: '#68251d',
          950: '#39110c',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0,0,0,0.04), 0 2px 6px -1px rgba(0,0,0,0.06)',
        'card-hover': '0 2px 4px 0 rgba(0,0,0,0.06), 0 8px 16px -4px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        xl: '0.875rem',
      },
    },
  },
  plugins: [],
}
