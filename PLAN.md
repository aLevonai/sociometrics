# Sociometric Evaluation Platform — Implementation Plan

## Context
A Hebrew-language internal web app (~160 employees) where each employee evaluates colleagues using 1–7 rated questions and open-ended text. Two-tier org structure: **Section → Department**. Each employee evaluates their full department + ≥10 others from within their section. Results are anonymous and revealed only when a super-admin flips a switch. Section admins can view aggregated results for their whole section; super-admin sees everything. Built with Next.js + Supabase + Vercel (free tiers).

---

## Org Hierarchy

```
Company
├── Section A (e.g. "Operations")
│   ├── Department A1 (~20 people)
│   └── Department A2 (~20 people)
└── Section B (e.g. "R&D")
    ├── Department B1 (~20 people)
    └── ...
```

Each employee may only evaluate others **within their own section**.

---

## Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Framework | Next.js 14 (App Router, TypeScript) | Full-stack, Vercel-native |
| Styling | Tailwind CSS + RTL config | Hebrew support |
| i18n | `next-intl` | Hebrew strings |
| Backend | Supabase (PostgreSQL + Auth + RLS) | Free tier, magic-link auth |
| Deployment | Vercel (hobby free) | Zero cost |
| Local dev | Supabase CLI (`supabase start`) | Docker-based local Supabase |

---

## Database Schema

```mermaid
erDiagram
    sections ||--o{ departments : has
    sections ||--o{ employees : "belongs to (denorm)"
    departments ||--o{ employees : "belongs to"
    employees ||--o{ evaluations : "submits (evaluator)"
    employees ||--o{ evaluations : "receives (evaluatee)"
    evaluation_cycles ||--o{ questions : has
    evaluation_cycles ||--o{ evaluations : within
    evaluations ||--o{ evaluation_responses : contains
    questions ||--o{ evaluation_responses : answered_by

    sections {
        uuid id PK
        text name
    }
    departments {
        uuid id PK
        text name
        uuid section_id FK
    }
    employees {
        uuid id PK "= Supabase auth user id"
        text company_id UK "the employee's company ID"
        text name
        text email UK
        uuid department_id FK
        uuid section_id FK "denormalized"
        text role "employee | section_admin | super_admin"
    }
    evaluation_cycles {
        uuid id PK
        text name
        bool is_active "evaluation submissions open"
        bool results_visible "employees can see results"
        int min_evaluators_to_reveal "default 3"
        int min_cross_dept "default 10"
        timestamptz created_at
    }
    questions {
        uuid id PK
        uuid cycle_id FK
        text type "rating | text"
        text text
        int display_order
    }
    evaluations {
        uuid id PK
        uuid cycle_id FK
        uuid evaluator_id FK "always stored, never shown to employees"
        uuid evaluatee_id FK
        bool is_submitted "locked once true"
        timestamptz submitted_at
        UNIQUE "cycle_id, evaluator_id, evaluatee_id"
    }
    evaluation_responses {
        uuid id PK
        uuid evaluation_id FK
        uuid question_id FK
        int rating_value "nullable, for rating questions"
        text text_value "nullable, for open questions"
    }
```

### Critical RLS Policies

- `evaluations`: employees can INSERT (own evaluator_id, same section as evaluatee, cycle active, not already submitted). Can SELECT only their own rows as evaluator (to check progress). **Can never SELECT evaluator_id column for rows where they are evaluatee.**
- `evaluation_responses`: employees can INSERT via evaluation they own. Cannot SELECT individual responses — only through aggregate API routes.
- Results are returned by **server-side API routes** that aggregate and strip identity before returning JSON. The client never sees raw evaluator_id.
- Section admins: can SELECT aggregated results for all employees in their section (same server-side aggregate API, scoped to section).
- Super admin: full read access.

---

## App Routes & Pages

```
/                        → redirect based on auth state
/login                   → Enter company ID → triggers magic link email
/auth/callback           → Supabase magic link handler

/dashboard               → Employee home
  - Evaluation progress ring (dept + cross-dept count)
  - List: "To evaluate" (within section)
  - Status: results not yet available / available

/evaluate/[employeeId]   → Evaluation form (all questions for one person)
  - Blocked if: already submitted, cycle inactive, wrong section

/results                 → My results (blocked until results_visible = true AND min_evaluators met)
  - Mean score per question
  - Rank in department + company-wide
  - All written responses (shuffled, no author metadata)

/admin                   → Super-admin: overview, all cycles, all sections
/admin/cycle/new         → Create cycle, set min_cross_dept, min_evaluators_to_reveal
/admin/cycle/[id]        → Manage questions (add/edit/reorder), toggle is_active, toggle results_visible
/admin/employees         → CSV upload (creates sections/depts/employees), list view
/admin/section/[id]      → Section admin view: completion stats + per-employee results for section
```

---

## Authentication Flow

```
Employee → enters company_id
          → API looks up employee by company_id → gets email
          → supabase.auth.signInWithOtp({ email }) → magic link
          → employee clicks link → /auth/callback → session cookie
          → redirect to /dashboard
```

- Employees never set a password.
- The company ID alone is never sufficient — the magic link goes to the registered email.
- Sessions managed by `@supabase/ssr` (cookie-based, SSR-compatible).

---

## CSV Format (admin upload)

```csv
company_id,name,email,section,department
EMP001,ישראל ישראלי,israel@company.com,מבצעים,כספים
```

- System creates sections/departments on first occurrence (case-insensitive match).
- Upserts employees by `company_id`.
- After upload, admin can manually set `role` for section admins.

---

## Anonymity Guarantees

1. `evaluator_id` stored in DB (required to prevent double-submission and enforce section scope), **never returned by any API endpoint to non-admins**.
2. Written responses returned in shuffled order with no metadata.
3. `min_evaluators_to_reveal` (default 3): results page shows a warning instead of results if fewer than this many people have submitted.
4. RLS prevents direct table queries from the client that would expose evaluator identity.
5. No admin UI exposes the evaluator_id mapping even to section admins (they see aggregated results only).

---

## Skew / Integrity Prevention

| Threat | Mitigation |
|---|---|
| Voting twice for same person | `UNIQUE(cycle_id, evaluator_id, evaluatee_id)` in DB |
| Editing after submit | `is_submitted = true` locks evaluation; API rejects updates |
| Evaluating outside section | API validates same `section_id` before accepting |
| Unauthenticated submission | All routes behind Supabase auth middleware |
| Submitting own evaluation | API rejects `evaluator_id = evaluatee_id` |

---

## Implementation Order

### Phase 0 — Local scaffold
1. `npx create-next-app@latest . --typescript --tailwind --app --src-dir`
2. `npm i @supabase/supabase-js @supabase/ssr next-intl`
3. `supabase init` + `supabase start` (Docker local Supabase)
4. Configure `dir="rtl"` in `layout.tsx`, add `next-intl` with Hebrew locale file

### Phase 1 — Database
5. Write migration files: `supabase/migrations/`
   - 001_tables.sql — all tables + types
   - 002_rls.sql — all RLS policies
   - 003_seed.sql — test data (3 sections, 6 depts, ~30 employees)
6. Run `supabase db reset` to apply

### Phase 2 — Auth
7. Login page: company ID input → magic link trigger
8. `/auth/callback` route handler
9. Middleware to protect all non-login routes
10. `useUser()` hook / server session util

### Phase 3 — Admin: employees + cycle
11. CSV upload page (`/admin/employees`) — parse + upsert
12. Cycle create/manage page — questions CRUD (type, text, order)
13. Toggle `is_active` / `results_visible`

### Phase 4 — Evaluation flow
14. `/dashboard` — show progress, list of people to evaluate
15. `/evaluate/[employeeId]` — form with all questions (rating sliders + text areas)
16. Submit handler — write to `evaluations` + `evaluation_responses`, set `is_submitted`

### Phase 5 — Results
17. Aggregate SQL function (or server-side query): mean per question, rank, text responses
18. `/results` page — show own results when visible
19. `/admin/section/[id]` — section admin sees all employees' results in their section

### Phase 6 — Polish & test
20. Hebrew strings via next-intl (no English fallbacks)
21. Responsive layout, RTL Tailwind utilities
22. Edge cases: what if cycle deactivated mid-fill? what if employee added after cycle started?
23. Local load test: seed all 160 employees, simulate full cycle

---

## Verification Plan

```bash
# 1. DB integrity
supabase db reset          # fresh seed
npx tsx scripts/seed.ts    # 160 employees, 8 depts, 2 sections

# 2. Auth
- Login with test company ID → check magic link arrives in Inbucket (local email catcher at :54324)
- Try wrong company ID → expect 404 error
- Try direct /dashboard without auth → expect redirect to /login

# 3. Evaluation constraints
- Submit evaluation for person in different section → expect API 403
- Submit same evaluation twice → expect DB unique error caught by API
- Try to update after is_submitted = true → expect 400

# 4. Anonymity
- As employee, call /api/results/[myId] → verify response contains no evaluator_id
- Check Supabase SQL editor: query evaluations as employee role → confirm RLS blocks evaluator_id

# 5. Admin flow
- Upload CSV → verify sections/depts/employees created correctly
- Create cycle + questions → toggle is_active → submit evaluations → toggle results_visible
- As section admin, view /admin/section/[id] → verify only own section visible

# 6. Results accuracy
- Manually calculate expected mean for a test employee
- Compare against /results page output
```

---

## Files to Create (critical paths)

```
/src/app/login/page.tsx
/src/app/auth/callback/route.ts
/src/app/dashboard/page.tsx
/src/app/evaluate/[employeeId]/page.tsx
/src/app/results/page.tsx
/src/app/admin/employees/page.tsx
/src/app/admin/cycle/[id]/page.tsx
/src/app/admin/section/[id]/page.tsx
/src/lib/supabase/server.ts       (server client helper)
/src/lib/supabase/client.ts       (browser client helper)
/src/middleware.ts                 (auth guard)
/src/i18n/he.json                  (all Hebrew strings)
/supabase/migrations/001_tables.sql
/supabase/migrations/002_rls.sql
/supabase/migrations/003_seed.sql
/scripts/seed.ts                   (160-employee test seed)
```
