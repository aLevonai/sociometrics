import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'

export default async function SectionAdminPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/login')

  const t = await getTranslations('admin')
  const tc = await getTranslations('common')

  const isSuperAdmin = session.user.role === 'super_admin'
  const isSectionAdmin = session.user.role === 'section_admin' && session.user.sectionId === id

  if (!isSuperAdmin && !isSectionAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{tc('unauthorized')}</p>
      </div>
    )
  }

  const supabase = createServiceClient()

  const { data: section } = await supabase
    .from('sections')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!section) notFound()

  const { data: sectionEmployees } = await supabase
    .from('employees')
    .select('id, full_name, department_id, department:departments(name)')
    .eq('section_id', id)
    .order('full_name')

  const { data: cycle } = await supabase
    .from('evaluation_cycles')
    .select('id, name, results_visible, min_evaluators_to_reveal')
    .eq('is_active', true)
    .maybeSingle()

  const empIds = (sectionEmployees ?? []).map((e) => e.id)

  type EvalRow = { evaluatee_id: string; evaluator_id: string; is_submitted: boolean }
  let evalStats: Record<string, { received: number; sent: number }> = {}

  if (cycle && empIds.length > 0) {
    const { data: evalsReceived } = await supabase
      .from('evaluations')
      .select('evaluatee_id, evaluator_id, is_submitted')
      .eq('cycle_id', cycle.id)
      .in('evaluatee_id', empIds)

    const { data: evalsSent } = await supabase
      .from('evaluations')
      .select('evaluatee_id, evaluator_id, is_submitted')
      .eq('cycle_id', cycle.id)
      .in('evaluator_id', empIds)

    const allEvals = [
      ...(evalsReceived ?? []),
      ...(evalsSent ?? []),
    ] as EvalRow[]

    const seen = new Set<string>()
    for (const e of allEvals) {
      const key = `${e.evaluator_id}:${e.evaluatee_id}`
      if (seen.has(key)) continue
      seen.add(key)
      if (!evalStats[e.evaluatee_id]) evalStats[e.evaluatee_id] = { received: 0, sent: 0 }
      if (!evalStats[e.evaluator_id]) evalStats[e.evaluator_id] = { received: 0, sent: 0 }
      if (e.is_submitted) {
        evalStats[e.evaluatee_id].received++
        evalStats[e.evaluator_id].sent++
      }
    }
  }

  type ResultMap = Record<string, number | null>
  const results: ResultMap = {}

  if (cycle?.results_visible && empIds.length > 0) {
    const { data: allEvals } = await supabase
      .from('evaluations')
      .select('id, evaluatee_id')
      .eq('cycle_id', cycle.id)
      .eq('is_submitted', true)
      .in('evaluatee_id', empIds)

    const evalsByEmp: Record<string, string[]> = {}
    for (const e of allEvals ?? []) {
      if (!evalsByEmp[e.evaluatee_id]) evalsByEmp[e.evaluatee_id] = []
      evalsByEmp[e.evaluatee_id].push(e.id)
    }

    for (const [empId, eIds] of Object.entries(evalsByEmp)) {
      if (eIds.length < (cycle.min_evaluators_to_reveal ?? 3)) {
        results[empId] = null
        continue
      }
      const { data: resps } = await supabase
        .from('evaluation_responses')
        .select('rating_value')
        .in('evaluation_id', eIds)
      const vals = (resps ?? [])
        .map((r) => r.rating_value)
        .filter((v): v is number => v != null)
      results[empId] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <Link href={isSuperAdmin ? '/admin' : '/dashboard'} className="text-sm text-gray-500 hover:text-gray-700">
          ←
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">
          {t('sectionAdminTitle', { name: section.name })}
        </h1>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900">
              {cycle ? `מחזור: ${cycle.name}` : 'אין מחזור פעיל'}
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 text-right text-gray-500">
                <th className="px-6 py-3 font-medium">שם</th>
                <th className="px-6 py-3 font-medium">מחלקה</th>
                <th className="px-6 py-3 font-medium">שלח</th>
                <th className="px-6 py-3 font-medium">קיבל</th>
                {cycle?.results_visible && (
                  <th className="px-6 py-3 font-medium">ציון ממוצע</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(sectionEmployees ?? []).map((emp) => {
                const stats = evalStats[emp.id] ?? { sent: 0, received: 0 }
                const avg = results[emp.id]
                return (
                  <tr key={emp.id}>
                    <td className="px-6 py-3 text-gray-800 font-medium">{emp.full_name}</td>
                    <td className="px-6 py-3 text-gray-500">
                      {(emp.department as unknown as { name: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{stats.sent}</td>
                    <td className="px-6 py-3 text-gray-600">{stats.received}</td>
                    {cycle?.results_visible && (
                      <td className="px-6 py-3 text-gray-600">
                        {avg != null ? avg.toFixed(2) : '—'}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
