import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'

// Visible to: company_commander (own company), year_commander, super_commander
// Shows: peer_company + peer_cross_year + team_leader results for each employee

export default async function CompanyResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: companyId } = await params
  const session = await auth()
  if (!session) redirect('/login')

  const role = session.user.role
  const canView =
    role === 'super_commander' ||
    role === 'year_commander' ||
    (role === 'company_commander' && session.user.companyId === companyId)

  if (!canView) redirect('/dashboard')

  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, year:years(name)')
    .eq('id', companyId)
    .single()

  if (!company) notFound()

  const { data: cycle } = await supabase
    .from('evaluation_cycles')
    .select('id, name')
    .eq('is_active', true)
    .maybeSingle()

  const { data: employees } = await supabase
    .from('employees')
    .select('id, full_name, role, military_id')
    .eq('company_id', companyId)
    .in('role', ['soldier', 'team_leader'])
    .order('full_name')

  const PEER_TYPES = ['peer_company', 'peer_cross_year', 'team_leader']

  type EmployeeStats = {
    id: string
    full_name: string
    role: string
    avgScore: number | null
    evalCount: number
    questionAverages: { question_text: string; avg: number }[]
  }

  const stats: EmployeeStats[] = []

  if (cycle && employees && employees.length > 0) {
    const { data: configs } = await supabase
      .from('cycle_eval_configs')
      .select('eval_type, results_visible, min_evaluators_to_reveal')
      .eq('cycle_id', cycle.id)
      .in('eval_type', PEER_TYPES)

    const { data: questions } = await supabase
      .from('questions')
      .select('id, text, eval_type')
      .eq('cycle_id', cycle.id)
      .in('eval_type', PEER_TYPES)

    for (const emp of employees) {
      const { data: evals } = await supabase
        .from('evaluations')
        .select('id, eval_type')
        .eq('cycle_id', cycle.id)
        .eq('evaluatee_id', emp.id)
        .eq('is_submitted', true)
        .in('eval_type', PEER_TYPES)

      const evalCount = evals?.length ?? 0

      // Check if any visible eval_type meets min threshold
      const visibleEvalTypes = (configs ?? [])
        .filter((c) => c.results_visible && evalCount >= (c.min_evaluators_to_reveal ?? 3))
        .map((c) => c.eval_type)

      const visibleEvals = (evals ?? []).filter((e) => visibleEvalTypes.includes(e.eval_type))

      if (visibleEvals.length === 0) {
        stats.push({ id: emp.id, full_name: emp.full_name, role: emp.role, avgScore: null, evalCount, questionAverages: [] })
        continue
      }

      const evalIds = visibleEvals.map((e) => e.id)
      const { data: responses } = await supabase
        .from('evaluation_responses')
        .select('question_id, rating_value')
        .in('evaluation_id', evalIds)

      const questionAverages: { question_text: string; avg: number }[] = []
      const ratingQuestions = (questions ?? []).filter((q) => visibleEvalTypes.includes(q.eval_type))

      for (const q of ratingQuestions) {
        const vals = (responses ?? [])
          .filter((r) => r.question_id === q.id && r.rating_value != null)
          .map((r) => r.rating_value as number)
        if (vals.length > 0) {
          questionAverages.push({ question_text: q.text, avg: vals.reduce((a, b) => a + b, 0) / vals.length })
        }
      }

      const allRatings = (responses ?? [])
        .map((r) => r.rating_value)
        .filter((v): v is number => v != null)
      const avgScore = allRatings.length > 0 ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : null

      stats.push({ id: emp.id, full_name: emp.full_name, role: emp.role, avgScore, evalCount, questionAverages })
    }
  }

  const year = company.year as unknown as { name: string } | null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← לוח בקרה
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            תוצאות סוציומטריה — {company.name}
          </h1>
          {year && <p className="text-xs text-gray-400">{year.name}</p>}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {!cycle ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400">אין מחזור פעיל</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">מחזור: {cycle.name}</p>

            {stats.map((emp) => (
              <div key={emp.id} className="bg-white rounded-xl border border-gray-100 p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{emp.full_name}</p>
                    <p className="text-xs text-gray-400">{emp.role} · קיבל {emp.evalCount} הערכות</p>
                  </div>
                  {emp.avgScore != null && (
                    <div className="text-left">
                      <p className="text-2xl font-bold text-blue-600">{emp.avgScore.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">ממוצע כללי</p>
                    </div>
                  )}
                  {emp.avgScore == null && (
                    <p className="text-sm text-gray-400">טרם זמין</p>
                  )}
                </div>

                {emp.questionAverages.length > 0 && (
                  <div className="space-y-2 mt-3 border-t border-gray-50 pt-3">
                    {emp.questionAverages.map((qa, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <p className="text-xs text-gray-600 flex-1">{qa.question_text}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-20 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-400 h-full rounded-full"
                              style={{ width: `${(qa.avg / 7) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-8 text-left">
                            {qa.avg.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {stats.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                <p className="text-gray-400">אין עובדים בפלוגה</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
