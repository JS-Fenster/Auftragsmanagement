import { useCallback, useRef, useEffect } from 'react';
import { ReviewDocument, formatDate, getConfidenceColor, getStatusBadgeColor } from '../lib/api';

interface ReviewQueueProps {
  items: ReviewDocument[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (doc: ReviewDocument) => void;
  // Batch selection
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  // Prefetch
  onHover?: (docId: string) => void;
  hasCachedPreview?: (docId: string) => boolean;
}

export function ReviewQueue({
  items,
  loading,
  selectedId,
  onSelect,
  selectedIds = new Set(),
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onHover,
  hasCachedPreview,
}: ReviewQueueProps) {
  const hasBatchMode = !!onToggleSelect;
  const allSelected = items.length > 0 && items.every(doc => selectedIds.has(doc.id));
  const someSelected = items.some(doc => selectedIds.has(doc.id));
  const tableRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // Keyboard navigation: Arrow Up/Down to move between rows
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (items.length === 0) return;

    e.preventDefault(); // Prevent scroll

    const currentIndex = selectedId ? items.findIndex(d => d.id === selectedId) : -1;
    let nextIndex: number;

    if (e.key === 'ArrowDown') {
      nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : currentIndex;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    }

    if (nextIndex !== currentIndex || currentIndex === -1) {
      const nextDoc = items[nextIndex];
      onSelect(nextDoc);
      onHover?.(nextDoc.id);
      // Scroll row into view, accounting for sticky thead
      const row = rowRefs.current.get(nextDoc.id);
      if (row) {
        const scrollContainer = row.closest('.queue-scroll') as HTMLElement;
        if (scrollContainer) {
          const thead = scrollContainer.querySelector('thead');
          const headerHeight = thead?.offsetHeight ?? 0;
          const rowTop = row.offsetTop - headerHeight;
          const rowBottom = row.offsetTop + row.offsetHeight;
          const scrollTop = scrollContainer.scrollTop;
          const visibleBottom = scrollTop + scrollContainer.clientHeight;
          if (rowTop < scrollTop) {
            scrollContainer.scrollTop = rowTop;
          } else if (rowBottom > visibleBottom) {
            scrollContainer.scrollTop = rowBottom - scrollContainer.clientHeight;
          }
        } else {
          row.scrollIntoView({ block: 'nearest' });
        }
      }
    }
  }, [items, selectedId, onSelect, onHover]);

  // Auto-focus table when items load so keyboard works immediately
  useEffect(() => {
    if (items.length > 0 && tableRef.current) {
      tableRef.current.focus();
    }
  }, [items.length]);

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
    <div
      className="bg-white rounded-lg shadow focus:outline-none"
      ref={tableRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div>
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {hasBatchMode && (
                <th className="w-10 px-2 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={() => {
                      if (allSelected) {
                        onDeselectAll?.();
                      } else {
                        onSelectAll?.();
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    title={allSelected ? "Alle abwaehlen" : "Alle auswaehlen"}
                  />
                </th>
              )}
              <th className="w-[130px] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Datum
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '200px' }}>
                Betreff / Absender
              </th>
              <th className="w-[140px] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                E-Mail Kat.
              </th>
              <th className="w-[140px] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dok. Kat.
              </th>
              <th className="w-[60px] px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Conf.
              </th>
              <th className="w-[80px] px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map(doc => {
              const isSelected = selectedId === doc.id;
              const isBatchSelected = selectedIds.has(doc.id);
              const isCached = hasCachedPreview?.(doc.id) ?? false;
              return (
                <tr
                  key={doc.id}
                  ref={el => { if (el) rowRefs.current.set(doc.id, el); }}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-100 hover:bg-blue-100'
                      : isBatchSelected
                        ? 'bg-blue-50 hover:bg-blue-50'
                        : 'hover:bg-gray-50'
                  }`}
                  onClick={() => onSelect(doc)}
                  onMouseEnter={() => onHover?.(doc.id)}
                >
                  {hasBatchMode && (
                    <td className="w-10 px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isBatchSelected}
                        onChange={() => onToggleSelect?.(doc.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                  )}
                  <td className="w-[130px] px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(doc.created_at)}
                  </td>
                  <td className="px-3 py-2" style={{ minWidth: '200px' }}>
                    <div
                      className="text-sm font-medium text-gray-900 truncate"
                      style={{ maxWidth: '280px' }}
                      title={doc.email_betreff || doc.primary_file?.fileName || ''}
                    >
                      {doc.email_betreff || doc.primary_file?.fileName || '(kein Betreff)'}
                    </div>
                    <div
                      className="text-xs text-gray-500 truncate"
                      style={{ maxWidth: '280px' }}
                      title={doc.email_von_email || ''}
                    >
                      {doc.email_von_name || doc.email_von_email || doc.source || '-'}
                    </div>
                    {doc.ki_review_notiz && (
                      <div
                        className="mt-0.5 text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded truncate"
                        style={{ maxWidth: '280px' }}
                        title={doc.ki_review_notiz}
                      >
                        {doc.ki_review_notiz}
                      </div>
                    )}
                  </td>
                  <td className="w-[140px] px-3 py-2">
                    <div className="text-xs text-gray-900 truncate" title={doc.email_kategorie_manual || doc.email_kategorie || ''}>
                      {doc.email_kategorie_manual || doc.email_kategorie || '-'}
                      {doc.email_kategorie_manual && (
                        <span className="ml-1 text-blue-600">(m)</span>
                      )}
                    </div>
                  </td>
                  <td className="w-[140px] px-3 py-2">
                    <div className="text-xs text-gray-600 truncate" title={doc.kategorie_manual || doc.kategorie || ''}>
                      {doc.kategorie_manual || doc.kategorie || '-'}
                      {doc.kategorie_manual && (
                        <span className="ml-1 text-blue-600">(m)</span>
                      )}
                    </div>
                  </td>
                  <td className="w-[60px] px-2 py-2 text-center">
                    {doc.email_kategorie_confidence !== null ? (
                      <span className={`text-xs font-medium ${getConfidenceColor(doc.email_kategorie_confidence)}`}>
                        {(doc.email_kategorie_confidence * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </td>
                  <td className="w-[80px] px-2 py-2 text-center">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeColor(doc.review_status)}`}>
                      {doc.review_status === 'approved' ? '✓' : doc.review_status === 'corrected' ? '✎' : '○'}
                    </span>
                    {doc.processing_status === 'error' && (
                      <span className="ml-1 text-red-500" title="Verarbeitungsfehler">⚠</span>
                    )}
                    {isCached && (
                      <span className="ml-1 text-green-500 text-xs" title="Preview gecached">●</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
