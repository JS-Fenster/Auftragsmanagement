/**
 * Budgetangebot - Step 4: Angebots-Vorschau
 *
 * Wann lesen: Wenn du die PDF-Vorschau, Download oder E-Mail-Versand aendern musst.
 * Zeigt das generierte HTML-Dokument als iframe + Aktions-Buttons.
 */
import {
  FileText,
  Download,
  Mail,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Save,
  Loader2,
} from 'lucide-react'

export function StepVorschau({ documentHtml, documentUrl, onReset, onSave, saveLoading, saveSuccess, saveError, savedAngebotId }) {
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

      {/* Save Feedback */}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-sm text-green-700">Angebot erfolgreich gespeichert!</p>
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
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          onClick={onReset}
        >
          <RotateCcw className="w-4 h-4" />
          Neues Angebot
        </button>
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm"
            disabled={saveLoading}
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
