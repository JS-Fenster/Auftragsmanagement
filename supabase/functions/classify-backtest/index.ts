// =============================================================================
// Classify Backtest - Re-Klassifizierung ohne Datenaenderung
// Version: 1.0.0 - 2026-02-10
// =============================================================================
// Liest Dokumente aus der DB, sendet den OCR-Text an GPT-5 mini mit dem
// SYSTEM_PROMPT aus process-document/prompts.ts und vergleicht die neue
// Kategorie mit der bestehenden. KEIN Schreibzugriff auf documents.
//
// Usage:
//   POST /functions/v1/classify-backtest
//   Header: x-api-key: <INTERNAL_API_KEY>
//   Body: { "document_ids": ["uuid1", ...], "limit": 20 }
//
// Parameter:
//   - document_ids: (optional) Array von Dokument-UUIDs zum Testen
//   - limit: (optional) Max Anzahl Dokumente, default 20, max 20
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SYSTEM_PROMPT } from "../process-document/prompts.ts";

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

const MAX_DOCS_PER_CALL = 20;
const GPT_MODEL = "gpt-5-mini";

const KATEGORIE_ENUM = [
  "Abnahmeprotokoll",
  "Angebot",
  "Aufmassblatt",
  "Auftragsbestaetigung",
  "Ausgangsrechnung",
  "Bauplan",
  "Bestellung",
  "Bild",
  "Brief_ausgehend",
  "Brief_eingehend",
  "Brief_von_Finanzamt",
  "Eingangslieferschein",
  "Eingangsrechnung",
  "Finanzierung",
  "Formular",
  "Gutschrift",
  "Kassenbeleg",
  "Kundenanfrage",
  "Kundenbestellung",
  "Kundenlieferschein",
  "Leasing",
  "Lieferantenangebot",
  "Mahnung",
  "Montageauftrag",
  "Notiz",
  "Preisanfrage",
  "Produktdatenblatt",
  "Reiseunterlagen",
  "Reklamation",
  "Serviceauftrag",
  "Skizze",
  "Sonstiges_Dokument",
  "Vertrag",
  "Zahlungsavis",
  "Zahlungserinnerung",
  "Zeichnung",
] as const;

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

async function classifyText(ocrText: string): Promise<ClassificationResult> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: GPT_MODEL,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Kategorisiere das folgende Dokument. Gib NUR die Kategorie zurueck, keine weiteren Felder.\n\n${ocrText}`,
        },
      ],
      temperature: 0,
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
}

interface BacktestResult {
  id: string;
  old_kategorie: string | null;
  new_kategorie: string;
  changed: boolean;
  betreff_old: string | null;
  old_kategorisiert_von: string | null;
  text_preview: string;
}

interface ChangeSummary {
  [key: string]: number;
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
        version: "1.0.0",
        status: "ready",
        model: GPT_MODEL,
        max_docs_per_call: MAX_DOCS_PER_CALL,
        configured: {
          openai: !!OPENAI_API_KEY,
          supabase: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
          internalApiKey: !!INTERNAL_API_KEY,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // ---- Only POST ----
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
    let documentIds: string[] | null = null;
    let limit = MAX_DOCS_PER_CALL;

    try {
      const body = await req.json();
      if (Array.isArray(body.document_ids) && body.document_ids.length > 0) {
        documentIds = body.document_ids.slice(0, MAX_DOCS_PER_CALL);
      }
      if (typeof body.limit === "number" && body.limit > 0) {
        limit = Math.min(body.limit, MAX_DOCS_PER_CALL);
      }
    } catch {
      // Leerer Body ist OK - defaults werden genutzt
    }

    // ---- Load Documents ----
    let documents: DocumentRow[];

    if (documentIds && documentIds.length > 0) {
      // Modus A: Spezifische IDs
      console.log(`[BACKTEST] Loading ${documentIds.length} specific document(s)`);
      const { data, error } = await supabase
        .from("documents")
        .select("id, kategorie, betreff, kategorisiert_von, ocr_text")
        .in("id", documentIds)
        .not("ocr_text", "is", null);

      if (error) {
        throw new Error(`DB query failed: ${error.message}`);
      }
      documents = (data || []) as DocumentRow[];
    } else {
      // Modus B: Die letzten `limit` Dokumente mit OCR-Text
      console.log(`[BACKTEST] Loading last ${limit} documents with OCR text`);
      const { data, error } = await supabase
        .from("documents")
        .select("id, kategorie, betreff, kategorisiert_von, ocr_text")
        .not("ocr_text", "is", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`DB query failed: ${error.message}`);
      }
      documents = (data || []) as DocumentRow[];
    }

    if (documents.length === 0) {
      return new Response(
        JSON.stringify({
          results: [],
          summary: { total: 0, changed: 0, unchanged: 0, changes: {} },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[BACKTEST] Processing ${documents.length} document(s) with ${GPT_MODEL}`);

    // ---- Classify each document ----
    const results: BacktestResult[] = [];
    const changes: ChangeSummary = {};
    let changedCount = 0;
    let unchangedCount = 0;

    for (const doc of documents) {
      try {
        const classification = await classifyText(doc.ocr_text);
        const newKategorie = classification.kategorie;
        const oldKategorie = doc.kategorie;
        const changed = newKategorie !== oldKategorie;

        if (changed) {
          changedCount++;
          const changeKey = `${oldKategorie || "(null)"}→${newKategorie}`;
          changes[changeKey] = (changes[changeKey] || 0) + 1;
        } else {
          unchangedCount++;
        }

        results.push({
          id: doc.id,
          old_kategorie: oldKategorie,
          new_kategorie: newKategorie,
          changed,
          betreff_old: doc.betreff,
          old_kategorisiert_von: doc.kategorisiert_von,
          text_preview: doc.ocr_text.substring(0, 100),
        });

        console.log(
          `[BACKTEST] ${doc.id}: ${oldKategorie} -> ${newKategorie} ${changed ? "[CHANGED]" : "[OK]"}`
        );
      } catch (classifyError) {
        console.error(`[BACKTEST] Error classifying ${doc.id}:`, classifyError);
        results.push({
          id: doc.id,
          old_kategorie: doc.kategorie,
          new_kategorie: `ERROR: ${classifyError instanceof Error ? classifyError.message : String(classifyError)}`,
          changed: false,
          betreff_old: doc.betreff,
          old_kategorisiert_von: doc.kategorisiert_von,
          text_preview: doc.ocr_text.substring(0, 100),
        });
      }
    }

    // ---- Response ----
    const response = {
      results,
      summary: {
        total: documents.length,
        changed: changedCount,
        unchanged: unchangedCount,
        changes,
      },
    };

    console.log(
      `[BACKTEST] Done: ${documents.length} total, ${changedCount} changed, ${unchangedCount} unchanged`
    );

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[BACKTEST] Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
