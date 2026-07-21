// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ar from './locales/ar.json';

// safe one-time init (prevents double-init during HMR / multiple imports)
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    // Design revamp (2026-07-21): Arabic is the shop's working language, so
    // it's the default rather than English. app/layout.tsx seeds
    // <html lang="ar" dir="rtl"> to match, so the first paint is already RTL
    // instead of rendering LTR and flipping once Sidebar's effect runs.
    // English stays the fallback: if an Arabic key is ever missing, showing the
    // English string beats showing the raw key.
    lng: 'ar',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    debug: false,
  });
}

export default i18n;
