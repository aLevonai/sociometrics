import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import CycleControls from './CycleControls'
import EvalTypeSection from './EvalTypeSection'

const EVAL_TYPES = [
  { code: 'peer_company',      label: 'סוציומטריה פנים-פלוגתית' },
  { code: 'peer_cross_year',   label: 'סוציומטריה בין-פלוגתית (שנה)' },
  { code: 'team_leader',       label: 'הערכת מ"כ שנה ג\'' },
  { code: 'cmd_by_soldiers',   label: 'הערכת מפקד פלוגה ע"י חיילים' },
  { code: 'cmd_by_teamleaders',label: 'הערכת מפקד פלוגה ע"י מ"כים' },
] as const

export default async function CycleAdminPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const { data: cycle } = await supabase
    .from('evaluation_cycles')
    .select('id, name, is_active')
    .eq('id', id)
    .single()

  if (!cycle) notFound()

  const { data: configs } = await supabase
    .from('cycle_eval_configs')
    .select('id, eval_type, results_visible, min_evaluators_to_reveal, min_cross_company')
    .eq('cycle_id', id)

  const { data: questions } = await supabase
    .from('questions')
    .select('id, type, text, display_order, eval_type')
    .eq('cycle_id', id)
    .order('eval_type')
    .order('display_order')

  const configMap = Object.fromEntries((configs ?? []).map((c) => [c.eval_type, c]))
  const questionsByType = Object.fromEntries(
    EVAL_TYPES.map((et) => [
      et.code,
      (questions ?? []).filter((q) => q.eval_type === et.code),
    ])
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
          ← {t('title')}
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">{cycle.name}</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <CycleControls cycleId={id} isActive={cycle.is_active} />

        {EVAL_TYPES.map((et) => (
          <EvalTypeSection
            key={et.code}
            cycleId={id}
            evalType={et.code}
            label={et.label}
            config={configMap[et.code] ?? null}
            questions={questionsByType[et.code] ?? []}
          />
        ))}
      </main>
    </div>
  )
}
