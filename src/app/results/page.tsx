import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export default async function ResultsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const role = session.user.role
  if (role === 'company_commander') redirect(`/results/company/${session.user.companyId}`)
  if (role === 'year_commander') redirect(`/results/year/${session.user.yearId}`)
  if (role === 'super_commander') redirect('/results/admin')

  redirect('/dashboard')
}
