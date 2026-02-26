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

  const isPdf = contentType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = contentType.startsWith('image/');

  useEffect(() => {
    // If we have a cached URL, use it directly
    if (cachedUrl) {
      setSignedUrl(cachedUrl);
      setLoading(false);
      return;
    }

    let revoke: string | null = null;

    async function fetchBlob() {
      try {
        setLoading(true);
        setError(null);
        // 1. Get signed URL from API
        const result = await api.getPreviewUrl(storagePath);
        // 2. Download blob ourselves (instead of letting react-pdf fetch it)
        const response = await fetch(result.signed_url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        revoke = objectUrl;
        setSignedUrl(objectUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    }
    fetchBlob();

    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [storagePath, api, cachedUrl]);

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
      <div className="bg-red-50 rounded-lg p-4 text-red-600 text-sm">
        Fehler: {error}
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
        {signedUrl && (
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm flex-shrink-0"
          >
            Oeffnen
          </a>
        )}
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEmailKategorie, setSelectedEmailKategorie] = useState<string>('');
  const [selectedKategorie, setSelectedKategorie] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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

  const handleSave = async () => {
    try {
      setIsSubmitting(true);
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

      // v1.4.0: Unterschrift-Felder immer mitsenden wenn geaendert
      if (unterschriftVorhanden !== null) {
        request.empfang_unterschrift = unterschriftVorhanden;
      }
      if (unterschriftText !== '') {
        request.unterschrift = unterschriftText || null;
      }

      await api.updateLabel(doc.id, request);
      setSuccess(isCorrection ? 'Korrigiert!' : 'Bestaetigt!');

      setSelectedEmailKategorie('');
      setSelectedKategorie('');
      setUnterschriftVorhanden(null);
      setUnterschriftText('');
      onUpdate();
      setTimeout(() => {
        setSuccess(null);
        onNextDocument?.();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setIsSubmitting(false);
    }
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
        {(doc.email_body_text || doc.inhalt_zusammenfassung) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {doc.email_body_text ? 'E-Mail Text' : 'Zusammenfassung'}
            </label>
            <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-auto">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">
                {doc.email_body_text || doc.inhalt_zusammenfassung}
              </pre>
            </div>
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

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
              {success}
            </div>
          )}

          {/* Single Action Button - switches between Confirm/Correct */}
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className={`w-full px-4 py-3 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors ${
              isCorrection
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isCorrection ? 'Korrigieren...' : 'Bestaetigen...'}
              </>
            ) : (
              <>
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
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
