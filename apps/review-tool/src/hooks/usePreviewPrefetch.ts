// =============================================================================
// usePreviewPrefetch Hook - Smart prefetch for preview cache
// =============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { AdminReviewApi, ReviewDocument } from '../lib/api';
import { previewCache, PrefetchMode } from '../lib/previewCache';

interface UsePreviewPrefetchOptions {
  api: AdminReviewApi | null;
  documents: ReviewDocument[];
  selectedDocument: ReviewDocument | null;
  prefetchMode: PrefetchMode;
  visibleCount?: number;  // Number of visible docs to prefetch (default: 10)
  nextCount?: number;     // Number of next docs to prefetch after selection (default: 3)
}

export function usePreviewPrefetch({
  api,
  documents,
  selectedDocument,
  prefetchMode,
  visibleCount = 10,
  nextCount = 3,
}: UsePreviewPrefetchOptions) {
  const lastQueueRef = useRef<string[]>([]);
  const lastSelectedIdRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // Prefetch on Queue Load (first N visible docs)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!api || prefetchMode === 'off' || documents.length === 0) return;

    // Create a simple hash of document IDs to detect queue changes
    const queueIds = documents.slice(0, visibleCount).map(d => d.id);
    const queueHash = queueIds.join(',');
    const lastHash = lastQueueRef.current.join(',');

    if (queueHash === lastHash) return; // Queue hasn't changed
    lastQueueRef.current = queueIds;

    // Cancel any pending prefetch
    const controller = previewCache.createAbortController();

    // Prefetch visible documents in idle time
    const prefetchVisible = async () => {
      const docsToFetch = documents.slice(0, visibleCount);
      console.log(`[Prefetch] Queue loaded - prefetching ${docsToFetch.length} visible docs`);

      try {
        await previewCache.prefetchDocuments(docsToFetch, api, controller.signal);
        console.log(`[Prefetch] Visible docs prefetched. Cache: ${previewCache.getStats().size}/${previewCache.getStats().maxSize}`);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.warn('[Prefetch] Error prefetching visible docs:', err);
        }
      }
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(() => prefetchVisible());
    } else {
      setTimeout(prefetchVisible, 0);
    }

    return () => {
      controller.abort();
    };
  }, [api, documents, prefetchMode, visibleCount]);

  // ---------------------------------------------------------------------------
  // Prefetch on Selection (next K docs)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!api || prefetchMode !== 'visible+next' || !selectedDocument || documents.length === 0) return;

    // Skip if same document selected
    if (selectedDocument.id === lastSelectedIdRef.current) return;
    lastSelectedIdRef.current = selectedDocument.id;

    const selectedIndex = documents.findIndex(d => d.id === selectedDocument.id);
    if (selectedIndex === -1) return;

    // Get next K documents
    const nextDocs = documents.slice(selectedIndex + 1, selectedIndex + 1 + nextCount);
    if (nextDocs.length === 0) return;

    const controller = previewCache.createAbortController();

    const prefetchNext = async () => {
      console.log(`[Prefetch] Selection changed - prefetching ${nextDocs.length} next docs`);
      try {
        await previewCache.prefetchDocuments(nextDocs, api, controller.signal);
        console.log(`[Prefetch] Next docs prefetched. Cache: ${previewCache.getStats().size}/${previewCache.getStats().maxSize}`);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.warn('[Prefetch] Error prefetching next docs:', err);
        }
      }
    };

    // Small delay to not block UI
    setTimeout(prefetchNext, 50);

    return () => {
      controller.abort();
    };
  }, [api, documents, selectedDocument, prefetchMode, nextCount]);

  // ---------------------------------------------------------------------------
  // Prefetch on Hover (single doc)
  // ---------------------------------------------------------------------------
  const prefetchOnHover = useCallback(async (docId: string) => {
    if (!api || prefetchMode === 'off') return;
    if (previewCache.has(docId)) return; // Already cached

    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    console.log(`[Prefetch] Hover - prefetching doc ${docId}`);
    try {
      await previewCache.prefetchDocument(doc, api);
    } catch (err) {
      console.warn('[Prefetch] Error prefetching on hover:', err);
    }
  }, [api, documents, prefetchMode]);

  // ---------------------------------------------------------------------------
  // Get cached objectURL for a storage path
  // ---------------------------------------------------------------------------
  const getCachedUrl = useCallback((docId: string, storagePath: string): string | null => {
    return previewCache.getObjectUrl(docId, storagePath);
  }, []);

  // ---------------------------------------------------------------------------
  // Check if document has cached preview
  // ---------------------------------------------------------------------------
  const hasCachedPreview = useCallback((docId: string): boolean => {
    return previewCache.has(docId);
  }, []);

  // ---------------------------------------------------------------------------
  // Get cache stats
  // ---------------------------------------------------------------------------
  const getCacheStats = useCallback(() => {
    return previewCache.getStats();
  }, []);

  return {
    prefetchOnHover,
    getCachedUrl,
    hasCachedPreview,
    getCacheStats,
    cache: previewCache,
  };
}
