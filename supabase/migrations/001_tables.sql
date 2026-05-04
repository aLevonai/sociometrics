-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Sections (top-level org unit)
create table public.sections (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Departments (within a section)
create table public.departments (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  section_id uuid not null references public.sections(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (name, section_id)
);

-- Employees (linked to supabase auth.users)
create type public.employee_role as enum ('employee', 'section_admin', 'super_admin');

create table public.employees (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id text not null unique,
  full_name text not null,
  email text not null unique,
  department_id uuid not null references public.departments(id),
  section_id uuid not null references public.sections(id),
  role public.employee_role not null default 'employee',
  created_at timestamptz not null default now()
);

-- Evaluation cycles
create table public.evaluation_cycles (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  is_active boolean not null default false,
  results_visible boolean not null default false,
  min_evaluators_to_reveal int not null default 3,
  min_cross_dept int not null default 10,
  created_at timestamptz not null default now()
);

-- Questions per cycle
create type public.question_type as enum ('rating', 'text');

create table public.questions (
  id uuid primary key default uuid_generate_v4(),
  cycle_id uuid not null references public.evaluation_cycles(id) on delete cascade,
  type public.question_type not null,
  text text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Evaluations (one per evaluator-evaluatee pair per cycle)
create table public.evaluations (
  id uuid primary key default uuid_generate_v4(),
  cycle_id uuid not null references public.evaluation_cycles(id),
  evaluator_id uuid not null references public.employees(id),
  evaluatee_id uuid not null references public.employees(id),
  is_submitted boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint no_self_eval check (evaluator_id <> evaluatee_id),
  unique (cycle_id, evaluator_id, evaluatee_id)
);

-- Individual question responses
create table public.evaluation_responses (
  id uuid primary key default uuid_generate_v4(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  rating_value smallint check (rating_value >= 1 and rating_value <= 7),
  text_value text,
  created_at timestamptz not null default now(),
  unique (evaluation_id, question_id)
);

-- Indexes for common queries
create index idx_evaluations_evaluator on public.evaluations(evaluator_id, cycle_id);
create index idx_evaluations_evaluatee on public.evaluations(evaluatee_id, cycle_id);
create index idx_evaluation_responses_evaluation on public.evaluation_responses(evaluation_id);
create index idx_employees_section on public.employees(section_id);
create index idx_employees_department on public.employees(department_id);
