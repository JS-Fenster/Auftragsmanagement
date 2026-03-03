// =============================================================================
// Classify Email Backtest - Re-Klassifizierung von Email-Kategorien
// Version: 1.0.0 - 2026-02-25
// =============================================================================
// Re-klassifiziert email_kategorie fuer bestehende Email-Dokumente.
// Aehnlich wie classify-backtest, aber fuer Email-Kategorien statt Dokument-Kategorien.
//
// Usage:
//   POST /functions/v1/classify-email-backtest
//   Header: x-api-key: <INTERNAL_API_KEY>
//   Body: { "doc_ids": ["uuid1", ...], "apply": false }
//
// Parameter:
//   - doc_ids: Array von Dokument-UUIDs (max 50, PFLICHT)
//   - apply: true = DB-Update, false = nur Vergleich (default: false)
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { VALID_EMAIL_KATEGORIEN } from "../_shared/categories.ts";

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
const GPT_MODEL = "gpt-5.2";

// JSON-Schema fuer Email-Kategorisierung
const EMAIL_CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: {
    kategorie: {
      type: "string",
      enum: [...VALID_EMAIL_KATEGORIEN],
    },
    zusammenfassung: {
      type: "string",
    },
  },
  required: ["kategorie", "zusammenfassung"],
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
// GPT Email Classification
// =============================================================================

interface EmailClassificationResult {
  kategorie: string;
  zusammenfassung: string;
}

async function classifyEmail(
  betreff: string,
  bodyText: string,
  vonEmail: string,
  richtung: string
): Promise<EmailClassificationResult> {
  const truncatedBody = bodyText?.substring(0, 2000) || "";

  const prompt = `Du bist ein E-Mail-Kategorisierer fuer ein Fenster- und Tuerenunternehmen (JS Fenster & Tueren).

Kategorisiere die folgende E-Mail in GENAU eine dieser Kategorien:
${VALID_EMAIL_KATEGORIEN.join(", ")}

Hinweise zu ausgewaehlten Kategorien:
- Intern: Interne Kommunikation zwischen Mitarbeitern (z.B. @js-fenster.de an @js-fenster.de), Absprachen, interne Infos
- Marktplatz_Anfrage: Anfragen von Online-Marktplaetzen wie eBay, eBay Kleinanzeigen, Amazon, Willhaben etc.
- Nachverfolgung: Follow-Up Emails, Rueckfragen zu bestehenden Vorgaengen, "wie ist der Stand", Erinnerungen
- Antwort_oder_Weiterleitung: Weitergeleitete oder beantwortete Emails ohne klaren eigenen Kategorisierungs-Inhalt
- Sonstiges: Nur verwenden wenn keine andere Kategorie passt

E-Mail-Daten:
- Richtung: ${richtung}
- Von: ${vonEmail}
- Betreff: ${betreff}
- Text (Auszug): ${truncatedBody}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GPT_MODEL,
      messages: [{ role: "user", content: prompt }],
      reasoning: { effort: "medium" },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_classification",
          strict: true,
          schema: EMAIL_CLASSIFICATION_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;
  return JSON.parse(content) as EmailClassificationResult;
}

// =============================================================================
// Types
// =============================================================================

interface EmailDocumentRow {
  id: string;
  email_kategorie: string | null;
  email_betreff: string | null;
  email_body_text: string | null;
  email_von_email: string | null;
  email_richtung: string | null;
  kategorisiert_von: string | null;
}

interface BacktestResult {
  id: string;
  alt: string | null;
  neu: string;
  zusammenfassung: string;
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
        service: "classify-email-backtest",
        version: "1.0.0",
        status: "ready",
        model: GPT_MODEL,
        max_docs_per_call: MAX_DOCS_PER_CALL,
        email_categories: VALID_EMAIL_KATEGORIEN.length,
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
    let applyChanges = false;

    try {
      const body = await req.json();
      const ids = body.doc_ids || body.document_ids;
      if (Array.isArray(ids) && ids.length > 0) {
        docIds = ids.slice(0, MAX_DOCS_PER_CALL);
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

    // ---- Load Email Documents ----
    console.log(`[EMAIL-BACKTEST] Loading ${docIds.length} emails, apply=${applyChanges}`);
    const { data, error } = await supabase
      .from("documents")
      .select("id, email_kategorie, email_betreff, email_body_text, email_von_email, email_richtung, kategorisiert_von")
      .in("id", docIds);

    if (error) throw new Error(`DB query failed: ${error.message}`);
    const documents = (data || []) as EmailDocumentRow[];

    if (documents.length === 0) {
      return new Response(
        JSON.stringify({ results: [], summary: { total: 0, changed: 0, unchanged: 0 } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ---- Classify each email ----
    const results: BacktestResult[] = [];
    const changes: Record<string, number> = {};
    let changedCount = 0;
    let appliedCount = 0;
    let skippedCount = 0;

    for (const doc of documents) {
      try {
        // Skip emails without body text
        if (!doc.email_body_text || doc.email_body_text.length < 10) {
          skippedCount++;
          results.push({
            id: doc.id,
            alt: doc.email_kategorie,
            neu: "SKIPPED",
            zusammenfassung: "",
            changed: false,
            applied: false,
            alt_source: doc.kategorisiert_von,
            grund: "No email body text",
          });
          continue;
        }

        const classification = await classifyEmail(
          doc.email_betreff || "(kein Betreff)",
          doc.email_body_text,
          doc.email_von_email || "(unbekannt)",
          doc.email_richtung || "eingehend"
        );

        const newKategorie = classification.kategorie;
        const oldKategorie = doc.email_kategorie;
        const changed = newKategorie !== oldKategorie;
        let applied = false;

        if (changed) {
          changedCount++;
          const changeKey = `${oldKategorie || "(null)"} -> ${newKategorie}`;
          changes[changeKey] = (changes[changeKey] || 0) + 1;

          if (applyChanges) {
            const now = new Date().toISOString();
            const { error: updateError } = await supabase
              .from("documents")
              .update({
                email_kategorie: newKategorie,
                email_zusammenfassung: classification.zusammenfassung,
                kategorisiert_von: "classify-email-backtest-v1.0.0",
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
          zusammenfassung: classification.zusammenfassung,
          changed,
          applied,
          alt_source: doc.kategorisiert_von,
        });
      } catch (classifyError) {
        console.error(`[EMAIL-BACKTEST] Error classifying ${doc.id}:`, classifyError);
        results.push({
          id: doc.id,
          alt: doc.email_kategorie,
          neu: "ERROR",
          zusammenfassung: "",
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
      unchanged: documents.length - changedCount - skippedCount,
      skipped: skippedCount,
      applied: appliedCount,
      apply_mode: applyChanges,
    };

    console.log(`[EMAIL-BACKTEST] Done: ${summary.total} total, ${summary.changed} changed, ${summary.skipped} skipped, ${summary.applied} applied`);

    return new Response(
      JSON.stringify({ results, summary, changes }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[EMAIL-BACKTEST] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
