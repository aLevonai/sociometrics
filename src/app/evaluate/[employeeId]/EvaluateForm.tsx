'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

type Question = {
  id: string
  type: 'rating' | 'text'
  text: string
  display_order: number
}

type ExistingResponse = {
  question_id: string
  rating_value: number | null
  text_value: string | null
}

type Props = {
  evaluatorId: string
  evaluatee: { id: string; full_name: string }
  cycle: { id: string; name: string }
  questions: Question[]
  existingEvalId: string | null
  existingResponses: ExistingResponse[]
}

export default function EvaluateForm({
  evaluatorId,
  evaluatee,
  cycle,
  questions,
  existingEvalId,
  existingResponses,
}: Props) {
  const t = useTranslations('evaluate')
  const router = useRouter()

  const initialRatings: Record<string, number> = {}
  const initialTexts: Record<string, string> = {}

  for (const r of existingResponses) {
    if (r.rating_value != null) initialRatings[r.question_id] = r.rating_value
    if (r.text_value != null) initialTexts[r.question_id] = r.text_value
  }

  const [ratings, setRatings] = useState<Record<string, number>>(initialRatings)
  const [texts, setTexts] = useState<Record<string, string>>(initialTexts)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const responses = questions.map((q) => ({
      question_id: q.id,
      rating_value: q.type === 'rating' ? (ratings[q.id] ?? null) : null,
      text_value: q.type === 'text' ? (texts[q.id] ?? null) : null,
    }))

    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cycle_id: cycle.id,
        evaluator_id: evaluatorId,
        evaluatee_id: evaluatee.id,
        existing_eval_id: existingEvalId,
        responses,
      }),
    })

    if (res.ok) {
      router.push('/dashboard')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'שגיאה בשליחה')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← {t('backToDashboard')}
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">
          {t('title', { name: evaluatee.full_name })}
        </h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-xl border border-gray-100 p-6">
              <p className="font-medium text-gray-900 mb-4">
                {idx + 1}. {q.text}
              </p>

              {q.type === 'rating' ? (
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                    <span>{t('ratingLow')}</span>
                    <span>{t('ratingHigh')}</span>
                  </div>
                  <div className="flex gap-2 justify-between">
                    {[1, 2, 3, 4, 5, 6, 7].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setRatings((prev) => ({ ...prev, [q.id]: v }))}
                        className={`w-10 h-10 rounded-full text-sm font-medium border transition-colors ${
                          ratings[q.id] === v
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <textarea
                  value={texts[q.id] ?? ''}
                  onChange={(e) => setTexts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="הזן את תשובתך כאן..."
                />
              )}
            </div>
          ))}

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? t('submitting') : t('submitButton')}
          </button>
        </form>
      </main>
    </div>
  )
}
