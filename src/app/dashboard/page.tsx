import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'

async function logout() {
  'use server'
  await signOut({ redirectTo: '/login' })
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const t = await getTranslations('dashboard')
  const supabase = createServiceClient()
  const employeeId = session.user.employeeId

  const { data: cycle } = await supabase
    .from('evaluation_cycles')
    .select('id, name, is_active, results_visible, min_cross_dept')
    .eq('is_active', true)
    .maybeSingle()

  const { data: sectionEmployees } = await supabase
    .from('employees')
    .select('id, full_name, department_id')
    .eq('section_id', session.user.sectionId)
    .neq('id', employeeId)
    .order('full_name')

  let submittedIds = new Set<string>()
  if (cycle) {
    const { data: myEvals } = await supabase
      .from('evaluations')
      .select('evaluatee_id, is_submitted')
      .eq('cycle_id', cycle.id)
      .eq('evaluator_id', employeeId)
    const submitted = (myEvals ?? []).filter((e) => e.is_submitted)
    submittedIds = new Set(submitted.map((e) => e.evaluatee_id))
  }

  const deptEmployees = (sectionEmployees ?? []).filter(
    (e) => e.department_id === session.user.departmentId
  )
  const crossDeptEmployees = (sectionEmployees ?? []).filter(
    (e) => e.department_id !== session.user.departmentId
  )
  const total = sectionEmployees?.length ?? 0
  const totalCompleted = submittedIds.size
  const deptCompleted = deptEmployees.filter((e) => submittedIds.has(e.id)).length
  const crossDeptCompleted = crossDeptEmployees.filter((e) => submittedIds.has(e.id)).length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">
          {t('title', { name: session.user.fullName })}
        </h1>
        <div className="flex items-center gap-4">
          {session.user.role === 'super_admin' && (
            <Link href="/admin" className="text-sm text-blue-600 hover:underline">
              {t('adminLink')}
            </Link>
          )}
          {session.user.role === 'section_admin' && (
            <Link
              href={`/admin/section/${session.user.sectionId}`}
              className="text-sm text-blue-600 hover:underline"
            >
              {t('sectionAdminLink')}
            </Link>
          )}
          <form action={logout}>
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">
              {t('logout')}
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {!cycle ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400">{t('noCycle')}</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">
                {t('cycleTitle', { name: cycle.name })}
              </h2>
              <div className="space-y-1 text-sm text-gray-600">
                <p>{t('progress', { completed: totalCompleted, total })}</p>
                <p>
                  {t('departmentProgress', {
                    completed: deptCompleted,
                    total: deptEmployees.length,
                  })}
                </p>
                <p>
                  {t('crossDeptProgress', {
                    completed: crossDeptCompleted,
                    min: cycle.min_cross_dept,
                  })}
                </p>
              </div>
              {cycle.results_visible && session.user.role !== 'employee' && (
                <Link
                  href="/results"
                  className="mt-4 inline-block bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  {t('viewResults')}
                </Link>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t('sectionTitle')}</h3>
              <ul className="divide-y divide-gray-50">
                {(sectionEmployees ?? []).map((emp) => (
                  <li key={emp.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-800">{emp.full_name}</span>
                      {emp.department_id === session.user.departmentId && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                          {t('sectionBadge')}
                        </span>
                      )}
                    </div>
                    {submittedIds.has(emp.id) ? (
                      <span className="text-xs text-gray-400">{t('alreadyEvaluated')}</span>
                    ) : (
                      <Link
                        href={`/evaluate/${emp.id}`}
                        className="text-sm text-blue-600 hover:underline font-medium"
                      >
                        {t('evaluateButton')}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
