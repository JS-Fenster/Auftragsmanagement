import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { AUFTRAG_STATUS, ERLAUBTE_TRANSITIONS, PRIORITAETEN, ZEITFENSTER } from '../lib/constants'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Plus, Search, Filter, X, ChevronDown, AlertTriangle, Clock, User, MapPin, Phone, Mail, FileText, Undo2, Save } from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────

function StatusBadge({ status }) {
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

function PriorityBadge({ priority }) {
  const p = PRIORITAETEN[priority]
  if (!p) return null
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{ color: p.color }}
    >
      {priority === 'HOCH' && '▲ '}{p.label}
    </span>
  )
}

function formatDate(d) {
  if (!d) return '–'
  try { return format(new Date(d), 'dd.MM.yyyy', { locale: de }) } catch { return '–' }
}

function formatDateTime(d) {
  if (!d) return '–'
  try { return format(new Date(d), 'dd.MM.yyyy HH:mm', { locale: de }) } catch { return '–' }
}

function truncate(str, len = 60) {
  if (!str) return '–'
  return str.length > len ? str.slice(0, len) + '…' : str
}

function kundeName(a) {
  // 1. ERP-Kunde aus View (kunde_firma)
  if (a.kunde_firma) return a.kunde_firma
  // 2. Neukunde
  if (a.neukunde_name) return a.neukunde_name
  // 3. Legacy: kunde-Objekt (fuer NeuAuftragModal Dropdown-Anzeige)
  if (a.kunde) {
    const k = a.kunde
    return [k.firma1 || k.firma, k.vorname, k.nachname || k.name].filter(Boolean).join(' ') || '–'
  }
  return '–'
}

function kundeAdresse(a) {
  // 1. Eigene Adresse (adresse_strasse)
  if (a.adresse_strasse) {
    return [a.adresse_strasse, [a.adresse_plz, a.adresse_ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  }
  // 2. ERP-Adresse aus View
  if (a.kunde_strasse_erp) {
    return [a.kunde_strasse_erp, [a.kunde_plz_erp, a.kunde_ort_erp].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  }
  // 3. Neukunde-Felder (kein eigenes Adressfeld, nur bei Neukunde)
  // 4. Legacy: kunde-Objekt
  if (a.kunde) {
    const k = a.kunde
    return [k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  }
  return '–'
}

function kundeTelefon(a) {
  if (a.kunde_telefon_erp) return a.kunde_telefon_erp
  if (a.neukunde_telefon) return a.neukunde_telefon
  return null
}

function kundeEmail(a) {
  if (a.kunde_email_erp) return a.kunde_email_erp
  if (a.neukunde_email) return a.neukunde_email
  return null
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── Section submit hook ──────────────────────────────────

function useSectionSubmit(onRefresh) {
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

function SectionFeedback({ error, success, successMsg = 'Gespeichert' }) {
  if (error) return <p className="text-sm text-red-600 mt-1">{error}</p>
  if (success) return <p className="text-sm text-green-600 mt-1">{successMsg}</p>
  return null
}

// ── useFormWithUndo Hook ─────────────────────────────────

function useFormWithUndo(initialValues) {
  const [values, setValues] = useState(initialValues)
  const originalRef = useRef(initialValues)
  const [undoStack, setUndoStack] = useState([])

  // Reset wenn ein neuer Auftrag geoeffnet wird
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

  // Nur geaenderte Felder fuer API-Call
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

// ── Feldname-Labels ─────────────────────────────────────

const FIELD_LABELS = {
  beschreibung: 'Beschreibung',
  prioritaet: 'Prioritaet',
  notizen: 'Notizen',
  auftragstyp: 'Auftragstyp',
  adresse_strasse: 'Strasse',
  adresse_plz: 'PLZ',
  adresse_ort: 'Ort',
  erp_kunde_id: 'Bestandskunde',
  kunde_kategorie: 'Kundenkategorie',
  neukunde_name: 'Neukunde Name',
  neukunde_telefon: 'Neukunde Telefon',
  neukunde_email: 'Neukunde E-Mail',
}

// ══════════════════════════════════════════════════════════
// UnsavedChangesDialog
// ══════════════════════════════════════════════════════════

function UnsavedChangesDialog({ dirtyFields, onSaveAndClose, onDiscard, onBack }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60" />
      <div className="relative bg-white rounded-xl max-w-md w-full shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-3">Ungespeicherte Aenderungen</h3>
        <p className="text-sm text-gray-600 mb-4">
          Es gibt {Object.keys(dirtyFields).length} ungespeicherte Aenderung{Object.keys(dirtyFields).length !== 1 ? 'en' : ''}:
        </p>
        <ul className="text-sm text-gray-700 space-y-1 mb-5 max-h-40 overflow-y-auto">
          {Object.entries(dirtyFields).map(([field, { oldValue, newValue }]) => (
            <li key={field} className="flex items-start gap-2">
              <span className="font-medium text-gray-500 shrink-0">{FIELD_LABELS[field] || field}:</span>
              <span className="text-red-500 line-through">{String(oldValue || '–')}</span>
              <span className="text-gray-400">&rarr;</span>
              <span className="text-green-600">{String(newValue || '–')}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            onClick={onBack}
          >
            Zurueck
          </button>
          <button
            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded-lg"
            onClick={onDiscard}
          >
            Verwerfen
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            onClick={onSaveAndClose}
          >
            Speichern & Schliessen
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// AuftragDetailModal
// ══════════════════════════════════════════════════════════

function AuftragDetailModal({ auftrag, onClose, onRefresh }) {
  const a = auftrag
  if (!a) return null

  // ── Dirty-State Form ──
  const form = useFormWithUndo({
    beschreibung: a.beschreibung || '',
    prioritaet: a.prioritaet || 'NORMAL',
    notizen: a.notizen || '',
    auftragstyp: a.auftragstyp || 'Reparaturauftrag',
    kunde_kategorie: a.kunde_kategorie || 'BESTANDSKUNDE',
    erp_kunde_id: a.erp_kunde_id || null,
    neukunde_name: a.neukunde_name || '',
    neukunde_telefon: a.neukunde_telefon || '',
    neukunde_email: a.neukunde_email || '',
  })

  // ── Kundensuche fuer Bestandskunde wechseln ──
  const [kundeSearch, setKundeSearch] = useState('')
  const [kundeResults, setKundeResults] = useState([])
  const [selectedKundeName, setSelectedKundeName] = useState(a.kunde_firma || '')
  const debouncedKundeSearch = useDebounce(kundeSearch, 300)

  useEffect(() => {
    if (!debouncedKundeSearch || debouncedKundeSearch.length < 2) {
      setKundeResults([])
      return
    }
    let cancelled = false
    apiFetch(`/reparatur-api/kunden?q=${encodeURIComponent(debouncedKundeSearch)}`)
      .then(data => { if (!cancelled) setKundeResults(Array.isArray(data) ? data : data.kunden || []) })
      .catch(() => { if (!cancelled) setKundeResults([]) })
    return () => { cancelled = true }
  }, [debouncedKundeSearch])

  // ── Unsaved Changes Dialog ──
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  // ── Save Handler ──
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleSave = useCallback(async (closeAfter = false) => {
    if (!form.isDirty) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await apiFetch(`/reparatur-api/reparatur/${a.id}/update`, {
        method: 'PATCH',
        body: form.changedValues,
      })
      setSaveSuccess(true)
      setTimeout(() => {
        onRefresh()
        if (closeAfter) onClose()
      }, 500)
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }, [a.id, form.isDirty, form.changedValues, onRefresh, onClose])

  // ── Close Handler ──
  const handleClose = useCallback(() => {
    if (form.isDirty) {
      setShowUnsavedDialog(true)
    } else {
      onClose()
    }
  }, [form.isDirty, onClose])

  // ── Status ──
  const statusSection = useSectionSubmit(onRefresh)
  const transitions = ERLAUBTE_TRANSITIONS[a.status] || []
  const [newStatus, setNewStatus] = useState(transitions[0] || '')

  // ── Termin SV1 ──
  const terminSection = useSectionSubmit(onRefresh)
  const [terminSv1, setTerminSv1] = useState(a.termin_sv1 ? a.termin_sv1.slice(0, 10) : '')
  const [zeitfenster, setZeitfenster] = useState(a.zeitfenster || '')

  // ── Outcome SV1 ──
  const outcomeSection = useSectionSubmit(onRefresh)
  const [outcomeSv1, setOutcomeSv1] = useState(a.outcome_sv1 || '')

  // ── Termin SV2 ──
  const terminSv2Section = useSectionSubmit(onRefresh)
  const [terminSv2, setTerminSv2] = useState(a.termin_sv2 ? a.termin_sv2.slice(0, 10) : '')

  // ── Mannstaerke ──
  const mannSection = useSectionSubmit(onRefresh)
  const [mannstaerke, setMannstaerke] = useState(a.mannstaerke != null ? String(a.mannstaerke) : '')

  // Dirty-Feld-Highlight-Style
  const dirtyBg = (field) => form.dirtyFields[field] ? 'bg-yellow-50 ring-1 ring-yellow-300' : ''

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4" onClick={handleClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-xl max-w-3xl w-full mx-auto my-8 max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 space-y-0">
          {/* 1. Header - Auftragsnummer statt UUID */}
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h2 className="text-lg font-bold text-gray-900">
              Auftrag {a.auftragsnummer || `#${String(a.id).slice(0, 8)}`}
            </h2>
            <StatusBadge status={a.status} />
            <PriorityBadge priority={a.prioritaet} />
            {/* Undo-Button */}
            {form.undoStack.length > 0 && (
              <button
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                onClick={form.undo}
                title="Letzte Aenderung rueckgaengig"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Zurueck ({form.undoStack.length})
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500">Erstellt: {formatDateTime(a.erstellt_am)}</p>

          {/* 2. Kunden-Info */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><User className="w-4 h-4" /> Kunde</h3>

            {/* Kundenkategorie-Toggle */}
            <div className="flex items-center gap-2 mb-3">
              <button
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${form.values.kunde_kategorie === 'BESTANDSKUNDE' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                onClick={() => form.setValue('kunde_kategorie', 'BESTANDSKUNDE')}
              >
                Bestandskunde
              </button>
              <button
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${form.values.kunde_kategorie === 'NEUKUNDE' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                onClick={() => form.setValue('kunde_kategorie', 'NEUKUNDE')}
              >
                Neukunde
              </button>
            </div>

            {form.values.kunde_kategorie === 'BESTANDSKUNDE' ? (
              <div className="space-y-2">
                {/* Kundensuche */}
                <div className="relative">
                  <div className={`flex items-center border border-gray-300 rounded-lg px-3 py-1.5 ${dirtyBg('erp_kunde_id')}`}>
                    <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                    <input
                      className="flex-1 text-sm outline-none bg-transparent"
                      placeholder="Bestandskunde suchen..."
                      value={form.values.erp_kunde_id ? selectedKundeName : kundeSearch}
                      onChange={e => {
                        setKundeSearch(e.target.value)
                        if (form.values.erp_kunde_id) {
                          form.setValue('erp_kunde_id', null)
                          setSelectedKundeName('')
                        }
                      }}
                    />
                    {form.values.erp_kunde_id && (
                      <button onClick={() => { form.setValue('erp_kunde_id', null); setSelectedKundeName(''); setKundeSearch('') }} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {kundeResults.length > 0 && !form.values.erp_kunde_id && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {kundeResults.map((k, i) => (
                        <button
                          key={k.code || k.id || i}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                          onClick={() => {
                            if (k.quelle === 'erp' && k.code) {
                              form.setValue('erp_kunde_id', k.code)
                              setSelectedKundeName(k.firma1 || k.name || '')
                            }
                            setKundeResults([])
                            setKundeSearch('')
                          }}
                        >
                          <div className="font-medium">{k.firma1 || k.name || '–'}</div>
                          <div className="text-xs text-gray-500">{[k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Aktuelle Kundeninfo anzeigen */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                  <div><span className="text-gray-500">Name:</span> {kundeName(a)}</div>
                  <div className="flex items-start gap-1"><MapPin className="w-3.5 h-3.5 mt-0.5 text-gray-400 shrink-0" />{kundeAdresse(a)}</div>
                  {kundeTelefon(a) && (
                    <div className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" />{kundeTelefon(a)}</div>
                  )}
                  {kundeEmail(a) && (
                    <div className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-gray-400" />{kundeEmail(a)}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  placeholder="Name *"
                  className={`border border-gray-300 rounded-lg px-3 py-1.5 text-sm ${dirtyBg('neukunde_name')}`}
                  value={form.values.neukunde_name}
                  onChange={e => form.setValue('neukunde_name', e.target.value)}
                />
                <input
                  placeholder="Telefon"
                  className={`border border-gray-300 rounded-lg px-3 py-1.5 text-sm ${dirtyBg('neukunde_telefon')}`}
                  value={form.values.neukunde_telefon}
                  onChange={e => form.setValue('neukunde_telefon', e.target.value)}
                />
                <input
                  placeholder="E-Mail"
                  className={`border border-gray-300 rounded-lg px-3 py-1.5 text-sm ${dirtyBg('neukunde_email')}`}
                  value={form.values.neukunde_email}
                  onChange={e => form.setValue('neukunde_email', e.target.value)}
                />
              </div>
            )}
          </div>

          {/* 3. Beschreibung (editierbar) */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><FileText className="w-4 h-4" /> Beschreibung</h3>
            <textarea
              className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[80px] ${dirtyBg('beschreibung')}`}
              placeholder="Beschreibung des Auftrags..."
              value={form.values.beschreibung}
              onChange={e => form.setValue('beschreibung', e.target.value)}
            />
          </div>

          {/* 3b. Prioritaet (editierbar) */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Prioritaet</h3>
            <select
              className={`border border-gray-300 rounded-lg px-3 py-1.5 text-sm ${dirtyBg('prioritaet')}`}
              value={form.values.prioritaet}
              onChange={e => form.setValue('prioritaet', e.target.value)}
            >
              {Object.entries(PRIORITAETEN).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* 3c. Notizen (editierbar) */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Notizen</h3>
            <textarea
              className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[60px] ${dirtyBg('notizen')}`}
              placeholder="Interne Notizen..."
              value={form.values.notizen}
              onChange={e => form.setValue('notizen', e.target.value)}
            />
          </div>

          {/* Save-Feedback */}
          {saveError && <p className="text-sm text-red-600 mt-2">{saveError}</p>}
          {saveSuccess && <p className="text-sm text-green-600 mt-2">Aenderungen gespeichert!</p>}

          {/* Speichern-Button (nur wenn dirty) */}
          {form.isDirty && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                disabled={saving}
                onClick={() => handleSave(false)}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Speichern...' : `${form.dirtyCount} Aenderung${form.dirtyCount !== 1 ? 'en' : ''} speichern`}
              </button>
            </div>
          )}

          {/* 4. Status aendern */}
          {transitions.length > 0 && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Status aendern</h3>
              <div className="flex items-center gap-2">
                <select
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                >
                  {transitions.map(t => (
                    <option key={t} value={t}>{AUFTRAG_STATUS[t]?.label || t}</option>
                  ))}
                </select>
                <button
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={statusSection.submitting || !newStatus}
                  onClick={() => statusSection.submit(() =>
                    apiFetch(`/reparatur-api/reparatur/${a.id}/status`, { method: 'PATCH', body: { neuer_status: newStatus } })
                  )}
                >
                  {statusSection.submitting ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
              <SectionFeedback error={statusSection.error} success={statusSection.success} />
            </div>
          )}

          {/* 5. Termin SV1 */}
          {['IN_BEARBEITUNG', 'TERMIN_RESERVIERT', 'NICHT_BESTAETIGT', 'NO_SHOW'].includes(a.status) && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><Clock className="w-4 h-4" /> Termin SV1</h3>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Datum</label>
                  <input
                    type="date"
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    value={terminSv1}
                    onChange={e => setTerminSv1(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Zeitfenster</label>
                  <select
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    value={zeitfenster}
                    onChange={e => setZeitfenster(e.target.value)}
                  >
                    <option value="">– waehlen –</option>
                    {Object.entries(ZEITFENSTER).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={terminSection.submitting || !terminSv1}
                  onClick={() => terminSection.submit(() =>
                    apiFetch(`/reparatur-api/reparatur/${a.id}/termin`, { method: 'PATCH', body: { termin_sv1: terminSv1, zeitfenster } })
                  )}
                >
                  {terminSection.submitting ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
              <SectionFeedback error={terminSection.error} success={terminSection.success} />
            </div>
          )}

          {/* 6. Outcome SV1 */}
          {['TERMIN_FIX', 'ERLEDIGT'].includes(a.status) && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Ergebnis SV1</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name="outcome" value="A" checked={outcomeSv1 === 'A'} onChange={() => setOutcomeSv1('A')} />
                  A – Sofort erledigt
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name="outcome" value="B" checked={outcomeSv1 === 'B'} onChange={() => setOutcomeSv1('B')} />
                  B – Folgetermin noetig
                </label>
                <button
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={outcomeSection.submitting || !outcomeSv1}
                  onClick={() => outcomeSection.submit(() =>
                    apiFetch(`/reparatur-api/reparatur/${a.id}/outcome`, { method: 'PATCH', body: { outcome_sv1: outcomeSv1 } })
                  )}
                >
                  {outcomeSection.submitting ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
              <SectionFeedback error={outcomeSection.error} success={outcomeSection.success} />
            </div>
          )}

          {/* 7. Termin SV2 */}
          {a.outcome_sv1 === 'B' && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><Clock className="w-4 h-4" /> Termin SV2</h3>
              <div className="flex items-end gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Datum</label>
                  <input
                    type="date"
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    value={terminSv2}
                    onChange={e => setTerminSv2(e.target.value)}
                  />
                </div>
                <button
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={terminSv2Section.submitting || !terminSv2}
                  onClick={() => terminSv2Section.submit(() =>
                    apiFetch(`/reparatur-api/reparatur/${a.id}/termin-sv2`, { method: 'PATCH', body: { termin_sv2: terminSv2 } })
                  )}
                >
                  {terminSv2Section.submitting ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
              <SectionFeedback error={terminSv2Section.error} success={terminSv2Section.success} />
            </div>
          )}

          {/* 8. Mannstaerke */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Mannstaerke</h3>
            <div className="flex items-center gap-2">
              <select
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                value={mannstaerke}
                onChange={e => setMannstaerke(e.target.value)}
              >
                <option value="">unbekannt</option>
                <option value="1">1 Person</option>
                <option value="2">2 Personen</option>
              </select>
              <button
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={mannSection.submitting}
                onClick={() => mannSection.submit(() =>
                  apiFetch(`/reparatur-api/reparatur/${a.id}/mannstaerke`, {
                    method: 'PATCH',
                    body: { mannstaerke: mannstaerke ? Number(mannstaerke) : null }
                  })
                )}
              >
                {mannSection.submitting ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
            <SectionFeedback error={mannSection.error} success={mannSection.success} />
          </div>
        </div>
      </div>

      {/* Unsaved Changes Dialog */}
      {showUnsavedDialog && (
        <UnsavedChangesDialog
          dirtyFields={form.dirtyFields}
          onSaveAndClose={() => { setShowUnsavedDialog(false); handleSave(true) }}
          onDiscard={() => { setShowUnsavedDialog(false); onClose() }}
          onBack={() => setShowUnsavedDialog(false)}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// NeuAuftragModal
// ══════════════════════════════════════════════════════════

function NeuAuftragModal({ onClose, onRefresh }) {
  const [kundeSearch, setKundeSearch] = useState('')
  const [kundeResults, setKundeResults] = useState([])
  const [selectedKunde, setSelectedKunde] = useState(null)
  const [neukundeMode, setNeukundeMode] = useState(false)
  const [neukunde, setNeukunde] = useState({ name: '', telefon: '', strasse: '', plz: '', ort: '' })
  const [prioritaet, setPrioritaet] = useState('NORMAL')
  const [beschreibung, setBeschreibung] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const debouncedSearch = useDebounce(kundeSearch, 300)

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2 || neukundeMode) {
      setKundeResults([])
      return
    }
    let cancelled = false
    apiFetch(`/reparatur-api/kunden?q=${encodeURIComponent(debouncedSearch)}`)
      .then(data => { if (!cancelled) setKundeResults(Array.isArray(data) ? data : data.kunden || []) })
      .catch(() => { if (!cancelled) setKundeResults([]) })
    return () => { cancelled = true }
  }, [debouncedSearch, neukundeMode])

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const body = {
        beschreibung,
        prioritaet,
        kunde_kategorie: neukundeMode ? 'NEUKUNDE' : 'BESTANDSKUNDE',
      }
      if (neukundeMode) {
        body.neukunde_name = neukunde.name
        body.neukunde_telefon = neukunde.telefon
        body.adresse_strasse = neukunde.strasse
        body.adresse_plz = neukunde.plz
        body.adresse_ort = neukunde.ort
      } else if (selectedKunde) {
        if (selectedKunde.quelle === 'manuell') {
          body.manuelle_kunde_id = selectedKunde.id
        } else {
          body.erp_kunde_id = selectedKunde.code
        }
      }
      await apiFetch('/reparatur-api/reparatur', { method: 'POST', body })
      onRefresh()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-xl max-w-3xl w-full mx-auto my-8 max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Neuer Auftrag</h2>

          {/* Kundensuche */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Kunde</label>
              <button
                className="text-xs text-blue-600 hover:underline"
                onClick={() => { setNeukundeMode(!neukundeMode); setSelectedKunde(null) }}
              >
                {neukundeMode ? 'Bestandskunde suchen' : 'Neukunde anlegen'}
              </button>
            </div>

            {neukundeMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input placeholder="Name *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" value={neukunde.name} onChange={e => setNeukunde({ ...neukunde, name: e.target.value })} />
                <input placeholder="Telefon" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" value={neukunde.telefon} onChange={e => setNeukunde({ ...neukunde, telefon: e.target.value })} />
                <input placeholder="Strasse" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" value={neukunde.strasse} onChange={e => setNeukunde({ ...neukunde, strasse: e.target.value })} />
                <div className="flex gap-2">
                  <input placeholder="PLZ" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24" value={neukunde.plz} onChange={e => setNeukunde({ ...neukunde, plz: e.target.value })} />
                  <input placeholder="Ort" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1" value={neukunde.ort} onChange={e => setNeukunde({ ...neukunde, ort: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center border border-gray-300 rounded-lg px-3 py-1.5">
                  <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                  <input
                    className="flex-1 text-sm outline-none"
                    placeholder="Kundenname suchen..."
                    value={selectedKunde ? kundeName({ kunde: selectedKunde }) : kundeSearch}
                    onChange={e => { setKundeSearch(e.target.value); setSelectedKunde(null) }}
                  />
                  {selectedKunde && (
                    <button onClick={() => { setSelectedKunde(null); setKundeSearch('') }} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {kundeResults.length > 0 && !selectedKunde && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {kundeResults.map((k, i) => (
                      <button
                        key={k.id || k.code || i}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        onClick={() => { setSelectedKunde(k); setKundeResults([]) }}
                      >
                        <div className="font-medium">{kundeName({ kunde: k })}</div>
                        <div className="text-xs text-gray-500">{kundeAdresse({ kunde: k })}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prioritaet */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Prioritaet</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              value={prioritaet}
              onChange={e => setPrioritaet(e.target.value)}
            >
              {Object.entries(PRIORITAETEN).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Beschreibung */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung *</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[100px]"
              placeholder="Was soll gemacht werden?"
              value={beschreibung}
              onChange={e => setBeschreibung(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Abbrechen</button>
            <button
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting || !beschreibung || (!selectedKunde && !neukundeMode) || (neukundeMode && !neukunde.name)}
              onClick={handleSubmit}
            >
              {submitting ? 'Erstellen...' : 'Auftrag erstellen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════

export default function Auftraege() {
  const [auftraege, setAuftraege] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [activeStatuses, setActiveStatuses] = useState([])
  const [priorityFilter, setPriorityFilter] = useState('')

  // Modals
  const [selectedAuftrag, setSelectedAuftrag] = useState(null)
  const [showNeu, setShowNeu] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('v_auftraege')
      .select('*')
      .order('erstellt_am', { ascending: false })
      .then(({ data, error: err }) => {
        if (!cancelled) {
          if (err) { setError(err.message) } else { setAuftraege(data || []); setError(null) }
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
    setSelectedAuftrag(null)
  }, [])

  const debouncedSearch = useDebounce(search, 200)

  const filtered = useMemo(() => {
    let list = [...auftraege]

    // Search - inkl. Auftragsnummer
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      list = list.filter(a =>
        (a.auftragsnummer || '').toLowerCase().includes(q) ||
        (a.beschreibung || '').toLowerCase().includes(q) ||
        (a.adresse_strasse || '').toLowerCase().includes(q) ||
        (a.adresse_ort || '').toLowerCase().includes(q) ||
        (a.neukunde_name || '').toLowerCase().includes(q) ||
        (a.kunde_firma || '').toLowerCase().includes(q) ||
        kundeName(a).toLowerCase().includes(q)
      )
    }

    // Status filter
    if (activeStatuses.length > 0) {
      list = list.filter(a => activeStatuses.includes(a.status))
    }

    // Priority filter
    if (priorityFilter) {
      list = list.filter(a => a.prioritaet === priorityFilter)
    }

    // Sort: priority DESC, ist_zu_lange_offen DESC, created_at ASC
    const prioOrder = { HOCH: 0, MITTEL: 1, NORMAL: 2 }
    list.sort((a, b) => {
      const pa = prioOrder[a.prioritaet] ?? 2
      const pb = prioOrder[b.prioritaet] ?? 2
      if (pa !== pb) return pa - pb
      const oa = a.ist_zu_lange_offen ? 0 : 1
      const ob = b.ist_zu_lange_offen ? 0 : 1
      if (oa !== ob) return oa - ob
      return new Date(a.erstellt_am) - new Date(b.erstellt_am)
    })

    return list
  }, [auftraege, debouncedSearch, activeStatuses, priorityFilter])

  const toggleStatus = (s) => {
    setActiveStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auftraege</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} von {auftraege.length} Auftraegen</p>
        </div>
        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          onClick={() => setShowNeu(true)}
        >
          <Plus className="w-4 h-4" /> Neuer Auftrag
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 mb-4 bg-white">
        <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
        <input
          className="flex-1 text-sm outline-none"
          placeholder="Suche nach Nr., Beschreibung, Adresse, Kunde..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-gray-400" />
        {Object.entries(AUFTRAG_STATUS).map(([key, val]) => {
          const active = activeStatuses.includes(key)
          return (
            <button
              key={key}
              className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
              style={{
                backgroundColor: active ? val.bg : 'transparent',
                color: active ? val.text : '#6B7280',
                borderColor: active ? val.color : '#D1D5DB',
              }}
              onClick={() => toggleStatus(key)}
            >
              {val.label}
            </button>
          )
        })}
        <select
          className="ml-2 border border-gray-300 rounded-lg px-2 py-1 text-xs"
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
        >
          <option value="">Alle Prioritaeten</option>
          {Object.entries(PRIORITAETEN).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Loading / Error */}
      {loading && <p className="text-sm text-gray-500 py-8 text-center">Lade Auftraege...</p>}
      {error && <p className="text-sm text-red-600 py-4 text-center">{error}</p>}

      {/* Table */}
      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-500 py-12 text-center">Keine Auftraege gefunden.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Nr.</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Prio</th>
                  <th className="px-4 py-3">Kunde</th>
                  <th className="px-4 py-3 hidden md:table-cell">Adresse</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Beschreibung</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Termin</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(a => (
                  <tr
                    key={a.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedAuftrag(a)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{a.auftragsnummer || '–'}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3"><PriorityBadge priority={a.prioritaet} /></td>
                    <td className="px-4 py-3 font-medium text-gray-900">{truncate(kundeName(a), 30)}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{truncate(kundeAdresse(a), 40)}</td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{truncate(a.beschreibung, 50)}</td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell whitespace-nowrap">{formatDate(a.termin_sv1)}</td>
                    <td className="px-4 py-3">
                      {a.ist_zu_lange_offen && (
                        <AlertTriangle className="w-4 h-4 text-amber-500" title="Zu lange offen" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modals */}
      {selectedAuftrag && (
        <AuftragDetailModal
          auftrag={selectedAuftrag}
          onClose={() => setSelectedAuftrag(null)}
          onRefresh={refresh}
        />
      )}
      {showNeu && (
        <NeuAuftragModal
          onClose={() => setShowNeu(false)}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}
