'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Leader = {
  id: string
  full_name: string
  military_id: string
  company_name: string
}

export default function TeamLeaderAssign({
  teamId,
  currentLeaderId,
  currentLeaderName,
  teamLeaders,
}: {
  teamId: string
  currentLeaderId: string | null
  currentLeaderName: string | null
  teamLeaders: Leader[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function assign(leaderId: string) {
    setSaving(true)
    await fetch(`/api/admin/teams/${teamId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_leader_id: leaderId || null }),
    })
    setSaving(false)
    router.refresh()
  }

  return (
    <select
      defaultValue={currentLeaderId ?? ''}
      onChange={(e) => assign(e.target.value)}
      disabled={saving}
      className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
    >
      <option value="">— ללא מ&quot;כ —</option>
      {teamLeaders.map((tl) => (
        <option key={tl.id} value={tl.id}>
          {tl.full_name} ({tl.military_id} / {tl.company_name})
        </option>
      ))}
    </select>
  )
}
