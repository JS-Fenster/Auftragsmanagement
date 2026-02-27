// =============================================================================
// Admin Review API - Review Queue, Labeling, Preview, Stats, Categories
// Version: 2.1.0 - 2026-02-27
// =============================================================================
// Aenderungen v2.1.0:
// - NEU: kategorie=__null__ Filter (WHERE kategorie IS NULL) fuer Emails ohne Dok-Kategorie
//
// Aenderungen v2.0.0:
// - NEU: ki_review_notiz Spalte in Queue-Select + Filter + Auto-Clearing
// - ENTFERNT: Learning Loop (Fingerprint, Features, Clusters, Rules, Settings, Backfill)
// - ENTFERNT: Endpoints: clusters, rules, settings, backfill, rule-suggestions
// - BEREINIGT: ~500 Zeilen toter Code entfernt
//
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
//   POST /admin-review/:id/label        - Update labels (approve/correct)
//   GET  /admin-review/preview?path=... - Get signed URL for attachment
//   GET  /admin-review/stats            - Get review statistics
//   GET  /admin-review/categories       - Get valid categories
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
  ki_review?: boolean;
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
    ki_review,
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
      unterschrift_erforderlich,
      empfang_unterschrift,
      unterschrift,
      ki_review_notiz
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
  // KI-Review: only filter by ki_review_notiz, skip status filter
  if (ki_review) {
    query = query.not("ki_review_notiz", "is", null);
  } else if (status === "error") {
    query = query.eq("processing_status", "error");
  } else if (status && status !== "all") {
    query = query.eq("review_status", status);
    query = query.neq("processing_status", "error");
  } else if (status === "all") {
    query = query.neq("processing_status", "error");
  }

  // Category filters (work with all modes including KI-Review)
  if (kategorie) {
    if (kategorie === "__null__") {
      query = query.is("kategorie", null);
    } else {
      query = query.eq("kategorie", kategorie);
      query = query.neq("source", "email");
    }
  }
  if (email_kategorie) {
    if (email_kategorie === "__no_emails__") {
      query = query.neq("source", "email");
    } else if (email_kategorie === "__null__") {
      query = query.is("email_kategorie", null);
      query = query.eq("source", "email");
    } else {
      query = query.eq("email_kategorie", email_kategorie);
      query = query.eq("source", "email");
    }
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
    ki_review_notiz: null,  // Clear KI review note after manual review
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

  return { success: true, document: data };
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
          version: "2.1.0",
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
        ki_review: url.searchParams.get("ki_review") === "true",
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
