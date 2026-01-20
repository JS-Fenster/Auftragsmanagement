import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { AttachmentMeta, formatFileSize, AdminReviewApi } from '../lib/api';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface AttachmentPreviewProps {
  attachment: AttachmentMeta;
  api: AdminReviewApi;
}

export function AttachmentPreview({ attachment, api }: AttachmentPreviewProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);

  const isPdf = attachment.contentType === 'application/pdf' || attachment.name.toLowerCase().endsWith('.pdf');
  const isImage = attachment.contentType.startsWith('image/');

  useEffect(() => {
    async function fetchUrl() {
      try {
        setLoading(true);
        setError(null);
        const result = await api.getPreviewUrl(attachment.storagePath);
        setSignedUrl(result.signed_url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    }
    fetchUrl();
  }, [attachment.storagePath, api]);

  if (loading) {
    return (
      <div className="bg-gray-100 rounded-lg p-4 animate-pulse">
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (error) {
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span className="text-sm text-gray-700 truncate" title={attachment.name}>
            {attachment.name}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0">
            ({formatFileSize(attachment.size)})
          </span>
        </div>
        {signedUrl && (
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm flex-shrink-0"
          >
            Download
          </a>
        )}
      </div>

      {/* Preview Content */}
      <div className="p-2 max-h-96 overflow-auto bg-gray-100">
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
              width={400}
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
            alt={attachment.name}
            className="max-w-full h-auto mx-auto rounded"
            style={{ maxHeight: '300px' }}
          />
        )}

        {!isPdf && !isImage && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-sm">Vorschau nicht verfuegbar</div>
            <div className="text-xs text-gray-400">{attachment.contentType}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Attachment List Component
// =============================================================================

interface AttachmentListProps {
  attachments: AttachmentMeta[] | null;
  api: AdminReviewApi;
}

export function AttachmentList({ attachments, api }: AttachmentListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!attachments || attachments.length === 0) {
    return (
      <div className="text-gray-500 text-sm">Keine Anhaenge</div>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment, index) => (
        <div key={attachment.id || index}>
          <button
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center justify-between"
          >
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-sm truncate">{attachment.name}</span>
              <span className="text-xs text-gray-500 flex-shrink-0">
                ({formatFileSize(attachment.size)})
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transform transition-transform ${expandedIndex === index ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedIndex === index && (
            <div className="mt-2">
              <AttachmentPreview attachment={attachment} api={api} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
