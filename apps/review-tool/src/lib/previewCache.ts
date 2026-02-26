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

  private async fetchAndCache(
    storagePath: string,
    contentType: string,
    api: AdminReviewApi,
    signal?: AbortSignal
  ): Promise<CachedPreview | null> {
    try {
      // Get signed URL (deduplicated in API class)
      const { signed_url } = await api.getPreviewUrl(storagePath);

      // Fetch as blob
      const response = await fetch(signed_url, { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      return {
        objectUrl,
        contentType,
        storagePath,
        timestamp: Date.now(),
      };
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.warn(`[PreviewCache] Failed to fetch ${storagePath}:`, err);
      }
      return null;
    }
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
