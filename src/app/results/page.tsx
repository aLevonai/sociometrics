import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'

export default async function ResultsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.role === 'employee') redirect('/dashboard')

  const t = await getTranslations('results')
  const supabase = createServiceClient()
  const myId = session.user.employeeId

  const { data: cycle } = await supabase
    .from('evaluation_cycles')
    .select('id, name, results_visible, min_evaluators_to_reveal')
    .eq('results_visible', true)
    .maybeSingle()

  if (!cycle) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center max-w-sm">
          <p className="text-gray-500 mb-4">{t('notAvailable')}</p>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            {t('backToDashboard')}
          </Link>
        </div>
      </div>
    )
  }

  const { data: evaluationsReceived } = await supabase
    .from('evaluations')
    .select('id')
    .eq('cycle_id', cycle.id)
    .eq('evaluatee_id', myId)
    .eq('is_submitted', true)

  const receivedCount = evaluationsReceived?.length ?? 0

  if (receivedCount < cycle.min_evaluators_to_reveal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center max-w-sm">
          <p className="text-gray-500 mb-4">
            {t('notEnoughEvaluators', { min: cycle.min_evaluators_to_reveal })}
          </p>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            {t('backToDashboard')}
          </Link>
        </div>
      </div>
    )
  }

  const { data: questions } = await supabase
    .from('questions')
    .select('id, type, text, display_order')
    .eq('cycle_id', cycle.id)
    .order('display_order')

  const evalIds = (evaluationsReceived ?? []).map((e) => e.id)

  const { data: responses } = evalIds.length > 0
    ? await supabase
        .from('evaluation_responses')
        .select('question_id, rating_value, text_value')
        .in('evaluation_id', evalIds)
    : { data: [] }

  const ratingMeans: Record<string, number> = {}
  const textResponses: Record<string, string[]> = {}

  for (const q of questions ?? []) {
    const qResponses = (responses ?? []).filter((r) => r.question_id === q.id)
    if (q.type === 'rating') {
      const vals = qResponses.map((r) => r.rating_value).filter((v) => v != null) as number[]
      if (vals.length > 0) {
        ratingMeans[q.id] = vals.reduce((a, b) => a + b, 0) / vals.length
      }
    } else {
      textResponses[q.id] = qResponses
        .map((r) => r.text_value)
        .filter((v): v is string => !!v)
        .sort(() => Math.random() - 0.5)
    }
  }

  const { data: deptEmployees } = await supabase
    .from('employees')
    .select('id')
    .eq('department_id', session.user.departmentId)

  const deptIds = (deptEmployees ?? []).map((e) => e.id)
  const { data: deptEvals } = await supabase
    .from('evaluations')
    .select('evaluatee_id, id')
    .eq('cycle_id', cycle.id)
    .eq('is_submitted', true)
    .in('evaluatee_id', deptIds.length > 0 ? deptIds : [''])

  const deptEvalIds: Record<string, string[]> = {}
  for (const e of deptEvals ?? []) {
    if (!deptEvalIds[e.evaluatee_id]) deptEvalIds[e.evaluatee_id] = []
    deptEvalIds[e.evaluatee_id].push(e.id)
  }

  const ratingQuestions = (questions ?? []).filter((q) => q.type === 'rating')
  const deptAvgs: Record<string, number> = {}

  for (const [empId, eIds] of Object.entries(deptEvalIds)) {
    if (eIds.length < cycle.min_evaluators_to_reveal) continue
    const { data: empResps } = await supabase
      .from('evaluation_responses')
      .select('rating_value')
      .in('evaluation_id', eIds)
      .in('question_id', ratingQuestions.map((q) => q.id))
    const vals = (empResps ?? [])
      .map((r) => r.rating_value)
      .filter((v): v is number => v != null)
    if (vals.length > 0) {
      deptAvgs[empId] = vals.reduce((a, b) => a + b, 0) / vals.length
    }
  }

  const myAvg = Object.values(ratingMeans).length > 0
    ? Object.values(ratingMeans).reduce((a, b) => a + b, 0) / Object.values(ratingMeans).length
    : null

  const sortedAvgs = Object.entries(deptAvgs).sort(([, a], [, b]) => b - a)
  const myRank = sortedAvgs.findIndex(([id]) => id === myId) + 1
  const deptTotal = sortedAvgs.length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← {t('backToDashboard')}
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">{t('title')}</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {myAvg != null && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <p className="text-2xl font-bold text-gray-900 mb-1">
              {t('averageScore', { score: myAvg.toFixed(2) })}
            </p>
            {myRank > 0 && (
              <p className="text-sm text-gray-500">
                {t('rankInDept', { rank: myRank, total: deptTotal })}
              </p>
            )}
          </div>
        )}

        {(questions ?? []).map((q) => (
          <div key={q.id} className="bg-white rounded-xl border border-gray-100 p-6">
            <p className="font-medium text-gray-900 mb-3">{q.text}</p>
            {q.type === 'rating' && ratingMeans[q.id] != null && (
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{ width: `${(ratingMeans[q.id] / 7) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-700">
                  {ratingMeans[q.id].toFixed(1)}
                </span>
              </div>
            )}
            {q.type === 'text' && (
              <div className="space-y-2">
                {textResponses[q.id]?.length > 0 ? (
                  textResponses[q.id].map((text, i) => (
                    <blockquote
                      key={i}
                      className="border-r-4 border-blue-200 pr-3 text-sm text-gray-600 italic"
                    >
                      {text}
                    </blockquote>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">{t('noWrittenFeedback')}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  )
}
