// =============================================================================
// Batch Process Pending - Verarbeitet alle pending_ocr Dokumente
// Version: 1.0.0 - 2026-01-29
// =============================================================================
// Findet alle Dokumente mit processing_status='pending_ocr' und ruft
// process-document fuer jedes auf.
//
// Usage:
//   POST /functions/v1/batch-process-pending
//   Header: x-api-key: <INTERNAL_API_KEY>
//   Body: { "limit": 10, "dry_run": false }
//
// Parameter:
//   - limit: Max Anzahl zu verarbeitender Dokumente (default: 10)
//   - dry_run: Wenn true, nur anzeigen was verarbeitet wuerde (default: false)
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
// Process a single document
// =============================================================================

interface ProcessResult {
  document_id: string;
  storage_path: string;
  success: boolean;
  kategorie?: string;
  error?: string;
}

async function processDocument(
  documentId: string,
  storagePath: string
): Promise<ProcessResult> {
  const result: ProcessResult = {
    document_id: documentId,
    storage_path: storagePath,
    success: false,
  };

  try {
    // 1. Download file from Storage
    console.log(`[BATCH] Downloading: ${storagePath}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(storagePath);

    if (downloadError || !fileData) {
      result.error = `Download failed: ${downloadError?.message || "No data"}`;
      console.error(`[BATCH] ${result.error}`);

      // Mark as error in DB
      await supabase
        .from("documents")
        .update({
          processing_status: "error",
          processing_last_error: result.error,
        })
        .eq("id", documentId);

      return result;
    }

    console.log(`[BATCH] Downloaded ${fileData.size} bytes`);

    // 2. Extract filename from storage path
    const fileName = storagePath.split("/").pop() || "document";
    const mimeType = getMimeType(fileName);

    // 3. Call process-document with UPDATE mode
    const formData = new FormData();
    const blob = new Blob([fileData], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("document_id", documentId);
    formData.append("storage_path", storagePath);

    console.log(`[BATCH] Calling process-document for ${documentId}`);

    const processUrl = `${SUPABASE_URL}/functions/v1/process-document`;
    const response = await fetch(processUrl, {
      method: "POST",
      headers: {
        "x-api-key": INTERNAL_API_KEY!,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      result.error = `process-document returned ${response.status}: ${errorText.substring(0, 200)}`;
      console.error(`[BATCH] ${result.error}`);

      // Mark as error in DB
      await supabase
        .from("documents")
        .update({
          processing_status: "error",
          processing_last_error: result.error,
        })
        .eq("id", documentId);

      return result;
    }

    const processResult = await response.json();
    result.success = processResult.success === true;
    result.kategorie = processResult.kategorie;

    if (result.success) {
      console.log(`[BATCH] SUCCESS: ${documentId} -> ${result.kategorie}`);
    } else {
      result.error = processResult.error || "Unknown error from process-document";
      console.warn(`[BATCH] FAILED: ${documentId} - ${result.error}`);
    }

    return result;
  } catch (error) {
    result.error = `Exception: ${error}`;
    console.error(`[BATCH] ${result.error}`);

    // Mark as error in DB
    await supabase
      .from("documents")
      .update({
        processing_status: "error",
        processing_last_error: result.error,
      })
      .eq("id", documentId);

    return result;
  }
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  // Health check
  if (req.method === "GET") {
    // Count pending documents
    const { count } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("processing_status", "pending_ocr");

    return new Response(
      JSON.stringify({
        service: "batch-process-pending",
        version: "1.0.0",
        status: "ready",
        pending_count: count || 0,
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

    try {
      const body = await req.json();
      if (body.limit && typeof body.limit === "number") {
        limit = Math.min(body.limit, 50); // Max 50 per batch
      }
      if (body.dry_run === true) {
        dryRun = true;
      }
    } catch {
      // Empty body is OK, use defaults
    }

    console.log(`[BATCH] Starting batch process: limit=${limit}, dry_run=${dryRun}`);

    // 1. Find pending documents
    const { data: pendingDocs, error: queryError } = await supabase
      .from("documents")
      .select("id, dokument_url, email_betreff")
      .eq("processing_status", "pending_ocr")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    if (!pendingDocs || pendingDocs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending documents found",
          processed: 0,
          results: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[BATCH] Found ${pendingDocs.length} pending document(s)`);

    // Dry run - just return what would be processed
    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          message: `Would process ${pendingDocs.length} document(s)`,
          documents: pendingDocs.map((d) => ({
            id: d.id,
            storage_path: d.dokument_url,
            betreff: d.email_betreff?.substring(0, 50),
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Process each document
    const results: ProcessResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const doc of pendingDocs) {
      if (!doc.dokument_url) {
        console.warn(`[BATCH] Skipping ${doc.id} - no dokument_url`);
        results.push({
          document_id: doc.id,
          storage_path: "",
          success: false,
          error: "No dokument_url",
        });
        errorCount++;
        continue;
      }

      const result = await processDocument(doc.id, doc.dokument_url);
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }

      // Small delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`[BATCH] Completed: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${pendingDocs.length} document(s)`,
        processed: pendingDocs.length,
        success_count: successCount,
        error_count: errorCount,
        results: results,
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
