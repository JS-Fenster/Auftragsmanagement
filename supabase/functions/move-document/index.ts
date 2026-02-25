// =============================================================================
// Move Document - Verschiebt Dateien im Storage in den Kategorie-Ordner
// Version: 1.0.0 - 2026-02-25
// =============================================================================
// Verschiebt Dateien in Supabase Storage basierend auf der aktuellen Kategorie.
// Aktualisiert dokument_url in der DB nach erfolgreichem Move.
//
// Usage:
//   POST /functions/v1/move-document
//   Header: x-api-key: <INTERNAL_API_KEY>
//   Body: { "doc_ids": ["uuid1", ...] }
//         oder { "auto": true, "limit": 50 }
//
// Parameter:
//   - doc_ids: Array von Dokument-UUIDs (max 50)
//   - auto: true = automatisch alle Docs finden wo Ordner != Kategorie
//   - limit: Max Anzahl bei auto-Modus (default 50, max 100)
//   - dry_run: true = nur prüfen, nicht verschieben (default: false)
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// Environment
// =============================================================================

const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BUCKET = "documents";
const MAX_DOCS = 100;

// =============================================================================
// Auth
// =============================================================================

function validateApiKey(req: Request): { valid: boolean; reason?: string } {
  if (!INTERNAL_API_KEY) return { valid: false, reason: "No API key configured" };
  const key = req.headers.get("x-api-key");
  if (!key) return { valid: false, reason: "Missing x-api-key header" };
  if (key !== INTERNAL_API_KEY) return { valid: false, reason: "Invalid API key" };
  return { valid: true };
}

// =============================================================================
// Types
// =============================================================================

interface MoveResult {
  id: string;
  old_path: string;
  new_path: string;
  moved: boolean;
  error?: string;
  skipped_reason?: string;
}

// =============================================================================
// Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
      },
    });
  }

  // Auth
  const authResult = validateApiKey(req);
  if (!authResult.valid) {
    return new Response(JSON.stringify({ error: authResult.reason }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Parse body
    const body = await req.json();
    const dryRun = body.dry_run === true;
    let docIds: string[] | null = null;

    if (Array.isArray(body.doc_ids) && body.doc_ids.length > 0) {
      docIds = body.doc_ids.slice(0, MAX_DOCS);
    }

    // Auto mode: find docs where folder != kategorie
    if (body.auto === true && !docIds) {
      const limit = Math.min(body.limit || 50, MAX_DOCS);
      const { data: autoDocs, error: autoError } = await supabase
        .from("documents")
        .select("id, kategorie, dokument_url")
        .not("dokument_url", "is", null)
        .not("dokument_url", "like", "email://%")
        .neq("processing_status", "error")
        .limit(1000);

      if (autoError) throw new Error(`Auto query failed: ${autoError.message}`);

      // Filter to docs where the folder part of dokument_url != kategorie
      const needsMove = (autoDocs || []).filter((doc: any) => {
        const url = doc.dokument_url as string;
        if (!url || url.startsWith("email://")) return false;
        const folderPart = url.split("/")[0];
        return folderPart !== doc.kategorie;
      });

      docIds = needsMove.slice(0, limit).map((d: any) => d.id);
      console.log(`[MOVE] Auto-mode: ${needsMove.length} docs need moving, processing ${docIds.length}`);
    }

    if (!docIds || docIds.length === 0) {
      return new Response(
        JSON.stringify({ results: [], summary: { total: 0, moved: 0, skipped: 0, errors: 0 } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Load documents
    const { data: documents, error: loadError } = await supabase
      .from("documents")
      .select("id, kategorie, dokument_url, source")
      .in("id", docIds);

    if (loadError) throw new Error(`DB query failed: ${loadError.message}`);

    console.log(`[MOVE] Processing ${(documents || []).length} docs, dry_run=${dryRun}`);

    // Process each document
    const results: MoveResult[] = [];
    let movedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const doc of documents || []) {
      const url = doc.dokument_url as string;

      // Skip emails (no storage file)
      if (!url || url.startsWith("email://")) {
        results.push({
          id: doc.id,
          old_path: url || "(none)",
          new_path: "",
          moved: false,
          skipped_reason: "email_reference",
        });
        skippedCount++;
        continue;
      }

      const pathParts = url.split("/");
      const currentFolder = pathParts[0];
      const fileName = pathParts.slice(1).join("/"); // Handle nested paths
      const targetFolder = doc.kategorie;

      // Skip if already in correct folder
      if (currentFolder === targetFolder) {
        results.push({
          id: doc.id,
          old_path: url,
          new_path: url,
          moved: false,
          skipped_reason: "already_correct",
        });
        skippedCount++;
        continue;
      }

      const newPath = `${targetFolder}/${fileName}`;

      if (dryRun) {
        results.push({
          id: doc.id,
          old_path: url,
          new_path: newPath,
          moved: false,
          skipped_reason: "dry_run",
        });
        continue;
      }

      try {
        // Step 1: Copy file to new location
        const { error: copyError } = await supabase.storage
          .from(BUCKET)
          .copy(url, newPath);

        if (copyError) {
          // Check if source file exists
          const { data: sourceCheck } = await supabase.storage
            .from(BUCKET)
            .list(currentFolder, {
              search: fileName,
              limit: 1,
            });

          if (!sourceCheck || sourceCheck.length === 0) {
            // Source file doesn't exist - ghost reference
            console.error(`[MOVE] Ghost reference: ${url} doesn't exist in storage`);
            results.push({
              id: doc.id,
              old_path: url,
              new_path: newPath,
              moved: false,
              error: `source_not_found: ${copyError.message}`,
            });
            errorCount++;
            continue;
          }

          // If target already exists, check and handle
          if (copyError.message?.includes("already exists") || copyError.message?.includes("Duplicate")) {
            console.log(`[MOVE] Target already exists, proceeding: ${newPath}`);
            // Target exists - proceed to delete old and update DB
          } else {
            throw copyError;
          }
        }

        // Step 2: Verify new file exists before deleting old
        const targetFolderName = newPath.split("/")[0];
        const targetFileName = newPath.split("/").slice(1).join("/");
        const { data: verifyData } = await supabase.storage
          .from(BUCKET)
          .list(targetFolderName, {
            search: targetFileName,
            limit: 1,
          });

        if (!verifyData || verifyData.length === 0) {
          console.error(`[MOVE] Verification failed - new file not found: ${newPath}`);
          results.push({
            id: doc.id,
            old_path: url,
            new_path: newPath,
            moved: false,
            error: "verification_failed",
          });
          errorCount++;
          continue;
        }

        // Step 3: Delete old file
        const { error: deleteError } = await supabase.storage
          .from(BUCKET)
          .remove([url]);

        if (deleteError) {
          console.error(`[MOVE] Failed to delete old file ${url}: ${deleteError.message}`);
          // File was copied but old not deleted - ghost file possible
          // Still update the DB to point to new location
        }

        // Step 4: Update dokument_url in DB
        const { error: updateError } = await supabase
          .from("documents")
          .update({ dokument_url: newPath })
          .eq("id", doc.id);

        if (updateError) {
          console.error(`[MOVE] DB update failed for ${doc.id}: ${updateError.message}`);
          results.push({
            id: doc.id,
            old_path: url,
            new_path: newPath,
            moved: false,
            error: `db_update_failed: ${updateError.message}`,
          });
          errorCount++;
          continue;
        }

        console.log(`[MOVE] ${doc.id}: ${url} -> ${newPath}`);
        results.push({
          id: doc.id,
          old_path: url,
          new_path: newPath,
          moved: true,
        });
        movedCount++;
      } catch (moveError: any) {
        console.error(`[MOVE] Error moving ${doc.id}: ${moveError.message}`);
        results.push({
          id: doc.id,
          old_path: url,
          new_path: newPath,
          moved: false,
          error: moveError.message,
        });
        errorCount++;
      }
    }

    const summary = {
      total: (documents || []).length,
      moved: movedCount,
      skipped: skippedCount,
      errors: errorCount,
      dry_run: dryRun,
    };

    console.log(`[MOVE] Done: ${JSON.stringify(summary)}`);

    return new Response(
      JSON.stringify({ results, summary }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err: any) {
    console.error("[MOVE] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
