Butcher Cashier - Next.js Starter

This Next.js (TypeScript) project is a ready starter to replace the previous CRA frontend.
It includes:
- Next.js app router (app/)
- TailwindCSS (3.4.13) setup
- react-i18next client-side i18n with English/Arabic
- Demo API routes for products/orders/parse-order so the UI works out-of-the-box

Local dev:
1. npm install
2. npm run dev

Deploy to Vercel:
- Import this repo (root contains package.json)
- Build command: npm run build
- Output: handled by Next on Vercel

Environment variables:
- NEXT_PUBLIC_API_URL -> optional (if you want to call a separate backend instead of demo routes)

Notes:
- This is a frontend replacement. The full backend (Express/Postgres) should be deployed separately (Railway) and the frontend pointed to it.
