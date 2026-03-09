// =============================================================================
// Process Document - Wrapper (Stage 1: OCR + Stage 2: Kategorisierung)
// Version: 40.0.0 - 2026-03-09
// =============================================================================
// Architektur: Dieser Wrapper empfaengt Dokumente von Scanner / process-email
// und delegiert intern an zwei spezialisierte Edge Functions:
//
//   1. process-document-ocr (Stage 1): OCR, Duplikat-Check, Upload-Filter
//   2. process-document-categorize (Stage 2): GPT-Kategorisierung, Storage-Move
//
// Die Response-Struktur bleibt backwards-kompatibel (Scanner + process-email).
//
// Vorher: 1247 Zeilen monolithisch (OCR + GPT + Storage + DB)
// Jetzt:  ~200 Zeilen Wrapper mit HTTP-Delegation
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createApiKeyValidator } from "./utils.ts";

// API Key Protection
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");
const SCANNER_API_KEY = Deno.env.get("SCANNER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const validateApiKey = createApiKeyValidator(INTERNAL_API_KEY, SCANNER_API_KEY);

// Internal API key for stage function calls
const STAGE_API_KEY = INTERNAL_API_KEY || SCANNER_API_KEY || "";

Deno.serve(async (req: Request) => {
  // ==========================================================================
  // Health Check (GET)
  // ==========================================================================
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        service: "process-document",
        version: "40.0.0",
        status: "ready",
        architecture: "wrapper",
        pipeline: {
          stage1: "process-document-ocr",
          stage2: "process-document-categorize",
        },
        configured: {
          supabase: !!SUPABASE_URL,
          internalApiKey: !!INTERNAL_API_KEY,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ========================================================================
    // API Key Validation
    // ========================================================================
    const authResult = validateApiKey(req);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: authResult.reason }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // FormData empfangen und an Stage 1 forwarden
    // ========================================================================
    const formData = await req.formData();

    // Stage 1: OCR + Duplikat-Check
    console.log(`[WRAPPER] Stage 1: Sende an process-document-ocr`);
    const ocrUrl = `${SUPABASE_URL}/functions/v1/process-document-ocr`;

    const stage1Controller = new AbortController();
    const stage1Timeout = setTimeout(() => stage1Controller.abort(), 60000);

    let ocrResponse: Response;
    try {
      ocrResponse = await fetch(ocrUrl, {
        method: "POST",
        headers: { "x-api-key": STAGE_API_KEY },
        body: formData,
        signal: stage1Controller.signal,
      });
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        throw new Error("Stage 1 (OCR) timeout after 60s");
      }
      throw fetchError;
    } finally {
      clearTimeout(stage1Timeout);
    }

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error(`[WRAPPER] Stage 1 fehlgeschlagen: ${ocrResponse.status} - ${errorText}`);
      // Forward the error response as-is (backwards-kompatibel)
      return new Response(errorText, {
        status: ocrResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ocrResult = await ocrResponse.json();
    console.log(`[WRAPPER] Stage 1 Ergebnis: status=${ocrResult.processing_status}, id=${ocrResult.id}`);

    // ========================================================================
    // Stage 1 Ergebnis pruefen - manche Faelle sind sofort fertig
    // ========================================================================

    // Duplikat erkannt → direkt zurueckgeben
    if (ocrResult.duplicate) {
      console.log(`[WRAPPER] Duplikat erkannt - kein Stage 2 noetig`);
      return new Response(JSON.stringify(ocrResult), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Media ohne Text (done) → direkt zurueckgeben
    if (ocrResult.processing_status === "done") {
      console.log(`[WRAPPER] Stage 1 done (Media/Upload-Filter) - kein Stage 2 noetig`);
      return new Response(JSON.stringify(ocrResult), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // OCR-Fehler → direkt zurueckgeben
    if (ocrResult.processing_status === "error_ocr") {
      console.log(`[WRAPPER] Stage 1 error_ocr - kein Stage 2 moeglich`);
      return new Response(JSON.stringify(ocrResult), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // pending_categorize → weiter mit Stage 2
    if (ocrResult.processing_status !== "pending_categorize") {
      console.warn(`[WRAPPER] Unerwarteter Status: ${ocrResult.processing_status} - gebe zurueck`);
      return new Response(JSON.stringify(ocrResult), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ========================================================================
    // Stage 2: GPT-Kategorisierung + Storage-Move
    // ========================================================================
    console.log(`[WRAPPER] Stage 2: Sende document_id=${ocrResult.id} an process-document-categorize`);
    const catUrl = `${SUPABASE_URL}/functions/v1/process-document-categorize`;

    const stage2Controller = new AbortController();
    const stage2Timeout = setTimeout(() => stage2Controller.abort(), 45000);

    let catResponse: Response;
    try {
      catResponse = await fetch(catUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": STAGE_API_KEY,
        },
        body: JSON.stringify({ document_id: ocrResult.id }),
        signal: stage2Controller.signal,
      });
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        throw new Error(`Stage 2 (Kategorisierung) timeout after 45s for document ${ocrResult.id}`);
      }
      throw fetchError;
    } finally {
      clearTimeout(stage2Timeout);
    }

    if (!catResponse.ok) {
      const errorText = await catResponse.text();
      console.error(`[WRAPPER] Stage 2 fehlgeschlagen: ${catResponse.status} - ${errorText}`);
      // Return combined info so caller knows OCR succeeded but categorization failed
      return new Response(JSON.stringify({
        error: `Kategorisierung fehlgeschlagen: ${catResponse.status}`,
        stage1_success: true,
        id: ocrResult.id,
        processing_status: "pending_categorize",
        detail: errorText,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const catResult = await catResponse.json();
    console.log(`[WRAPPER] Stage 2 Ergebnis: kategorie=${catResult.kategorie}, id=${catResult.id}`);

    // ========================================================================
    // Kombiniertes Ergebnis zurueckgeben (backwards-kompatibel)
    // ========================================================================
    return new Response(JSON.stringify(catResult), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[WRAPPER] Error processing document:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
