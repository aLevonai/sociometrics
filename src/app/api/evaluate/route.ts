import { type NextRequest } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'

type EvalResponse = {
  question_id: string
  rating_value: number | null
  text_value: string | null
}

const VALID_EVAL_TYPES = new Set([
  'peer_company', 'peer_cross_year', 'team_leader', 'cmd_by_soldiers', 'cmd_by_teamleaders',
])

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const myId = session.user.employeeId

  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'invalid body' }, { status: 400 })

  const { cycle_id, evaluatee_id, eval_type, responses, existing_eval_id } = body as {
    cycle_id: string
    evaluatee_id: string
    eval_type: string
    responses: EvalResponse[]
    existing_eval_id: string | null
  }

  if (!cycle_id || !evaluatee_id || !eval_type || !Array.isArray(responses)) {
    return Response.json({ error: 'missing fields' }, { status: 400 })
  }

  if (!VALID_EVAL_TYPES.has(eval_type)) {
    return Response.json({ error: 'invalid eval_type' }, { status: 400 })
  }

  if (evaluatee_id === myId) {
    return Response.json({ error: 'cannot evaluate yourself' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: cycle } = await supabase
    .from('evaluation_cycles')
    .select('id, is_active')
    .eq('id', cycle_id)
    .eq('is_active', true)
    .single()

  if (!cycle) {
    return Response.json({ error: 'cycle not active' }, { status: 400 })
  }

  let evalId = existing_eval_id

  if (!evalId) {
    const { data: newEval, error: evalError } = await supabase
      .from('evaluations')
      .insert({
        cycle_id,
        evaluator_id: myId,
        evaluatee_id,
        eval_type,
        is_submitted: false,
      })
      .select('id')
      .single()

    if (evalError) {
      const { data: existingEval } = await supabase
        .from('evaluations')
        .select('id, is_submitted')
        .eq('cycle_id', cycle_id)
        .eq('evaluator_id', myId)
        .eq('evaluatee_id', evaluatee_id)
        .eq('eval_type', eval_type)
        .single()

      if (!existingEval) return Response.json({ error: evalError.message }, { status: 500 })
      if (existingEval.is_submitted) return Response.json({ error: 'already submitted' }, { status: 409 })
      evalId = existingEval.id
    } else {
      evalId = newEval.id
    }
  } else {
    const { data: check } = await supabase
      .from('evaluations')
      .select('is_submitted')
      .eq('id', evalId)
      .eq('evaluator_id', myId)
      .single()

    if (check?.is_submitted) return Response.json({ error: 'already submitted' }, { status: 409 })
  }

  const responseRows = responses
    .filter((r) => r.rating_value != null || (r.text_value && r.text_value.trim()))
    .map((r) => ({
      evaluation_id: evalId!,
      question_id: r.question_id,
      rating_value: r.rating_value,
      text_value: r.text_value?.trim() || null,
    }))

  if (responseRows.length > 0) {
    const { error: respError } = await supabase
      .from('evaluation_responses')
      .upsert(responseRows, { onConflict: 'evaluation_id,question_id' })

    if (respError) return Response.json({ error: respError.message }, { status: 500 })
  }

  const { error: submitError } = await supabase
    .from('evaluations')
    .update({ is_submitted: true, submitted_at: new Date().toISOString() })
    .eq('id', evalId)
    .eq('evaluator_id', myId)
    .eq('is_submitted', false)

  if (submitError) return Response.json({ error: submitError.message }, { status: 500 })

  return Response.json({ ok: true })
}
