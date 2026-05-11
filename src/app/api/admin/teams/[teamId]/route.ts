import { type NextRequest } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await ctx.params
  const session = await auth()
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (session.user.role !== 'super_commander') return Response.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'invalid body' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('teams')
    .update({ team_leader_id: body.team_leader_id ?? null })
    .eq('id', teamId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
