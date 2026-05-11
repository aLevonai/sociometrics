import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'

export default async function YearAdminPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/login')

  const allowedRoles = ['super_commander', 'year_commander', 'company_commander']
  if (!allowedRoles.includes(session.user.role)) redirect('/dashboard')

  const supabase = createServiceClient()

  const { data: year } = await supabase
    .from('years')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!year) notFound()

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('year_id', id)
    .order('name')

  const { data: employees } = await supabase
    .from('employees')
    .select('id, military_id, full_name, email, role, company_id, team:teams(name)')
    .eq('year_id', id)
    .order('full_name')

  const { data: cycle } = await supabase
    .from('evaluation_cycles')
    .select('id, name')
    .eq('is_active', true)
    .maybeSingle()

  let submittedMap: Record<string, number> = {}
  let receivedMap: Record<string, number> = {}

  if (cycle && employees && employees.length > 0) {
    const empIds = employees.map((e) => e.id)
    const { data: evals } = await supabase
      .from('evaluations')
      .select('evaluator_id, evaluatee_id')
      .eq('cycle_id', cycle.id)
      .eq('is_submitted', true)
      .or(`evaluator_id.in.(${empIds.join(',')}),evaluatee_id.in.(${empIds.join(',')})`)

    for (const e of evals ?? []) {
      submittedMap[e.evaluator_id] = (submittedMap[e.evaluator_id] ?? 0) + 1
      receivedMap[e.evaluatee_id] = (receivedMap[e.evaluatee_id] ?? 0) + 1
    }
  }

  const companyMap = Object.fromEntries((companies ?? []).map((c) => [c.id, c.name]))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
          ←
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">{year.name}</h1>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900">
              {cycle ? `מחזור פעיל: ${cycle.name}` : 'אין מחזור פעיל'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-right text-gray-500">
                  <th className="px-6 py-3 font-medium">שם</th>
                  <th className="px-6 py-3 font-medium">פלוגה</th>
                  <th className="px-6 py-3 font-medium">צוות</th>
                  <th className="px-6 py-3 font-medium">תפקיד</th>
                  <th className="px-6 py-3 font-medium">שלח</th>
                  <th className="px-6 py-3 font-medium">קיבל</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(employees ?? []).map((emp) => {
                  const team = emp.team as unknown as { name: string } | null
                  return (
                    <tr key={emp.id}>
                      <td className="px-6 py-3 text-gray-800 font-medium">{emp.full_name}</td>
                      <td className="px-6 py-3 text-gray-500">{companyMap[emp.company_id] ?? '—'}</td>
                      <td className="px-6 py-3 text-gray-500">{team?.name ?? '—'}</td>
                      <td className="px-6 py-3 text-gray-500">{emp.role}</td>
                      <td className="px-6 py-3 text-gray-600">{submittedMap[emp.id] ?? 0}</td>
                      <td className="px-6 py-3 text-gray-600">{receivedMap[emp.id] ?? 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
