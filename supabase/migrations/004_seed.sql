-- Test seed data for local development
-- Run after supabase db reset

-- Create auth users (these are test users for local Supabase)
insert into auth.users (id, email, email_confirmed_at, created_at, updated_at)
values
  ('11111111-0000-0000-0000-000000000001', 'admin@company.com', now(), now(), now()),
  ('11111111-0000-0000-0000-000000000002', 'emp001@company.com', now(), now(), now()),
  ('11111111-0000-0000-0000-000000000003', 'emp002@company.com', now(), now(), now()),
  ('11111111-0000-0000-0000-000000000004', 'emp003@company.com', now(), now(), now()),
  ('11111111-0000-0000-0000-000000000005', 'emp004@company.com', now(), now(), now()),
  ('11111111-0000-0000-0000-000000000006', 'emp005@company.com', now(), now(), now()),
  ('11111111-0000-0000-0000-000000000007', 'sadmin1@company.com', now(), now(), now()),
  ('11111111-0000-0000-0000-000000000008', 'sadmin2@company.com', now(), now(), now())
on conflict (id) do nothing;

-- Sections
insert into public.sections (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'מבצעים'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'פיתוח')
on conflict (id) do nothing;

-- Departments
insert into public.departments (id, name, section_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'כספים', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'לוגיסטיקה', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'פרונטאנד', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'בקאנד', 'aaaaaaaa-0000-0000-0000-000000000002')
on conflict (id) do nothing;

-- Employees
insert into public.employees (id, company_id, full_name, email, department_id, section_id, role) values
  ('11111111-0000-0000-0000-000000000001', 'ADM001', 'מנהל מערכת', 'admin@company.com',
   'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'super_admin'),
  ('11111111-0000-0000-0000-000000000002', 'EMP001', 'ישראל ישראלי', 'emp001@company.com',
   'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'employee'),
  ('11111111-0000-0000-0000-000000000003', 'EMP002', 'שרה כהן', 'emp002@company.com',
   'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'employee'),
  ('11111111-0000-0000-0000-000000000004', 'EMP003', 'משה לוי', 'emp003@company.com',
   'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'employee'),
  ('11111111-0000-0000-0000-000000000005', 'EMP004', 'רחל דוד', 'emp004@company.com',
   'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'employee'),
  ('11111111-0000-0000-0000-000000000006', 'EMP005', 'דוד אברהם', 'emp005@company.com',
   'bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'employee'),
  ('11111111-0000-0000-0000-000000000007', 'SADM01', 'מנהל סקציה מבצעים', 'sadmin1@company.com',
   'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'section_admin'),
  ('11111111-0000-0000-0000-000000000008', 'SADM02', 'מנהל סקציה פיתוח', 'sadmin2@company.com',
   'bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'section_admin')
on conflict (id) do nothing;

-- Sample evaluation cycle
insert into public.evaluation_cycles (id, name, is_active, results_visible, min_evaluators_to_reveal, min_cross_dept) values
  ('cccccccc-0000-0000-0000-000000000001', 'מחזור ראשון 2026', true, false, 3, 2)
on conflict (id) do nothing;

-- Sample questions
insert into public.questions (cycle_id, type, text, display_order) values
  ('cccccccc-0000-0000-0000-000000000001', 'rating', 'כיצד תדרג את מקצועיות העובד?', 1),
  ('cccccccc-0000-0000-0000-000000000001', 'rating', 'כיצד תדרג את יכולת שיתוף הפעולה?', 2),
  ('cccccccc-0000-0000-0000-000000000001', 'rating', 'כיצד תדרג את עמידה בלוחות זמנים?', 3),
  ('cccccccc-0000-0000-0000-000000000001', 'text', 'מה הם החוזקות הבולטות של העובד?', 4),
  ('cccccccc-0000-0000-0000-000000000001', 'text', 'במה יוכל העובד להשתפר?', 5)
on conflict do nothing;
