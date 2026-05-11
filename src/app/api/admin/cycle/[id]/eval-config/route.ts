import { type NextRequest } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'

const VALID_EVAL_TYPES = new Set([
  'peer_company', 'peer_cross_year', 'team_leader', 'cmd_by_soldiers', 'cmd_by_teamleaders',
])

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const session = await auth()
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (session.user.role !== 'super_commander') return Response.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body?.eval_type || !VALID_EVAL_TYPES.has(body.eval_type)) {
    return Response.json({ error: 'valid eval_type required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('cycle_eval_configs')
    .upsert(
      {
        cycle_id: id,
        eval_type: body.eval_type,
        results_visible: body.results_visible ?? false,
        min_evaluators_to_reveal: body.min_evaluators_to_reveal ?? 3,
        min_cross_company: body.min_cross_company ?? 0,
      },
      { onConflict: 'cycle_id,eval_type' }
    )
    .select('id, eval_type, results_visible, min_evaluators_to_reveal, min_cross_company')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data)
}
