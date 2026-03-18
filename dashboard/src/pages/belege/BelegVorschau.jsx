/**
 * BelegVorschau — PDF/HTML preview for a Beleg
 *
 * Calls the generate-beleg-pdf Edge Function and displays the HTML in an iframe.
 * Buttons: PDF herunterladen, Drucken, Zurueck
 */
import { useState, useEffect } from 'react'
import { FileText, Download, Printer, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react'
import { supabaseAnonKey } from '../../lib/supabase'
import { API_BASE } from '../../lib/constants'

export default function BelegVorschau({ belegId, onClose }) {
  const [html, setHtml] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!belegId) return

    let cancelled = false

    async function fetchPreview() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/generate-beleg-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ beleg_id: belegId }),
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `Fehler ${res.status}`)
        }

        const data = await res.json()
        if (cancelled) return

        setHtml(data.html || null)
        setPdfUrl(data.pdf_url || null)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPreview()
    return () => { cancelled = true }
  }, [belegId])

  const handlePrint = () => {
    const iframe = document.querySelector('#beleg-preview-iframe')
    if (iframe?.contentWindow) {
      iframe.contentWindow.print()
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
        <p className="text-sm text-text-secondary">Vorschau wird erstellt...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">Vorschau fehlgeschlagen: {error}</p>
        </div>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-text-secondary border border-border-default hover:bg-surface-main rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurueck
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Preview Card */}
      <div className="bg-surface-card rounded-lg shadow-sm border border-border-default overflow-hidden">
        <div className="px-6 py-4 border-b border-border-default flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand" />
            Beleg-Vorschau
          </h3>
        </div>

        {html ? (
          <div className="p-1">
            <iframe
              id="beleg-preview-iframe"
              srcDoc={html}
              className="w-full border-0 rounded"
              style={{ minHeight: '700px' }}
              title="Beleg Vorschau"
              sandbox="allow-same-origin"
            />
          </div>
        ) : (
          <div className="p-12 text-center text-text-secondary">
            <FileText className="w-12 h-12 mx-auto mb-3 text-text-muted" />
            <p className="text-sm">Keine Vorschau verfuegbar</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-text-secondary border border-border-default hover:bg-surface-main rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurueck
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            disabled={!html}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-text-primary border border-border-default hover:bg-surface-main rounded-lg transition-colors disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Drucken
          </button>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-btn-primary text-white text-sm font-medium rounded-lg hover:bg-btn-primary-hover transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              PDF herunterladen
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
