-- Enable RLS on all tables
alter table public.sections enable row level security;
alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.evaluation_cycles enable row level security;
alter table public.questions enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_responses enable row level security;

-- Helper: get current employee record
create or replace function public.current_employee()
returns public.employees
language sql stable security definer
as $$
  select * from public.employees where id = auth.uid()
$$;

-- Helper: get current employee's role
create or replace function public.current_role()
returns public.employee_role
language sql stable security definer
as $$
  select role from public.employees where id = auth.uid()
$$;

-- Helper: get current employee's section_id
create or replace function public.current_section_id()
returns uuid
language sql stable security definer
as $$
  select section_id from public.employees where id = auth.uid()
$$;

-- SECTIONS
-- Anyone authenticated can read sections
create policy "sections_select" on public.sections
  for select to authenticated
  using (true);

create policy "sections_insert_super_admin" on public.sections
  for insert to authenticated
  with check (public.current_role() = 'super_admin');

create policy "sections_update_super_admin" on public.sections
  for update to authenticated
  using (public.current_role() = 'super_admin');

-- DEPARTMENTS
create policy "departments_select" on public.departments
  for select to authenticated
  using (true);

create policy "departments_insert_super_admin" on public.departments
  for insert to authenticated
  with check (public.current_role() = 'super_admin');

create policy "departments_update_super_admin" on public.departments
  for update to authenticated
  using (public.current_role() = 'super_admin');

-- EMPLOYEES (read own + same section, write super_admin only)
create policy "employees_select_own" on public.employees
  for select to authenticated
  using (
    id = auth.uid()
    or section_id = public.current_section_id()
    or public.current_role() in ('super_admin', 'section_admin')
  );

create policy "employees_insert_super_admin" on public.employees
  for insert to authenticated
  with check (public.current_role() = 'super_admin');

create policy "employees_update_super_admin" on public.employees
  for update to authenticated
  using (public.current_role() = 'super_admin');

-- EVALUATION CYCLES
create policy "cycles_select" on public.evaluation_cycles
  for select to authenticated
  using (true);

create policy "cycles_write_super_admin" on public.evaluation_cycles
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

-- QUESTIONS
create policy "questions_select" on public.questions
  for select to authenticated
  using (true);

create policy "questions_write_super_admin" on public.questions
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

-- EVALUATIONS
-- Employee can see their own evaluations as evaluator (to track progress)
-- Employee CANNOT see evaluations where they are evaluatee (prevents de-anonymization)
-- Section admin can see all evaluations in their section (for completion stats only)
-- Super admin sees everything

create policy "evaluations_select_as_evaluator" on public.evaluations
  for select to authenticated
  using (
    evaluator_id = auth.uid()
    or public.current_role() = 'super_admin'
    or (
      public.current_role() = 'section_admin'
      and evaluatee_id in (
        select id from public.employees where section_id = public.current_section_id()
      )
    )
  );

create policy "evaluations_insert" on public.evaluations
  for insert to authenticated
  with check (
    evaluator_id = auth.uid()
    and evaluatee_id in (
      select id from public.employees where section_id = public.current_section_id()
    )
    and exists (
      select 1 from public.evaluation_cycles
      where id = cycle_id and is_active = true
    )
  );

-- No updates/deletes by employees (submissions are locked)
create policy "evaluations_update_super_admin" on public.evaluations
  for update to authenticated
  using (public.current_role() = 'super_admin');

-- EVALUATION RESPONSES
-- Employees cannot directly query individual responses (use aggregate API routes)
-- They can INSERT their own responses (for evaluations they own)
-- Super admin and section admin can read for aggregate computation

create policy "responses_insert" on public.evaluation_responses
  for insert to authenticated
  with check (
    evaluation_id in (
      select id from public.evaluations
      where evaluator_id = auth.uid() and is_submitted = false
    )
  );

create policy "responses_select_admin" on public.evaluation_responses
  for select to authenticated
  using (
    public.current_role() = 'super_admin'
    or (
      public.current_role() = 'section_admin'
      and evaluation_id in (
        select e.id from public.evaluations e
        join public.employees emp on emp.id = e.evaluatee_id
        where emp.section_id = public.current_section_id()
      )
    )
    or (
      -- Employee can only read their own responses (as evaluator, not evaluatee)
      evaluation_id in (
        select id from public.evaluations where evaluator_id = auth.uid()
      )
    )
  );
