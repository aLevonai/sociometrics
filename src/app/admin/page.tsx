import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'

export default async function AdminPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const t = await getTranslations('admin')
  const tc = await getTranslations('common')

  if (session.user.role !== 'super_commander') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{tc('unauthorized')}</p>
      </div>
    )
  }

  const supabase = createServiceClient()

  const { data: cycles } = await supabase
    .from('evaluation_cycles')
    .select('id, name, is_active, created_at')
    .order('created_at', { ascending: false })

  const { data: years } = await supabase
    .from('years')
    .select('id, name, order_num')
    .order('order_num')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{t('title')}</h1>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← לוח בקרה
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Link
            href="/admin/employees"
            className="bg-white rounded-xl border border-gray-100 p-6 hover:border-blue-200 transition-colors"
          >
            <h2 className="font-semibold text-gray-900">{t('employees')}</h2>
            <p className="text-sm text-gray-400 mt-1">העלאת CSV, ניהול חיילים</p>
          </Link>
          <Link
            href="/admin/cycle/new"
            className="bg-white rounded-xl border border-gray-100 p-6 hover:border-blue-200 transition-colors"
          >
            <h2 className="font-semibold text-gray-900">{t('newCycle')}</h2>
            <p className="text-sm text-gray-400 mt-1">צור מחזור סוציומטריה חדש</p>
          </Link>
          <Link
            href="/admin/teams"
            className="bg-white rounded-xl border border-gray-100 p-6 hover:border-blue-200 transition-colors"
          >
            <h2 className="font-semibold text-gray-900">ניהול צוותים</h2>
            <p className="text-sm text-gray-400 mt-1">שיוך מ&quot;כים שנה ג&apos; לצוותים</p>
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">{t('allCycles')}</h2>
          {!cycles?.length ? (
            <p className="text-gray-400 text-sm">{t('noCycles')}</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {cycles.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-medium text-sm text-gray-800">{c.name}</span>
                    {c.is_active && (
                      <span className="mr-2 text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
                        {t('isActive')}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/admin/cycle/${c.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {t('manageCycle')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {years && years.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">שנים וחברות</h2>
            <ul className="divide-y divide-gray-50">
              {years.map((y) => (
                <li key={y.id} className="flex items-center justify-between py-3">
                  <span className="text-sm text-gray-800">{y.name}</span>
                  <Link
                    href={`/admin/year/${y.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    צפה בחיילים
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
