// Added: Login/Logout link so the auth flow (ADR-002) is reachable from the UI.
//
// i18n init moved here from app/layout.tsx: this is the first Client
// Component in the tree (layout.tsx is a Server Component and can't import
// react-i18next directly — see the comment in layout.tsx for the build
// error that caused). The side-effect import below runs before
// useTranslation is called.
'use client'
import '../src/i18n'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { getToken, clearToken } from '../lib/api'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const { i18n } = useTranslation()
  const router = useRouter()
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') document.documentElement.lang = i18n.language
  }, [i18n.language])

  useEffect(() => {
    setLoggedIn(!!getToken())
  }, [])

  const switchLang = () => i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en')

  function logout() {
    clearToken()
    setLoggedIn(false)
    router.push('/login')
  }

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
          {loggedIn ? (
            <button onClick={logout} className="px-3 py-1 border rounded">Logout</button>
          ) : (
            <Link href="/login" className="px-3 py-1 border rounded">Login</Link>
          )}
        </nav>
      </div>
    </header>
  )
}
