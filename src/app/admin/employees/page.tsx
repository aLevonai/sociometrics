import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import CsvUpload from './CsvUpload'

export default async function AdminEmployeesPage() {
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

  const supabase = createServiceClient()
  const { data: employees } = await supabase
    .from('employees')
    .select('id, company_id, full_name, email, role, department:departments(name), section:sections(name)')
    .order('full_name')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
          ← {t('title')}
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">{t('employees')}</h1>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-2">{t('uploadCsv')}</h2>
          <p className="text-xs text-gray-400 mb-4">{t('csvFormat')}</p>
          <CsvUpload />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            עובדים ({employees?.length ?? 0})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-right text-gray-500">
                  <th className="pb-2 font-medium">מ&quot;ס עובד</th>
                  <th className="pb-2 font-medium">שם</th>
                  <th className="pb-2 font-medium">אימייל</th>
                  <th className="pb-2 font-medium">מחלקה</th>
                  <th className="pb-2 font-medium">סקציה</th>
                  <th className="pb-2 font-medium">תפקיד</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(employees ?? []).map((emp) => (
                  <tr key={emp.id}>
                    <td className="py-2 text-gray-600">{emp.company_id}</td>
                    <td className="py-2 text-gray-800 font-medium">{emp.full_name}</td>
                    <td className="py-2 text-gray-600">{emp.email}</td>
                    <td className="py-2 text-gray-600">
                      {(emp.department as unknown as { name: string } | null)?.name ?? '—'}
                    </td>
                    <td className="py-2 text-gray-600">
                      {(emp.section as unknown as { name: string } | null)?.name ?? '—'}
                    </td>
                    <td className="py-2 text-gray-600">{emp.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
