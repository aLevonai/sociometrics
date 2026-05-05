'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function NewCycleForm() {
  const t = useTranslations('admin')
  const router = useRouter()
  const [name, setName] = useState('')
  const [minEvaluators, setMinEvaluators] = useState(3)
  const [minCrossDept, setMinCrossDept] = useState(10)
  const [status, setStatus] = useState<'idle' | 'creating' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setStatus('creating')

    const res = await fetch('/api/admin/cycle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        min_evaluators_to_reveal: minEvaluators,
        min_cross_dept: minCrossDept,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      router.push(`/admin/cycle/${data.id}`)
    } else {
      setError(data.error || 'שגיאה')
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('cycleName')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('minEvaluators')}
        </label>
        <input
          type="number"
          min={1}
          value={minEvaluators}
          onChange={(e) => setMinEvaluators(Number(e.target.value))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('minCrossDept')}
        </label>
        <input
          type="number"
          min={0}
          value={minCrossDept}
          onChange={(e) => setMinCrossDept(Number(e.target.value))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={status === 'creating'}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {status === 'creating' ? t('creating') : t('createCycle')}
      </button>
    </form>
  )
}
