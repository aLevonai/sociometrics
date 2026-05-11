import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'

async function logout() {
  'use server'
  await signOut({ redirectTo: '/login' })
}

type EvalTarget = {
  employeeId: string
  fullName: string
  evalType: string
  submitted: boolean
}

type EvalGroup = {
  label: string
  targets: EvalTarget[]
  minRequired?: number
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const t = await getTranslations('dashboard')
  const supabase = createServiceClient()
  const myId = session.user.employeeId
  const myRole = session.user.role
  const myCompanyId = session.user.companyId
  const myYearId = session.user.yearId
  const myTeamId = session.user.teamId

  const { data: cycle } = await supabase
    .from('evaluation_cycles')
    .select('id, name, is_active')
    .eq('is_active', true)
    .maybeSingle()

  const { data: evalConfigs } = cycle
    ? await supabase
        .from('cycle_eval_configs')
        .select('eval_type, min_cross_company')
        .eq('cycle_id', cycle.id)
    : { data: null }

  const minCrossCompany =
    evalConfigs?.find((c) => c.eval_type === 'peer_cross_year')?.min_cross_company ?? 0

  // ── Build evaluation task groups based on role ──────────────────────────
  const groups: EvalGroup[] = []

  if (cycle && (myRole === 'soldier' || myRole === 'team_leader')) {
    // Fetch all submitted evaluations for this cycle where I am evaluator
    const { data: myEvals } = await supabase
      .from('evaluations')
      .select('evaluatee_id, eval_type, is_submitted')
      .eq('cycle_id', cycle.id)
      .eq('evaluator_id', myId)

    const submittedSet = new Set(
      (myEvals ?? []).filter((e) => e.is_submitted).map((e) => `${e.evaluatee_id}::${e.eval_type}`)
    )

    if (myRole === 'soldier') {
      // ── Group 1: Company peers (peer_company) ──────────────────────────
      const { data: companyPeers } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('company_id', myCompanyId)
        .neq('id', myId)
        .in('role', ['soldier', 'team_leader'])
        .order('full_name')

      if (companyPeers && companyPeers.length > 0) {
        groups.push({
          label: 'סוציומטריה — פלוגה שלי',
          targets: companyPeers.map((e) => ({
            employeeId: e.id,
            fullName: e.full_name,
            evalType: 'peer_company',
            submitted: submittedSet.has(`${e.id}::peer_company`),
          })),
        })
      }

      // ── Group 2: Cross-company peers (peer_cross_year) ─────────────────
      const { data: otherYearEmps } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('year_id', myYearId)
        .neq('company_id', myCompanyId)
        .in('role', ['soldier', 'team_leader'])
        .order('full_name')

      if (otherYearEmps && otherYearEmps.length > 0) {
        groups.push({
          label: 'סוציומטריה — בין פלוגות (שנה)',
          minRequired: minCrossCompany,
          targets: otherYearEmps.map((e) => ({
            employeeId: e.id,
            fullName: e.full_name,
            evalType: 'peer_cross_year',
            submitted: submittedSet.has(`${e.id}::peer_cross_year`),
          })),
        })
      }

      // ── Group 3: My team leader (team_leader eval) ─────────────────────
      if (myTeamId) {
        const { data: myTeam } = await supabase
          .from('teams')
          .select('team_leader_id, team_leader:employees!team_leader_id(id, full_name)')
          .eq('id', myTeamId)
          .maybeSingle()

        const tl = myTeam?.team_leader as unknown as { id: string; full_name: string } | null
        if (tl) {
          groups.push({
            label: 'הערכת מ"כ שלי',
            targets: [
              {
                employeeId: tl.id,
                fullName: tl.full_name,
                evalType: 'team_leader',
                submitted: submittedSet.has(`${tl.id}::team_leader`),
              },
            ],
          })
        }
      }

      // ── Group 4: My company commander (cmd_by_soldiers) ───────────────
      const { data: myCommander } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('company_id', myCompanyId)
        .eq('role', 'company_commander')
        .maybeSingle()

      if (myCommander) {
        groups.push({
          label: 'הערכת מפקד הפלוגה',
          targets: [
            {
              employeeId: myCommander.id,
              fullName: myCommander.full_name,
              evalType: 'cmd_by_soldiers',
              submitted: submittedSet.has(`${myCommander.id}::cmd_by_soldiers`),
            },
          ],
        })
      }
    }

    if (myRole === 'team_leader') {
      // ── Group 1: Year 3 company peers (peer_company) ───────────────────
      const { data: year3Peers } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('company_id', myCompanyId)
        .neq('id', myId)
        .in('role', ['soldier', 'team_leader'])
        .order('full_name')

      if (year3Peers && year3Peers.length > 0) {
        groups.push({
          label: 'סוציומטריה — פלוגה שלי (שנה ג\')',
          targets: year3Peers.map((e) => ({
            employeeId: e.id,
            fullName: e.full_name,
            evalType: 'peer_company',
            submitted: submittedSet.has(`${e.id}::peer_company`),
          })),
        })
      }

      // ── Group 2: Cross Year 3 company peers (peer_cross_year) ──────────
      const { data: otherYear3Emps } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('year_id', myYearId)
        .neq('company_id', myCompanyId)
        .in('role', ['soldier', 'team_leader'])
        .order('full_name')

      if (otherYear3Emps && otherYear3Emps.length > 0) {
        groups.push({
          label: 'סוציומטריה — בין פלוגות שנה ג\'',
          minRequired: minCrossCompany,
          targets: otherYear3Emps.map((e) => ({
            employeeId: e.id,
            fullName: e.full_name,
            evalType: 'peer_cross_year',
            submitted: submittedSet.has(`${e.id}::peer_cross_year`),
          })),
        })
      }

      // ── Group 3+4: Commanders to evaluate (cmd_by_teamleaders) ─────────
      const cmdTargets: EvalTarget[] = []

      // Find the Year 1/2 company where I lead a team
      const { data: myLedTeam } = await supabase
        .from('teams')
        .select('company_id')
        .eq('team_leader_id', myId)
        .maybeSingle()

      if (myLedTeam) {
        const { data: assignedCmd } = await supabase
          .from('employees')
          .select('id, full_name')
          .eq('company_id', myLedTeam.company_id)
          .eq('role', 'company_commander')
          .maybeSingle()

        if (assignedCmd) {
          cmdTargets.push({
            employeeId: assignedCmd.id,
            fullName: assignedCmd.full_name,
            evalType: 'cmd_by_teamleaders',
            submitted: submittedSet.has(`${assignedCmd.id}::cmd_by_teamleaders`),
          })
        }
      }

      // My own Year 3 company commander
      const { data: myYear3Cmd } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('company_id', myCompanyId)
        .eq('role', 'company_commander')
        .maybeSingle()

      if (myYear3Cmd) {
        const alreadyInList = cmdTargets.some((t) => t.employeeId === myYear3Cmd.id)
        if (!alreadyInList) {
          cmdTargets.push({
            employeeId: myYear3Cmd.id,
            fullName: myYear3Cmd.full_name,
            evalType: 'cmd_by_teamleaders',
            submitted: submittedSet.has(`${myYear3Cmd.id}::cmd_by_teamleaders`),
          })
        }
      }

      if (cmdTargets.length > 0) {
        groups.push({
          label: 'הערכת מפקדים (כמ"כ שנה ג\')',
          targets: cmdTargets,
        })
      }
    }
  }

  const totalTargets = groups.flatMap((g) => g.targets).length
  const totalSubmitted = groups.flatMap((g) => g.targets).filter((t) => t.submitted).length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">
          {t('title', { name: session.user.fullName })}
        </h1>
        <div className="flex items-center gap-4">
          {myRole === 'super_commander' && (
            <Link href="/admin" className="text-sm text-blue-600 hover:underline">
              {t('adminLink')}
            </Link>
          )}
          {myRole === 'year_commander' && (
            <Link href={`/admin/year/${myYearId}`} className="text-sm text-blue-600 hover:underline">
              ניהול שנה
            </Link>
          )}
          {myRole === 'company_commander' && (
            <Link href={`/results/company/${myCompanyId}`} className="text-sm text-blue-600 hover:underline">
              תוצאות הפלוגה
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
            {(myRole === 'soldier' || myRole === 'team_leader') && (
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-900 mb-2">
                  {t('cycleTitle', { name: cycle.name })}
                </h2>
                <p className="text-sm text-gray-500">
                  הגשת {totalSubmitted} מתוך {totalTargets} הערכות
                </p>
                <div className="mt-2 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ width: totalTargets > 0 ? `${(totalSubmitted / totalTargets) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            )}

            {myRole === 'company_commander' && (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                <p className="text-gray-600 mb-4">מחזור פעיל: {cycle.name}</p>
                <Link
                  href={`/results/company/${myCompanyId}`}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  צפה בתוצאות הפלוגה
                </Link>
              </div>
            )}

            {(myRole === 'year_commander' || myRole === 'super_commander') && (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                <p className="text-gray-600 mb-4">מחזור פעיל: {cycle.name}</p>
                <div className="flex justify-center gap-3">
                  {myRole === 'year_commander' && (
                    <Link
                      href={`/results/year/${myYearId}`}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      תוצאות השנה
                    </Link>
                  )}
                  {myRole === 'super_commander' && (
                    <Link
                      href="/results/admin"
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      תוצאות כלל המסגרת
                    </Link>
                  )}
                </div>
              </div>
            )}

            {groups.map((group, gi) => (
              <div key={gi} className="bg-white rounded-xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">{group.label}</h3>
                  {group.minRequired != null && group.minRequired > 0 && (
                    <span className="text-xs text-gray-400">
                      מינימום {group.minRequired} נדרשים
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-gray-50">
                  {group.targets.map((target) => (
                    <li
                      key={`${target.employeeId}::${target.evalType}`}
                      className="flex items-center justify-between py-3"
                    >
                      <span className="text-sm text-gray-800">{target.fullName}</span>
                      {target.submitted ? (
                        <span className="text-xs text-gray-400">{t('alreadyEvaluated')}</span>
                      ) : (
                        <Link
                          href={`/evaluate/${target.employeeId}?type=${target.evalType}`}
                          className="text-sm text-blue-600 hover:underline font-medium"
                        >
                          {t('evaluateButton')}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  )
}
