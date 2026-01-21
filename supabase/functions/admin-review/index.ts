// =============================================================================
// Admin Review API - Review Queue, Labeling, Preview, Rules, Learning Loop
// Version: 1.7.0 - 2026-01-21
// =============================================================================
// Aenderungen v1.7.0:
// - NEU: Kategorien Reiseunterlagen, Kundenbestellung, Zahlungsavis
// - NEU: Shared categories v2.2 mit erweiterten Heuristik-Regeln
//
// Aenderungen v1.6.0:
// - NEU: Kategorien Produktdatenblatt, Finanzierung, Leasing
// - NEU: Shared categories v2.0 mit Heuristik-Support
//
// Aenderungen v1.5.0:
// - NEU: Taxonomie-Update - shared categories, canonicalize
// - NEU: Kategorien Gutschrift, Abnahmeprotokoll, Reklamation, Vertrag
// - NEU: Brief_eingehend / Brief_ausgehend (ersetzt Brief_von_*/Brief_an_*)
// - ENTFERNT: Angebotsanfrage, Archiv, Brief_von_Kunde, Brief_an_Kunde, Brief_von_Amt
//
// Aenderungen v1.4.0:
// - NEU: Unterschrift-Felder in Queue/Label Response
// - NEU: Unterschrift-Felder manuell editierbar
// - NEU: Kategorien Lieferantenangebot, Bild
// =============================================================================
// Endpoints:
//   GET  /admin-review                  - Get review queue
//   POST /admin-review/:id/label        - Update labels (approve/correct) + learning
//   GET  /admin-review/preview?path=... - Get signed URL for attachment
//   GET  /admin-review/stats            - Get review statistics
//   GET  /admin-review/categories       - Get valid categories
//   GET  /admin-review/clusters         - Get evidence clusters for rule generation
//   GET  /admin-review/settings         - Get rules settings
//   POST /admin-review/settings         - Update rules settings
//   GET  /admin-review/rules            - Get classification rules
//   POST /admin-review/rules/:id/activate - Activate a draft rule
//   POST /admin-review/rules/:id/disable  - Disable a rule
//   POST /admin-review/rules/:id/pause    - Pause a rule
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  VALID_DOKUMENT_KATEGORIEN,
  VALID_EMAIL_KATEGORIEN,
  canonicalizeKategorie,
} from "../_shared/categories.ts";

// Environment
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SVC_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =============================================================================
// Valid Categories - imported from shared module
// =============================================================================
// VALID_DOKUMENT_KATEGORIEN and VALID_EMAIL_KATEGORIEN imported from _shared/categories.ts

// =============================================================================
// API Key Validation
// =============================================================================

function validateApiKey(req: Request): { valid: boolean; reason?: string } {
  if (!INTERNAL_API_KEY) {
    console.error("[AUTH] CRITICAL: INTERNAL_API_KEY not configured");
    return { valid: false, reason: "No API key configured on server" };
  }

  // Check x-api-key header
  const apiKeyHeader = req.headers.get("x-api-key");
  if (apiKeyHeader && apiKeyHeader === INTERNAL_API_KEY) {
    return { valid: true };
  }

  // Check Authorization: Bearer header
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1] === INTERNAL_API_KEY) {
      return { valid: true };
    }
  }

  return { valid: false, reason: "Invalid or missing API key" };
}

// =============================================================================
// CORS Headers
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// =============================================================================
// Helper: Generate rule fingerprint
// =============================================================================

function generateFingerprint(doc: {
  email_von_email?: string;
  email_betreff?: string;
  kategorie?: string;
}): string | null {
  if (!doc.email_von_email) return null;

  const domain = doc.email_von_email.split("@")[1]?.toLowerCase() || "";
  const subjectWords = (doc.email_betreff || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 3)
    .sort()
    .slice(0, 5)
    .join("_");

  return `${domain}:${subjectWords}`;
}

// =============================================================================
// Helper: Get content type from file extension
// =============================================================================

function getContentTypeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    'bmp': 'image/bmp',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// =============================================================================
// Helper: Build primary_file from dokument_url
// =============================================================================

function buildPrimaryFile(dokument_url: string | null): {
  storagePath: string;
  fileName: string;
  contentType: string;
} | null {
  if (!dokument_url) return null;

  const fileName = dokument_url.split('/').pop() || dokument_url;
  const contentType = getContentTypeFromPath(dokument_url);

  return {
    storagePath: dokument_url,
    fileName,
    contentType,
  };
}

// =============================================================================
// GET /admin-review - Review Queue
// =============================================================================

interface ReviewQueueParams {
  since?: string;        // ISO date
  until?: string;        // ISO date
  status?: string;       // pending|approved|corrected
  only_suspect?: boolean;
  kategorie?: string;
  email_kategorie?: string;
  limit?: number;
  offset?: number;
}

async function getReviewQueue(params: ReviewQueueParams) {
  const {
    since,
    until,
    status = "pending",
    only_suspect = false,
    kategorie,
    email_kategorie,
    limit = 50,
    offset = 0,
  } = params;

  let query = supabase
    .from("documents")
    .select(`
      id,
      created_at,
      updated_at,
      kategorie,
      kategorie_manual,
      email_kategorie,
      email_kategorie_confidence,
      email_kategorie_manual,
      email_betreff,
      email_von_email,
      email_von_name,
      email_postfach,
      email_hat_anhaenge,
      email_anhaenge_count,
      email_anhaenge_meta,
      email_body_text,
      inhalt_zusammenfassung,
      processing_status,
      processing_last_error,
      review_status,
      reviewed_at,
      reviewed_by,
      dokument_url,
      source,
      rule_fingerprint,
      unterschrift_erforderlich,
      empfang_unterschrift,
      unterschrift
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (since) {
    query = query.gte("created_at", since);
  }
  if (until) {
    query = query.lte("created_at", until);
  }
  if (status && status !== "all") {
    query = query.eq("review_status", status);
  }
  if (kategorie) {
    query = query.eq("kategorie", kategorie);
  }
  if (email_kategorie) {
    query = query.eq("email_kategorie", email_kategorie);
  }

  // Suspect filter: Sonstiges, low confidence, or errors
  if (only_suspect) {
    query = query.or(
      "kategorie.eq.Sonstiges_Dokument," +
      "email_kategorie.eq.Sonstiges," +
      "email_kategorie_confidence.lt.0.7," +
      "processing_status.eq.error"
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Query failed: ${error.message}`);
  }

  // Add primary_file to each document
  const items = (data || []).map(doc => ({
    ...doc,
    primary_file: buildPrimaryFile(doc.dokument_url),
  }));

  return {
    items,
    count: items.length,
    offset,
    limit,
  };
}

// =============================================================================
// POST /admin-review/:id/label - Update Labels
// =============================================================================

interface LabelUpdateBody {
  action: "approve" | "correct";
  kategorie_manual?: string;
  email_kategorie_manual?: string;
  reviewed_by?: string;
  // v1.4.0: Unterschrift-Felder
  empfang_unterschrift?: boolean;
  unterschrift?: string | null;
  unterschrift_erforderlich?: boolean;
}

async function updateLabel(documentId: string, body: LabelUpdateBody) {
  const {
    action,
    kategorie_manual: kategorie_manual_raw,
    email_kategorie_manual,
    reviewed_by,
    empfang_unterschrift,
    unterschrift,
    unterschrift_erforderlich,
  } = body;

  // v1.5.0: Canonicalize kategorie (alias mapping)
  const kategorie_manual = kategorie_manual_raw
    ? canonicalizeKategorie(kategorie_manual_raw) || kategorie_manual_raw
    : undefined;

  // Validate categories if provided
  if (kategorie_manual && !VALID_DOKUMENT_KATEGORIEN.includes(kategorie_manual)) {
    throw new Error(`Invalid kategorie_manual: ${kategorie_manual}`);
  }
  if (email_kategorie_manual && !VALID_EMAIL_KATEGORIEN.includes(email_kategorie_manual)) {
    throw new Error(`Invalid email_kategorie_manual: ${email_kategorie_manual}`);
  }

  // Build update object
  const updateData: Record<string, unknown> = {
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewed_by || "admin",
    review_status: action === "approve" ? "approved" : "corrected",
  };

  // v1.4.0: Unterschrift-Felder (immer aktualisieren wenn angegeben, auch bei approve)
  if (empfang_unterschrift !== undefined) {
    updateData.empfang_unterschrift = empfang_unterschrift;
  }
  if (unterschrift !== undefined) {
    updateData.unterschrift = unterschrift;
  }
  if (unterschrift_erforderlich !== undefined) {
    updateData.unterschrift_erforderlich = unterschrift_erforderlich;
  }

  if (action === "correct") {
    if (kategorie_manual) {
      updateData.kategorie_manual = kategorie_manual;
    }
    if (email_kategorie_manual) {
      updateData.email_kategorie_manual = email_kategorie_manual;
    }
  }

  // First, get document to generate fingerprint
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("email_von_email, email_betreff, kategorie, email_kategorie")
    .eq("id", documentId)
    .single();

  if (fetchError) {
    throw new Error(`Document not found: ${documentId}`);
  }

  // Generate fingerprint for learning
  const fingerprint = generateFingerprint(doc);
  if (fingerprint) {
    updateData.rule_fingerprint = fingerprint;
  }

  // Update document
  const { data, error } = await supabase
    .from("documents")
    .update(updateData)
    .eq("id", documentId)
    .select()
    .single();

  if (error) {
    throw new Error(`Update failed: ${error.message}`);
  }

  // =========================================================================
  // Learning Loop: Extract features and add to evidence cluster
  // =========================================================================
  let clusterId: string | null = null;
  let clusterStatus: string | null = null;

  // Only process for corrections (not approvals of existing correct classifications)
  if (action === "correct" && (kategorie_manual || email_kategorie_manual)) {
    try {
      // Step 1: Extract features from document
      const { error: extractError } = await supabase.rpc("extract_document_features", {
        doc_id: documentId,
      });

      if (extractError) {
        console.error(`[LEARNING] Failed to extract features for ${documentId}: ${extractError.message}`);
      } else {
        console.log(`[LEARNING] Extracted features for document ${documentId}`);
      }

      // Step 2: Add to evidence cluster
      const targetEmailKat = email_kategorie_manual || null;
      const targetKat = kategorie_manual || null;

      const { data: clusterResult, error: clusterError } = await supabase.rpc("add_evidence_to_cluster", {
        doc_id: documentId,
        target_email_kat: targetEmailKat,
        target_kat: targetKat,
      });

      if (clusterError) {
        console.error(`[LEARNING] Failed to add to cluster: ${clusterError.message}`);
      } else if (clusterResult) {
        clusterId = clusterResult;
        console.log(`[LEARNING] Added document ${documentId} to cluster ${clusterId}`);

        // Check cluster status (if ready for rule generation)
        const { data: cluster } = await supabase
          .from("rule_evidence_clusters")
          .select("status, evidence_count")
          .eq("id", clusterId)
          .single();

        if (cluster) {
          clusterStatus = cluster.status;
          console.log(`[LEARNING] Cluster ${clusterId}: ${cluster.evidence_count} evidence, status=${cluster.status}`);
        }
      }
    } catch (learningError) {
      // Don't fail the main operation if learning fails
      console.error(`[LEARNING] Error in learning loop: ${learningError}`);
    }
  }

  return {
    success: true,
    document_id: documentId,
    action,
    review_status: updateData.review_status,
    rule_fingerprint: fingerprint,
    learning: clusterId ? {
      cluster_id: clusterId,
      cluster_status: clusterStatus,
    } : null,
  };
}

// =============================================================================
// GET /admin-review/preview - Signed URL for Storage
// =============================================================================

// Signed URL TTL in seconds (short for security)
const SIGNED_URL_TTL = 120;

async function getPreviewUrl(path: string) {
  if (!path) {
    throw new Error("Missing path parameter");
  }

  // Create signed URL (valid for 2 minutes - short TTL for security)
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  // SECURITY: Never log the signed URL
  return {
    signed_url: data.signedUrl,
    expires_in: SIGNED_URL_TTL,
    path,
  };
}

// =============================================================================
// GET /admin-review/stats - Review Statistics (FIXED: proper count handling)
// =============================================================================

async function getReviewStats() {
  // Get counts by review_status
  const { data: statusCounts } = await supabase
    .from("documents")
    .select("review_status")
    .not("review_status", "is", null);

  // Get suspect counts (last 48h) - using proper count
  const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // FIX: Use count properly - don't use head:true, get actual count from response
  const { count: sonstigesDokumentCount } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("kategorie", "Sonstiges_Dokument")
    .gte("created_at", since48h);

  const { count: sonstigesEmailCount } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("email_kategorie", "Sonstiges")
    .gte("created_at", since48h);

  const { count: errorsCount } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("processing_status", "error");

  const { count: pendingReviewsCount } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("review_status", "pending");

  const { count: total48hCount } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since48h);

  // Calculate percentages with proper null handling
  const sonstigesDok = sonstigesDokumentCount || 0;
  const sonstigesEmail = sonstigesEmailCount || 0;
  const total48h = total48hCount || 1;

  return {
    review_status: {
      pending: statusCounts?.filter(d => d.review_status === "pending").length || 0,
      approved: statusCounts?.filter(d => d.review_status === "approved").length || 0,
      corrected: statusCounts?.filter(d => d.review_status === "corrected").length || 0,
    },
    suspects_48h: {
      sonstiges_dokument: sonstigesDok,
      sonstiges_email: sonstigesEmail,
      sonstiges_percent: ((sonstigesDok + sonstigesEmail) / total48h * 100).toFixed(1),
    },
    errors_total: errorsCount || 0,
    pending_reviews: pendingReviewsCount || 0,
    last_updated: new Date().toISOString(),
  };
}

// =============================================================================
// GET /admin-review/rule-suggestions - Fingerprint-based suggestions
// =============================================================================

async function getRuleSuggestions() {
  // Find fingerprints that have been manually confirmed >= 5 times
  const { data, error } = await supabase
    .from("documents")
    .select("rule_fingerprint, email_kategorie_manual, kategorie_manual")
    .not("rule_fingerprint", "is", null)
    .in("review_status", ["approved", "corrected"]);

  if (error) {
    throw new Error(`Query failed: ${error.message}`);
  }

  // Group by fingerprint and count
  const fingerprintCounts: Record<string, {
    count: number;
    email_kategorie: string | null;
    kategorie: string | null;
  }> = {};

  for (const doc of data || []) {
    const fp = doc.rule_fingerprint;
    if (!fp) continue;

    if (!fingerprintCounts[fp]) {
      fingerprintCounts[fp] = {
        count: 0,
        email_kategorie: doc.email_kategorie_manual,
        kategorie: doc.kategorie_manual,
      };
    }
    fingerprintCounts[fp].count++;
  }

  // Filter to those with >= 5 confirmations
  const suggestions = Object.entries(fingerprintCounts)
    .filter(([_, v]) => v.count >= 5)
    .map(([fingerprint, data]) => ({
      fingerprint,
      confirmed_count: data.count,
      suggested_email_kategorie: data.email_kategorie,
      suggested_kategorie: data.kategorie,
    }))
    .sort((a, b) => b.confirmed_count - a.confirmed_count);

  return {
    suggestions,
    count: suggestions.length,
    threshold: 5,
  };
}

// =============================================================================
// GET /admin-review/clusters - Get Evidence Clusters
// =============================================================================

interface ClustersQueryParams {
  status?: string; // pending|ready|rule_generated|all
  limit?: number;
  offset?: number;
}

async function getClusters(params: ClustersQueryParams) {
  const { status = "all", limit = 50, offset = 0 } = params;

  let query = supabase
    .from("rule_evidence_clusters")
    .select(`
      id,
      created_at,
      updated_at,
      cluster_key,
      target_email_kategorie,
      target_kategorie,
      evidence_count,
      evidence_document_ids,
      status,
      generated_rule_id
    `)
    .order("evidence_count", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load clusters: ${error.message}`);
  }

  // Get example documents for each cluster
  const clusters = await Promise.all((data || []).map(async (cluster) => {
    let examples: Array<{
      id: string;
      email_betreff: string | null;
      email_von_email: string | null;
      email_von_name: string | null;
    }> = [];

    if (cluster.evidence_document_ids && cluster.evidence_document_ids.length > 0) {
      const { data: exampleDocs } = await supabase
        .from("documents")
        .select("id, email_betreff, email_von_email, email_von_name")
        .in("id", cluster.evidence_document_ids.slice(0, 5));
      examples = exampleDocs || [];
    }

    return {
      ...cluster,
      examples,
    };
  }));

  // Get counts by status
  const { data: countData } = await supabase
    .from("rule_evidence_clusters")
    .select("status");

  const counts = {
    pending: 0,
    ready: 0,
    rule_generated: 0,
  };
  for (const row of countData || []) {
    if (row.status in counts) {
      counts[row.status as keyof typeof counts]++;
    }
  }

  return {
    clusters,
    count: clusters.length,
    offset,
    limit,
    counts,
  };
}

// =============================================================================
// GET /admin-review/settings - Get Rules Settings
// =============================================================================

async function getSettings() {
  const { data, error } = await supabase
    .from("app_config")
    .select("key, value, description")
    .in("key", [
      "rules_activation_mode",
      "rules_min_evidence",
      "rules_min_backtest_matches",
      "rules_min_precision"
    ]);

  if (error) {
    throw new Error(`Failed to load settings: ${error.message}`);
  }

  // Convert to object
  const settings: Record<string, string> = {};
  for (const row of data || []) {
    settings[row.key] = row.value;
  }

  return {
    activation_mode: settings.rules_activation_mode || "manual",
    thresholds: {
      min_evidence: parseInt(settings.rules_min_evidence || "5"),
      min_backtest_matches: parseInt(settings.rules_min_backtest_matches || "20"),
      min_precision: parseFloat(settings.rules_min_precision || "0.95"),
    },
  };
}

// =============================================================================
// POST /admin-review/settings - Update Rules Settings
// =============================================================================

interface SettingsUpdateBody {
  activation_mode?: "manual" | "auto";
  min_evidence?: number;
  min_backtest_matches?: number;
  min_precision?: number;
}

async function updateSettings(body: SettingsUpdateBody) {
  const updates: Array<{ key: string; value: string }> = [];

  if (body.activation_mode) {
    if (!["manual", "auto"].includes(body.activation_mode)) {
      throw new Error("Invalid activation_mode. Must be 'manual' or 'auto'");
    }
    updates.push({ key: "rules_activation_mode", value: body.activation_mode });
  }
  if (body.min_evidence !== undefined) {
    if (body.min_evidence < 1 || body.min_evidence > 100) {
      throw new Error("min_evidence must be between 1 and 100");
    }
    updates.push({ key: "rules_min_evidence", value: String(body.min_evidence) });
  }
  if (body.min_backtest_matches !== undefined) {
    if (body.min_backtest_matches < 1 || body.min_backtest_matches > 1000) {
      throw new Error("min_backtest_matches must be between 1 and 1000");
    }
    updates.push({ key: "rules_min_backtest_matches", value: String(body.min_backtest_matches) });
  }
  if (body.min_precision !== undefined) {
    if (body.min_precision < 0.5 || body.min_precision > 1.0) {
      throw new Error("min_precision must be between 0.5 and 1.0");
    }
    updates.push({ key: "rules_min_precision", value: String(body.min_precision) });
  }

  // Update each setting
  for (const { key, value } of updates) {
    const { error } = await supabase
      .from("app_config")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);

    if (error) {
      throw new Error(`Failed to update ${key}: ${error.message}`);
    }
  }

  return { success: true, updated: updates.length };
}

// =============================================================================
// GET /admin-review/rules - Get Classification Rules
// =============================================================================

interface RulesQueryParams {
  status?: string; // draft|active|disabled|paused|all
  limit?: number;
  offset?: number;
}

async function getRules(params: RulesQueryParams) {
  const { status = "all", limit = 50, offset = 0 } = params;

  let query = supabase
    .from("classification_rules")
    .select(`
      id,
      created_at,
      updated_at,
      name,
      description,
      conditions,
      target_email_kategorie,
      target_kategorie,
      status,
      activated_by,
      activated_at,
      paused_reason,
      evidence_count,
      evidence_document_ids,
      backtest_matches,
      precision_estimate,
      validation_metrics,
      misfire_count,
      last_misfire_at,
      created_by
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load rules: ${error.message}`);
  }

  // Get example documents for each rule
  const rules = await Promise.all((data || []).map(async (rule) => {
    // Get up to 3 example documents
    let examples: Array<{
      id: string;
      email_betreff: string | null;
      email_von_email: string | null;
    }> = [];

    if (rule.evidence_document_ids && rule.evidence_document_ids.length > 0) {
      const { data: exampleDocs } = await supabase
        .from("documents")
        .select("id, email_betreff, email_von_email")
        .in("id", rule.evidence_document_ids.slice(0, 3));
      examples = exampleDocs || [];
    }

    return {
      ...rule,
      examples,
    };
  }));

  // Get counts by status
  const { data: countData } = await supabase
    .from("classification_rules")
    .select("status");

  const counts = {
    draft: 0,
    active: 0,
    disabled: 0,
    paused: 0,
  };
  for (const row of countData || []) {
    if (row.status in counts) {
      counts[row.status as keyof typeof counts]++;
    }
  }

  return {
    rules,
    count: rules.length,
    offset,
    limit,
    counts,
  };
}

// =============================================================================
// POST /admin-review/rules/:id/activate - Manually Activate a Rule
// =============================================================================

async function activateRule(ruleId: string) {
  // Get current rule
  const { data: rule, error: fetchError } = await supabase
    .from("classification_rules")
    .select("status, evidence_count")
    .eq("id", ruleId)
    .single();

  if (fetchError || !rule) {
    throw new Error(`Rule not found: ${ruleId}`);
  }

  if (rule.status === "active") {
    throw new Error("Rule is already active");
  }

  // Update to active
  const { error } = await supabase
    .from("classification_rules")
    .update({
      status: "active",
      activated_by: "manual",
      activated_at: new Date().toISOString(),
      paused_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId);

  if (error) {
    throw new Error(`Failed to activate rule: ${error.message}`);
  }

  return { success: true, rule_id: ruleId, new_status: "active" };
}

// =============================================================================
// POST /admin-review/rules/:id/disable - Disable a Rule
// =============================================================================

async function disableRule(ruleId: string) {
  const { error } = await supabase
    .from("classification_rules")
    .update({
      status: "disabled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId);

  if (error) {
    throw new Error(`Failed to disable rule: ${error.message}`);
  }

  return { success: true, rule_id: ruleId, new_status: "disabled" };
}

// =============================================================================
// POST /admin-review/rules/:id/pause - Pause a Rule
// =============================================================================

async function pauseRule(ruleId: string, reason?: string) {
  const { error } = await supabase
    .from("classification_rules")
    .update({
      status: "paused",
      paused_reason: reason || "Manually paused",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId);

  if (error) {
    throw new Error(`Failed to pause rule: ${error.message}`);
  }

  return { success: true, rule_id: ruleId, new_status: "paused" };
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // pathParts: ["admin-review"] or ["admin-review", "preview"] or ["admin-review", "<uuid>", "label"]

  try {
    // Health check (no auth required)
    if (req.method === "GET" && pathParts.length === 1 && url.searchParams.get("health") === "1") {
      return new Response(
        JSON.stringify({
          service: "admin-review",
          version: "1.7.0",
          status: "ready",
          configured: {
            supabase: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
            internalApiKey: !!INTERNAL_API_KEY,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // API Key validation for all other requests
    const authResult = validateApiKey(req);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: authResult.reason }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: GET /admin-review/categories
    if (req.method === "GET" && pathParts[1] === "categories") {
      return new Response(
        JSON.stringify({
          dokument_kategorien: VALID_DOKUMENT_KATEGORIEN,
          email_kategorien: VALID_EMAIL_KATEGORIEN,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: GET /admin-review/stats
    if (req.method === "GET" && pathParts[1] === "stats") {
      const stats = await getReviewStats();
      return new Response(
        JSON.stringify(stats),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: GET /admin-review/preview?path=...
    if (req.method === "GET" && pathParts[1] === "preview") {
      const path = url.searchParams.get("path");
      if (!path) {
        return new Response(
          JSON.stringify({ error: "Missing path parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const result = await getPreviewUrl(path);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: GET /admin-review/clusters
    if (req.method === "GET" && pathParts[1] === "clusters") {
      const params: ClustersQueryParams = {
        status: url.searchParams.get("status") || "all",
        limit: parseInt(url.searchParams.get("limit") || "50"),
        offset: parseInt(url.searchParams.get("offset") || "0"),
      };
      const result = await getClusters(params);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: GET /admin-review/rule-suggestions
    if (req.method === "GET" && pathParts[1] === "rule-suggestions") {
      const suggestions = await getRuleSuggestions();
      return new Response(
        JSON.stringify(suggestions),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: GET /admin-review/settings
    if (req.method === "GET" && pathParts[1] === "settings") {
      const settings = await getSettings();
      return new Response(
        JSON.stringify(settings),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: POST /admin-review/settings
    if (req.method === "POST" && pathParts[1] === "settings") {
      const body: SettingsUpdateBody = await req.json();
      const result = await updateSettings(body);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: GET /admin-review/rules
    if (req.method === "GET" && pathParts[1] === "rules" && pathParts.length === 2) {
      const params: RulesQueryParams = {
        status: url.searchParams.get("status") || "all",
        limit: parseInt(url.searchParams.get("limit") || "50"),
        offset: parseInt(url.searchParams.get("offset") || "0"),
      };
      const result = await getRules(params);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: POST /admin-review/rules/:id/activate
    if (req.method === "POST" && pathParts[1] === "rules" && pathParts[3] === "activate") {
      const ruleId = pathParts[2];
      const result = await activateRule(ruleId);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: POST /admin-review/rules/:id/disable
    if (req.method === "POST" && pathParts[1] === "rules" && pathParts[3] === "disable") {
      const ruleId = pathParts[2];
      const result = await disableRule(ruleId);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: POST /admin-review/rules/:id/pause
    if (req.method === "POST" && pathParts[1] === "rules" && pathParts[3] === "pause") {
      const ruleId = pathParts[2];
      const body = await req.json().catch(() => ({}));
      const result = await pauseRule(ruleId, body.reason);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: POST /admin-review/:id/label
    if (req.method === "POST" && pathParts[2] === "label") {
      const documentId = pathParts[1];
      if (!documentId || documentId.length < 30) {
        return new Response(
          JSON.stringify({ error: "Invalid document ID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const body: LabelUpdateBody = await req.json();
      if (!body.action || !["approve", "correct"].includes(body.action)) {
        return new Response(
          JSON.stringify({ error: "Invalid action. Must be 'approve' or 'correct'" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const result = await updateLabel(documentId, body);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: GET /admin-review (queue)
    if (req.method === "GET" && pathParts.length === 1) {
      const params: ReviewQueueParams = {
        since: url.searchParams.get("since") || undefined,
        until: url.searchParams.get("until") || undefined,
        status: url.searchParams.get("status") || "pending",
        only_suspect: url.searchParams.get("only_suspect") === "1",
        kategorie: url.searchParams.get("kategorie") || undefined,
        email_kategorie: url.searchParams.get("email_kategorie") || undefined,
        limit: parseInt(url.searchParams.get("limit") || "50"),
        offset: parseInt(url.searchParams.get("offset") || "0"),
      };
      const result = await getReviewQueue(params);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown route
    return new Response(
      JSON.stringify({ error: "Not found", path: url.pathname }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[ERROR] ${error}`);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
