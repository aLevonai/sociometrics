-- ============================================================
-- Migration 006: RLS — deny-by-default for all tables
-- ============================================================
-- All server-side access uses the Supabase service role key,
-- which bypasses RLS entirely. RLS is kept enabled to prevent
-- any accidental direct authenticated queries from leaking data.
-- No permissive policies are created.
-- ============================================================

ALTER TABLE public.years                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_cycles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_eval_configs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_responses ENABLE ROW LEVEL SECURITY;
