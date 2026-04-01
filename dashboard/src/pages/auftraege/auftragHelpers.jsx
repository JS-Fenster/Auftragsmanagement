import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { AUFTRAG_STATUS, PRIORITAETEN } from '../../lib/constants'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

// ── UI Badges ──────────────────────────────────────────────

export function StatusBadge({ status }) {
  const s = AUFTRAG_STATUS[status] || AUFTRAG_STATUS.OFFEN
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  const p = PRIORITAETEN[priority]
  if (!p) return null
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{ color: p.color }}
    >
      {priority === 'HOCH' && '\u25B2 '}{p.label}
    </span>
  )
}

// ── Formatters ─────────────────────────────────────────────

export function formatDate(d) {
  if (!d) return '\u2013'
  try { return format(new Date(d), 'dd.MM.yyyy', { locale: de }) } catch { return '\u2013' }
}

export function formatDateTime(d) {
  if (!d) return '\u2013'
  try { return format(new Date(d), 'dd.MM.yyyy HH:mm', { locale: de }) } catch { return '\u2013' }
}

export function truncate(str, len = 60) {
  if (!str) return '\u2013'
  return str.length > len ? str.slice(0, len) + '\u2026' : str
}

// ── Kunde helpers ──────────────────────────────────────────

export function kundeName(a) {
  if (a.kunde_firma) return a.kunde_firma
  if (a.neukunde_name) return a.neukunde_name
  if (a.kunde) {
    const k = a.kunde
    return [k.firma1 || k.firma, k.vorname, k.nachname || k.name].filter(Boolean).join(' ') || '\u2013'
  }
  return '\u2013'
}

export function kundeAdresse(a) {
  if (a.adresse_strasse) {
    return [a.adresse_strasse, [a.adresse_plz, a.adresse_ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  }
  if (a.kunde_strasse_erp) {
    return [a.kunde_strasse_erp, [a.kunde_plz_erp, a.kunde_ort_erp].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  }
  if (a.kunde) {
    const k = a.kunde
    return [k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  }
  return '\u2013'
}

export function einsatzortAdresse(a) {
  if (a.einsatzort_strasse || a.einsatzort_ort) {
    return [a.einsatzort_strasse, [a.einsatzort_plz, a.einsatzort_ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  }
  return null
}

export function kundeTelefon(a) {
  if (a.kunde_telefon_erp) return a.kunde_telefon_erp
  if (a.neukunde_telefon) return a.neukunde_telefon
  return null
}

export function kundeEmail(a) {
  if (a.kunde_email_erp) return a.kunde_email_erp
  if (a.neukunde_email) return a.neukunde_email
  return null
}

// ── Hooks ──────────────────────────────────────────────────

export function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function useSectionSubmit(onRefresh) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const submit = useCallback(async (fn) => {
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    try {
      await fn()
      setSuccess(true)
      setTimeout(() => { onRefresh() }, 1500)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }, [onRefresh])

  return { submitting, error, success, submit }
}

export function SectionFeedback({ error, success, successMsg = 'Gespeichert' }) {
  if (error) return <p className="text-sm text-red-600 mt-1">{error}</p>
  if (success) return <p className="text-sm text-green-600 mt-1">{successMsg}</p>
  return null
}

// ── useFormWithUndo Hook ───────────────────────────────────

export function useFormWithUndo(initialValues) {
  const [values, setValues] = useState(initialValues)
  const originalRef = useRef(initialValues)
  const [undoStack, setUndoStack] = useState([])

  useEffect(() => {
    originalRef.current = initialValues
    setValues(initialValues)
    setUndoStack([])
  }, [JSON.stringify(initialValues)])

  const setValue = useCallback((field, newValue) => {
    setValues(prev => {
      const oldValue = prev[field]
      if (oldValue === newValue) return prev
      setUndoStack(stack => [...stack, { field, oldValue, newValue }])
      return { ...prev, [field]: newValue }
    })
  }, [])

  const undo = useCallback(() => {
    setUndoStack(stack => {
      if (stack.length === 0) return stack
      const last = stack[stack.length - 1]
      setValues(prev => ({ ...prev, [last.field]: last.oldValue }))
      return stack.slice(0, -1)
    })
  }, [])

  const dirtyFields = useMemo(() => {
    const dirty = {}
    for (const key of Object.keys(originalRef.current)) {
      if (values[key] !== originalRef.current[key]) {
        dirty[key] = { oldValue: originalRef.current[key], newValue: values[key] }
      }
    }
    return dirty
  }, [values])

  const isDirty = Object.keys(dirtyFields).length > 0
  const dirtyCount = Object.keys(dirtyFields).length

  const changedValues = useMemo(() => {
    const changed = {}
    for (const [key, { newValue }] of Object.entries(dirtyFields)) {
      changed[key] = newValue
    }
    return changed
  }, [dirtyFields])

  return {
    values,
    setValue,
    undo,
    undoStack,
    dirtyFields,
    isDirty,
    dirtyCount,
    changedValues,
  }
}

// ── Field Labels ───────────────────────────────────────────

export const FIELD_LABELS = {
  beschreibung: 'Beschreibung',
  prioritaet: 'Priorit\u00e4t',
  notizen: 'Notizen',
  auftragstyp: 'Auftragstyp',
  adresse_strasse: 'Stra\u00dfe',
  adresse_plz: 'PLZ',
  adresse_ort: 'Ort',
  erp_kunde_id: 'Bestandskunde',
  kunde_kategorie: 'Kundenkategorie',
  neukunde_name: 'Neukunde Name',
  neukunde_telefon: 'Neukunde Telefon',
  neukunde_email: 'Neukunde E-Mail',
  einsatzort_strasse: 'Einsatzort Stra\u00dfe',
  einsatzort_plz: 'Einsatzort PLZ',
  einsatzort_ort: 'Einsatzort Ort',
}

// ── UnsavedChangesDialog ───────────────────────────────────

export function UnsavedChangesDialog({ dirtyFields, onSaveAndClose, onDiscard, onBack }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60" />
      <div className="relative bg-surface-card rounded-xl max-w-md w-full shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-text-primary mb-3">Ungespeicherte {'\u00c4'}nderungen</h3>
        <p className="text-sm text-text-secondary mb-4">
          Es gibt {Object.keys(dirtyFields).length} ungespeicherte {'\u00c4'}nderung{Object.keys(dirtyFields).length !== 1 ? 'en' : ''}:
        </p>
        <ul className="text-sm text-text-primary space-y-1 mb-5 max-h-40 overflow-y-auto">
          {Object.entries(dirtyFields).map(([field, { oldValue, newValue }]) => (
            <li key={field} className="flex items-start gap-2">
              <span className="font-medium text-text-secondary shrink-0">{FIELD_LABELS[field] || field}:</span>
              <span className="text-red-500 line-through">{String(oldValue || '\u2013')}</span>
              <span className="text-text-muted">&rarr;</span>
              <span className="text-green-600">{String(newValue || '\u2013')}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
            onClick={onBack}
          >
            {`Zur\u00fcck`}
          </button>
          <button
            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded-lg"
            onClick={onDiscard}
          >
            Verwerfen
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-btn-primary text-white rounded-lg hover:bg-btn-primary-hover"
            onClick={onSaveAndClose}
          >
            Speichern & Schliessen
          </button>
        </div>
      </div>
    </div>
  )
}
