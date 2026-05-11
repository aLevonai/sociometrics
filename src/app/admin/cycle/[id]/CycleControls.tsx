'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CycleControls({
  cycleId,
  isActive: initialIsActive,
}: {
  cycleId: string
  isActive: boolean
}) {
  const router = useRouter()
  const [isActive, setIsActive] = useState(initialIsActive)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    setSaving(true)
    const res = await fetch(`/api/admin/cycle/${cycleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    })
    if (res.ok) {
      setIsActive(!isActive)
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">הגדרות מחזור</h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">פעיל</p>
          <p className="text-xs text-gray-400">האם ניתן להגיש הערכות</p>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            isActive ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isActive ? '-translate-x-6' : '-translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
