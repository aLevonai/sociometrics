import { type NextRequest } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const session = await auth()
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (session.user.role !== 'super_admin') return Response.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body?.text || !body?.type) {
    return Response.json({ error: 'text and type required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: question, error } = await supabase
    .from('questions')
    .insert({
      cycle_id: id,
      type: body.type,
      text: body.text,
      display_order: body.display_order ?? 0,
    })
    .select('id, type, text, display_order')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(question)
}
