import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'

// Visible to: super_commander only
// Shows: overview of all years — links to year results + company results

export default async function AdminResultsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.role !== 'super_commander') redirect('/dashboard')

  const supabase = createServiceClient()

  const { data: cycle } = await supabase
    .from('evaluation_cycles')
    .select('id, name')
    .eq('is_active', true)
    .maybeSingle()

  const { data: years } = await supabase
    .from('years')
    .select('id, name, order_num')
    .order('order_num')

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, year_id')
    .order('name')

  type CycleStats = {
    totalEmployees: number
    totalSubmitted: number
    totalRequired: number
  }

  let cycleStats: CycleStats | null = null

  if (cycle) {
    const { data: empCount } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .in('role', ['soldier', 'team_leader'])

    const { data: submitted } = await supabase
      .from('evaluations')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycle.id)
      .eq('is_submitted', true)

    cycleStats = {
      totalEmployees: (empCount as unknown as { count: number } | null)?.count ?? 0,
      totalSubmitted: (submitted as unknown as { count: number } | null)?.count ?? 0,
      totalRequired: 0,
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← לוח בקרה
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">תוצאות כלל המסגרת</h1>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {!cycle ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400">אין מחזור פעיל</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h2 className="font-semibold text-gray-900 mb-2">מחזור: {cycle.name}</h2>
              {cycleStats && (
                <p className="text-sm text-gray-500">
                  {cycleStats.totalSubmitted} הערכות הוגשו
                </p>
              )}
            </div>

            {(years ?? []).map((year) => {
              const yearCompanies = (companies ?? []).filter((c) => c.year_id === year.id)
              return (
                <div key={year.id} className="bg-white rounded-xl border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900">{year.name}</h2>
                    <Link
                      href={`/results/year/${year.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      תוצאות מפקדים →
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {yearCompanies.map((company) => (
                      <Link
                        key={company.id}
                        href={`/results/company/${company.id}`}
                        className="bg-gray-50 rounded-lg p-3 hover:bg-blue-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-800">{company.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">סוציומטריה →</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </main>
    </div>
  )
}
