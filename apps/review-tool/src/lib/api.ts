// =============================================================================
// API Client for Admin Review
// =============================================================================

const SUPABASE_URL = 'https://rsmjgdujlpnydbsfuiek.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbWpnZHVqbHBueWRic2Z1aWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NjY0NTcsImV4cCI6MjA4MTM0MjQ1N30.da6ZwbEfqhqdsZlKYNUGP7uvu8A7qwlVLBI0IK4uQfc';

// =============================================================================
// Types
// =============================================================================

export interface PrimaryFile {
  storagePath: string;
  fileName: string;
  contentType: string;
}

export interface ReviewDocument {
  id: string;
  created_at: string;
  updated_at: string;
  kategorie: string;
  kategorie_manual: string | null;
  email_kategorie: string | null;
  email_kategorie_confidence: number | null;
  email_kategorie_manual: string | null;
  email_betreff: string | null;
  email_von_email: string | null;
  email_von_name: string | null;
  email_postfach: string | null;
  email_hat_anhaenge: boolean;
  email_anhaenge_count: number;
  email_anhaenge_meta: AttachmentMeta[] | null;
  email_body_text: string | null;
  inhalt_zusammenfassung: string | null;
  processing_status: string;
  processing_last_error: string | null;
  review_status: 'pending' | 'approved' | 'corrected' | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  dokument_url: string | null;
  source: string | null;
  rule_fingerprint: string | null;
  primary_file: PrimaryFile | null;
  // v1.4.0: Unterschrift-Felder
  unterschrift_erforderlich: boolean | null;
  empfang_unterschrift: boolean | null;
  unterschrift: string | null;
}

export interface AttachmentMeta {
  id: string;
  name: string;
  size: number;
  contentType: string;
  storagePath: string;
  hash: string;
}

export interface ReviewStats {
  review_status: {
    pending: number;
    approved: number;
    corrected: number;
  };
  suspects_48h: {
    sonstiges_dokument: number;
    sonstiges_email: number;
    sonstiges_percent: string;
  };
  errors_total: number;
  pending_reviews: number;
  last_updated: string;
}

export interface Categories {
  dokument_kategorien: string[];
  email_kategorien: string[];
}

export interface QueueResponse {
  items: ReviewDocument[];
  count: number;
  offset: number;
  limit: number;
}

export interface LabelUpdateRequest {
  action: 'approve' | 'correct';
  kategorie_manual?: string;
  email_kategorie_manual?: string;
  reviewed_by?: string;
  // v1.4.0: Unterschrift-Felder
  empfang_unterschrift?: boolean;
  unterschrift?: string | null;
  unterschrift_erforderlich?: boolean;
}

export interface PreviewResponse {
  signed_url: string;
  expires_in: number;
  path: string;
}

export interface RulesSettings {
  activation_mode: 'manual' | 'auto';
  thresholds: {
    min_evidence: number;
    min_backtest_matches: number;
    min_precision: number;
  };
}

export interface ClassificationRule {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string | null;
  conditions: Record<string, unknown>;
  target_email_kategorie: string | null;
  target_kategorie: string | null;
  status: 'draft' | 'active' | 'disabled' | 'paused';
  activated_by: 'manual' | 'auto' | null;
  activated_at: string | null;
  paused_reason: string | null;
  evidence_count: number;
  evidence_document_ids: string[];
  backtest_matches: number;
  precision_estimate: number;
  validation_metrics: Record<string, unknown>;
  misfire_count: number;
  last_misfire_at: string | null;
  created_by: string;
  examples: Array<{
    id: string;
    email_betreff: string | null;
    email_von_email: string | null;
  }>;
}

export interface RulesResponse {
  rules: ClassificationRule[];
  count: number;
  offset: number;
  limit: number;
  counts: {
    draft: number;
    active: number;
    disabled: number;
    paused: number;
  };
}

export interface EvidenceCluster {
  id: string;
  created_at: string;
  updated_at: string;
  cluster_key: string;
  target_email_kategorie: string | null;
  target_kategorie: string | null;
  evidence_count: number;
  evidence_document_ids: string[];
  status: 'pending' | 'ready' | 'rule_generated';
  generated_rule_id: string | null;
  examples: Array<{
    id: string;
    email_betreff: string | null;
    email_von_email: string | null;
    email_von_name: string | null;
  }>;
}

export interface ClustersResponse {
  clusters: EvidenceCluster[];
  count: number;
  offset: number;
  limit: number;
  counts: {
    pending: number;
    ready: number;
    rule_generated: number;
  };
}

export interface GenerateRuleResponse {
  success: boolean;
  rule_id: string;
  cluster_id: string;
  backtest_results: {
    total_matches: number;
    correct_matches: number;
    false_positives: number;
    precision: number;
    coverage: number;
    time_window_days: number;
  };
}

// =============================================================================
// API Client
// =============================================================================

export class AdminReviewApi {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = `${SUPABASE_URL}/functions/v1/admin-review`;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-api-key': this.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));

      // Specific handling for 404 - likely outdated backend
      if (response.status === 404) {
        const endpoint = path.split('?')[0];
        throw new Error(`Endpoint ${endpoint} nicht gefunden (404). Backend-Version moeglicherweise veraltet - bitte admin-review Function deployen.`);
      }

      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Health check
  async health(): Promise<{ status: string; version: string }> {
    return this.fetch('?health=1');
  }

  // Get categories
  async getCategories(): Promise<Categories> {
    return this.fetch('/categories');
  }

  // Get statistics
  async getStats(): Promise<ReviewStats> {
    return this.fetch('/stats');
  }

  // Get review queue
  async getQueue(params: {
    status?: string;
    only_suspect?: boolean;
    kategorie?: string;
    email_kategorie?: string;
    limit?: number;
    offset?: number;
    since?: string;
    until?: string;
  } = {}): Promise<QueueResponse> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.only_suspect) searchParams.set('only_suspect', '1');
    if (params.kategorie) searchParams.set('kategorie', params.kategorie);
    if (params.email_kategorie) searchParams.set('email_kategorie', params.email_kategorie);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));
    if (params.since) searchParams.set('since', params.since);
    if (params.until) searchParams.set('until', params.until);

    const query = searchParams.toString();
    return this.fetch(query ? `?${query}` : '');
  }

  // Update label
  async updateLabel(documentId: string, data: LabelUpdateRequest): Promise<{ success: boolean }> {
    return this.fetch(`/${documentId}/label`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Get preview URL
  async getPreviewUrl(path: string): Promise<PreviewResponse> {
    return this.fetch(`/preview?path=${encodeURIComponent(path)}`);
  }

  // Get rule suggestions
  async getRuleSuggestions(): Promise<{
    suggestions: Array<{
      fingerprint: string;
      confirmed_count: number;
      suggested_email_kategorie: string | null;
      suggested_kategorie: string | null;
    }>;
    count: number;
  }> {
    return this.fetch('/rule-suggestions');
  }

  // Get rules settings
  async getSettings(): Promise<RulesSettings> {
    return this.fetch('/settings');
  }

  // Update rules settings
  async updateSettings(data: Partial<{
    activation_mode: 'manual' | 'auto';
    min_evidence: number;
    min_backtest_matches: number;
    min_precision: number;
  }>): Promise<{ success: boolean; updated: number }> {
    return this.fetch('/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Get classification rules
  async getRules(params: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<RulesResponse> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));

    const query = searchParams.toString();
    return this.fetch(query ? `/rules?${query}` : '/rules');
  }

  // Activate a rule
  async activateRule(ruleId: string): Promise<{ success: boolean; rule_id: string; new_status: string }> {
    return this.fetch(`/rules/${ruleId}/activate`, {
      method: 'POST',
    });
  }

  // Disable a rule
  async disableRule(ruleId: string): Promise<{ success: boolean; rule_id: string; new_status: string }> {
    return this.fetch(`/rules/${ruleId}/disable`, {
      method: 'POST',
    });
  }

  // Pause a rule
  async pauseRule(ruleId: string, reason?: string): Promise<{ success: boolean; rule_id: string; new_status: string }> {
    return this.fetch(`/rules/${ruleId}/pause`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Get evidence clusters
  async getClusters(params: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ClustersResponse> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));

    const query = searchParams.toString();
    return this.fetch(query ? `/clusters?${query}` : '/clusters');
  }

  // Generate rule from cluster (calls rule-generator function)
  async generateRule(clusterId: string): Promise<GenerateRuleResponse> {
    const url = `${SUPABASE_URL}/functions/v1/rule-generator/generate`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({ cluster_id: clusterId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function getConfidenceColor(confidence: number | null): string {
  if (confidence === null) return 'text-gray-400';
  if (confidence >= 0.8) return 'text-green-600';
  if (confidence >= 0.6) return 'text-yellow-600';
  return 'text-red-600';
}

export function getStatusBadgeColor(status: string | null): string {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-800';
    case 'corrected':
      return 'bg-blue-100 text-blue-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
