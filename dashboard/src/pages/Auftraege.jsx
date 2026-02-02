import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { AUFTRAG_STATUS, ERLAUBTE_TRANSITIONS, PRIORITAETEN, ZEITFENSTER } from '../lib/constants'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Plus, Search, Filter, X, ChevronDown, AlertTriangle, Clock, User, MapPin, Phone, FileText } from 'lucide-react'

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
  if (a.neukunde_name) return a.neukunde_name
  if (a.kunde) {
    const k = a.kunde
    return [k.firma, k.vorname, k.nachname].filter(Boolean).join(' ') || k.name || '–'
  }
  return '–'
}

function kundeAdresse(a) {
  if (a.adresse_strasse) {
    return [a.adresse_strasse, [a.adresse_plz, a.adresse_ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  }
  if (a.kunde) {
    const k = a.kunde
    return [k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  }
  return '–'
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

// ══════════════════════════════════════════════════════════
// AuftragDetailModal
// ══════════════════════════════════════════════════════════

function AuftragDetailModal({ auftrag, onClose, onRefresh }) {
  const a = auftrag
  if (!a) return null

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

  // ── Mannstärke ──
  const mannSection = useSectionSubmit(onRefresh)
  const [mannstaerke, setMannstaerke] = useState(a.mannstaerke != null ? String(a.mannstaerke) : '')

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-xl max-w-3xl w-full mx-auto my-8 max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 space-y-0">
          {/* 1. Header */}
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h2 className="text-lg font-bold text-gray-900">
              Auftrag #{String(a.id).slice(0, 8)}
            </h2>
            <StatusBadge status={a.status} />
            <PriorityBadge priority={a.prioritaet} />
          </div>
          <p className="text-sm text-gray-500">Erstellt: {formatDateTime(a.erstellt_am)}</p>

          {/* 2. Kunden-Info */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><User className="w-4 h-4" /> Kunde</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
              <div><span className="text-gray-500">Name:</span> {kundeName(a)}</div>
              <div className="flex items-start gap-1"><MapPin className="w-3.5 h-3.5 mt-0.5 text-gray-400 shrink-0" />{kundeAdresse(a)}</div>
              {(a.kunde?.telefon || a.neukunde_telefon) && (
                <div className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" />{a.kunde?.telefon || a.neukunde_telefon}</div>
              )}
              {a.kunde?.email && <div>{a.kunde.email}</div>}
            </div>
          </div>

          {/* 3. Beschreibung */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><FileText className="w-4 h-4" /> Beschreibung</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.beschreibung || '–'}</p>
            {a.notizen && (
              <div className="mt-2">
                <span className="text-xs font-medium text-gray-500">Notizen:</span>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{a.notizen}</p>
              </div>
            )}
          </div>

          {/* 4. Status ändern */}
          {transitions.length > 0 && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Status ändern</h3>
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
                    apiFetch(`/reparatur-api/reparatur/${a.id}/status`, { method: 'PATCH', body: { status: newStatus } })
                  )}
                >
                  {statusSection.submitting ? 'Speichern…' : 'Speichern'}
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
                    <option value="">– wählen –</option>
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
                  {terminSection.submitting ? 'Speichern…' : 'Speichern'}
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
                  B – Folgetermin nötig
                </label>
                <button
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={outcomeSection.submitting || !outcomeSv1}
                  onClick={() => outcomeSection.submit(() =>
                    apiFetch(`/reparatur-api/reparatur/${a.id}/outcome`, { method: 'PATCH', body: { outcome_sv1: outcomeSv1 } })
                  )}
                >
                  {outcomeSection.submitting ? 'Speichern…' : 'Speichern'}
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
                  {terminSv2Section.submitting ? 'Speichern…' : 'Speichern'}
                </button>
              </div>
              <SectionFeedback error={terminSv2Section.error} success={terminSv2Section.success} />
            </div>
          )}

          {/* 8. Mannstärke */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Mannstärke</h3>
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
                {mannSection.submitting ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
            <SectionFeedback error={mannSection.error} success={mannSection.success} />
          </div>
        </div>
      </div>
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
        body.kunde_code = selectedKunde.code || selectedKunde.kunde_code
        body.kunde_id = selectedKunde.id || selectedKunde.kunde_id
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
                <input placeholder="Straße" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" value={neukunde.strasse} onChange={e => setNeukunde({ ...neukunde, strasse: e.target.value })} />
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
                    placeholder="Kundenname suchen…"
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

          {/* Priorität */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Priorität</label>
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
              {submitting ? 'Erstellen…' : 'Auftrag erstellen'}
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
      .from('auftraege')
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

    // Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      list = list.filter(a =>
        (a.beschreibung || '').toLowerCase().includes(q) ||
        (a.adresse_strasse || '').toLowerCase().includes(q) ||
        (a.adresse_ort || '').toLowerCase().includes(q) ||
        (a.neukunde_name || '').toLowerCase().includes(q) ||
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
          <h1 className="text-2xl font-bold text-gray-900">Aufträge</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} von {auftraege.length} Aufträgen</p>
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
          placeholder="Suche nach Beschreibung, Adresse, Kunde…"
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
          <option value="">Alle Prioritäten</option>
          {Object.entries(PRIORITAETEN).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Loading / Error */}
      {loading && <p className="text-sm text-gray-500 py-8 text-center">Lade Aufträge…</p>}
      {error && <p className="text-sm text-red-600 py-4 text-center">{error}</p>}

      {/* Table */}
      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-500 py-12 text-center">Keine Aufträge gefunden.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
