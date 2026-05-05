import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { getTranslations } from 'next-intl/server'
import NewCycleForm from './NewCycleForm'

export default async function NewCyclePage() {
  const session = await auth()
  if (!session) redirect('/login')

  const t = await getTranslations('admin')
  const tc = await getTranslations('common')

  if (session.user.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{tc('unauthorized')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
          ← {t('title')}
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">{t('newCycle')}</h1>
      </header>
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <NewCycleForm />
        </div>
      </main>
    </div>
  )
}
