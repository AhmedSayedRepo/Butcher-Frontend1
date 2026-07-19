'use client'
import { useTranslation } from 'react-i18next'

export default function AdminPage(){
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t('admin')}</h1>
      <div className="bg-white p-4 rounded shadow">{t('admin_page.subtitle')}</div>
    </div>
  )
}
