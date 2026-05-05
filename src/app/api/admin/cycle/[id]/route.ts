import { type NextRequest } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const session = await auth()
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (session.user.role !== 'super_admin') return Response.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'invalid body' }, { status: 400 })

  const allowed = ['is_active', 'results_visible', 'name', 'min_evaluators_to_reveal', 'min_cross_dept']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'no valid fields' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('evaluation_cycles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data)
}
