import { useState, useEffect, useCallback } from 'react';
import { AdminReviewApi, ReviewDocument, ReviewStats, Categories } from './lib/api';
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
        status: filterStatus,
        only_suspect: filterOnlySuspect,
        email_kategorie: filterEmailKategorie || undefined,
        limit: 100,
      });
      setDocuments(result.items);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoadingQueue(false);
    }
  }, [api, filterStatus, filterOnlySuspect, filterEmailKategorie]);

  // Initial load when connected
  useEffect(() => {
    if (isConnected && api) {
      loadStats();
      loadCategories();
      loadQueue();
    }
  }, [isConnected, api, loadStats, loadCategories, loadQueue]);

  // Reload queue when filters change
  useEffect(() => {
    if (isConnected && api) {
      loadQueue();
    }
  }, [filterStatus, filterOnlySuspect, filterEmailKategorie, isConnected, api, loadQueue]);

  // Handle document update
  const handleDocumentUpdate = () => {
    loadStats();
    loadQueue();
    setSelectedDocument(null);
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
          <button
            onClick={handleDisconnect}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Abmelden
          </button>
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
                <option value="approved">Bestaetigt</option>
                <option value="corrected">Korrigiert</option>
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

            <div className="ml-auto pt-5">
              <button
                onClick={() => { loadStats(); loadQueue(); }}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Aktualisieren
              </button>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Queue */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              Queue ({documents.length} Dokumente)
            </h2>
            <ReviewQueue
              items={documents}
              loading={loadingQueue}
              selectedId={selectedDocument?.id || null}
              onSelect={setSelectedDocument}
            />
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              Details
            </h2>
            {api && (
              <DetailPanel
                document={selectedDocument}
                categories={categories}
                api={api}
                onUpdate={handleDocumentUpdate}
              />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
        Review Tool v0.1.0 | Spaeter 1:1 ins Frontend uebertragbar
      </footer>
    </div>
  );
}

export default App;
