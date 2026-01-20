import { ReviewDocument, formatDate, getConfidenceColor, getStatusBadgeColor } from '../lib/api';

interface ReviewQueueProps {
  items: ReviewDocument[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (doc: ReviewDocument) => void;
}

export function ReviewQueue({ items, loading, selectedId, onSelect }: ReviewQueueProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex space-x-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-gray-400 text-4xl mb-2">&#x2713;</div>
        <div className="text-gray-600">Keine Dokumente in der Queue</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Datum
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Betreff / Absender
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kategorie (KI)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Confidence
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Anhaenge
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map(doc => (
              <tr
                key={doc.id}
                className={`hover:bg-gray-50 cursor-pointer ${selectedId === doc.id ? 'bg-blue-50' : ''}`}
                onClick={() => onSelect(doc)}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(doc.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={doc.email_betreff || ''}>
                    {doc.email_betreff || '(kein Betreff)'}
                  </div>
                  <div className="text-sm text-gray-500 truncate max-w-xs" title={doc.email_von_email || ''}>
                    {doc.email_von_name || doc.email_von_email || '-'}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {doc.email_kategorie_manual || doc.email_kategorie || '-'}
                    {doc.email_kategorie_manual && (
                      <span className="ml-1 text-xs text-blue-600">(manuell)</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {doc.kategorie_manual || doc.kategorie}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`text-sm font-medium ${getConfidenceColor(doc.email_kategorie_confidence)}`}>
                    {doc.email_kategorie_confidence !== null
                      ? `${(doc.email_kategorie_confidence * 100).toFixed(0)}%`
                      : '-'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(doc.review_status)}`}>
                    {doc.review_status || 'pending'}
                  </span>
                  {doc.processing_status === 'error' && (
                    <span className="ml-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      Fehler
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {doc.email_anhaenge_count > 0 ? (
                    <span className="inline-flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {doc.email_anhaenge_count}
                    </span>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
