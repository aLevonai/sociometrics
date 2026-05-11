import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'
import TeamLeaderAssign from './TeamLeaderAssign'

export default async function TeamsAdminPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.role !== 'super_commander') redirect('/dashboard')

  const supabase = createServiceClient()

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, company_id, team_leader_id, company:companies(name, year:years(name))')
    .order('name')

  const { data: teamLeaders } = await supabase
    .from('employees')
    .select('id, full_name, military_id, company:companies(name)')
    .eq('role', 'team_leader')
    .order('full_name')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
          ← ניהול
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">ניהול צוותים</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-right text-gray-500">
                <th className="px-6 py-3 font-medium">שנה</th>
                <th className="px-6 py-3 font-medium">פלוגה</th>
                <th className="px-6 py-3 font-medium">צוות</th>
                <th className="px-6 py-3 font-medium">מ&quot;כ (שנה ג&apos;)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(teams ?? []).map((team) => {
                const company = team.company as unknown as { name: string; year: { name: string } | null } | null
                const currentLeader = teamLeaders?.find((tl) => tl.id === team.team_leader_id)
                return (
                  <tr key={team.id}>
                    <td className="px-6 py-3 text-gray-500">{company?.year?.name ?? '—'}</td>
                    <td className="px-6 py-3 text-gray-500">{company?.name ?? '—'}</td>
                    <td className="px-6 py-3 text-gray-800 font-medium">{team.name}</td>
                    <td className="px-6 py-3">
                      <TeamLeaderAssign
                        teamId={team.id}
                        currentLeaderId={team.team_leader_id}
                        currentLeaderName={currentLeader?.full_name ?? null}
                        teamLeaders={(teamLeaders ?? []).map((tl) => ({
                          id: tl.id,
                          full_name: tl.full_name,
                          military_id: tl.military_id,
                          company_name: (tl.company as unknown as { name: string } | null)?.name ?? '',
                        }))}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {(!teams || teams.length === 0) && (
            <p className="text-center text-gray-400 text-sm py-8">
              אין צוותים. העלה CSV עם חיילים שנה א&apos;/ב&apos; עם עמודת team.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
