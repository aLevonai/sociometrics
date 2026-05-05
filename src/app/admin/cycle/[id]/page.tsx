import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import CycleControls from './CycleControls'
import QuestionManager from './QuestionManager'

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

  if (session.user.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{tc('unauthorized')}</p>
      </div>
    )
  }

  const supabase = createServiceClient()

  const { data: cycle } = await supabase
    .from('evaluation_cycles')
    .select('id, name, is_active, results_visible, min_evaluators_to_reveal, min_cross_dept')
    .eq('id', id)
    .single()

  if (!cycle) notFound()

  const { data: questions } = await supabase
    .from('questions')
    .select('id, type, text, display_order')
    .eq('cycle_id', id)
    .order('display_order')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
          ← {t('title')}
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">{cycle.name}</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <CycleControls cycle={cycle} />
        <QuestionManager cycleId={id} questions={questions ?? []} />
      </main>
    </div>
  )
}
