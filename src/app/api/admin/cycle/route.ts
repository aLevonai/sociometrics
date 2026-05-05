import { type NextRequest } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (session.user.role !== 'super_admin') return Response.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body?.name) return Response.json({ error: 'name required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: cycle, error } = await supabase
    .from('evaluation_cycles')
    .insert({
      name: body.name,
      min_evaluators_to_reveal: body.min_evaluators_to_reveal ?? 3,
      min_cross_dept: body.min_cross_dept ?? 10,
    })
    .select('id, name')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(cycle)
}
