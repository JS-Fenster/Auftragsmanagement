import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase'
import {
  Sparkles,
  Loader2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Info,
  FileText,
  Download,
  Mail,
  RotateCcw,
  Pencil,
  Check,
  X,
  Euro,
  ArrowRight,
  ArrowLeft,
  Search,
  Users,
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────

const SYSTEME = [
  { value: '', label: 'Automatisch (KI entscheidet)' },
  { value: 'CASTELLO', label: 'CASTELLO' },
  { value: 'CALIDO', label: 'CALIDO' },
  { value: 'IMPREO', label: 'IMPREO' },
  { value: 'AFINO', label: 'AFINO' },
]

const MWST_SATZ = 0.19

const FIRMA_INFO = {
  firma: 'J.S. Fenster & Tueren GmbH',
  strasse: 'Regensburger Strasse 59',
  plz_ort: '92224 Amberg',
  telefon: '09621 / 76 35 33',
  fax: '09621 / 78 32 59',
  email: 'info@js-fenster.de',
  web: 'www.js-fenster.de',
}

const CONFIDENCE_CONFIG = {
  high: { label: 'Hoch', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle },
  medium: { label: 'Mittel', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle },
  low: { label: 'Niedrig', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle },
}

// ── Helpers ──────────────────────────────────────────────

function formatEuro(value) {
  if (value == null || isNaN(value)) return '0,00 \u20AC'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatPreis(betrag, showNetto, opts = {}) {
  const { decimals = 0, suffix = ' EUR', isNetto = false } = opts
  if (betrag == null || isNaN(betrag)) return '-'
  let wert
  if (isNetto) {
    wert = showNetto ? betrag : betrag * (1 + MWST_SATZ)
  } else {
    wert = showNetto ? betrag / (1 + MWST_SATZ) : betrag
  }
  return wert.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + suffix
}

function toDisplayValue(betrag, showNetto, isNetto = false) {
  if (betrag == null || isNaN(betrag)) return 0
  if (isNetto) return showNetto ? betrag : betrag * (1 + MWST_SATZ)
  return showNetto ? betrag / (1 + MWST_SATZ) : betrag
}

function parseNumber(str) {
  if (str == null) return 0
  const cleaned = String(str).replace(/\./g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function generateTempId() {
  return 'pos_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

// ── Sub-Components ───────────────────────────────────────

function StepIndicator({ currentStep, maxVisitedStep, onStepClick }) {
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

function ConfidenceBadge({ confidence }) {
  const cfg = CONFIDENCE_CONFIG[confidence] || CONFIDENCE_CONFIG.medium
  const Icon = cfg.icon
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
      <Icon className="w-4 h-4" />
      Konfidenz: {cfg.label}
    </div>
  )
}

function EditableCell({ value, onChange, type = 'text', className = '' }) {
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

// ── Kunden-Suche Helper ─────────────────────────────────

async function searchKontakte(term) {
  if (!term || term.trim().length < 2) return []

  // Multi-Term: "Andreas Kropfersricht" → ['andreas', 'kropfersricht']
  const terms = term.trim().split(/\s+/).filter(t => t.length >= 2)
  if (terms.length === 0) return []

  const KONTAKTE_SELECT = 'id, firma1, firma2, strasse, plz, ort, erp_kunden_code, kontakt_personen!kontakt_id(id, vorname, nachname, ist_hauptkontakt, kontakt_details(typ, wert, ist_primaer))'

  // Build OR filters covering ALL terms across all fields
  const kontakteOr = terms.flatMap(t => {
    const p = `%${t}%`
    return [`firma1.ilike.${p}`, `firma2.ilike.${p}`, `ort.ilike.${p}`, `plz.ilike.${p}`, `strasse.ilike.${p}`]
  }).join(',')

  const personenOr = terms.flatMap(t => {
    const p = `%${t}%`
    return [`vorname.ilike.${p}`, `nachname.ilike.${p}`]
  }).join(',')

  // For details, search each term
  const detailsOr = terms.map(t => `%${t}%`)

  const queries = [
    supabase.from('kontakte').select(KONTAKTE_SELECT).or(kontakteOr).limit(80),
    supabase.from('kontakt_personen').select('kontakt_id, vorname, nachname').or(personenOr).limit(50),
  ]
  // kontakt_details: ilike only accepts one pattern, so search with first term
  // (multi-term filtering happens client-side)
  queries.push(
    supabase.from('kontakt_details')
      .select('kontakt_person_id, wert, kontakt_personen!inner(kontakt_id)')
      .ilike('wert', detailsOr[0])
      .limit(50)
  )

  const [kontakteRes, personenRes, detailsRes] = await Promise.all(queries)

  const kontaktMap = new Map()
  for (const k of (kontakteRes.data || [])) kontaktMap.set(k.id, k)

  const missingIds = new Set()
  for (const p of (personenRes.data || [])) {
    if (!kontaktMap.has(p.kontakt_id)) missingIds.add(p.kontakt_id)
  }
  for (const d of (detailsRes.data || [])) {
    const kid = d.kontakt_personen?.kontakt_id
    if (kid && !kontaktMap.has(kid)) missingIds.add(kid)
  }

  if (missingIds.size > 0) {
    const { data: extra } = await supabase.from('kontakte')
      .select(KONTAKTE_SELECT)
      .in('id', Array.from(missingIds))
    for (const k of (extra || [])) kontaktMap.set(k.id, k)
  }

  // Transform to display format
  const results = Array.from(kontaktMap.values()).map(k => {
    const personen = k.kontakt_personen || []
    const haupt = personen.find(p => p.ist_hauptkontakt) || personen[0]
    const allDetails = personen.flatMap(p => p.kontakt_details || [])
    const telefon = allDetails.find(d => d.typ === 'telefon' && d.ist_primaer)?.wert
      || allDetails.find(d => d.typ === 'telefon')?.wert || ''
    const email = allDetails.find(d => d.typ === 'email' && d.ist_primaer)?.wert
      || allDetails.find(d => d.typ === 'email')?.wert || ''
    const displayName = haupt
      ? `${haupt.nachname || ''}${haupt.vorname ? ', ' + haupt.vorname : ''}`.trim()
      : k.firma1 || ''

    return {
      kontakt_id: k.id,
      display_name: displayName,
      firma: k.firma1 || '',
      firma2: k.firma2 || '',
      strasse: k.strasse || '',
      ort: k.ort || '',
      plz: k.plz || '',
      telefon,
      email,
      personen: personen.map(p => ({ vorname: p.vorname || '', nachname: p.nachname || '' })),
    }
  })

  // Client-side AND-Filter: JEDES Suchwort muss irgendwo im Kontakt vorkommen
  if (terms.length > 1) {
    return results.filter(r => {
      const haystack = [
        r.display_name, r.firma, r.firma2, r.strasse, r.ort, r.plz,
        r.telefon, r.email,
        ...r.personen.map(p => `${p.vorname} ${p.nachname}`),
      ].join(' ').toLowerCase()
      return terms.every(t => haystack.includes(t.toLowerCase()))
    }).slice(0, 50)
  }

  return results.slice(0, 50)
}

// ── Kunden-Suchmodal ────────────────────────────────────

function KundenSuchModal({ onSelect, onClose }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!term || term.length < 2) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchKontakte(term)
        setResults(res)
      } catch (err) {
        console.error('Kundensuche Fehler:', err)
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timerRef.current)
  }, [term])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col m-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Kunde suchen
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Name, Firma, Telefon oder E-Mail suchen..."
              value={term}
              onChange={e => setTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="ml-2 text-sm text-gray-500">Suche...</span>
            </div>
          )}
          {!loading && results.length === 0 && term.length >= 2 && (
            <div className="text-center py-8 text-sm text-gray-500">Keine Kunden gefunden</div>
          )}
          {!loading && results.length === 0 && term.length < 2 && (
            <div className="text-center py-8 text-sm text-gray-400">Mindestens 2 Zeichen eingeben</div>
          )}
          {!loading && results.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Firma</th>
                  <th className="px-4 py-2">Ort</th>
                  <th className="px-4 py-2">Telefon</th>
                  <th className="px-4 py-2">E-Mail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map(r => (
                  <tr
                    key={r.kontakt_id}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => onSelect(r)}
                  >
                    <td className="px-4 py-2 font-medium text-gray-900">{r.display_name || '-'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.firma || '-'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.ort || '-'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.telefon || '-'}</td>
                    <td className="px-4 py-2 text-gray-600 truncate max-w-[180px]">{r.email || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Step 1: Freitext-Eingabe ─────────────────────────────

function StepEingabe({
  inputText,
  setInputText,
  kundenInfo,
  setKundenInfo,
  showKundenInfo,
  setShowKundenInfo,
  selectedSystem,
  setSelectedSystem,
  montageOptions,
  setMontageOptions,
  loading,
  error,
  onSubmit,
  // Kunden-Autocomplete props
  kundenSuche,
  setKundenSuche,
  kundenVorschlaege,
  kundenLoading,
  selectedKontaktId,
  onKundenSearch,
  onKundeSelect,
  onKundeReset,
  showKundenModal,
  setShowKundenModal,
}) {
  return (
    <div className="space-y-6">
      {/* Textarea Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Beschreibung der gewuenschten Fenster und Tueren
        </label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm min-h-[180px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
          placeholder={'Beschreiben Sie die gewuenschten Fenster und Tueren...\n\nBeispiel:\nWohnzimmer: 2x Fenster 1230x1480 mit Rollladen\nKueche: 1x Fenster 980x1180\nFlur: 1x Haustuer 1100x2100'}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          rows={6}
        />
      </div>

      {/* Kundeninfo (collapsible) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <button
          className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors rounded-lg"
          onClick={() => setShowKundenInfo(!showKundenInfo)}
        >
          <span>Kundendaten (optional)</span>
          {showKundenInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showKundenInfo && (
          <div className="px-6 pb-6 pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Kundenname mit Autocomplete */}
              <div className="relative">
                <label className="block text-xs text-gray-500 mb-1">Kundenname</label>
                <div className="flex gap-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      className={`w-full border border-gray-300 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${selectedKontaktId ? 'pl-3 pr-8 bg-green-50 border-green-300' : 'px-3'}`}
                      placeholder="Name eingeben oder suchen..."
                      value={selectedKontaktId ? kundenInfo.name : kundenSuche}
                      onChange={e => {
                        if (selectedKontaktId) {
                          onKundeReset()
                          setKundenSuche(e.target.value)
                        } else {
                          setKundenSuche(e.target.value)
                        }
                        onKundenSearch(e.target.value)
                      }}
                    />
                    {selectedKontaktId && (
                      <button
                        onClick={onKundeReset}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-gray-200 text-gray-600 hover:bg-red-100 hover:text-red-600 transition-colors"
                        title="Kundenauswahl aufheben"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {kundenLoading && !selectedKontaktId && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                    )}

                    {/* Autocomplete Dropdown */}
                    {kundenVorschlaege.length > 0 && !selectedKontaktId && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {kundenVorschlaege.map(v => (
                          <button
                            key={v.kontakt_id}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                            onClick={() => onKundeSelect(v)}
                          >
                            <div className="text-sm font-medium text-gray-900">
                              {v.display_name || v.firma}
                            </div>
                            <div className="text-xs text-gray-500 flex gap-2">
                              {v.firma && v.display_name !== v.firma && <span>{v.firma}</span>}
                              {v.ort && <span>{v.ort}</span>}
                              {v.telefon && <span>{v.telefon}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Alle Kunden Button */}
                  <button
                    type="button"
                    className="px-2.5 py-2 border border-gray-300 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors shrink-0"
                    onClick={() => setShowKundenModal(true)}
                    title="Alle Kunden durchsuchen"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                </div>
                {selectedKontaktId && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Kunde verknuepft
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Telefon</label>
                <input
                  type="tel"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0171 1234567"
                  value={kundenInfo.telefon}
                  onChange={e => setKundenInfo({ ...kundenInfo, telefon: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">E-Mail</label>
                <input
                  type="email"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="max@beispiel.de"
                  value={kundenInfo.email}
                  onChange={e => setKundenInfo({ ...kundenInfo, email: e.target.value })}
                />
              </div>
            </div>
            {/* Adresszeile */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Strasse</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Musterstrasse 1"
                  value={kundenInfo.strasse}
                  onChange={e => setKundenInfo({ ...kundenInfo, strasse: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">PLZ</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="92224"
                  value={kundenInfo.plz}
                  onChange={e => setKundenInfo({ ...kundenInfo, plz: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ort</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Amberg"
                  value={kundenInfo.ort}
                  onChange={e => setKundenInfo({ ...kundenInfo, ort: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Kunden-Suchmodal */}
      {showKundenModal && (
        <KundenSuchModal
          onSelect={(kunde) => { onKundeSelect(kunde); setShowKundenModal(false) }}
          onClose={() => setShowKundenModal(false)}
        />
      )}

      {/* Options Row */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Profilsystem</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedSystem}
              onChange={e => setSelectedSystem(e.target.value)}
            >
              {SYSTEME.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Montage Checkboxes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Zusatzleistungen</label>
            <div className="flex flex-wrap gap-4">
              {[
                { key: 'montage', label: 'Montage' },
                { key: 'demontage', label: 'Demontage' },
                { key: 'entsorgung', label: 'Entsorgung' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={montageOptions[key]}
                    onChange={e => setMontageOptions({ ...montageOptions, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-center">
        <button
          className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-blue-600 text-white text-base font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
          disabled={loading || !inputText.trim()}
          onClick={onSubmit}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              KI analysiert...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Budgetangebot erstellen
            </>
          )}
        </button>
      </div>

      {/* Loading hint */}
      {loading && (
        <div className="text-center">
          <p className="text-sm text-gray-500 animate-pulse">
            Die KI analysiert Ihre Eingabe und berechnet Preise. Dies kann einige Sekunden dauern...
          </p>
        </div>
      )}
    </div>
  )
}

// ── Step 2: Positionen-Tabelle ───────────────────────────

function StepPositionen({ editedPositions, setEditedPositions, onBack, onNext }) {
  const updatePosition = useCallback((index, field, value) => {
    setEditedPositions(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      // Recalculate Gesamtpreis
      if (['einzelpreis', 'menge'].includes(field)) {
        const ep = field === 'einzelpreis' ? value : updated[index].einzelpreis
        const mg = field === 'menge' ? value : updated[index].menge
        updated[index].gesamtpreis = (parseFloat(ep) || 0) * (parseInt(mg) || 1)
      }
      return updated
    })
  }, [setEditedPositions])

  const deletePosition = useCallback((index) => {
    setEditedPositions(prev => prev.filter((_, i) => i !== index))
  }, [setEditedPositions])

  const addPosition = useCallback(() => {
    setEditedPositions(prev => [
      ...prev,
      {
        _id: generateTempId(),
        pos: prev.length + 1,
        raum: '',
        typ: 'Fenster',
        bezeichnung: 'Neue Position',
        breite: 1000,
        hoehe: 1200,
        menge: 1,
        einzelpreis: 0,
        gesamtpreis: 0,
        zubehoer: [],
      },
    ])
  }, [setEditedPositions])

  const netto = editedPositions.reduce((sum, p) => sum + (parseFloat(p.gesamtpreis) || 0), 0)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            Positionen ({editedPositions.length})
          </h3>
          <div className="text-sm text-gray-500">
            Netto: <span className="font-semibold text-gray-900">{formatEuro(netto)}</span>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="px-4 py-3 w-12">Pos</th>
                <th className="px-4 py-3">Raum</th>
                <th className="px-4 py-3">Typ</th>
                <th className="px-4 py-3">Bezeichnung</th>
                <th className="px-4 py-3 w-20">Breite</th>
                <th className="px-4 py-3 w-20">Hoehe</th>
                <th className="px-4 py-3 w-16">Menge</th>
                <th className="px-4 py-3 w-28">Einzelpreis</th>
                <th className="px-4 py-3 w-28">Gesamtpreis</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {editedPositions.map((pos, idx) => (
                <tr key={pos._id || idx} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-2 text-gray-500 font-mono text-xs">{idx + 1}</td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={pos.raum}
                      onChange={v => updatePosition(idx, 'raum', v)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={pos.typ}
                      onChange={v => updatePosition(idx, 'typ', v)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={pos.bezeichnung}
                      onChange={v => updatePosition(idx, 'bezeichnung', v)}
                    />
                    {pos.zubehoer && pos.zubehoer.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 px-2">
                        {pos.zubehoer.map((z, zi) => (
                          <span
                            key={zi}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                          >
                            {typeof z === 'string' ? z : z.bezeichnung || z.typ || 'Zubehoer'}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={pos.breite}
                      onChange={v => updatePosition(idx, 'breite', v)}
                      type="number"
                      className="w-16"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={pos.hoehe}
                      onChange={v => updatePosition(idx, 'hoehe', v)}
                      type="number"
                      className="w-16"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={pos.menge}
                      onChange={v => updatePosition(idx, 'menge', v)}
                      type="number"
                      className="w-12"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={pos.einzelpreis}
                      onChange={v => updatePosition(idx, 'einzelpreis', v)}
                      type="number"
                      className="w-24"
                    />
                  </td>
                  <td className="px-4 py-2 font-semibold text-gray-900">
                    {formatEuro(pos.gesamtpreis)}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      onClick={() => deletePosition(idx)}
                      title="Position loeschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add position button */}
        <div className="px-6 py-4 border-t border-gray-200">
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            onClick={addPosition}
          >
            <Plus className="w-4 h-4" />
            Position hinzufuegen
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4" />
          Zurueck zur Eingabe
        </button>
        <button
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          disabled={editedPositions.length === 0}
          onClick={onNext}
        >
          Weiter zur Zusammenfassung
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Zusammenfassung ──────────────────────────────

function StepZusammenfassung({
  editedPositions,
  result,
  loading,
  error,
  onBack,
  onGenerateDocument,
  onReset,
  showNetto,
  setShowNetto,
}) {
  const netto = editedPositions.reduce((sum, p) => sum + (parseFloat(p.gesamtpreis) || 0), 0)
  const mwst = netto * MWST_SATZ
  const brutto = netto + mwst

  // Preisspanne: ±15% vom Brutto, gerundet auf 50 EUR
  const preisVon = Math.round((brutto * 0.85) / 50) * 50
  const preisBis = Math.round((brutto * 1.15) / 50) * 50

  const zusammenfassung = result?.data?.zusammenfassung || result?.zusammenfassung || {}
  const confidence = zusammenfassung.confidence || 'medium'
  const annahmen = zusammenfassung.annahmen || result?.data?.annahmen || result?.annahmen || []
  const fehlendeInfos = zusammenfassung.fehlende_infos || result?.data?.fehlende_infos || result?.fehlende_infos || []

  // Montage V2 Daten aus Edge Function
  const workBreakdown = result?.data?.work_breakdown || result?.work_breakdown || {}
  const workDetails = result?.data?.work_details || result?.work_details || {}
  const breakdown = result?.data?.breakdown || result?.breakdown || {}

  // Anzeige-Wert berechnen (Netto/Brutto-aware)
  const displayBrutto = showNetto ? netto : brutto
  const displayLabel = showNetto ? 'Netto' : 'Brutto'

  return (
    <div className="space-y-6">
      {/* Firmendaten + Netto/Brutto Toggle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{FIRMA_INFO.firma}</span>
            <span className="mx-2">|</span>
            {FIRMA_INFO.strasse}, {FIRMA_INFO.plz_ort}
            <span className="mx-2">|</span>
            {FIRMA_INFO.telefon}
          </div>
          <button
            onClick={() => setShowNetto(!showNetto)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors hover:bg-gray-50"
          >
            {showNetto ? 'Netto' : 'Brutto'}
            <span className="text-xs text-gray-400">klick zum Wechseln</span>
          </button>
        </div>
      </div>

      {/* Price Summary Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Euro className="w-5 h-5 text-blue-600" />
          Preiszusammenfassung ({displayLabel})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Prices */}
          <div className="space-y-3">
            {/* Breakdown: Fenster / Zubehoer / Montage */}
            {(breakdown.fenster || breakdown.zubehoer || breakdown.montage) && (
              <>
                {breakdown.fenster > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-600">Fenster/Tueren</span>
                    <span className="text-sm text-gray-900">{formatPreis(breakdown.fenster, showNetto, { isNetto: true })}</span>
                  </div>
                )}
                {breakdown.zubehoer > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-600">Zubehoer</span>
                    <span className="text-sm text-gray-900">{formatPreis(breakdown.zubehoer, showNetto, { isNetto: true })}</span>
                  </div>
                )}
                {breakdown.montage > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-600">Montage/Demontage</span>
                    <span className="text-sm text-gray-900">{formatPreis(breakdown.montage, showNetto, { isNetto: true })}</span>
                  </div>
                )}
                <div className="border-t border-gray-100 my-1" />
              </>
            )}

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Netto</span>
              <span className="text-sm font-semibold text-gray-900">{formatEuro(netto)}</span>
            </div>
            {!showNetto && (
              <>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">MwSt. (19%)</span>
                  <span className="text-sm text-gray-700">{formatEuro(mwst)}</span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Brutto</span>
                  <span className="text-lg font-bold text-gray-900">{formatEuro(brutto)}</span>
                </div>
              </>
            )}
          </div>

          {/* Right: Meta */}
          <div className="space-y-4">
            {/* Confidence */}
            <div>
              <ConfidenceBadge confidence={confidence} />
            </div>

            {/* Price Range ±15% */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Preisspanne ({displayLabel}, {'\u00b1'}15%)</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatEuro(showNetto ? preisVon / (1 + MWST_SATZ) : preisVon)} {'\u2013'} {formatEuro(showNetto ? preisBis / (1 + MWST_SATZ) : preisBis)}
              </p>
            </div>

            {/* Position count */}
            <div className="text-sm text-gray-500">
              {editedPositions.length} Position{editedPositions.length !== 1 ? 'en' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Montage V2 Details */}
      {(workBreakdown.montage || workBreakdown.entsorgung || workBreakdown.material) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Montage-Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {workBreakdown.montage > 0 && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-600 font-medium">Arbeitsstunden</p>
                <p className="text-sm font-semibold text-blue-900">{formatPreis(workBreakdown.montage, showNetto, { decimals: 2, isNetto: true })}</p>
                {workDetails?.montage && (
                  <p className="text-xs text-blue-700 mt-1">
                    {workDetails.montage.stunden_gesamt?.toFixed(1)} Std \u00d7 {toDisplayValue(workDetails.montage.stundensatz, showNetto, true).toFixed(2)} EUR/Std
                  </p>
                )}
              </div>
            )}
            {workBreakdown.entsorgung > 0 && (
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="text-xs text-amber-600 font-medium">Entsorgung</p>
                <p className="text-sm font-semibold text-amber-900">{formatPreis(workBreakdown.entsorgung, showNetto, { decimals: 2, isNetto: true })}</p>
                {workDetails?.entsorgung && (
                  <p className="text-xs text-amber-700 mt-1">
                    {workDetails.entsorgung.lfm_gesamt?.toFixed(1)} lfm
                  </p>
                )}
              </div>
            )}
            {workBreakdown.material > 0 && (
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-600 font-medium">Montagematerial</p>
                <p className="text-sm font-semibold text-green-900">{formatPreis(workBreakdown.material, showNetto, { decimals: 2, isNetto: true })}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assumptions */}
      {annahmen.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Annahmen der KI
          </h4>
          <ul className="space-y-1">
            {annahmen.map((a, i) => (
              <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5 shrink-0">&bull;</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing Info */}
      {fehlendeInfos.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Fehlende Informationen
          </h4>
          <ul className="space-y-1">
            {fehlendeInfos.map((f, i) => (
              <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5 shrink-0">&bull;</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4" />
          Zurueck zu Positionen
        </button>
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            onClick={onReset}
          >
            <RotateCcw className="w-4 h-4" />
            Neues Angebot
          </button>
          <button
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
            disabled={loading || editedPositions.length === 0}
            onClick={onGenerateDocument}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generiere Dokument...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Angebot generieren
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 4: Angebots-Vorschau ────────────────────────────

function StepVorschau({ documentHtml, documentUrl, onReset }) {
  return (
    <div className="space-y-6">
      {/* Preview Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-600" />
            Angebots-Vorschau
          </h3>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Erstellt
          </div>
        </div>

        {/* HTML Preview */}
        {documentHtml ? (
          <div className="p-1">
            <iframe
              srcDoc={documentHtml}
              className="w-full border-0 rounded"
              style={{ minHeight: '700px' }}
              title="Budgetangebot Vorschau"
              sandbox="allow-same-origin"
            />
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Keine Vorschau verfuegbar</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          onClick={onReset}
        >
          <RotateCcw className="w-4 h-4" />
          Neues Angebot
        </button>
        <div className="flex items-center gap-3">
          {documentUrl && (
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              PDF herunterladen
            </a>
          )}
          <button
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            onClick={() => {
              // Placeholder for future email functionality
              alert('E-Mail-Versand wird in einer zukuenftigen Version implementiert.')
            }}
          >
            <Mail className="w-4 h-4" />
            Per E-Mail senden
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Main Page Component
// ══════════════════════════════════════════════════════════

export default function Budgetangebot() {
  // Step management
  const [step, setStep] = useState(1)
  const [maxVisitedStep, setMaxVisitedStep] = useState(1)

  // Freitext-Hash (U2) - verhindert unnoetige GPT-Calls
  const lastParsedTextRef = useRef(null)

  // Netto/Brutto Toggle
  const [showNetto, setShowNetto] = useState(false)

  // Step 1: Input
  const [inputText, setInputText] = useState('')
  const [kundenInfo, setKundenInfo] = useState({ name: '', telefon: '', email: '', strasse: '', plz: '', ort: '' })
  const [showKundenInfo, setShowKundenInfo] = useState(false)
  const [selectedSystem, setSelectedSystem] = useState('')
  const [montageOptions, setMontageOptions] = useState({ montage: true, demontage: true, entsorgung: true })

  // Kunden-Autocomplete
  const [kundenSuche, setKundenSuche] = useState('')
  const [kundenVorschlaege, setKundenVorschlaege] = useState([])
  const [kundenLoading, setKundenLoading] = useState(false)
  const [showKundenModal, setShowKundenModal] = useState(false)
  const [selectedKontaktId, setSelectedKontaktId] = useState(null)
  const kundenTimerRef = useRef(null)

  // Loading & errors
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Step 2-3: Result
  const [result, setResult] = useState(null)
  const [editedPositions, setEditedPositions] = useState([])
  const [caseId, setCaseId] = useState(null)

  // Step 4: Document
  const [documentHtml, setDocumentHtml] = useState(null)
  const [documentUrl, setDocumentUrl] = useState(null)
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState(null)

  // ── Step Navigation ─────────────────────────────────────
  const goToStep = useCallback((targetStep) => {
    if (targetStep <= maxVisitedStep) {
      setStep(targetStep)
    }
  }, [maxVisitedStep])

  // ── Kunden-Autocomplete Callbacks ─────────────────────
  const handleKundenSearch = useCallback((term) => {
    clearTimeout(kundenTimerRef.current)
    if (!term || term.length < 2) {
      setKundenVorschlaege([])
      return
    }
    kundenTimerRef.current = setTimeout(async () => {
      setKundenLoading(true)
      try {
        const res = await searchKontakte(term)
        setKundenVorschlaege(res)
      } catch (err) {
        console.error('Kundensuche Fehler:', err)
      } finally {
        setKundenLoading(false)
      }
    }, 400)
  }, [])

  const handleKundeSelect = useCallback((kunde) => {
    const name = kunde.display_name || kunde.firma || ''
    setKundenInfo({
      name,
      telefon: kunde.telefon || '',
      email: kunde.email || '',
      strasse: kunde.strasse || '',
      plz: kunde.plz || '',
      ort: kunde.ort || '',
    })
    setSelectedKontaktId(kunde.kontakt_id)
    setKundenSuche(name)
    setKundenVorschlaege([])
  }, [])

  const handleKundeReset = useCallback(() => {
    setSelectedKontaktId(null)
    setKundenSuche('')
    setKundenVorschlaege([])
    setKundenInfo({ name: '', telefon: '', email: '', strasse: '', plz: '', ort: '' })
  }, [])

  // ── Submit to AI ───────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!inputText.trim()) return

    // U2: Freitext-Hash - ueberspringe GPT-Call wenn Text unveraendert
    if (lastParsedTextRef.current === inputText.trim() && editedPositions.length > 0) {
      console.log('[U2] Freitext unveraendert - ueberspringe GPT-Call, behalte bestehende Positionen')
      setStep(2)
      setMaxVisitedStep(prev => Math.max(prev, 2))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/budget-ki`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: inputText,
          kunde: {
            name: kundenInfo.name || undefined,
            telefon: kundenInfo.telefon || undefined,
            email: kundenInfo.email || undefined,
          },
          kontakt_id: selectedKontaktId || undefined,
          optionen: {
            montage: montageOptions.montage,
            demontage: montageOptions.demontage,
            entsorgung: montageOptions.entsorgung,
            system: selectedSystem || undefined,
          },
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || errData.message || `Fehler ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setResult(data)
      setCaseId(data.budget_case_id || data.case_id || null)

      // Map positions with temp IDs for stable rendering
      // Edge Function returns data nested: { success, data: { positionen: [...] } }
      const rawPositions = data.data?.positionen || data.positionen || []
      const positions = rawPositions.map((p, i) => ({
        ...p,
        _id: generateTempId(),
        pos: p.pos || i + 1,
        breite: p.breite ?? p.breite_mm ?? 0,
        hoehe: p.hoehe ?? p.hoehe_mm ?? 0,
        einzelpreis: p.einzelpreis ?? p.einzel_preis ?? 0,
        gesamtpreis: p.gesamtpreis ?? p.gesamt_preis ?? (parseFloat(p.einzelpreis ?? p.einzel_preis) || 0) * (parseInt(p.menge) || 1),
        zubehoer: p.zubehoer || p.accessories || [],
      }))
      setEditedPositions(positions)
      lastParsedTextRef.current = inputText.trim()
      setStep(2)
      setMaxVisitedStep(prev => Math.max(prev, 2))
    } catch (err) {
      console.error('Budget KI Fehler:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [inputText, kundenInfo, montageOptions, selectedSystem, selectedKontaktId, editedPositions.length])

  // ── Generate Document ──────────────────────────────────
  const handleGenerateDocument = useCallback(async () => {
    setDocLoading(true)
    setDocError(null)

    try {
      const netto = editedPositions.reduce((sum, p) => sum + (parseFloat(p.gesamtpreis) || 0), 0)
      const mwst = netto * 0.19
      const brutto = netto + mwst

      const summaryData = {
        netto,
        mwst,
        brutto,
        brutto_gerundet: Math.ceil(brutto / 10) * 10,
        confidence: result?.data?.zusammenfassung?.confidence || result?.zusammenfassung?.confidence || 'medium',
        preis_spanne: result?.data?.zusammenfassung?.preis_spanne || result?.zusammenfassung?.preis_spanne || {},
        annahmen: result?.data?.zusammenfassung?.annahmen || result?.zusammenfassung?.annahmen || result?.data?.annahmen || result?.annahmen || [],
      }

      const kundeData = {
        name: kundenInfo.name || undefined,
        telefon: kundenInfo.telefon || undefined,
        email: kundenInfo.email || undefined,
        strasse: kundenInfo.strasse || undefined,
        plz: kundenInfo.plz || undefined,
        ort: kundenInfo.ort || undefined,
      }

      // Clean positions for API (remove _id)
      const cleanPositions = editedPositions.map(({ _id, ...rest }) => rest)

      const docResponse = await fetch(`${supabaseUrl}/functions/v1/budget-dokument`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          budget_case_id: caseId,
          positionen: cleanPositions,
          kunde: kundeData,
          kontakt_id: selectedKontaktId || undefined,
          zusammenfassung: summaryData,
        }),
      })

      if (!docResponse.ok) {
        const errData = await docResponse.json().catch(() => ({}))
        throw new Error(errData.error || errData.message || `Fehler ${docResponse.status}: ${docResponse.statusText}`)
      }

      const docData = await docResponse.json()
      setDocumentHtml(docData.html || null)
      setDocumentUrl(docData.pdf_url || docData.url || null)
      setStep(4)
      setMaxVisitedStep(prev => Math.max(prev, 4))
    } catch (err) {
      console.error('Dokument-Generierung Fehler:', err)
      setDocError(err.message)
    } finally {
      setDocLoading(false)
    }
  }, [editedPositions, result, kundenInfo, selectedKontaktId, caseId])

  // ── Reset ──────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setStep(1)
    setMaxVisitedStep(1)
    lastParsedTextRef.current = null
    setShowNetto(false)
    setInputText('')
    setKundenInfo({ name: '', telefon: '', email: '', strasse: '', plz: '', ort: '' })
    setShowKundenInfo(false)
    setSelectedSystem('')
    setMontageOptions({ montage: true, demontage: true, entsorgung: true })
    setLoading(false)
    setError(null)
    setResult(null)
    setEditedPositions([])
    setCaseId(null)
    setDocumentHtml(null)
    setDocumentUrl(null)
    setDocLoading(false)
    setDocError(null)
    // Kunden-Autocomplete reset
    setKundenSuche('')
    setKundenVorschlaege([])
    setSelectedKontaktId(null)
    setShowKundenModal(false)
  }, [])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Budgetangebot erstellen</h1>
        <p className="text-sm text-gray-500 mt-1">
          Beschreiben Sie die gewuenschten Fenster und Tueren im Freitext. Die KI erstellt daraus ein vollstaendiges Budgetangebot mit Preisen.
        </p>
      </div>

      {/* Step Indicator (U1: klickbar) */}
      <StepIndicator currentStep={step} maxVisitedStep={maxVisitedStep} onStepClick={goToStep} />

      {/* Step Content */}
      {step === 1 && (
        <StepEingabe
          inputText={inputText}
          setInputText={setInputText}
          kundenInfo={kundenInfo}
          setKundenInfo={setKundenInfo}
          showKundenInfo={showKundenInfo}
          setShowKundenInfo={setShowKundenInfo}
          selectedSystem={selectedSystem}
          setSelectedSystem={setSelectedSystem}
          montageOptions={montageOptions}
          setMontageOptions={setMontageOptions}
          loading={loading}
          error={error}
          onSubmit={handleSubmit}
          kundenSuche={kundenSuche}
          setKundenSuche={setKundenSuche}
          kundenVorschlaege={kundenVorschlaege}
          kundenLoading={kundenLoading}
          selectedKontaktId={selectedKontaktId}
          onKundenSearch={handleKundenSearch}
          onKundeSelect={handleKundeSelect}
          onKundeReset={handleKundeReset}
          showKundenModal={showKundenModal}
          setShowKundenModal={setShowKundenModal}
        />
      )}

      {step === 2 && (
        <StepPositionen
          editedPositions={editedPositions}
          setEditedPositions={setEditedPositions}
          onBack={() => setStep(1)}
          onNext={() => { setStep(3); setMaxVisitedStep(prev => Math.max(prev, 3)) }}
        />
      )}

      {step === 3 && (
        <StepZusammenfassung
          editedPositions={editedPositions}
          result={result}
          loading={docLoading}
          error={docError}
          onBack={() => setStep(2)}
          onGenerateDocument={handleGenerateDocument}
          onReset={handleReset}
          showNetto={showNetto}
          setShowNetto={setShowNetto}
        />
      )}

      {step === 4 && (
        <StepVorschau
          documentHtml={documentHtml}
          documentUrl={documentUrl}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
