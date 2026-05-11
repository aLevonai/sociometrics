import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import EvaluateForm from './EvaluateForm'
import Link from 'next/link'

const VALID_EVAL_TYPES = new Set([
  'peer_company', 'peer_cross_year', 'team_leader', 'cmd_by_soldiers', 'cmd_by_teamleaders',
])

export default async function EvaluatePage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ type?: string }>
}) {
  const { employeeId } = await params
  const { type } = await searchParams
  const evalType = type && VALID_EVAL_TYPES.has(type) ? type : null

  const session = await auth()
  if (!session) redirect('/login')

  if (!evalType) redirect('/dashboard')

  const t = await getTranslations('evaluate')
  const supabase = createServiceClient()
  const myId = session.user.employeeId

  if (employeeId === myId) redirect('/dashboard')

  const { data: targetEmployee } = await supabase
    .from('employees')
    .select('id, full_name')
    .eq('id', employeeId)
    .single()

  if (!targetEmployee) notFound()

  const { data: cycle } = await supabase
    .from('evaluation_cycles')
    .select('id, name')
    .eq('is_active', true)
    .maybeSingle()

  if (!cycle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center max-w-sm">
          <p className="text-gray-500 mb-4">{t('cycleInactive')}</p>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            {t('backToDashboard')}
          </Link>
        </div>
      </div>
    )
  }

  const { data: existingEval } = await supabase
    .from('evaluations')
    .select('id, is_submitted')
    .eq('cycle_id', cycle.id)
    .eq('evaluator_id', myId)
    .eq('evaluatee_id', employeeId)
    .eq('eval_type', evalType)
    .maybeSingle()

  if (existingEval?.is_submitted) {
    redirect('/dashboard')
  }

  const { data: questions } = await supabase
    .from('questions')
    .select('id, type, text, display_order')
    .eq('cycle_id', cycle.id)
    .eq('eval_type', evalType)
    .order('display_order')

  let existingResponses: { question_id: string; rating_value: number | null; text_value: string | null }[] = []
  if (existingEval) {
    const { data } = await supabase
      .from('evaluation_responses')
      .select('question_id, rating_value, text_value')
      .eq('evaluation_id', existingEval.id)
    existingResponses = data ?? []
  }

  return (
    <EvaluateForm
      evaluatorId={myId}
      evaluatee={{ id: targetEmployee.id, full_name: targetEmployee.full_name }}
      cycle={{ id: cycle.id, name: cycle.name }}
      evalType={evalType}
      questions={questions ?? []}
      existingEvalId={existingEval?.id ?? null}
      existingResponses={existingResponses}
    />
  )
}
