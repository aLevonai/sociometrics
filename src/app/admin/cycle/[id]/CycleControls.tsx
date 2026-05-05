'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

type Cycle = {
  id: string
  name: string
  is_active: boolean
  results_visible: boolean
  min_evaluators_to_reveal: number
  min_cross_dept: number
}

export default function CycleControls({ cycle }: { cycle: Cycle }) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isActive, setIsActive] = useState(cycle.is_active)
  const [resultsVisible, setResultsVisible] = useState(cycle.results_visible)
  const [saving, setSaving] = useState(false)

  async function toggle(field: 'is_active' | 'results_visible') {
    setSaving(true)
    const newVal = field === 'is_active' ? !isActive : !resultsVisible

    const res = await fetch(`/api/admin/cycle/${cycle.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: newVal }),
    })

    if (res.ok) {
      if (field === 'is_active') setIsActive(newVal)
      else setResultsVisible(newVal)
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">הגדרות מחזור</h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('isActive')}</p>
            <p className="text-xs text-gray-400">האם ניתן להגיש הערכות</p>
          </div>
          <button
            onClick={() => toggle('is_active')}
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

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('resultsVisible')}</p>
            <p className="text-xs text-gray-400">האם עובדים יכולים לראות תוצאות</p>
          </div>
          <button
            onClick={() => toggle('results_visible')}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              resultsVisible ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                resultsVisible ? '-translate-x-6' : '-translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="pt-2 border-t border-gray-50 text-xs text-gray-400 space-y-1">
          <p>מינימום מעריכים לחשיפה: {cycle.min_evaluators_to_reveal}</p>
          <p>מינימום הערכות בין-מחלקתיות: {cycle.min_cross_dept}</p>
        </div>
      </div>
    </div>
  )
}
