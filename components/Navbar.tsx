'use client'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
export default function Navbar(){
  const { i18n } = useTranslation()
  useEffect(()=>{ if (typeof window !== 'undefined') document.documentElement.lang = i18n.language }, [i18n.language])
  const switchLang = ()=> i18n.changeLanguage(i18n.language==='en' ? 'ar' : 'en')
  return (
    <header className="bg-white shadow p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="text-lg font-semibold">Butcher Cashier</div>
        <nav className="flex items-center gap-3">
          <Link href="/" className="px-3 py-1">Dashboard</Link>
          <Link href="/orders" className="px-3 py-1">Orders</Link>
          <Link href="/inventory" className="px-3 py-1">Inventory</Link>
          <Link href="/admin" className="px-3 py-1">Admin</Link>
          <button onClick={switchLang} className="px-3 py-1 border rounded">EN/AR</button>
        </nav>
      </div>
    </header>
  )
}
