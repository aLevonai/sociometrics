import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import EvaluateForm from './EvaluateForm'
import Link from 'next/link'

export default async function EvaluatePage({
  params,
}: {
  params: Promise<{ employeeId: string }>
}) {
  const { employeeId } = await params
  const session = await auth()
  if (!session) redirect('/login')

  const t = await getTranslations('evaluate')
  const supabase = createServiceClient()
  const myId = session.user.employeeId

  const { data: targetEmployee } = await supabase
    .from('employees')
    .select('id, full_name, section_id')
    .eq('id', employeeId)
    .single()

  if (!targetEmployee) notFound()

  if (targetEmployee.section_id !== session.user.sectionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center max-w-sm">
          <p className="text-red-500 mb-4">{t('notInSection')}</p>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            {t('backToDashboard')}
          </Link>
        </div>
      </div>
    )
  }

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
    .maybeSingle()

  if (existingEval?.is_submitted) {
    redirect('/dashboard')
  }

  const { data: questions } = await supabase
    .from('questions')
    .select('id, type, text, display_order')
    .eq('cycle_id', cycle.id)
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
      questions={questions ?? []}
      existingEvalId={existingEval?.id ?? null}
      existingResponses={existingResponses}
    />
  )
}
