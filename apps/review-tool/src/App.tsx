import { useState, useEffect, useCallback } from 'react';
import { AdminReviewApi, ReviewDocument, ReviewStats, Categories } from './lib/api';
import { PrefetchMode } from './lib/previewCache';
import { usePreviewPrefetch } from './hooks/usePreviewPrefetch';
import { StatsPanel } from './components/StatsPanel';
import { ReviewQueue } from './components/ReviewQueue';
import { DetailPanel } from './components/DetailPanel';


function App() {
  // API Key State
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('review-tool-api-key') || '';
  });
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Data State
  const [api, setApi] = useState<AdminReviewApi | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [categories, setCategories] = useState<Categories | null>(null);
  const [documents, setDocuments] = useState<ReviewDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<ReviewDocument | null>(null);

  // Loading State
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(false);

  // Filter State
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [filterOnlySuspect, setFilterOnlySuspect] = useState(false);
  const [filterEmailKategorie, setFilterEmailKategorie] = useState<string>('');
  const [filterKategorie, setFilterKategorie] = useState<string>(''); // Dokument-Kategorie filter (GPT)
  const [filterKategorieManual, setFilterKategorieManual] = useState<string>(''); // Korrigierte Kategorie filter
  const [filterMaxConfidence, setFilterMaxConfidence] = useState<number>(100);

  // Batch Selection State
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());
  const [batchConfirming, setBatchConfirming] = useState(false);
  const [batchEmailKategorie, setBatchEmailKategorie] = useState<string>('');
  const [batchKategorie, setBatchKategorie] = useState<string>('');

  // Rules Panel State

  // Prefetch Settings State
  const [prefetchMode, setPrefetchMode] = useState<PrefetchMode>(() => {
    return (localStorage.getItem('review-tool-prefetch-mode') as PrefetchMode) || 'visible+next';
  });

  // Preview Prefetch Hook
  const { prefetchOnHover, getCachedUrl, hasCachedPreview, getCacheStats } = usePreviewPrefetch({
    api,
    documents,
    selectedDocument,
    prefetchMode,
    visibleCount: 10,
    nextCount: 3,
  });

  // Save prefetch mode to localStorage
  useEffect(() => {
    localStorage.setItem('review-tool-prefetch-mode', prefetchMode);
  }, [prefetchMode]);

  // Connect to API
  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setConnectionError('Bitte API Key eingeben');
      return;
    }

    const newApi = new AdminReviewApi(apiKey);
    try {
      setConnectionError(null);
      await newApi.health();
      localStorage.setItem('review-tool-api-key', apiKey);
      setApi(newApi);
      setIsConnected(true);
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen');
      setIsConnected(false);
    }
  };

  // Disconnect
  const handleDisconnect = () => {
    setIsConnected(false);
    setApi(null);
    setStats(null);
    setDocuments([]);
    setSelectedDocument(null);
    setBatchSelectedIds(new Set());
  };

  // Load stats
  const loadStats = useCallback(async () => {
    if (!api) return;
    try {
      setLoadingStats(true);
      const result = await api.getStats();
      setStats(result);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [api]);

  // Load categories
  const loadCategories = useCallback(async () => {
    if (!api) return;
    try {
      const result = await api.getCategories();
      setCategories(result);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, [api]);

  // Load queue
  const loadQueue = useCallback(async () => {
    if (!api) return;
    try {
      setLoadingQueue(true);
      const result = await api.getQueue({
        status: filterStatus === 'ki_review' ? 'all' : filterStatus,
        only_suspect: filterOnlySuspect,
        email_kategorie: filterEmailKategorie || undefined,
        kategorie: filterKategorie || undefined,
        ki_review: filterStatus === 'ki_review' ? true : undefined,
        limit: 100,
      });
      // Client-side filters
      let items = result.items;
      if (filterMaxConfidence < 100) {
        items = items.filter(doc =>
          doc.email_kategorie_confidence === null ||
          doc.email_kategorie_confidence * 100 <= filterMaxConfidence
        );
      }
      if (filterKategorieManual) {
        items = items.filter(doc => doc.kategorie_manual === filterKategorieManual);
      }
      setDocuments(items);
      setBatchSelectedIds(new Set()); // Clear batch selection on reload
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoadingQueue(false);
    }
  }, [api, filterStatus, filterOnlySuspect, filterEmailKategorie, filterKategorie, filterKategorieManual, filterMaxConfidence]);

  // Initial load when connected (stats + categories only once)
  useEffect(() => {
    if (isConnected && api) {
      loadStats();
      loadCategories();
    }
  }, [isConnected, api, loadStats, loadCategories]);

  // Load queue on connect and when filters change
  useEffect(() => {
    if (isConnected && api) {
      loadQueue();
    }
  }, [isConnected, api, loadQueue]);

  // Handle document update
  const handleDocumentUpdate = () => {
    loadStats();
    loadQueue();
  };

  // Handle next document (auto-advance after save)
  const handleNextDocument = useCallback(() => {
    if (!selectedDocument || documents.length === 0) {
      setSelectedDocument(null);
      return;
    }
    const currentIndex = documents.findIndex(d => d.id === selectedDocument.id);
    if (currentIndex < documents.length - 1) {
      // Select next document
      setSelectedDocument(documents[currentIndex + 1]);
    } else if (currentIndex === documents.length - 1 && documents.length > 1) {
      // Was last item, select previous
      setSelectedDocument(documents[currentIndex - 1]);
    } else {
      // No more documents
      setSelectedDocument(null);
    }
  }, [selectedDocument, documents]);

  // Batch selection handlers
  const handleToggleBatchSelect = (id: string) => {
    setBatchSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setBatchSelectedIds(new Set(documents.map(d => d.id)));
  };

  const handleDeselectAll = () => {
    setBatchSelectedIds(new Set());
  };

  // Batch confirm (approve or correct all selected)
  const handleBatchConfirm = async () => {
    if (!api || batchSelectedIds.size === 0) return;

    setBatchConfirming(true);
    let successCount = 0;
    let failCount = 0;

    // Determine if this is a correction (categories set) or just approval
    const isCorrection = batchEmailKategorie || batchKategorie;
    const action = isCorrection ? 'correct' : 'approve';

    for (const id of batchSelectedIds) {
      try {
        const updateData: {
          action: 'approve' | 'correct';
          reviewed_by: string;
          email_kategorie_manual?: string;
          kategorie_manual?: string;
        } = {
          action,
          reviewed_by: 'admin',
        };

        // Add category corrections if set
        if (batchEmailKategorie) {
          updateData.email_kategorie_manual = batchEmailKategorie;
        }
        if (batchKategorie) {
          updateData.kategorie_manual = batchKategorie;
        }

        await api.updateLabel(id, updateData);
        successCount++;
      } catch (err) {
        console.error(`Failed to ${action} ${id}:`, err);
        failCount++;
      }
    }

    setBatchConfirming(false);
    setBatchSelectedIds(new Set());
    // Reset batch category selections
    setBatchEmailKategorie('');
    setBatchKategorie('');
    loadStats();
    loadQueue();

    // Show result
    const actionText = isCorrection ? 'korrigiert' : 'bestaetigt';
    if (failCount > 0) {
      alert(`${successCount} ${actionText}, ${failCount} fehlgeschlagen`);
    }
  };

  // Login Screen
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Review Tool</h1>
          <p className="text-gray-600 mb-6">Kategorisierung pruefen und korrigieren</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                INTERNAL_API_KEY
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                placeholder="API Key eingeben..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {connectionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {connectionError}
              </div>
            )}

            <button
              onClick={handleConnect}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Verbinden
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Der API Key wird lokal im Browser gespeichert und nie an Dritte uebertragen.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main App
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Review Tool</h1>
            <p className="text-sm text-gray-500">Kategorisierung pruefen</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Prefetch Mode Toggle */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Prefetch:</label>
              <select
                value={prefetchMode}
                onChange={(e) => setPrefetchMode(e.target.value as PrefetchMode)}
                className="text-xs px-2 py-1 border border-gray-300 rounded"
                title="Preview-Cache Modus"
              >
                <option value="off">Aus</option>
                <option value="visible">10 sichtbar</option>
                <option value="visible+next">10+Next3</option>
              </select>
              {prefetchMode !== 'off' && (
                <span className="text-xs text-gray-400" title="Cache Status">
                  ({getCacheStats().size}/{getCacheStats().maxSize})
                </span>
              )}
            </div>
            <button
              onClick={handleDisconnect}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Panel */}
        <StatsPanel stats={stats} loading={loadingStats} />

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="pending">Ausstehend</option>
                <option value="ki_review">KI-Review</option>
                <option value="approved">Bestaetigt</option>
                <option value="corrected">Korrigiert</option>
                <option value="error">Fehler</option>
                <option value="all">Alle</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Email-Kategorie</label>
              <select
                value={filterEmailKategorie}
                onChange={(e) => setFilterEmailKategorie(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Alle</option>
                {categories?.email_kategorien.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Dok.-Kategorie (GPT)</label>
              <select
                value={filterKategorie}
                onChange={(e) => setFilterKategorie(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Alle</option>
                {categories?.dokument_kategorien.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Dok.-Kat. (korrigiert)</label>
              <select
                value={filterKategorieManual}
                onChange={(e) => setFilterKategorieManual(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Alle</option>
                {categories?.dokument_kategorien.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Confidence Filter Slider */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Max. Confidence: {filterMaxConfidence}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={filterMaxConfidence}
                onChange={(e) => setFilterMaxConfidence(Number(e.target.value))}
                className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="only-suspect"
                checked={filterOnlySuspect}
                onChange={(e) => setFilterOnlySuspect(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="only-suspect" className="text-sm text-gray-700">
                Nur Verdaechtige (Sonstiges, niedrige Confidence, Fehler)
              </label>
            </div>

            <div className="ml-auto pt-5 flex items-center gap-2">
              {batchSelectedIds.size > 0 && (
                <>
                  {/* Batch Email-Kategorie Dropdown */}
                  <div>
                    <select
                      value={batchEmailKategorie}
                      onChange={(e) => setBatchEmailKategorie(e.target.value)}
                      className="px-2 py-2 border border-gray-300 rounded-lg text-sm"
                      title="Email-Kategorie fuer alle setzen"
                    >
                      <option value="">Email-Kat. (keine Aenderung)</option>
                      {categories?.email_kategorien.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Batch Dokument-Kategorie Dropdown */}
                  <div>
                    <select
                      value={batchKategorie}
                      onChange={(e) => setBatchKategorie(e.target.value)}
                      className="px-2 py-2 border border-gray-300 rounded-lg text-sm"
                      title="Dok-Kategorie fuer alle setzen"
                    >
                      <option value="">Dok-Kat. (keine Aenderung)</option>
                      {categories?.dokument_kategorien.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Batch Confirm Button */}
                  <button
                    onClick={handleBatchConfirm}
                    disabled={batchConfirming}
                    className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center gap-2 ${
                      batchEmailKategorie || batchKategorie ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {batchConfirming ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {batchEmailKategorie || batchKategorie ? 'Korrigieren...' : 'Bestaetigen...'}
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {batchSelectedIds.size} {batchEmailKategorie || batchKategorie ? 'Korrigieren' : 'Bestaetigen'}
                      </>
                    )}
                  </button>
                </>
              )}
              <button
                onClick={() => { loadStats(); loadQueue(); }}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Aktualisieren
              </button>
            </div>
          </div>
        </div>

        {/* Main Grid - with scroll behavior */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: 'calc(100vh - 320px)' }}>
          {/* Queue - scrollable */}
          <div className="lg:col-span-1 flex flex-col">
            <h2 className="text-lg font-medium text-gray-900 mb-2 flex-shrink-0">
              Queue ({documents.length} Dokumente)
              {batchSelectedIds.size > 0 && (
                <span className="ml-2 text-sm text-blue-600">
                  ({batchSelectedIds.size} ausgewaehlt)
                </span>
              )}
            </h2>
            <div className="flex-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
              <ReviewQueue
                items={documents}
                loading={loadingQueue}
                selectedId={selectedDocument?.id || null}
                onSelect={setSelectedDocument}
                selectedIds={batchSelectedIds}
                onToggleSelect={handleToggleBatchSelect}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
                onHover={prefetchOnHover}
                hasCachedPreview={hasCachedPreview}
              />
            </div>
          </div>

          {/* Detail Panel - sticky */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-4">
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                Details
              </h2>
              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
                {api && (
                  <DetailPanel
                    document={selectedDocument}
                    categories={categories}
                    api={api}
                    onUpdate={handleDocumentUpdate}
                    onNextDocument={handleNextDocument}
                    getCachedUrl={getCachedUrl}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
        Review Tool v0.7.0 | KI-Review Notizen
      </footer>

    </div>
  );
}

export default App;
