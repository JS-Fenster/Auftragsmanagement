// =============================================================================
// Batch Process Pending - 2-Stufen-Pipeline (OCR + Kategorisierung)
// Version: 2.0.1 - 2026-03-09
// =============================================================================
// Stage 1: pending_ocr → process-document-ocr (Download + OCR)
// Stage 2: pending_categorize → process-document-categorize (GPT, kein Download)
//
// v2.0.0 Changes:
// - 2-Stufen-Pipeline: OCR und Kategorisierung getrennt
// - Neuer Parameter: stage ("ocr", "categorize", "both" [default])
// - Health Check zeigt beide Queues + Error-Counts
// - Response mit ocr_batch + categorize_batch
//
// v1.1.0 Changes:
// - FIX: fetchWithRetry() fuer process-document (55s Timeout, 1 Retry)
// - Designed as safety-net via pg_cron (alle 15 Min)
//
// Usage:
//   POST /functions/v1/batch-process-pending
//   Header: x-api-key: <INTERNAL_API_KEY>
//   Body: { "limit": 10, "dry_run": false, "stage": "both" }
//
// Parameter:
//   - limit: Max Anzahl pro Stage (default: 10, max: 50)
//   - dry_run: Wenn true, nur anzeigen was verarbeitet wuerde (default: false)
//   - stage: "ocr" | "categorize" | "both" (default: "both")
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =============================================================================
// API Key Validation
// =============================================================================

function validateApiKey(req: Request): { valid: boolean; reason?: string } {
  if (!INTERNAL_API_KEY) {
    return { valid: false, reason: "INTERNAL_API_KEY not configured" };
  }

  const apiKeyHeader = req.headers.get("x-api-key");
  if (apiKeyHeader && apiKeyHeader === INTERNAL_API_KEY) {
    return { valid: true };
  }

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
// Get MIME type from filename
// =============================================================================

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    tif: "image/tiff",
    tiff: "image/tiff",
    bmp: "image/bmp",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

// =============================================================================
// Retry + Timeout for Edge Function calls
// =============================================================================

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 1,
  timeoutMs = 55000
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (response.ok || attempt === maxRetries) return response;
      if (response.status < 500) return response;
      console.warn(`[BATCH] Retry ${attempt + 1}/${maxRetries + 1}: HTTP ${response.status}`);
    } catch (err: unknown) {
      clearTimeout(timer);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (attempt === maxRetries) throw err;
      console.warn(`[BATCH] Retry ${attempt + 1}/${maxRetries + 1}: ${errMsg}`);
    }
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error("fetchWithRetry: all retries exhausted");
}

// =============================================================================
// Process Result Types
// =============================================================================

interface OcrResult {
  document_id: string;
  storage_path: string;
  success: boolean;
  error?: string;
}

interface CategorizeResult {
  document_id: string;
  success: boolean;
  kategorie?: string;
  error?: string;
}

interface BatchResult {
  processed: number;
  success: number;
  errors: number;
  results: (OcrResult | CategorizeResult)[];
}

// =============================================================================
// Stage 1: OCR (pending_ocr → process-document-ocr)
// =============================================================================

async function processDocumentOcr(
  documentId: string,
  storagePath: string
): Promise<OcrResult> {
  const result: OcrResult = {
    document_id: documentId,
    storage_path: storagePath,
    success: false,
  };

  try {
    // 1. Download file from Storage
    console.log(`[BATCH-OCR] Downloading: ${storagePath}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(storagePath);

    if (downloadError || !fileData) {
      result.error = `Download failed: ${downloadError?.message || "No data"}`;
      console.error(`[BATCH-OCR] ${result.error}`);

      await supabase
        .from("documents")
        .update({
          processing_status: "error_ocr",
          processing_last_error: result.error,
        })
        .eq("id", documentId);

      return result;
    }

    console.log(`[BATCH-OCR] Downloaded ${fileData.size} bytes`);

    // 2. Extract filename and build FormData
    const fileName = storagePath.split("/").pop() || "document";
    const mimeType = getMimeType(fileName);

    const formData = new FormData();
    const blob = new Blob([fileData], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("document_id", documentId);
    formData.append("storage_path", storagePath);

    // 3. Call process-document-ocr (55s timeout, 1 retry)
    console.log(`[BATCH-OCR] Calling process-document-ocr for ${documentId}`);

    const processUrl = `${SUPABASE_URL}/functions/v1/process-document-ocr`;
    const response = await fetchWithRetry(processUrl, {
      method: "POST",
      headers: {
        "x-api-key": INTERNAL_API_KEY!,
      },
      body: formData,
    }, 1, 55000);

    if (!response.ok) {
      const errorText = await response.text();
      result.error = `process-document-ocr returned ${response.status}: ${errorText.substring(0, 200)}`;
      console.error(`[BATCH-OCR] ${result.error}`);

      await supabase
        .from("documents")
        .update({
          processing_status: "error_ocr",
          processing_last_error: result.error,
        })
        .eq("id", documentId);

      return result;
    }

    const processResult = await response.json();
    result.success = processResult.success === true;

    if (result.success) {
      console.log(`[BATCH-OCR] SUCCESS: ${documentId} → pending_categorize`);
    } else {
      result.error = processResult.error || "Unknown error from process-document-ocr";
      console.warn(`[BATCH-OCR] FAILED: ${documentId} - ${result.error}`);
    }

    return result;
  } catch (error) {
    result.error = `Exception: ${error}`;
    console.error(`[BATCH-OCR] ${result.error}`);

    await supabase
      .from("documents")
      .update({
        processing_status: "error_ocr",
        processing_last_error: result.error,
      })
      .eq("id", documentId);

    return result;
  }
}

// =============================================================================
// Stage 2: Kategorisierung (pending_categorize → process-document-categorize)
// =============================================================================

async function processDocumentCategorize(
  documentId: string
): Promise<CategorizeResult> {
  const result: CategorizeResult = {
    document_id: documentId,
    success: false,
  };

  try {
    // Kein File-Download noetig - Stage 2 liest ocr_text aus der DB
    console.log(`[BATCH-CAT] Calling process-document-categorize for ${documentId}`);

    const processUrl = `${SUPABASE_URL}/functions/v1/process-document-categorize`;
    // 30s Timeout (kein OCR), 1 Retry
    const response = await fetchWithRetry(processUrl, {
      method: "POST",
      headers: {
        "x-api-key": INTERNAL_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ document_id: documentId }),
    }, 1, 30000);

    if (!response.ok) {
      const errorText = await response.text();
      result.error = `process-document-categorize returned ${response.status}: ${errorText.substring(0, 200)}`;
      console.error(`[BATCH-CAT] ${result.error}`);

      // Race-condition guard: Don't overwrite 'done' if parallel process already finished
      await supabase
        .from("documents")
        .update({
          processing_status: "error_gpt",
          processing_last_error: result.error,
        })
        .eq("id", documentId)
        .in("processing_status", ["pending_categorize", "processing"]);

      return result;
    }

    const processResult = await response.json();
    result.success = processResult.success === true;
    result.kategorie = processResult.kategorie;

    if (result.success) {
      console.log(`[BATCH-CAT] SUCCESS: ${documentId} → ${result.kategorie}`);
    } else {
      result.error = processResult.error || "Unknown error from process-document-categorize";
      console.warn(`[BATCH-CAT] FAILED: ${documentId} - ${result.error}`);
    }

    return result;
  } catch (error) {
    result.error = `Exception: ${error}`;
    console.error(`[BATCH-CAT] ${result.error}`);

    // Race-condition guard: Don't overwrite 'done' if parallel process already finished
    await supabase
      .from("documents")
      .update({
        processing_status: "error_gpt",
        processing_last_error: result.error,
      })
      .eq("id", documentId)
      .in("processing_status", ["pending_categorize", "processing"]);

    return result;
  }
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  // Health check
  if (req.method === "GET") {
    const [
      { count: pendingOcrCount },
      { count: pendingCategorizeCount },
      { count: errorOcrCount },
      { count: errorGptCount },
    ] = await Promise.all([
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("processing_status", "pending_ocr"),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("processing_status", "pending_categorize"),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("processing_status", "error_ocr"),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("processing_status", "error_gpt"),
    ]);

    return new Response(
      JSON.stringify({
        service: "batch-process-pending",
        version: "2.0.1",
        status: "ready",
        pending_ocr_count: pendingOcrCount || 0,
        pending_categorize_count: pendingCategorizeCount || 0,
        error_ocr_count: errorOcrCount || 0,
        error_gpt_count: errorGptCount || 0,
        configured: {
          supabase: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
          internalApiKey: !!INTERNAL_API_KEY,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auth check
  const authResult = validateApiKey(req);
  if (!authResult.valid) {
    return new Response(JSON.stringify({ error: authResult.reason }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Parse request body
    let limit = 10;
    let dryRun = false;
    let stage: "ocr" | "categorize" | "both" = "both";

    try {
      const body = await req.json();
      if (body.limit && typeof body.limit === "number") {
        limit = Math.min(body.limit, 50); // Max 50 per batch
      }
      if (body.dry_run === true) {
        dryRun = true;
      }
      if (body.stage === "ocr" || body.stage === "categorize") {
        stage = body.stage;
      }
    } catch {
      // Empty body is OK, use defaults
    }

    console.log(`[BATCH] Starting batch process: limit=${limit}, dry_run=${dryRun}, stage=${stage}`);

    const runOcr = stage === "ocr" || stage === "both";
    const runCategorize = stage === "categorize" || stage === "both";

    // =========================================================================
    // Stage 1: OCR Batch (pending_ocr)
    // =========================================================================

    const ocrBatch: BatchResult = { processed: 0, success: 0, errors: 0, results: [] };

    if (runOcr) {
      const { data: pendingOcrDocs, error: ocrQueryError } = await supabase
        .from("documents")
        .select("id, dokument_url, email_betreff")
        .eq("processing_status", "pending_ocr")
        .order("created_at", { ascending: true })
        .limit(limit);

      if (ocrQueryError) {
        throw new Error(`OCR query failed: ${ocrQueryError.message}`);
      }

      if (pendingOcrDocs && pendingOcrDocs.length > 0) {
        console.log(`[BATCH] Found ${pendingOcrDocs.length} pending_ocr document(s)`);

        if (dryRun) {
          ocrBatch.processed = pendingOcrDocs.length;
          ocrBatch.results = pendingOcrDocs.map((d) => ({
            document_id: d.id,
            storage_path: d.dokument_url || "",
            success: false,
            error: "dry_run",
          }));
        } else {
          for (const doc of pendingOcrDocs) {
            if (!doc.dokument_url) {
              console.warn(`[BATCH-OCR] Skipping ${doc.id} - no dokument_url`);
              ocrBatch.results.push({
                document_id: doc.id,
                storage_path: "",
                success: false,
                error: "No dokument_url",
              });
              ocrBatch.errors++;
              ocrBatch.processed++;
              continue;
            }

            const result = await processDocumentOcr(doc.id, doc.dokument_url);
            ocrBatch.results.push(result);
            ocrBatch.processed++;

            if (result.success) {
              ocrBatch.success++;
            } else {
              ocrBatch.errors++;
            }

            // Small delay between requests to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }

      console.log(`[BATCH] OCR batch: ${ocrBatch.success} success, ${ocrBatch.errors} errors`);
    }

    // =========================================================================
    // Stage 2: Kategorisierungs-Batch (pending_categorize)
    // =========================================================================

    const categorizeBatch: BatchResult = { processed: 0, success: 0, errors: 0, results: [] };

    if (runCategorize) {
      const { data: pendingCatDocs, error: catQueryError } = await supabase
        .from("documents")
        .select("id, email_betreff")
        .eq("processing_status", "pending_categorize")
        .order("created_at", { ascending: true })
        .limit(limit);

      if (catQueryError) {
        throw new Error(`Categorize query failed: ${catQueryError.message}`);
      }

      if (pendingCatDocs && pendingCatDocs.length > 0) {
        console.log(`[BATCH] Found ${pendingCatDocs.length} pending_categorize document(s)`);

        if (dryRun) {
          categorizeBatch.processed = pendingCatDocs.length;
          categorizeBatch.results = pendingCatDocs.map((d) => ({
            document_id: d.id,
            success: false,
            error: "dry_run",
          }));
        } else {
          for (const doc of pendingCatDocs) {
            const result = await processDocumentCategorize(doc.id);
            categorizeBatch.results.push(result);
            categorizeBatch.processed++;

            if (result.success) {
              categorizeBatch.success++;
            } else {
              categorizeBatch.errors++;
            }

            // Small delay between requests
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }

      console.log(`[BATCH] Categorize batch: ${categorizeBatch.success} success, ${categorizeBatch.errors} errors`);
    }

    // =========================================================================
    // Response
    // =========================================================================

    const totalProcessed = ocrBatch.processed + categorizeBatch.processed;

    if (totalProcessed === 0 && !dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending documents found",
          stage,
          ocr_batch: ocrBatch,
          categorize_batch: categorizeBatch,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun || undefined,
        stage,
        message: dryRun
          ? `Would process ${totalProcessed} document(s)`
          : `Processed ${totalProcessed} document(s)`,
        ocr_batch: ocrBatch,
        categorize_batch: categorizeBatch,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[BATCH] Fatal error: ${error}`);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
