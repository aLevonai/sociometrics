import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'

// Visible to: year_commander (own year), super_commander
// Shows: commander evaluation results (cmd_by_soldiers + cmd_by_teamleaders) per company

export default async function YearResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: yearId } = await params
  const session = await auth()
  if (!session) redirect('/login')

  const role = session.user.role
  const canView =
    role === 'super_commander' ||
    (role === 'year_commander' && session.user.yearId === yearId)

  if (!canView) redirect('/dashboard')

  const supabase = createServiceClient()

  const { data: year } = await supabase
    .from('years')
    .select('id, name')
    .eq('id', yearId)
    .single()

  if (!year) notFound()

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('year_id', yearId)
    .order('name')

  const { data: cycle } = await supabase
    .from('evaluation_cycles')
    .select('id, name')
    .eq('is_active', true)
    .maybeSingle()

  const { data: configs } = cycle
    ? await supabase
        .from('cycle_eval_configs')
        .select('eval_type, results_visible, min_evaluators_to_reveal')
        .eq('cycle_id', cycle.id)
        .in('eval_type', ['cmd_by_soldiers', 'cmd_by_teamleaders'])
    : { data: null }

  const { data: questions } = cycle
    ? await supabase
        .from('questions')
        .select('id, text, eval_type')
        .eq('cycle_id', cycle.id)
        .in('eval_type', ['cmd_by_soldiers', 'cmd_by_teamleaders'])
    : { data: null }

  type CmdResult = {
    companyName: string
    commander: { id: string; full_name: string } | null
    bySoldiers: { avgScore: number | null; evalCount: number }
    byTeamLeaders: { avgScore: number | null; evalCount: number }
  }

  const companyResults: CmdResult[] = []

  for (const company of companies ?? []) {
    const { data: commander } = await supabase
      .from('employees')
      .select('id, full_name')
      .eq('company_id', company.id)
      .eq('role', 'company_commander')
      .maybeSingle()

    if (!commander || !cycle) {
      companyResults.push({ companyName: company.name, commander: null, bySoldiers: { avgScore: null, evalCount: 0 }, byTeamLeaders: { avgScore: null, evalCount: 0 } })
      continue
    }

    async function getEvalStats(evalType: 'cmd_by_soldiers' | 'cmd_by_teamleaders') {
      const config = configs?.find((c) => c.eval_type === evalType)
      const { data: evals } = await supabase
        .from('evaluations')
        .select('id')
        .eq('cycle_id', cycle!.id)
        .eq('evaluatee_id', commander!.id)
        .eq('eval_type', evalType)
        .eq('is_submitted', true)

      const evalCount = evals?.length ?? 0
      const minRequired = config?.min_evaluators_to_reveal ?? 3

      if (!config?.results_visible || evalCount < minRequired) {
        return { avgScore: null, evalCount }
      }

      const evalIds = (evals ?? []).map((e) => e.id)
      const { data: responses } = await supabase
        .from('evaluation_responses')
        .select('rating_value')
        .in('evaluation_id', evalIds)

      const vals = (responses ?? [])
        .map((r) => r.rating_value)
        .filter((v): v is number => v != null)
      const avgScore = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null

      return { avgScore, evalCount }
    }

    const bySoldiers = await getEvalStats('cmd_by_soldiers')
    const byTeamLeaders = await getEvalStats('cmd_by_teamleaders')

    companyResults.push({ companyName: company.name, commander, bySoldiers, byTeamLeaders })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← לוח בקרה
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">
          תוצאות מפקדים — {year.name}
        </h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        {!cycle ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400">אין מחזור פעיל</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500">מחזור: {cycle.name}</p>

            {companyResults.map((cr, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-gray-900">{cr.companyName}</p>
                    {cr.commander && (
                      <p className="text-xs text-gray-400">מפקד: {cr.commander.full_name}</p>
                    )}
                    {!cr.commander && (
                      <p className="text-xs text-gray-400">אין מפקד פלוגה מוגדר</p>
                    )}
                  </div>
                  <Link
                    href={`/results/company/${companies?.find((c) => c.name === cr.companyName)?.id ?? ''}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    תוצאות סוציומטריה →
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">הערכת חיילים</p>
                    <p className="text-xs text-gray-400 mb-2">{cr.bySoldiers.evalCount} הגישו</p>
                    {cr.bySoldiers.avgScore != null ? (
                      <p className="text-2xl font-bold text-blue-600">{cr.bySoldiers.avgScore.toFixed(2)}</p>
                    ) : (
                      <p className="text-sm text-gray-400">טרם זמין</p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">הערכת מ&quot;כים שנה ג&apos;</p>
                    <p className="text-xs text-gray-400 mb-2">{cr.byTeamLeaders.evalCount} הגישו</p>
                    {cr.byTeamLeaders.avgScore != null ? (
                      <p className="text-2xl font-bold text-purple-600">{cr.byTeamLeaders.avgScore.toFixed(2)}</p>
                    ) : (
                      <p className="text-sm text-gray-400">טרם זמין</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  )
}
