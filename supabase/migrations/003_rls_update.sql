-- Allow evaluators to submit their own unsubmitted evaluations
-- Using check ensures they can only flip is_submitted to true, never back to false
create policy "evaluations_update_own_submit" on public.evaluations
  for update to authenticated
  using (evaluator_id = auth.uid() and is_submitted = false)
  with check (evaluator_id = auth.uid() and is_submitted = true);

-- Allow employees to update their own evaluation responses (before submission)
create policy "responses_update_own" on public.evaluation_responses
  for update to authenticated
  using (
    evaluation_id in (
      select id from public.evaluations
      where evaluator_id = auth.uid() and is_submitted = false
    )
  );
