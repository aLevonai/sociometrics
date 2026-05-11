'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'

export default function CsvUpload() {
  const t = useTranslations('admin')
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setStatus('uploading')
    const text = await file.text()

    const res = await fetch('/api/admin/employees/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: text }),
    })

    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      setStatus('success')
      setMessage(t('uploadSuccess', { count: data.count ?? 0 }))
      if (fileRef.current) fileRef.current.value = ''
    } else {
      setStatus('error')
      setMessage(data.error || t('uploadError'))
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 font-mono leading-relaxed">
        <p className="font-semibold text-gray-600 mb-1">פורמט CSV:</p>
        <p>id, name, email, year, company, role [, team] [, assigned_year, assigned_company, assigned_team]</p>
        <p className="mt-1 text-gray-400">
          role: soldier | team_leader | company_commander | year_commander | super_commander
        </p>
        <p className="text-gray-400">
          מ&quot;כ שנה ג&apos;: מלא assigned_year + assigned_company + assigned_team
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            required
          />
        </div>
        <button
          type="submit"
          disabled={status === 'uploading'}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {status === 'uploading' ? t('uploading') : t('uploadButton')}
        </button>
      </form>

      {status === 'success' && <p className="text-green-600 text-sm">{message}</p>}
      {status === 'error' && <p className="text-red-500 text-sm">{message}</p>}
    </div>
  )
}
