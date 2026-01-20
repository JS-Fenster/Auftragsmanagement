// =============================================================================
// Admin Review API - Review Queue, Labeling, Preview
// Version: 1.0.0 - 2026-01-20
// =============================================================================
// Endpoints:
//   GET  /admin-review                  - Get review queue
//   POST /admin-review/:id/label        - Update labels (approve/correct)
//   GET  /admin-review/preview?path=... - Get signed URL for attachment
//   GET  /admin-review/stats            - Get review statistics
//   GET  /admin-review/categories       - Get valid categories
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Environment
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SVC_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =============================================================================
// Valid Categories (must match CHECK constraints in DB)
// =============================================================================

const VALID_DOKUMENT_KATEGORIEN = [
  "Preisanfrage", "Angebot", "Auftragsbestaetigung", "Bestellung",
  "Eingangslieferschein", "Eingangsrechnung", "Kundenlieferschein",
  "Montageauftrag", "Ausgangsrechnung", "Zahlungserinnerung", "Mahnung",
  "Notiz", "Skizze", "Brief_an_Kunde", "Brief_von_Kunde",
  "Brief_von_Finanzamt", "Brief_von_Amt", "Sonstiges_Dokument",
  "Video", "Audio", "Office_Dokument", "Archiv",
  "Email_Eingehend", "Email_Ausgehend", "Email_Anhang"
];

const VALID_EMAIL_KATEGORIEN = [
  "Bewerbung", "Lead_Anfrage", "BAFA_Foerderung", "Versicherung_Schaden",
  "Lieferstatus_Update", "Rechnung_Eingang", "Rechnung_Gesendet",
  "Auftragserteilung", "Bestellbestaetigung", "Angebot_Anforderung",
  "Reklamation", "Serviceanfrage", "Anforderung_Unterlagen",
  "Terminanfrage", "Kundenanfrage", "Newsletter_Werbung",
  "Antwort_oder_Weiterleitung", "Sonstiges"
];

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
      processing_status,
      processing_last_error,
      review_status,
      reviewed_at,
      reviewed_by,
      dokument_url,
      source,
      rule_fingerprint
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

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Query failed: ${error.message}`);
  }

  return {
    items: data || [],
    count: data?.length || 0,
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
}

async function updateLabel(documentId: string, body: LabelUpdateBody) {
  const { action, kategorie_manual, email_kategorie_manual, reviewed_by } = body;

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

  return {
    success: true,
    document_id: documentId,
    action,
    review_status: updateData.review_status,
    rule_fingerprint: fingerprint,
  };
}

// =============================================================================
// GET /admin-review/preview - Signed URL for Storage
// =============================================================================

async function getPreviewUrl(path: string) {
  if (!path) {
    throw new Error("Missing path parameter");
  }

  // Create signed URL (valid for 5 minutes)
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 300);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return {
    signed_url: data.signedUrl,
    expires_in: 300,
    path,
  };
}

// =============================================================================
// GET /admin-review/stats - Review Statistics
// =============================================================================

async function getReviewStats() {
  // Get counts by review_status
  const { data: statusCounts, error: statusError } = await supabase
    .from("documents")
    .select("review_status")
    .not("review_status", "is", null);

  // Get suspect counts (last 48h)
  const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: sonstigesDokument } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("kategorie", "Sonstiges_Dokument")
    .gte("created_at", since48h);

  const { data: sonstigesEmail } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("email_kategorie", "Sonstiges")
    .gte("created_at", since48h);

  const { data: errors } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("processing_status", "error");

  const { data: pendingReviews } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "pending");

  const { data: total48h } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since48h);

  // Calculate percentages
  const sonstigesDokumentCount = sonstigesDokument?.length || 0;
  const sonstigesEmailCount = sonstigesEmail?.length || 0;
  const total48hCount = total48h?.length || 1;

  return {
    review_status: {
      pending: statusCounts?.filter(d => d.review_status === "pending").length || 0,
      approved: statusCounts?.filter(d => d.review_status === "approved").length || 0,
      corrected: statusCounts?.filter(d => d.review_status === "corrected").length || 0,
    },
    suspects_48h: {
      sonstiges_dokument: sonstigesDokumentCount,
      sonstiges_email: sonstigesEmailCount,
      sonstiges_percent: ((sonstigesDokumentCount + sonstigesEmailCount) / total48hCount * 100).toFixed(1),
    },
    errors_total: errors?.length || 0,
    pending_reviews: pendingReviews?.length || 0,
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
          version: "1.0.0",
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

    // Route: GET /admin-review/rule-suggestions
    if (req.method === "GET" && pathParts[1] === "rule-suggestions") {
      const suggestions = await getRuleSuggestions();
      return new Response(
        JSON.stringify(suggestions),
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
