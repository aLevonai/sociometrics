import { type NextRequest } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Papa from 'papaparse'

// ── CSV format ────────────────────────────────────────────────────────────────
// id, name, email, year, company, role [, team] [, assigned_year, assigned_company, assigned_team]
//
// Columns:
//   id              – soldier's military ID (e.g. EMP001)
//   name            – full name
//   email           – Google login email
//   year            – 1 | 2 | 3
//   company         – company name within that year
//   role            – soldier | team_leader | company_commander | year_commander | super_commander
//   team            – team name (Year 1/2 soldiers only)
//   assigned_year   – Year 1/2 (Year 3 TLs only)
//   assigned_company– Company name in that year (Year 3 TLs only)
//   assigned_team   – Team name in that company (Year 3 TLs only)

type CsvRow = {
  id: string
  name: string
  email: string
  year: string
  company: string
  role: string
  team: string
  assigned_year: string
  assigned_company: string
  assigned_team: string
}

const VALID_ROLES = new Set([
  'soldier', 'team_leader', 'company_commander', 'year_commander', 'super_commander',
])

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (session.user.role !== 'super_commander') return Response.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body?.csv) return Response.json({ error: 'csv required' }, { status: 400 })

  const result = Papa.parse<CsvRow>(body.csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (result.errors.length > 0) {
    return Response.json({ error: 'CSV parse error: ' + result.errors[0].message }, { status: 400 })
  }

  const rows = result.data.filter(
    (r) => r.id && r.name && r.email && r.year && r.company && VALID_ROLES.has(r.role?.trim().toLowerCase())
  )

  if (rows.length === 0) {
    return Response.json({ error: 'no valid rows found' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // ── 1. Upsert years ───────────────────────────────────────────────────────
  const allYearNums = [
    ...new Set([
      ...rows.map((r) => r.year.trim()),
      ...rows.map((r) => r.assigned_year?.trim()).filter(Boolean),
    ]),
  ]
  const yearMap: Record<string, string> = {} // yearNum → uuid

  for (const yearNum of allYearNums) {
    const yearName = `שנה ${yearNum}`
    const { data: existing } = await supabase
      .from('years')
      .select('id')
      .eq('name', yearName)
      .maybeSingle()
    if (existing) {
      yearMap[yearNum] = existing.id
    } else {
      const { data: created } = await supabase
        .from('years')
        .insert({ name: yearName, order_num: parseInt(yearNum) })
        .select('id')
        .single()
      if (created) yearMap[yearNum] = created.id
    }
  }

  // ── 2. Upsert companies ───────────────────────────────────────────────────
  const companyPairs: { yearNum: string; name: string }[] = []
  for (const r of rows) {
    companyPairs.push({ yearNum: r.year.trim(), name: r.company.trim() })
    if (r.assigned_year?.trim() && r.assigned_company?.trim()) {
      companyPairs.push({ yearNum: r.assigned_year.trim(), name: r.assigned_company.trim() })
    }
  }

  const companyMap: Record<string, string> = {} // "yearId::companyNameLower" → uuid

  for (const { yearNum, name } of companyPairs) {
    const yearId = yearMap[yearNum]
    if (!yearId || !name) continue
    const key = `${yearId}::${name.toLowerCase()}`
    if (companyMap[key]) continue

    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('year_id', yearId)
      .ilike('name', name)
      .maybeSingle()

    if (existing) {
      companyMap[key] = existing.id
    } else {
      const { data: created } = await supabase
        .from('companies')
        .insert({ name, year_id: yearId })
        .select('id')
        .single()
      if (created) companyMap[key] = created.id
    }
  }

  // ── 3. Upsert teams ───────────────────────────────────────────────────────
  // Collect all teams from soldier rows and from TL assigned_team rows
  const teamPairs: { yearNum: string; companyName: string; teamName: string }[] = []
  for (const r of rows) {
    if (r.team?.trim()) {
      teamPairs.push({ yearNum: r.year.trim(), companyName: r.company.trim(), teamName: r.team.trim() })
    }
    if (r.assigned_year?.trim() && r.assigned_company?.trim() && r.assigned_team?.trim()) {
      teamPairs.push({
        yearNum: r.assigned_year.trim(),
        companyName: r.assigned_company.trim(),
        teamName: r.assigned_team.trim(),
      })
    }
  }

  const teamMap: Record<string, string> = {} // "companyId::teamNameLower" → uuid

  for (const { yearNum, companyName, teamName } of teamPairs) {
    const yearId = yearMap[yearNum]
    if (!yearId) continue
    const companyId = companyMap[`${yearId}::${companyName.toLowerCase()}`]
    if (!companyId) continue
    const key = `${companyId}::${teamName.toLowerCase()}`
    if (teamMap[key]) continue

    const { data: existing } = await supabase
      .from('teams')
      .select('id')
      .eq('company_id', companyId)
      .ilike('name', teamName)
      .maybeSingle()

    if (existing) {
      teamMap[key] = existing.id
    } else {
      const { data: created } = await supabase
        .from('teams')
        .insert({ name: teamName, company_id: companyId })
        .select('id')
        .single()
      if (created) teamMap[key] = created.id
    }
  }

  // ── 4. Upsert employees ───────────────────────────────────────────────────
  let processed = 0

  for (const row of rows) {
    const yearId = yearMap[row.year.trim()]
    const companyId = yearId
      ? companyMap[`${yearId}::${row.company.trim().toLowerCase()}`]
      : undefined
    if (!yearId || !companyId) continue

    const role = row.role.trim().toLowerCase()
    const teamId = row.team?.trim()
      ? (teamMap[`${companyId}::${row.team.trim().toLowerCase()}`] ?? null)
      : null

    const { error } = await supabase.from('employees').upsert(
      {
        military_id: row.id.trim(),
        full_name: row.name.trim(),
        email: row.email.trim().toLowerCase(),
        year_id: yearId,
        company_id: companyId,
        team_id: teamId,
        role,
      },
      { onConflict: 'military_id' }
    )
    if (!error) processed++
  }

  // ── 5. Assign TL to teams ─────────────────────────────────────────────────
  for (const row of rows) {
    if (row.role?.trim().toLowerCase() !== 'team_leader') continue
    if (!row.assigned_year?.trim() || !row.assigned_company?.trim() || !row.assigned_team?.trim()) continue

    const assignedYearId = yearMap[row.assigned_year.trim()]
    if (!assignedYearId) continue
    const assignedCompanyId = companyMap[`${assignedYearId}::${row.assigned_company.trim().toLowerCase()}`]
    if (!assignedCompanyId) continue
    const assignedTeamId = teamMap[`${assignedCompanyId}::${row.assigned_team.trim().toLowerCase()}`]
    if (!assignedTeamId) continue

    // Find this TL's employee id
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('military_id', row.id.trim())
      .maybeSingle()
    if (!emp) continue

    await supabase
      .from('teams')
      .update({ team_leader_id: emp.id })
      .eq('id', assignedTeamId)
  }

  return Response.json({ ok: true, count: processed })
}
