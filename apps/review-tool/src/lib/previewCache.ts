// =============================================================================
// Preview Cache - LRU Cache with Blob/objectURL for instant preview loading
// =============================================================================

import { AdminReviewApi, ReviewDocument } from './api';

// =============================================================================
// Types
// =============================================================================

export interface CachedPreview {
  objectUrl: string;
  contentType: string;
  storagePath: string;
  timestamp: number;
}

export interface DocumentPreviewCache {
  primaryFile?: CachedPreview;
  attachments: Map<string, CachedPreview>; // keyed by storagePath
  timestamp: number;
}

export type PrefetchMode = 'off' | 'visible' | 'visible+next';

// =============================================================================
// Preview Cache Class
// =============================================================================

export class PreviewCache {
  private cache = new Map<string, DocumentPreviewCache>();
  private failedPaths = new Map<string, number>(); // Negative cache with TTL (path → timestamp)
  private static FAILED_PATH_TTL = 60_000; // Retry failed paths after 60s (transient errors)
  private static FETCH_TIMEOUT = 15_000; // 15s timeout per fetch
  private maxSize: number;
  private concurrencyLimit: number;
  private activeDownloads = 0;
  private downloadQueue: Array<() => Promise<void>> = [];
  private abortController: AbortController | null = null;

  constructor(maxSize = 30, concurrencyLimit = 2) {
    this.maxSize = maxSize;
    this.concurrencyLimit = concurrencyLimit;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Check if a document has cached previews
   */
  has(docId: string): boolean {
    return this.cache.has(docId);
  }

  /**
   * Get cached preview for a document
   */
  get(docId: string): DocumentPreviewCache | undefined {
    const cached = this.cache.get(docId);
    if (cached) {
      // Update timestamp for LRU
      cached.timestamp = Date.now();
    }
    return cached;
  }

  /**
   * Get objectURL for a specific storage path (primary file or attachment)
   */
  getObjectUrl(docId: string, storagePath: string): string | null {
    const cached = this.cache.get(docId);
    if (!cached) return null;

    // Check primary file
    if (cached.primaryFile?.storagePath === storagePath) {
      return cached.primaryFile.objectUrl;
    }

    // Check attachments
    const attachment = cached.attachments.get(storagePath);
    return attachment?.objectUrl || null;
  }

  /**
   * Prefetch previews for multiple documents
   */
  async prefetchDocuments(
    docs: ReviewDocument[],
    api: AdminReviewApi,
    signal?: AbortSignal
  ): Promise<void> {
    const tasks: Array<() => Promise<void>> = [];

    for (const doc of docs) {
      if (this.cache.has(doc.id)) continue; // Skip if already cached

      const previewPaths = this.getPreviewPaths(doc);
      if (previewPaths.length === 0) continue;

      tasks.push(() => this.prefetchDocument(doc, api, signal));
    }

    // Process tasks with concurrency limit
    await this.processQueue(tasks);
  }

  /**
   * Prefetch a single document's previews
   */
  async prefetchDocument(
    doc: ReviewDocument,
    api: AdminReviewApi,
    signal?: AbortSignal
  ): Promise<void> {
    if (this.cache.has(doc.id)) return;

    const docCache: DocumentPreviewCache = {
      attachments: new Map(),
      timestamp: Date.now(),
    };

    try {
      // Prefetch primary file for non-email sources
      if (doc.primary_file?.storagePath && doc.source !== 'email') {
        const isPdfOrImage = this.isPreviewable(doc.primary_file.contentType, doc.primary_file.fileName);
        if (isPdfOrImage) {
          const cached = await this.fetchAndCache(
            doc.primary_file.storagePath,
            doc.primary_file.contentType,
            api,
            signal
          );
          if (cached) {
            docCache.primaryFile = cached;
          }
        }
      }

      // Prefetch attachments (only PDF/images, max 3)
      if (doc.email_anhaenge_meta && doc.email_anhaenge_meta.length > 0) {
        const previewableAttachments = doc.email_anhaenge_meta
          .filter(att => this.isPreviewable(att.contentType, att.name))
          .slice(0, 3); // Limit to 3 attachments per doc

        for (const att of previewableAttachments) {
          if (signal?.aborted) break;
          const cached = await this.fetchAndCache(att.storagePath, att.contentType, api, signal);
          if (cached) {
            docCache.attachments.set(att.storagePath, cached);
          }
        }
      }

      // Only add to cache if we got something
      if (docCache.primaryFile || docCache.attachments.size > 0) {
        this.addToCache(doc.id, docCache);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.warn(`[PreviewCache] Failed to prefetch doc ${doc.id}:`, err);
      }
    }
  }

  /**
   * Cancel all pending prefetch operations
   */
  cancelPrefetch(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.downloadQueue = [];
  }

  /**
   * Create a new abort controller for prefetch operations
   */
  createAbortController(): AbortController {
    this.cancelPrefetch();
    this.abortController = new AbortController();
    return this.abortController;
  }

  /**
   * Clear all cached previews
   */
  clear(): void {
    this.cancelPrefetch();
    for (const [, docCache] of this.cache) {
      this.revokeDocumentUrls(docCache);
    }
    this.cache.clear();
    this.failedPaths = new Map();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize };
  }


  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private isPathFailed(storagePath: string): boolean {
    const failedAt = this.failedPaths.get(storagePath);
    if (failedAt === undefined) return false;
    // Expired? Allow retry
    if (Date.now() - failedAt > PreviewCache.FAILED_PATH_TTL) {
      this.failedPaths.delete(storagePath);
      return false;
    }
    return true;
  }

  private async fetchAndCache(
    storagePath: string,
    contentType: string,
    api: AdminReviewApi,
    signal?: AbortSignal
  ): Promise<CachedPreview | null> {
    // Skip paths that recently failed (negative cache with TTL)
    if (this.isPathFailed(storagePath)) return null;

    // Create a timeout-aware signal that combines caller signal + timeout
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), PreviewCache.FETCH_TIMEOUT);
    const combinedSignal = signal
      ? this.combineSignals(signal, timeoutController.signal)
      : timeoutController.signal;

    try {
      // Get signed URL (deduplicated in API class)
      const { signed_url } = await api.getPreviewUrl(storagePath, combinedSignal);

      // Fetch as blob
      const response = await fetch(signed_url, { signal: combinedSignal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Success - remove from failed paths if it was there
      this.failedPaths.delete(storagePath);

      return {
        objectUrl,
        contentType,
        storagePath,
        timestamp: Date.now(),
      };
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.warn(`[PreviewCache] Failed to fetch ${storagePath}:`, err);
        // Add to negative cache with TTL (allows retry after expiry)
        this.failedPaths.set(storagePath, Date.now());
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private combineSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        return controller.signal;
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return controller.signal;
  }

  private addToCache(docId: string, docCache: DocumentPreviewCache): void {
    // Enforce LRU eviction
    while (this.cache.size >= this.maxSize) {
      const oldest = this.findOldestEntry();
      if (oldest) {
        this.removeFromCache(oldest);
      }
    }

    this.cache.set(docId, docCache);
  }

  private removeFromCache(docId: string): void {
    const docCache = this.cache.get(docId);
    if (docCache) {
      this.revokeDocumentUrls(docCache);
      this.cache.delete(docId);
    }
  }

  private revokeDocumentUrls(docCache: DocumentPreviewCache): void {
    if (docCache.primaryFile) {
      URL.revokeObjectURL(docCache.primaryFile.objectUrl);
    }
    for (const [, att] of docCache.attachments) {
      URL.revokeObjectURL(att.objectUrl);
    }
  }

  private findOldestEntry(): string | null {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, docCache] of this.cache) {
      if (docCache.timestamp < oldestTime) {
        oldestTime = docCache.timestamp;
        oldestId = id;
      }
    }

    return oldestId;
  }

  private isPreviewable(contentType: string, fileName: string): boolean {
    const isPdf = contentType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
    const isImage = contentType.startsWith('image/');
    return isPdf || isImage;
  }

  private getPreviewPaths(doc: ReviewDocument): string[] {
    const paths: string[] = [];

    // Primary file for non-email sources
    if (doc.primary_file?.storagePath && doc.source !== 'email') {
      if (this.isPreviewable(doc.primary_file.contentType, doc.primary_file.fileName)) {
        paths.push(doc.primary_file.storagePath);
      }
    }

    // Attachments
    if (doc.email_anhaenge_meta) {
      for (const att of doc.email_anhaenge_meta) {
        if (this.isPreviewable(att.contentType, att.name)) {
          paths.push(att.storagePath);
        }
      }
    }

    return paths;
  }

  private async processQueue(tasks: Array<() => Promise<void>>): Promise<void> {
    this.downloadQueue.push(...tasks);
    await this.processNextInQueue();
  }

  private async processNextInQueue(): Promise<void> {
    while (this.downloadQueue.length > 0 && this.activeDownloads < this.concurrencyLimit) {
      const task = this.downloadQueue.shift();
      if (task) {
        this.activeDownloads++;
        task()
          .finally(() => {
            this.activeDownloads--;
            this.processNextInQueue();
          });
      }
    }
  }
}

// =============================================================================
// Singleton instance
// =============================================================================

export const previewCache = new PreviewCache();
