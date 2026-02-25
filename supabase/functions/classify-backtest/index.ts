// =============================================================================
// Classify Backtest - Re-Klassifizierung mit optionalem DB-Update
// Version: 2.1.0 - 2026-02-23
// =============================================================================
// Liest Dokumente aus der DB, sendet den OCR-Text an GPT-5 mini mit dem
// SYSTEM_PROMPT aus process-document/prompts.ts und vergleicht die neue
// Kategorie mit der bestehenden.
//
// v2.1.0: KATEGORIE_ENUM auf 38 Kategorien aktualisiert (+ Fahrzeugdokument, Personalunterlagen)
//         Import KATEGORIE_ENUM direkt aus categories.ts statt hardcoded
// NEU v2.0: apply=true schreibt die neue Kategorie in die DB zurueck.
//
// Usage:
//   POST /functions/v1/classify-backtest
//   Header: x-api-key: <INTERNAL_API_KEY>
//   Body: { "doc_ids": ["uuid1", ...], "apply": false }
//
// Parameter:
//   - doc_ids: (optional) Array von Dokument-UUIDs zum Testen (max 50)
//   - apply: (optional) true = DB-Update, false = nur Vergleich (default: false)
//   - limit: (optional) Max Anzahl Dokumente, default 20, max 50
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SYSTEM_PROMPT } from "../process-document/prompts.ts";
import { canonicalizeKategorie, VALID_DOKUMENT_KATEGORIEN } from "../_shared/categories.ts";

// =============================================================================
// Environment
// =============================================================================

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =============================================================================
// Constants
// =============================================================================

const MAX_DOCS_PER_CALL = 50;
const GPT_MODEL = "gpt-5-mini";

// Nutze die zentrale Kategorie-Liste aus _shared/categories.ts (38 Kategorien)
const KATEGORIE_ENUM = VALID_DOKUMENT_KATEGORIEN;

// Minimales JSON-Schema: nur Kategorie extrahieren (spart Tokens)
const CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: {
    kategorie: {
      type: "string",
      enum: [...KATEGORIE_ENUM],
    },
  },
  required: ["kategorie"],
  additionalProperties: false,
} as const;

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
// GPT Classification (nur Kategorie)
// =============================================================================

interface ClassificationResult {
  kategorie: string;
}

async function classifyText(ocrText: string, fileName?: string): Promise<ClassificationResult> {
  const userContent = fileName
    ? `Dateiname: ${fileName}\n\nKategorisiere das folgende Dokument. Gib NUR die Kategorie zurueck, keine weiteren Felder.\n\n${ocrText}`
    : `Kategorisiere das folgende Dokument. Gib NUR die Kategorie zurueck, keine weiteren Felder.\n\n${ocrText}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: GPT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      // GPT-5 mini: temperature nur default(1) erlaubt, NICHT 0
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "classification",
          strict: true,
          schema: CLASSIFICATION_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;
  return JSON.parse(content) as ClassificationResult;
}

// =============================================================================
// Types
// =============================================================================

interface DocumentRow {
  id: string;
  kategorie: string | null;
  betreff: string | null;
  kategorisiert_von: string | null;
  ocr_text: string;
  dokument_url: string | null;
}

interface BacktestResult {
  id: string;
  alt: string | null;
  neu: string;
  changed: boolean;
  applied: boolean;
  alt_source: string | null;
  grund?: string;
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  // ---- Health Check (GET) ----
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        service: "classify-backtest",
        version: "2.1.0",
        status: "ready",
        model: GPT_MODEL,
        max_docs_per_call: MAX_DOCS_PER_CALL,
        features: { apply_mode: true },
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

  // ---- Auth ----
  const authResult = validateApiKey(req);
  if (!authResult.valid) {
    return new Response(JSON.stringify({ error: authResult.reason }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // ---- Parse Body ----
    let docIds: string[] | null = null;
    let limit = 20;
    let applyChanges = false;

    try {
      const body = await req.json();
      // Support both doc_ids and document_ids
      const ids = body.doc_ids || body.document_ids;
      if (Array.isArray(ids) && ids.length > 0) {
        docIds = ids.slice(0, MAX_DOCS_PER_CALL);
      }
      if (typeof body.limit === "number" && body.limit > 0) {
        limit = Math.min(body.limit, MAX_DOCS_PER_CALL);
      }
      if (body.apply === true) {
        applyChanges = true;
      }
    } catch {
      // Leerer Body ist OK
    }

    if (!docIds || docIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Provide 1-50 doc_ids" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ---- Load Documents ----
    console.log(`[BACKTEST] Loading ${docIds.length} docs, apply=${applyChanges}`);
    const { data, error } = await supabase
      .from("documents")
      .select("id, kategorie, betreff, kategorisiert_von, ocr_text, dokument_url")
      .in("id", docIds)
      .not("ocr_text", "is", null);

    if (error) throw new Error(`DB query failed: ${error.message}`);
    const documents = (data || []) as DocumentRow[];

    if (documents.length === 0) {
      return new Response(
        JSON.stringify({ results: [], summary: { total: 0, changed: 0, unchanged: 0 } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ---- Classify each document ----
    const results: BacktestResult[] = [];
    const changes: Record<string, number> = {};
    let changedCount = 0;
    let appliedCount = 0;

    for (const doc of documents) {
      try {
        // Extract filename from dokument_url
        const fileName = doc.dokument_url?.split("/").pop() || undefined;

        const classification = await classifyText(doc.ocr_text, fileName);
        // Apply alias mapping (typo fix etc.)
        const rawKategorie = classification.kategorie;
        const newKategorie = canonicalizeKategorie(rawKategorie) || rawKategorie;
        const oldKategorie = doc.kategorie;
        const changed = newKategorie !== oldKategorie;
        let applied = false;

        if (changed) {
          changedCount++;
          const changeKey = `${oldKategorie || "(null)"} -> ${newKategorie}`;
          changes[changeKey] = (changes[changeKey] || 0) + 1;

          // Apply to DB if requested
          if (applyChanges) {
            const now = new Date().toISOString();
            const { error: updateError } = await supabase
              .from("documents")
              .update({
                kategorie: newKategorie,
                kategorisiert_von: "process-document-gpt",
                kategorisiert_am: now,
              })
              .eq("id", doc.id);

            if (updateError) {
              console.error(`[APPLY] Failed to update ${doc.id}: ${updateError.message}`);
            } else {
              applied = true;
              appliedCount++;
              console.log(`[APPLY] ${doc.id}: ${oldKategorie} -> ${newKategorie}`);
            }
          }
        }

        results.push({
          id: doc.id,
          alt: oldKategorie,
          neu: newKategorie,
          changed,
          applied,
          alt_source: doc.kategorisiert_von,
        });
      } catch (classifyError) {
        console.error(`[BACKTEST] Error classifying ${doc.id}:`, classifyError);
        results.push({
          id: doc.id,
          alt: doc.kategorie,
          neu: "ERROR",
          changed: false,
          applied: false,
          alt_source: doc.kategorisiert_von,
          grund: classifyError instanceof Error ? classifyError.message : String(classifyError),
        });
      }
    }

    const summary = {
      total: documents.length,
      changed: changedCount,
      unchanged: documents.length - changedCount,
      applied: appliedCount,
      apply_mode: applyChanges,
    };

    console.log(`[BACKTEST] Done: ${summary.total} total, ${summary.changed} changed, ${summary.applied} applied`);

    return new Response(
      JSON.stringify({ results, summary, changes }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[BACKTEST] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
