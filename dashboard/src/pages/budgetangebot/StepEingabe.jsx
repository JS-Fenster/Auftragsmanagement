/**
 * Budgetangebot - Step 1: Freitext-Eingabe
 *
 * Wann lesen: Wenn du die Eingabe-Seite aendern musst (Textarea, Kundendaten, Profilsystem, Zusatzleistungen).
 * Props kommen aus der Hauptkomponente (Budgetangebot.jsx).
 */
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  X,
  Users,
} from 'lucide-react'
import { SYSTEME } from './constants'
import { KundenSuchModal } from './KundenSuche'

export function StepEingabe({
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
