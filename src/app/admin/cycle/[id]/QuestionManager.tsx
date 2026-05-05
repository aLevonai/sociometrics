'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

type Question = {
  id: string
  type: 'rating' | 'text'
  text: string
  display_order: number
}

export default function QuestionManager({
  cycleId,
  questions: initialQuestions,
}: {
  cycleId: string
  questions: Question[]
}) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [questions, setQuestions] = useState(initialQuestions)
  const [newText, setNewText] = useState('')
  const [newType, setNewType] = useState<'rating' | 'text'>('rating')
  const [adding, setAdding] = useState(false)

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
        display_order: questions.length,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setQuestions((prev) => [...prev, data])
      setNewText('')
    }
    setAdding(false)
    router.refresh()
  }

  async function deleteQuestion(qId: string) {
    const res = await fetch(`/api/admin/cycle/${cycleId}/questions/${qId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setQuestions((prev) => prev.filter((q) => q.id !== qId))
      router.refresh()
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">{t('questions')}</h2>

      {questions.length === 0 ? (
        <p className="text-sm text-gray-400 mb-4">{t('noQuestions')}</p>
      ) : (
        <ul className="divide-y divide-gray-50 mb-4">
          {questions.map((q, idx) => (
            <li key={q.id} className="flex items-start justify-between py-3 gap-3">
              <div className="flex-1">
                <p className="text-sm text-gray-800">
                  {idx + 1}. {q.text}
                </p>
                <span className="text-xs text-gray-400">
                  {q.type === 'rating' ? t('rating') : t('text')}
                </span>
              </div>
              <button
                onClick={() => deleteQuestion(q.id)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                {t('deleteQuestion')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addQuestion} className="border-t border-gray-50 pt-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-700">{t('addQuestion')}</h3>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('questionType')}</label>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as 'rating' | 'text')}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="rating">{t('rating')}</option>
            <option value="text">{t('text')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('questionText')}</label>
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {t('saveQuestion')}
        </button>
      </form>
    </div>
  )
}
