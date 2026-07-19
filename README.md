Butcher Cashier - Next.js Starter

This Next.js (TypeScript) project is a ready starter to replace the previous CRA frontend.
It includes:
- Next.js app router (app/)
- TailwindCSS (3.4.13) setup
- react-i18next client-side i18n with English/Arabic
- Login flow wired to the real backend (see lib/api.ts, app/login/page.tsx)

Local dev:
1. npm install
2. cp .env.example .env.local
3. npm run dev

Deploy to Vercel:
- Import this repo (root contains package.json)
- Build command: npm run build
- Output: handled by Next on Vercel

Environment variables:
- NEXT_PUBLIC_API_URL -> required, points at the Butcher-Backend deployment (see ../backend)

Notes:
- The old `pages/api/*` demo routes were removed. The UI now calls the real backend
  directly (see ../CONTRACT.md for exact response shapes).
- The backend (Express/Postgres) is deployed separately (Railway) — see ../backend/README.md.
