// app/layout.tsx
import '../src/i18n';            // <-- IMPORTANT: initialize i18n first
import './globals.css';
import { ReactNode } from 'react';
import Navbar from '../components/Navbar';
import './globals.css'
import { ReactNode } from 'react'
import Navbar from '../components/Navbar'

export const metadata = {
  title: 'Butcher Cashier',
  description: 'SaaS cashier for non-countable products (meat)'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <Navbar />
        <div className="max-w-7xl mx-auto p-4">{children}</div>
      </body>
    </html>
  )
}
