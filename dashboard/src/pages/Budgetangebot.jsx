import { useState, useCallback } from 'react'
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase'
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
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────

const SYSTEME = [
  { value: '', label: 'Automatisch (KI entscheidet)' },
  { value: 'CASTELLO', label: 'CASTELLO' },
  { value: 'CALIDO', label: 'CALIDO' },
  { value: 'IMPREO', label: 'IMPREO' },
  { value: 'AFINO', label: 'AFINO' },
]

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

function StepIndicator({ currentStep }) {
  const steps = [
    { num: 1, label: 'Eingabe' },
    { num: 2, label: 'Positionen' },
    { num: 3, label: 'Zusammenfassung' },
    { num: 4, label: 'Vorschau' },
  ]

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, idx) => (
        <div key={s.num} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                currentStep >= s.num
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {currentStep > s.num ? <Check className="w-4 h-4" /> : s.num}
            </div>
            <span
              className={`text-sm hidden sm:inline ${
                currentStep >= s.num ? 'text-blue-700 font-medium' : 'text-gray-400'
              }`}
            >
              {s.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={`w-8 lg:w-16 h-0.5 mx-2 transition-colors ${
                currentStep > s.num ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
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
          <div className="px-6 pb-6 pt-0 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kundenname</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Max Mustermann"
                value={kundenInfo.name}
                onChange={e => setKundenInfo({ ...kundenInfo, name: e.target.value })}
              />
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
        )}
      </div>

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
}) {
  const netto = editedPositions.reduce((sum, p) => sum + (parseFloat(p.gesamtpreis) || 0), 0)
  const mwst = netto * 0.19
  const brutto = netto + mwst
  const bruttoGerundet = Math.ceil(brutto / 10) * 10

  const zusammenfassung = result?.data?.zusammenfassung || result?.zusammenfassung || {}
  const preisSpanne = zusammenfassung.preis_spanne || {}
  const confidence = zusammenfassung.confidence || 'medium'
  const annahmen = zusammenfassung.annahmen || result?.data?.annahmen || result?.annahmen || []
  const fehlendeInfos = zusammenfassung.fehlende_infos || result?.data?.fehlende_infos || result?.fehlende_infos || []

  return (
    <div className="space-y-6">
      {/* Price Summary Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Euro className="w-5 h-5 text-blue-600" />
          Preiszusammenfassung
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Prices */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Netto</span>
              <span className="text-sm font-semibold text-gray-900">{formatEuro(netto)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">MwSt. (19%)</span>
              <span className="text-sm text-gray-700">{formatEuro(mwst)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Brutto</span>
              <span className="text-lg font-bold text-gray-900">{formatEuro(brutto)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Brutto (gerundet)</span>
              <span className="text-sm font-semibold text-blue-600">{formatEuro(bruttoGerundet)}</span>
            </div>
          </div>

          {/* Right: Meta */}
          <div className="space-y-4">
            {/* Confidence */}
            <div>
              <ConfidenceBadge confidence={confidence} />
            </div>

            {/* Price Range */}
            {(preisSpanne.von || preisSpanne.bis) && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Preisspanne (Netto)</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatEuro(preisSpanne.von)} \u2013 {formatEuro(preisSpanne.bis)}
                </p>
              </div>
            )}

            {/* Position count */}
            <div className="text-sm text-gray-500">
              {editedPositions.length} Position{editedPositions.length !== 1 ? 'en' : ''}
            </div>
          </div>
        </div>
      </div>

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

  // Step 1: Input
  const [inputText, setInputText] = useState('')
  const [kundenInfo, setKundenInfo] = useState({ name: '', telefon: '', email: '' })
  const [showKundenInfo, setShowKundenInfo] = useState(false)
  const [selectedSystem, setSelectedSystem] = useState('')
  const [montageOptions, setMontageOptions] = useState({ montage: true, demontage: true, entsorgung: true })

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

  // ── Submit to AI ───────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!inputText.trim()) return

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
      setStep(2)
    } catch (err) {
      console.error('Budget KI Fehler:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [inputText, kundenInfo, montageOptions, selectedSystem])

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
    } catch (err) {
      console.error('Dokument-Generierung Fehler:', err)
      setDocError(err.message)
    } finally {
      setDocLoading(false)
    }
  }, [editedPositions, result, kundenInfo, caseId])

  // ── Reset ──────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setStep(1)
    setInputText('')
    setKundenInfo({ name: '', telefon: '', email: '' })
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

      {/* Step Indicator */}
      <StepIndicator currentStep={step} />

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
        />
      )}

      {step === 2 && (
        <StepPositionen
          editedPositions={editedPositions}
          setEditedPositions={setEditedPositions}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
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
