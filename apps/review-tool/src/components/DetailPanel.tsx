import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ReviewDocument, Categories, formatDate, getConfidenceColor, AdminReviewApi } from '../lib/api';
import { AttachmentList } from './AttachmentPreview';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DetailPanelProps {
  document: ReviewDocument | null;
  categories: Categories | null;
  api: AdminReviewApi;
  onUpdate: () => void;
  onNextDocument?: () => void;
  getCachedUrl?: (docId: string, storagePath: string) => string | null;
}

// Primary File Preview Component
function PrimaryFilePreview({
  storagePath,
  contentType,
  fileName,
  api,
  cachedUrl
}: {
  storagePath: string;
  contentType: string;
  fileName: string;
  api: AdminReviewApi;
  cachedUrl?: string | null;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(cachedUrl || null);
  const [loading, setLoading] = useState(!cachedUrl);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const isPdf = contentType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = contentType.startsWith('image/');

  useEffect(() => {
    // If we have a cached URL, use it directly
    if (cachedUrl) {
      setSignedUrl(cachedUrl);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    let blobUrl: string | null = null;

    async function fetchBlob() {
      try {
        setLoading(true);
        setError(null);
        // Get signed URL (deduplicated in API class)
        const result = await api.getPreviewUrl(storagePath, controller.signal);
        if (controller.signal.aborted) return;
        // Download blob for instant react-pdf rendering
        const response = await fetch(result.signed_url, { signal: controller.signal });
        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          throw new Error(errBody || `HTTP ${response.status}`);
        }
        if (controller.signal.aborted) return;
        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
        if (controller.signal.aborted) { URL.revokeObjectURL(blobUrl); blobUrl = null; return; }
        setSignedUrl(blobUrl);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'Failed to load preview');
        }
      } finally {
        clearTimeout(timeoutId);
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchBlob();

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [storagePath, api, cachedUrl, retryCount]);

  if (loading) {
    return (
      <div className="bg-gray-100 rounded-lg p-4 animate-pulse">
        <div className="h-48 bg-gray-200 rounded flex items-center justify-center">
          <span className="text-gray-400">Lade Vorschau...</span>
        </div>
      </div>
    );
  }

  // Handle "Object not found" gracefully - file doesn't exist in storage
  if (error) {
    const isNotFound = error.toLowerCase().includes('not found') || error.toLowerCase().includes('object');
    if (isNotFound) {
      // Don't show anything if file doesn't exist - this is normal for emails
      return null;
    }
    return (
      <div className="bg-red-50 rounded-lg p-4 text-red-600 text-sm flex items-center justify-between">
        <span>Fehler: {error}</span>
        <button
          onClick={() => setRetryCount(c => c + 1)}
          className="ml-2 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs flex-shrink-0"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm text-gray-700 truncate" title={fileName}>
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {signedUrl && (
            <button
              onClick={() => window.open(signedUrl, '_blank')}
              className="text-gray-500 hover:text-gray-700"
              title="Im neuen Tab oeffnen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </button>
          )}
          {signedUrl && (
            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = signedUrl;
                a.download = fileName;
                a.click();
              }}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Download
            </button>
          )}
        </div>
      </div>

      {/* Preview Content */}
      <div className="p-2 max-h-80 overflow-auto bg-gray-100">
        {isPdf && signedUrl && (
          <Document
            file={signedUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            }
            error={
              <div className="text-red-500 text-sm text-center p-4">
                PDF konnte nicht geladen werden
              </div>
            }
          >
            <Page
              pageNumber={1}
              width={380}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        )}

        {isPdf && numPages && numPages > 1 && (
          <div className="text-center text-xs text-gray-500 mt-2">
            Seite 1 von {numPages}
          </div>
        )}

        {isImage && signedUrl && (
          <img
            src={signedUrl}
            alt={fileName}
            className="max-w-full h-auto mx-auto rounded"
            style={{ maxHeight: '280px' }}
          />
        )}

        {!isPdf && !isImage && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-sm">Vorschau nicht verfuegbar</div>
            <div className="text-xs text-gray-400">{contentType}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DetailPanel({ document: doc, categories, api, onUpdate, onNextDocument, getCachedUrl }: DetailPanelProps) {
  const [selectedEmailKategorie, setSelectedEmailKategorie] = useState<string>('');
  const [selectedKategorie, setSelectedKategorie] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  // v1.4.0: Unterschrift-State
  const [unterschriftVorhanden, setUnterschriftVorhanden] = useState<boolean | null>(null);
  const [unterschriftText, setUnterschriftText] = useState<string>('');

  if (!doc) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Dokument auswaehlen um Details zu sehen
      </div>
    );
  }

  // Single-button UX: determine if this is a correction or confirmation
  const hasKategorieChanges = selectedEmailKategorie || selectedKategorie;
  // hasUnterschriftChanges unused for now but kept for future use
  void (unterschriftVorhanden !== null || unterschriftText !== '');
  const isCorrection = hasKategorieChanges; // Unterschrift-Aenderungen erfordern keine "correction"

  // Optimistic save: advance immediately, DB update in background
  const handleSave = () => {
    setError(null);

    // Build request with optional unterschrift fields
    const request: import('../lib/api').LabelUpdateRequest = {
      action: isCorrection ? 'correct' : 'approve',
      reviewed_by: 'admin',
    };

    if (isCorrection) {
      if (selectedEmailKategorie) request.email_kategorie_manual = selectedEmailKategorie;
      if (selectedKategorie) request.kategorie_manual = selectedKategorie;
    }

    if (unterschriftVorhanden !== null) {
      request.empfang_unterschrift = unterschriftVorhanden;
    }
    if (unterschriftText !== '') {
      request.unterschrift = unterschriftText || null;
    }

    // Reset form + advance immediately
    setSelectedEmailKategorie('');
    setSelectedKategorie('');
    setUnterschriftVorhanden(null);
    setUnterschriftText('');
    onUpdate();
    onNextDocument?.();

    // DB update in background
    api.updateLabel(doc.id, request).catch(err => {
      console.error('Label update failed:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    });
  };

  const currentEmailKategorie = doc.email_kategorie_manual || doc.email_kategorie;
  const currentKategorie = doc.kategorie_manual || doc.kategorie;

  // Preview logic: show primary_file for non-email sources (scans, uploads, etc.)
  // or email attachments for email sources
  const isEmailSource = doc.source === 'email';
  const hasPrimaryFile = doc.primary_file && doc.primary_file.storagePath;
  const hasAttachments = doc.email_anhaenge_meta && doc.email_anhaenge_meta.length > 0;

  // For scanned documents: show primary_file if source is NOT 'email' or source is null/undefined
  const showPrimaryFilePreview = hasPrimaryFile && !isEmailSource;
  const showAttachmentsPreview = hasAttachments;
  const hasPreview = showPrimaryFilePreview || showAttachmentsPreview;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b">
        <h3 className="text-lg font-medium text-gray-900 truncate" title={doc.email_betreff || ''}>
          {doc.email_betreff || doc.primary_file?.fileName || '(kein Betreff)'}
        </h3>
        {doc.email_von_email && (
          <div className="text-sm text-gray-500 mt-1">
            {doc.email_von_name && <span>{doc.email_von_name} </span>}
            <span className="text-gray-400">&lt;{doc.email_von_email}&gt;</span>
          </div>
        )}
        <div className="text-xs text-gray-400 mt-1">
          {formatDate(doc.created_at)}
          {doc.email_postfach && <> | Postfach: {doc.email_postfach}</>}
          {doc.source && <> | Quelle: {doc.source}</>}
        </div>
      </div>

      {/* KI-Review Notiz */}
      {doc.ki_review_notiz && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="text-sm font-medium text-amber-800">KI-Review Hinweis:</div>
          <div className="text-sm text-amber-700 mt-1">{doc.ki_review_notiz}</div>
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Current Categories - Email-Kategorie only for email sources */}
        <div className={`grid gap-4 ${doc.source === 'email' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {doc.source === 'email' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email-Kategorie
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1.5 bg-gray-100 rounded text-sm">
                  {currentEmailKategorie || '-'}
                </span>
                {doc.email_kategorie_confidence !== null && (
                  <span className={`text-sm font-medium ${getConfidenceColor(doc.email_kategorie_confidence)}`}>
                    {(doc.email_kategorie_confidence * 100).toFixed(0)}%
                  </span>
                )}
                {doc.email_kategorie_manual && (
                  <span className="text-xs text-blue-600">(manuell)</span>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dokument-Kategorie
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1.5 bg-gray-100 rounded text-sm">
                {currentKategorie || '-'}
              </span>
              {doc.kategorie_manual && (
                <span className="text-xs text-blue-600">(manuell)</span>
              )}
            </div>
          </div>
        </div>

        {/* Processing Status */}
        {doc.processing_status === 'error' && doc.processing_last_error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-sm font-medium text-red-800">Verarbeitungsfehler:</div>
            <div className="text-sm text-red-600 mt-1">{doc.processing_last_error}</div>
          </div>
        )}

        {/* Review Status */}
        {doc.reviewed_at && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-sm text-green-800">
              Reviewed: {formatDate(doc.reviewed_at)} von {doc.reviewed_by}
            </div>
          </div>
        )}

        {/* Email Body / Summary */}
        {(doc.email_body_html || doc.email_body_text || doc.inhalt_zusammenfassung) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {doc.email_body_html ? 'E-Mail (Original)' : doc.email_body_text ? 'E-Mail Text' : 'Zusammenfassung'}
            </label>
            {doc.email_body_html ? (
              <iframe
                srcDoc={doc.email_body_html}
                sandbox=""
                className="w-full h-64 bg-white border border-gray-200 rounded-lg"
                title="E-Mail Inhalt"
              />
            ) : (
              <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-auto">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">
                  {doc.email_body_text || doc.inhalt_zusammenfassung}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Primary File Preview (for scanned documents, uploads - NOT for emails) */}
        {showPrimaryFilePreview && doc.primary_file && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dokument-Vorschau
            </label>
            <PrimaryFilePreview
              storagePath={doc.primary_file.storagePath}
              contentType={doc.primary_file.contentType}
              fileName={doc.primary_file.fileName}
              api={api}
              cachedUrl={getCachedUrl?.(doc.id, doc.primary_file.storagePath)}
            />
          </div>
        )}

        {/* Attachments (for emails) */}
        {doc.email_anhaenge_meta && doc.email_anhaenge_meta.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email-Anhaenge ({doc.email_anhaenge_count || doc.email_anhaenge_meta.length})
            </label>
            <AttachmentList attachments={doc.email_anhaenge_meta} api={api} />
          </div>
        )}

        {/* No preview available */}
        {!hasPreview && (
          <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
            <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="text-sm">Keine Vorschau verfuegbar</div>
          </div>
        )}

        {/* Unterschrift-Abschnitt (nur fuer non-email Quellen) */}
        {doc.source !== 'email' && (
          <div className="border rounded-lg p-3 bg-gray-50">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Unterschrift
            </h4>
            <div className="space-y-3">
              {/* Status-Badges */}
              <div className="flex items-center gap-3 text-sm">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  doc.unterschrift_erforderlich
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {doc.unterschrift_erforderlich ? 'Erforderlich' : 'Optional'}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  doc.empfang_unterschrift
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {doc.empfang_unterschrift ? 'Vorhanden' : 'Nicht vorhanden'}
                </span>
                {doc.unterschrift && (
                  <span className="text-gray-600">Name: {doc.unterschrift}</span>
                )}
              </div>

              {/* Korrektur-Felder */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={unterschriftVorhanden ?? doc.empfang_unterschrift ?? false}
                    onChange={(e) => setUnterschriftVorhanden(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Unterschrift vorhanden</span>
                </label>
                <input
                  type="text"
                  value={unterschriftText || doc.unterschrift || ''}
                  onChange={(e) => setUnterschriftText(e.target.value)}
                  placeholder="Name (optional)"
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Correction Form */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Korrektur</h4>

          <div className={`grid gap-4 mb-4 ${doc.source === 'email' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {doc.source === 'email' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Email-Kategorie
                </label>
                <select
                  value={selectedEmailKategorie}
                  onChange={(e) => setSelectedEmailKategorie(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Keine Aenderung --</option>
                  {categories?.email_kategorien.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Dokument-Kategorie
              </label>
              <select
                value={selectedKategorie}
                onChange={(e) => setSelectedKategorie(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Keine Aenderung --</option>
                {categories?.dokument_kategorien.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error Message (shown if background save fails) */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Single Action Button - optimistic (instant) */}
          <button
            onClick={handleSave}
            className={`w-full px-4 py-3 text-white rounded-lg flex items-center justify-center gap-2 transition-colors ${
              isCorrection
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isCorrection ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {isCorrection ? 'Korrigieren' : 'Bestaetigen'}
          </button>
        </div>
      </div>
    </div>
  );
}
