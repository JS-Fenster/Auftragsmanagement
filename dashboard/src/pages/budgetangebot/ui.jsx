/**
 * Budgetangebot - Kleine UI-Komponenten
 *
 * Wann lesen: Wenn du StepIndicator, ConfidenceBadge oder EditableCell aendern musst.
 * Enthaelt: StepIndicator (Step-Navigation), ConfidenceBadge, EditableCell (inline-editing)
 */
import { useState } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { CONFIDENCE_CONFIG, parseNumber } from './constants'

// ── Step-Navigation ─────────────────────────────────────

export function StepIndicator({ currentStep, maxVisitedStep, onStepClick }) {
  const steps = [
    { num: 1, label: 'Eingabe' },
    { num: 2, label: 'Positionen' },
    { num: 3, label: 'Zusammenfassung' },
    { num: 4, label: 'Vorschau' },
  ]

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, idx) => {
        const isActive = currentStep === s.num
        const isCompleted = currentStep > s.num
        const isClickable = s.num <= maxVisitedStep

        return (
          <div key={s.num} className="flex items-center">
            <button
              onClick={() => isClickable && onStepClick(s.num)}
              disabled={!isClickable}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-50'
                  : isClickable
                    ? 'hover:bg-gray-100 cursor-pointer'
                    : 'cursor-not-allowed'
              }`}
              title={isClickable ? `Zu "${s.label}" springen` : 'Noch nicht freigeschaltet'}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : isCompleted
                      ? 'bg-green-600 text-white'
                      : isClickable
                        ? 'bg-gray-300 text-white'
                        : 'bg-gray-200 text-gray-400'
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span
                className={`text-sm hidden sm:inline ${
                  isActive
                    ? 'text-blue-700 font-medium'
                    : isCompleted
                      ? 'text-green-700 font-medium'
                      : isClickable
                        ? 'text-gray-600'
                        : 'text-gray-400'
                }`}
              >
                {s.label}
              </span>
            </button>
            {idx < steps.length - 1 && (
              <div
                className={`w-8 lg:w-16 h-0.5 mx-2 transition-colors ${
                  currentStep > s.num ? 'bg-green-400' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Konfidenz-Badge ─────────────────────────────────────

export function ConfidenceBadge({ confidence }) {
  const cfg = CONFIDENCE_CONFIG[confidence] || CONFIDENCE_CONFIG.medium
  const Icon = cfg.icon
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
      <Icon className="w-4 h-4" />
      Konfidenz: {cfg.label}
    </div>
  )
}

// ── Editierbare Tabellenzelle ───────────────────────────

export function EditableCell({ value, onChange, type = 'text', className = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))

  const commit = () => {
    setEditing(false)
    if (type === 'number') {
      onChange(parseNumber(draft))
    } else {
      onChange(draft)
    }
  }

  const cancel = () => {
    setEditing(false)
    setDraft(String(value ?? ''))
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type={type === 'number' ? 'number' : 'text'}
          className={`border border-blue-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') cancel()
          }}
          autoFocus
        />
        <button onClick={commit} className="text-green-600 hover:text-green-700 shrink-0">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={cancel} className="text-gray-400 hover:text-gray-600 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={`cursor-pointer group flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition-colors ${className}`}
      onClick={() => { setDraft(String(value ?? '')); setEditing(true) }}
    >
      <span className="text-sm">{type === 'number' && typeof value === 'number' ? value.toLocaleString('de-DE') : (value || '\u2013')}</span>
      <Pencil className="w-3 h-3 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
    </div>
  )
}
