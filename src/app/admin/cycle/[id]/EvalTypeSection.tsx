'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Question = {
  id: string
  type: 'rating' | 'text'
  text: string
  display_order: number
  eval_type: string
}

type Config = {
  id: string
  eval_type: string
  results_visible: boolean
  min_evaluators_to_reveal: number
  min_cross_company: number
} | null

export default function EvalTypeSection({
  cycleId,
  evalType,
  label,
  config: initialConfig,
  questions: initialQuestions,
}: {
  cycleId: string
  evalType: string
  label: string
  config: Config
  questions: Question[]
}) {
  const router = useRouter()
  const [config, setConfig] = useState(initialConfig)
  const [questions, setQuestions] = useState(initialQuestions)
  const [newText, setNewText] = useState('')
  const [newType, setNewType] = useState<'rating' | 'text'>('rating')
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)

  async function toggleResultsVisible() {
    setSaving(true)
    const newVal = !(config?.results_visible ?? false)
    const res = await fetch(`/api/admin/cycle/${cycleId}/eval-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eval_type: evalType,
        results_visible: newVal,
        min_evaluators_to_reveal: config?.min_evaluators_to_reveal ?? 3,
        min_cross_company: config?.min_cross_company ?? 0,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setConfig(data)
      router.refresh()
    }
    setSaving(false)
  }

  async function updateMinEvaluators(val: number) {
    const res = await fetch(`/api/admin/cycle/${cycleId}/eval-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eval_type: evalType,
        results_visible: config?.results_visible ?? false,
        min_evaluators_to_reveal: val,
        min_cross_company: config?.min_cross_company ?? 0,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setConfig(data)
    }
  }

  async function updateMinCrossCompany(val: number) {
    if (evalType !== 'peer_cross_year') return
    const res = await fetch(`/api/admin/cycle/${cycleId}/eval-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eval_type: evalType,
        results_visible: config?.results_visible ?? false,
        min_evaluators_to_reveal: config?.min_evaluators_to_reveal ?? 3,
        min_cross_company: val,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setConfig(data)
    }
  }

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault()
    if (!newText.trim()) return
    setAdding(true)

    const res = await fetch(`/api/admin/cycle/${cycleId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: newType,
        text: newText.trim(),
        eval_type: evalType,
        display_order: questions.length,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setQuestions((prev) => [...prev, data])
      setNewText('')
      router.refresh()
    }
    setAdding(false)
  }

  async function deleteQuestion(qId: string) {
    const res = await fetch(`/api/admin/cycle/${cycleId}/questions/${qId}`, { method: 'DELETE' })
    if (res.ok) {
      setQuestions((prev) => prev.filter((q) => q.id !== qId))
      router.refresh()
    }
  }

  const resultsVisible = config?.results_visible ?? false

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{label}</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">הצג תוצאות</span>
          <button
            onClick={toggleResultsVisible}
            disabled={saving}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
              resultsVisible ? 'bg-green-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                resultsVisible ? '-translate-x-5' : '-translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex gap-4 text-xs text-gray-500">
        <label className="flex items-center gap-1">
          מינ. מעריכים לחשיפה:
          <input
            type="number"
            min={1}
            defaultValue={config?.min_evaluators_to_reveal ?? 3}
            onBlur={(e) => updateMinEvaluators(parseInt(e.target.value) || 3)}
            className="w-12 border border-gray-200 rounded px-1 py-0.5 text-center"
          />
        </label>
        {evalType === 'peer_cross_year' && (
          <label className="flex items-center gap-1">
            מינ. הערכות בין-פלוגתיות:
            <input
              type="number"
              min={0}
              defaultValue={config?.min_cross_company ?? 0}
              onBlur={(e) => updateMinCrossCompany(parseInt(e.target.value) || 0)}
              className="w-12 border border-gray-200 rounded px-1 py-0.5 text-center"
            />
          </label>
        )}
      </div>

      {questions.length === 0 ? (
        <p className="text-sm text-gray-400">אין שאלות עדיין</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {questions.map((q, idx) => (
            <li key={q.id} className="flex items-start justify-between py-2 gap-3">
              <div className="flex-1">
                <p className="text-sm text-gray-800">
                  {idx + 1}. {q.text}
                </p>
                <span className="text-xs text-gray-400">
                  {q.type === 'rating' ? 'דירוג' : 'טקסט'}
                </span>
              </div>
              <button
                onClick={() => deleteQuestion(q.id)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                מחק
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addQuestion} className="border-t border-gray-50 pt-4 flex gap-3 items-end">
        <div className="flex-1">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="הוסף שאלה..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as 'rating' | 'text')}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          <option value="rating">דירוג</option>
          <option value="text">טקסט</option>
        </select>
        <button
          type="submit"
          disabled={adding}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          הוסף
        </button>
      </form>
    </div>
  )
}
