-- ============================================================
-- Migration 005: Org structure & evaluation type redesign
-- ============================================================
-- Renames sections→years, departments→companies, adds teams,
-- updates roles, adds eval_type discrimination.
-- Safe to run on a fresh Supabase project (no prod data yet).
-- ============================================================

-- Step 1: Drop all RLS policies so we can safely rename/alter
DROP POLICY IF EXISTS "sections_select" ON public.sections;
DROP POLICY IF EXISTS "sections_insert_super_admin" ON public.sections;
DROP POLICY IF EXISTS "sections_update_super_admin" ON public.sections;
DROP POLICY IF EXISTS "departments_select" ON public.departments;
DROP POLICY IF EXISTS "departments_insert_super_admin" ON public.departments;
DROP POLICY IF EXISTS "departments_update_super_admin" ON public.departments;
DROP POLICY IF EXISTS "employees_select_own" ON public.employees;
DROP POLICY IF EXISTS "employees_insert_super_admin" ON public.employees;
DROP POLICY IF EXISTS "employees_update_super_admin" ON public.employees;
DROP POLICY IF EXISTS "cycles_select" ON public.evaluation_cycles;
DROP POLICY IF EXISTS "cycles_write_super_admin" ON public.evaluation_cycles;
DROP POLICY IF EXISTS "questions_select" ON public.questions;
DROP POLICY IF EXISTS "questions_write_super_admin" ON public.questions;
DROP POLICY IF EXISTS "evaluations_select_as_evaluator" ON public.evaluations;
DROP POLICY IF EXISTS "evaluations_insert" ON public.evaluations;
DROP POLICY IF EXISTS "evaluations_update_super_admin" ON public.evaluations;
DROP POLICY IF EXISTS "evaluations_update_own_submit" ON public.evaluations;
DROP POLICY IF EXISTS "responses_insert" ON public.evaluation_responses;
DROP POLICY IF EXISTS "responses_select_admin" ON public.evaluation_responses;
DROP POLICY IF EXISTS "responses_update_own" ON public.evaluation_responses;

-- Step 2: Drop stale helper functions
DROP FUNCTION IF EXISTS public.current_employee() CASCADE;
DROP FUNCTION IF EXISTS public.current_role() CASCADE;
DROP FUNCTION IF EXISTS public.current_section_id() CASCADE;

-- Step 3: Clear all data so structural changes won't hit FK violations
TRUNCATE public.evaluation_responses,
         public.evaluations,
         public.questions,
         public.evaluation_cycles,
         public.employees,
         public.departments,
         public.sections
CASCADE;

-- Step 4: Rename employee_role enum values
--   employee      → soldier
--   section_admin → company_commander
--   super_admin   → super_commander
ALTER TYPE public.employee_role RENAME VALUE 'employee'      TO 'soldier';
ALTER TYPE public.employee_role RENAME VALUE 'section_admin' TO 'company_commander';
ALTER TYPE public.employee_role RENAME VALUE 'super_admin'   TO 'super_commander';
ALTER TYPE public.employee_role ADD VALUE 'team_leader';
ALTER TYPE public.employee_role ADD VALUE 'year_commander';

-- Step 5: Rename sections → years
ALTER TABLE public.sections RENAME TO years;
ALTER TABLE public.years ADD COLUMN IF NOT EXISTS order_num integer;

-- Step 6: Rename departments → companies; rename FK column
ALTER TABLE public.departments RENAME TO companies;
ALTER TABLE public.companies RENAME COLUMN section_id TO year_id;

-- Step 7: Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  company_id     uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  team_leader_id uuid        REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, company_id)
);

-- Step 8: Update employees — rename FK columns, add new optional columns
-- The old "company_id" column is the TEXT military ID (EMP001 etc).
-- Rename it to "military_id" first so we can free up the name "company_id"
-- for the UUID FK that replaces department_id.
ALTER TABLE public.employees RENAME COLUMN company_id    TO military_id;
ALTER TABLE public.employees RENAME COLUMN section_id    TO year_id;
ALTER TABLE public.employees RENAME COLUMN department_id TO company_id;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- Step 9: Strip cycle-level visibility/threshold columns (move to cycle_eval_configs)
ALTER TABLE public.evaluation_cycles DROP COLUMN IF EXISTS results_visible;
ALTER TABLE public.evaluation_cycles DROP COLUMN IF EXISTS min_evaluators_to_reveal;
ALTER TABLE public.evaluation_cycles DROP COLUMN IF EXISTS min_cross_dept;

-- Step 10: Create eval_type enum
CREATE TYPE public.eval_type AS ENUM (
  'peer_company',
  'peer_cross_year',
  'team_leader',
  'cmd_by_soldiers',
  'cmd_by_teamleaders'
);

-- Step 11: Per-eval-type config per cycle
CREATE TABLE IF NOT EXISTS public.cycle_eval_configs (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id                uuid        NOT NULL REFERENCES public.evaluation_cycles(id) ON DELETE CASCADE,
  eval_type               public.eval_type NOT NULL,
  results_visible         boolean     NOT NULL DEFAULT false,
  min_evaluators_to_reveal integer    NOT NULL DEFAULT 3,
  min_cross_company       integer     NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cycle_id, eval_type)
);

-- Step 12: Scope questions to eval_type
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS eval_type public.eval_type NOT NULL DEFAULT 'peer_company';

-- Step 13: Scope evaluations to eval_type; update unique constraint
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS eval_type public.eval_type NOT NULL DEFAULT 'peer_company';

ALTER TABLE public.evaluations
  DROP CONSTRAINT IF EXISTS evaluations_cycle_id_evaluator_id_evaluatee_id_key;

ALTER TABLE public.evaluations
  ADD CONSTRAINT evaluations_unique_per_type
  UNIQUE(cycle_id, evaluator_id, evaluatee_id, eval_type);

-- Step 14: Refresh indexes
DROP INDEX IF EXISTS idx_employees_section;
DROP INDEX IF EXISTS idx_employees_department;

CREATE INDEX IF NOT EXISTS idx_employees_year    ON public.employees(year_id);
CREATE INDEX IF NOT EXISTS idx_employees_company ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_team    ON public.employees(team_id);
CREATE INDEX IF NOT EXISTS idx_teams_company     ON public.teams(company_id);
CREATE INDEX IF NOT EXISTS idx_cycle_configs     ON public.cycle_eval_configs(cycle_id);
CREATE INDEX IF NOT EXISTS idx_evals_type        ON public.evaluations(cycle_id, eval_type);
