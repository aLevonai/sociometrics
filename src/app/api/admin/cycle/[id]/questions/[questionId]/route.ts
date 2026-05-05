import { type NextRequest } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await ctx.params
  const session = await auth()
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (session.user.role !== 'super_admin') return Response.json({ error: 'forbidden' }, { status: 403 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('questions')
    .delete()
    .eq('id', questionId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
