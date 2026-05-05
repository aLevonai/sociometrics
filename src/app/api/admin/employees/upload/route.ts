import { type NextRequest } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Papa from 'papaparse'

type CsvRow = {
  company_id: string
  name: string
  email: string
  section: string
  department: string
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (session.user.role !== 'super_admin') return Response.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body?.csv) return Response.json({ error: 'csv required' }, { status: 400 })

  const result = Papa.parse<CsvRow>(body.csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  if (result.errors.length > 0) {
    return Response.json({ error: 'CSV parse error: ' + result.errors[0].message }, { status: 400 })
  }

  const rows = result.data.filter(
    (r) => r.company_id && r.name && r.email && r.section && r.department
  )

  if (rows.length === 0) {
    return Response.json({ error: 'no valid rows found' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const sectionNames = [...new Set(rows.map((r) => r.section.trim()))]
  const sectionMap: Record<string, string> = {}

  for (const name of sectionNames) {
    const { data: existing } = await supabase
      .from('sections')
      .select('id')
      .ilike('name', name)
      .maybeSingle()

    if (existing) {
      sectionMap[name] = existing.id
    } else {
      const { data: created } = await supabase
        .from('sections')
        .insert({ name })
        .select('id')
        .single()
      if (created) sectionMap[name] = created.id
    }
  }

  const deptMap: Record<string, string> = {}

  for (const row of rows) {
    const sectionId = sectionMap[row.section.trim()]
    if (!sectionId) continue
    const deptKey = `${sectionId}::${row.department.trim().toLowerCase()}`

    if (!deptMap[deptKey]) {
      const { data: existing } = await supabase
        .from('departments')
        .select('id')
        .eq('section_id', sectionId)
        .ilike('name', row.department.trim())
        .maybeSingle()

      if (existing) {
        deptMap[deptKey] = existing.id
      } else {
        const { data: created } = await supabase
          .from('departments')
          .insert({ name: row.department.trim(), section_id: sectionId })
          .select('id')
          .single()
        if (created) deptMap[deptKey] = created.id
      }
    }
  }

  let processed = 0

  for (const row of rows) {
    const sectionId = sectionMap[row.section.trim()]
    const deptKey = `${sectionId}::${row.department.trim().toLowerCase()}`
    const deptId = deptMap[deptKey]
    if (!sectionId || !deptId) continue

    const { error } = await supabase.from('employees').upsert(
      {
        company_id: row.company_id.trim(),
        full_name: row.name.trim(),
        email: row.email.trim().toLowerCase(),
        department_id: deptId,
        section_id: sectionId,
      },
      { onConflict: 'company_id' }
    )

    if (!error) processed++
  }

  return Response.json({ ok: true, count: processed })
}
