/**
 * Budgetangebot - Step 3: Preiszusammenfassung
 *
 * Wann lesen: Wenn du die Preisanzeige, Montage-Details, Annahmen oder
 * den Speichern/Generieren-Flow im Step 3 aendern musst.
 * Hier landen Montage/Demontage/Entsorgung-Kosten, Preisspanne, Confidence.
 */
import {
  Euro,
  Info,
  AlertTriangle,
  RotateCcw,
  ArrowLeft,
  Save,
  Loader2,
  FileText,
  CheckCircle,
} from 'lucide-react'
import { ConfidenceBadge } from './ui'
import { MWST_SATZ, FIRMA_INFO, formatEuro, formatPreis, toDisplayValue } from './constants'

export function StepZusammenfassung({
  editedPositions,
  result,
  loading,
  error,
  onBack,
  onGenerateDocument,
  onReset,
  showNetto,
  setShowNetto,
  onSave,
  saveLoading,
  saveSuccess,
  saveError,
  savedAngebotId,
}) {
  const positionenNetto = editedPositions.reduce((sum, p) => sum + (parseFloat(p.gesamtpreis) || 0), 0)

  // Montage/Demontage/Entsorgung aus KI-Ergebnis (B-007 Fix)
  const montageData = result?.data?.montage || result?.montage || {}
  const montageKosten = (parseFloat(montageData.montage) || 0)
    + (parseFloat(montageData.demontage) || 0)
    + (parseFloat(montageData.entsorgung) || 0)

  const netto = positionenNetto + montageKosten
  const mwst = netto * MWST_SATZ
  const brutto = netto + mwst

  // Preisspanne: +-15% vom Brutto, gerundet auf 50 EUR
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
            {(breakdown.fenster || breakdown.zubehoer || breakdown.montage || montageKosten > 0) && (
              <>
                {(breakdown.fenster > 0 || positionenNetto > 0) && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-600">Fenster/Tueren</span>
                    <span className="text-sm text-gray-900">{formatPreis(breakdown.fenster || positionenNetto, showNetto, { isNetto: true })}</span>
                  </div>
                )}
                {breakdown.zubehoer > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-600">Zubehoer</span>
                    <span className="text-sm text-gray-900">{formatPreis(breakdown.zubehoer, showNetto, { isNetto: true })}</span>
                  </div>
                )}
                {/* Zusatzleistungen einzeln anzeigen (B-007 Fix) */}
                {(parseFloat(montageData.montage) || 0) > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-600">Montage</span>
                    <span className="text-sm text-gray-900">{formatPreis(montageData.montage, showNetto, { isNetto: true })}</span>
                  </div>
                )}
                {(parseFloat(montageData.demontage) || 0) > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-600">Demontage</span>
                    <span className="text-sm text-gray-900">{formatPreis(montageData.demontage, showNetto, { isNetto: true })}</span>
                  </div>
                )}
                {(parseFloat(montageData.entsorgung) || 0) > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-600">Entsorgung</span>
                    <span className="text-sm text-gray-900">{formatPreis(montageData.entsorgung, showNetto, { isNetto: true })}</span>
                  </div>
                )}
                {breakdown.montage > 0 && !montageKosten && (
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

            {/* Price Range +-15% */}
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
                    {workDetails.montage.stunden_gesamt?.toFixed(1)} Std {'\u00d7'} {toDisplayValue(workDetails.montage.stundensatz, showNetto, true).toFixed(2)} EUR/Std
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

      {/* Save Feedback */}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-sm text-green-700">Angebot erfolgreich gespeichert{savedAngebotId ? ' (aktualisiert)' : ''}!</p>
        </div>
      )}
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">Speichern fehlgeschlagen: {saveError}</p>
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
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm"
            disabled={saveLoading || editedPositions.length === 0}
            onClick={onSave}
          >
            {saveLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Speichere...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {savedAngebotId ? 'Aktualisieren' : 'Speichern'}
              </>
            )}
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
