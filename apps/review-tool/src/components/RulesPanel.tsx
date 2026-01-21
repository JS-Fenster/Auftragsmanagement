import { useState, useEffect, useCallback } from 'react';
import { AdminReviewApi, RulesSettings, ClassificationRule, RulesResponse, EvidenceCluster, ClustersResponse, formatDate } from '../lib/api';

interface RulesPanelProps {
  api: AdminReviewApi;
  onClose: () => void;
}

export function RulesPanel({ api, onClose }: RulesPanelProps) {
  // Settings State
  const [settings, setSettings] = useState<RulesSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editMode, setEditMode] = useState<'manual' | 'auto'>('manual');

  // Rules State
  const [rulesData, setRulesData] = useState<RulesResponse | null>(null);
  const [loadingRules, setLoadingRules] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Clusters State
  const [clustersData, setClustersData] = useState<ClustersResponse | null>(null);
  const [loadingClusters, setLoadingClusters] = useState(true);
  const [clusterFilterStatus, setClusterFilterStatus] = useState<string>('ready');
  const [generatingRule, setGeneratingRule] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'clusters' | 'rules' | 'settings'>('clusters');

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      setLoadingSettings(true);
      const result = await api.getSettings();
      setSettings(result);
      setEditMode(result.activation_mode);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  }, [api]);

  // Load rules
  const loadRules = useCallback(async () => {
    try {
      setLoadingRules(true);
      const result = await api.getRules({ status: filterStatus === 'all' ? undefined : filterStatus });
      setRulesData(result);
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoadingRules(false);
    }
  }, [api, filterStatus]);

  // Load clusters
  const loadClusters = useCallback(async () => {
    try {
      setLoadingClusters(true);
      const result = await api.getClusters({ status: clusterFilterStatus === 'all' ? undefined : clusterFilterStatus });
      setClustersData(result);
    } catch (err) {
      console.error('Failed to load clusters:', err);
    } finally {
      setLoadingClusters(false);
    }
  }, [api, clusterFilterStatus]);

  // Generate rule from cluster
  const handleGenerateRule = async (clusterId: string) => {
    try {
      setGeneratingRule(clusterId);
      const result = await api.generateRule(clusterId);
      console.log('Rule generated:', result);
      // Reload both clusters and rules
      await Promise.all([loadClusters(), loadRules()]);
      // Switch to rules tab to show the new draft
      setActiveTab('rules');
      setFilterStatus('draft');
    } catch (err) {
      console.error('Failed to generate rule:', err);
      alert('Fehler beim Generieren der Regel: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setGeneratingRule(null);
    }
  };

  // Initial load
  useEffect(() => {
    loadSettings();
    loadRules();
    loadClusters();
  }, [loadSettings, loadRules, loadClusters]);

  // Save settings
  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      setSavingSettings(true);
      await api.updateSettings({ activation_mode: editMode });
      setSettings({ ...settings, activation_mode: editMode });
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Fehler beim Speichern der Einstellungen');
    } finally {
      setSavingSettings(false);
    }
  };

  // Rule actions
  const handleActivateRule = async (ruleId: string) => {
    try {
      setActionLoading(ruleId);
      await api.activateRule(ruleId);
      loadRules();
    } catch (err) {
      console.error('Failed to activate rule:', err);
      alert('Fehler beim Aktivieren der Regel');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisableRule = async (ruleId: string) => {
    try {
      setActionLoading(ruleId);
      await api.disableRule(ruleId);
      loadRules();
    } catch (err) {
      console.error('Failed to disable rule:', err);
      alert('Fehler beim Deaktivieren der Regel');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePauseRule = async (ruleId: string) => {
    try {
      setActionLoading(ruleId);
      await api.pauseRule(ruleId, 'Manuell pausiert');
      loadRules();
    } catch (err) {
      console.error('Failed to pause rule:', err);
      alert('Fehler beim Pausieren der Regel');
    } finally {
      setActionLoading(null);
    }
  };

  // Status badge colors
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'paused':
        return 'bg-orange-100 text-orange-800';
      case 'disabled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Aktiv';
      case 'draft': return 'Entwurf';
      case 'paused': return 'Pausiert';
      case 'disabled': return 'Deaktiviert';
      default: return status;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Regeln & Einstellungen</h2>
            <p className="text-sm text-gray-500">Automatische Klassifizierungsregeln verwalten</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-2 border-b border-gray-200 flex gap-4">
          <button
            onClick={() => setActiveTab('clusters')}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              activeTab === 'clusters'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Clusters
            {clustersData && (
              <span className="ml-2 text-xs">
                ({clustersData.counts.ready} bereit)
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              activeTab === 'rules'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Regeln
            {rulesData && (
              <span className="ml-2 text-xs">
                ({rulesData.counts.active} aktiv, {rulesData.counts.draft} Entwuerfe)
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              activeTab === 'settings'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Einstellungen
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'clusters' && (
            <div className="space-y-4">
              {/* Info Banner */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-purple-800 mb-1">Learning Loop</h3>
                <p className="text-sm text-purple-700">
                  Hier siehst du Gruppen von aehnlichen Korrekturen. Wenn genug Belege gesammelt wurden,
                  kannst du mit einem Klick eine KI-generierte Regel erstellen.
                </p>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-4">
                <select
                  value={clusterFilterStatus}
                  onChange={(e) => setClusterFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">Alle ({(clustersData?.counts.pending || 0) + (clustersData?.counts.ready || 0) + (clustersData?.counts.rule_generated || 0)})</option>
                  <option value="ready">Bereit ({clustersData?.counts.ready || 0})</option>
                  <option value="pending">Sammelnd ({clustersData?.counts.pending || 0})</option>
                  <option value="rule_generated">Regel erstellt ({clustersData?.counts.rule_generated || 0})</option>
                </select>
                <button
                  onClick={loadClusters}
                  className="text-sm text-purple-600 hover:text-purple-800"
                >
                  Aktualisieren
                </button>
              </div>

              {/* Clusters List */}
              {loadingClusters ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse h-24 bg-gray-100 rounded-lg"></div>
                  ))}
                </div>
              ) : clustersData?.clusters.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <p className="mt-2">Keine Clusters gefunden</p>
                  <p className="text-sm text-gray-400">
                    Clusters werden automatisch aus Korrekturen erstellt.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clustersData?.clusters.map(cluster => (
                    <ClusterCard
                      key={cluster.id}
                      cluster={cluster}
                      onGenerateRule={() => handleGenerateRule(cluster.id)}
                      generating={generatingRule === cluster.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Activation Mode */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Aktivierungsmodus</h3>
                {loadingSettings ? (
                  <div className="animate-pulse h-20 bg-gray-200 rounded"></div>
                ) : (
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="activation_mode"
                        value="manual"
                        checked={editMode === 'manual'}
                        onChange={() => setEditMode('manual')}
                        className="mt-1"
                      />
                      <div>
                        <span className="font-medium text-gray-900">Manual</span>
                        <p className="text-sm text-gray-500">
                          Regeln werden als Entwurf erstellt. Du musst sie manuell aktivieren.
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="activation_mode"
                        value="auto"
                        checked={editMode === 'auto'}
                        onChange={() => setEditMode('auto')}
                        className="mt-1"
                      />
                      <div>
                        <span className="font-medium text-gray-900">Auto</span>
                        <p className="text-sm text-gray-500">
                          Regeln werden automatisch aktiviert wenn die Kriterien erfuellt sind.
                        </p>
                      </div>
                    </label>

                    {editMode !== settings?.activation_mode && (
                      <button
                        onClick={handleSaveSettings}
                        disabled={savingSettings}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingSettings ? 'Speichern...' : 'Speichern'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Thresholds */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Auto-Aktivierungs-Kriterien</h3>
                {loadingSettings ? (
                  <div className="animate-pulse h-24 bg-gray-200 rounded"></div>
                ) : settings ? (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Min. Belege:</span>
                      <span className="ml-2 font-medium">{settings.thresholds.min_evidence}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Min. Backtest:</span>
                      <span className="ml-2 font-medium">{settings.thresholds.min_backtest_matches}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Min. Precision:</span>
                      <span className="ml-2 font-medium">{(settings.thresholds.min_precision * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-gray-400">
                  Diese Werte bestimmen, wann eine Regel im Auto-Modus aktiviert wird.
                </p>
              </div>

              {/* Kill-Switch Info */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-orange-800 mb-2">Kill-Switch</h3>
                <p className="text-sm text-orange-700">
                  Wenn eine aktive Regel innerhalb von 48 Stunden 2+ falsche Klassifizierungen
                  hat, wird sie automatisch pausiert und du wirst benachrichtigt.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-4">
              {/* Filter */}
              <div className="flex items-center gap-4">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">Alle Status</option>
                  <option value="active">Aktiv ({rulesData?.counts.active || 0})</option>
                  <option value="draft">Entwurf ({rulesData?.counts.draft || 0})</option>
                  <option value="paused">Pausiert ({rulesData?.counts.paused || 0})</option>
                  <option value="disabled">Deaktiviert ({rulesData?.counts.disabled || 0})</option>
                </select>
                <button
                  onClick={loadRules}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Aktualisieren
                </button>
              </div>

              {/* Rules List */}
              {loadingRules ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse h-24 bg-gray-100 rounded-lg"></div>
                  ))}
                </div>
              ) : rulesData?.rules.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="mt-2">Keine Regeln gefunden</p>
                  <p className="text-sm text-gray-400">
                    Regeln werden automatisch aus Korrekturen erstellt.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rulesData?.rules.map(rule => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      onActivate={() => handleActivateRule(rule.id)}
                      onDisable={() => handleDisableRule(rule.id)}
                      onPause={() => handlePauseRule(rule.id)}
                      loading={actionLoading === rule.id}
                      getStatusBadge={getStatusBadge}
                      getStatusLabel={getStatusLabel}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Rule Card Component
interface RuleCardProps {
  rule: ClassificationRule;
  onActivate: () => void;
  onDisable: () => void;
  onPause: () => void;
  loading: boolean;
  getStatusBadge: (status: string) => string;
  getStatusLabel: (status: string) => string;
}

function RuleCard({ rule, onActivate, onDisable, onPause, loading, getStatusBadge, getStatusLabel }: RuleCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900">{rule.name}</h4>
            <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(rule.status)}`}>
              {getStatusLabel(rule.status)}
            </span>
            {rule.paused_reason && (
              <span className="text-xs text-orange-600" title={rule.paused_reason}>
                ({rule.paused_reason})
              </span>
            )}
          </div>
          {rule.description && (
            <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {loading ? (
            <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <>
              {rule.status === 'draft' && (
                <button
                  onClick={onActivate}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Aktivieren
                </button>
              )}
              {rule.status === 'active' && (
                <>
                  <button
                    onClick={onPause}
                    className="px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                  >
                    Pausieren
                  </button>
                  <button
                    onClick={onDisable}
                    className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Deaktivieren
                  </button>
                </>
              )}
              {rule.status === 'paused' && (
                <>
                  <button
                    onClick={onActivate}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Reaktivieren
                  </button>
                  <button
                    onClick={onDisable}
                    className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Deaktivieren
                  </button>
                </>
              )}
              {rule.status === 'disabled' && (
                <button
                  onClick={onActivate}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Aktivieren
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-3 flex items-center gap-6 text-xs text-gray-500">
        <div>
          <span className="text-gray-400">Ziel:</span>{' '}
          {rule.target_email_kategorie && (
            <span className="font-medium text-gray-700">{rule.target_email_kategorie}</span>
          )}
          {rule.target_email_kategorie && rule.target_kategorie && ' / '}
          {rule.target_kategorie && (
            <span className="font-medium text-gray-700">{rule.target_kategorie}</span>
          )}
        </div>
        <div>
          <span className="text-gray-400">Belege:</span>{' '}
          <span className="font-medium">{rule.evidence_count}</span>
        </div>
        <div>
          <span className="text-gray-400">Precision:</span>{' '}
          <span className="font-medium">{(rule.precision_estimate * 100).toFixed(0)}%</span>
        </div>
        {rule.misfire_count > 0 && (
          <div className="text-orange-600">
            <span>Fehlklassifizierungen:</span>{' '}
            <span className="font-medium">{rule.misfire_count}</span>
          </div>
        )}
      </div>

      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs text-blue-600 hover:text-blue-800"
      >
        {expanded ? 'Weniger anzeigen' : 'Details anzeigen'}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          {/* Conditions */}
          <div>
            <span className="text-xs text-gray-400">Bedingungen:</span>
            <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(rule.conditions, null, 2)}
            </pre>
          </div>

          {/* Examples */}
          {rule.examples.length > 0 && (
            <div>
              <span className="text-xs text-gray-400">Beispiele:</span>
              <ul className="mt-1 space-y-1">
                {rule.examples.map(ex => (
                  <li key={ex.id} className="text-xs text-gray-600">
                    <span className="font-mono">{ex.email_von_email}</span>
                    {ex.email_betreff && <span className="text-gray-400"> - {ex.email_betreff}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex gap-4 text-xs text-gray-400">
            <span>Erstellt: {formatDate(rule.created_at)}</span>
            {rule.activated_at && (
              <span>Aktiviert: {formatDate(rule.activated_at)} ({rule.activated_by})</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Cluster Card Component
interface ClusterCardProps {
  cluster: EvidenceCluster;
  onGenerateRule: () => void;
  generating: boolean;
}

function ClusterCard({ cluster, onGenerateRule, generating }: ClusterCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rule_generated':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready': return 'Bereit';
      case 'pending': return 'Sammelnd';
      case 'rule_generated': return 'Regel erstellt';
      default: return status;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(cluster.status)}`}>
              {getStatusLabel(cluster.status)}
            </span>
            <span className="text-sm font-medium text-gray-900">
              {cluster.evidence_count} Belege
            </span>
          </div>

          {/* Target Categories */}
          <div className="mt-1 text-sm text-gray-600">
            <span className="text-gray-400">Ziel:</span>{' '}
            {cluster.target_email_kategorie && (
              <span className="font-medium text-purple-700">{cluster.target_email_kategorie}</span>
            )}
            {cluster.target_email_kategorie && cluster.target_kategorie && ' / '}
            {cluster.target_kategorie && (
              <span className="font-medium text-purple-700">{cluster.target_kategorie}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {generating ? (
            <div className="flex items-center gap-2 text-purple-600">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">KI generiert...</span>
            </div>
          ) : cluster.status === 'ready' ? (
            <button
              onClick={onGenerateRule}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Regel generieren
            </button>
          ) : cluster.status === 'rule_generated' ? (
            <span className="text-xs text-gray-500">
              Regel bereits erstellt
            </span>
          ) : (
            <span className="text-xs text-gray-500">
              Noch {5 - cluster.evidence_count} Belege noetig
            </span>
          )}
        </div>
      </div>

      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs text-purple-600 hover:text-purple-800"
      >
        {expanded ? 'Weniger anzeigen' : 'Beispiele anzeigen'}
      </button>

      {/* Expanded: Examples */}
      {expanded && cluster.examples.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-400">Beispiel-Dokumente:</span>
          <ul className="mt-2 space-y-2">
            {cluster.examples.map(ex => (
              <li key={ex.id} className="text-sm bg-gray-50 p-2 rounded">
                <div className="font-mono text-xs text-gray-600">{ex.email_von_email}</div>
                {ex.email_von_name && (
                  <div className="text-xs text-gray-500">{ex.email_von_name}</div>
                )}
                {ex.email_betreff && (
                  <div className="text-sm text-gray-700 mt-1">{ex.email_betreff}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cluster Key (for debugging) */}
      {expanded && (
        <div className="mt-2 text-xs text-gray-400">
          <span>Cluster-Key: </span>
          <code className="bg-gray-100 px-1 rounded">{cluster.cluster_key}</code>
        </div>
      )}
    </div>
  );
}
