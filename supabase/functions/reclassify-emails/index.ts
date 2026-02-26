// =============================================================================
// Reclassify Emails - Batch Email-Kategorisierung
// Version: 1.0.0 - 2026-02-25
// =============================================================================
// Reklassifiziert Emails mit GPT. Nutzt denselben Prompt wie process-email.
// Einmal-Migrations-Tool fuer K-010.
//
// Usage:
//   POST /functions/v1/reclassify-emails
//   Header: x-api-key: <INTERNAL_API_KEY>
//   Body: { "limit": 50 }                    // Sonstiges-Emails
//         oder { "doc_ids": ["uuid1", ...] }  // Spezifische Emails
//         oder { "dry_run": true, "limit": 5 } // Nur anzeigen
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { VALID_EMAIL_KATEGORIEN } from "../_shared/categories.ts";

const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const MAX_DOCS = 50;

function validateApiKey(req: Request): boolean {
  if (!INTERNAL_API_KEY) return false;
  return req.headers.get("x-api-key") === INTERNAL_API_KEY;
}

async function classifyEmail(
  betreff: string,
  bodyText: string,
  vonEmail: string,
  richtung: string
): Promise<{ kategorie: string; zusammenfassung: string }> {
  const truncatedBody = bodyText?.substring(0, 2000) || "";

  const prompt = `Du bist ein E-Mail-Kategorisierer fuer ein Fenster- und Tuerenunternehmen (J.S. Fenster & Tueren).

Kategorisiere die folgende E-Mail in GENAU eine dieser Kategorien:
${VALID_EMAIL_KATEGORIEN.join(", ")}

Kategorie-Definitionen:
- Automatische_Benachrichtigung: Auto-Replies, Abwesenheitsnotizen, Zustellberichte, System-Mails, Mailerdaemon
- Intern: Interne Kommunikation zwischen Mitarbeitern von JS Fenster
- Marktplatz_Anfrage: Anfragen ueber eBay, Kleinanzeigen, oder andere Marktplaetze
- Nachverfolgung: Follow-Up Emails, Rueckfragen zu bestehenden Vorgaengen (KEIN neuer Auftrag)
- Newsletter_Werbung: Newsletter, Werbemails, Marketing-Aktionen
- Kundenanfrage: Neue Anfrage von einem Kunden (Preis, Angebot, Info)
- Lead_Anfrage: Neue Anfrage ueber Webformular, Vergleichsportal, etc.
- Bewerbung: Stellenbewerbungen und Initiativbewerbungen
- Sonstiges: NUR wenn keine andere Kategorie passt

E-Mail-Daten:
- Richtung: ${richtung}
- Von: ${vonEmail}
- Betreff: ${betreff}
- Text (Auszug): ${truncatedBody}

Antwort im JSON-Format:
{
  "kategorie": "KATEGORIE_NAME",
  "zusammenfassung": "Kurze Zusammenfassung in 1-2 Saetzen"
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 400,
      reasoning_effort: "medium",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[RECLASS] OpenAI error: ${response.status} - ${errorText.substring(0, 300)}`);
    throw new Error(`OpenAI API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON in GPT response: ${content.substring(0, 100)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate category
  const matchedCategory = VALID_EMAIL_KATEGORIEN.find(
    (c) => c.toLowerCase() === parsed.kategorie?.toLowerCase()
  );

  return {
    kategorie: matchedCategory || "Sonstiges",
    zusammenfassung: parsed.zusammenfassung || betreff,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key",
      },
    });
  }

  if (!validateApiKey(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const dryRun = body.dry_run === true;
    const limit = Math.min(body.limit || 50, MAX_DOCS);
    let docIds: string[] | null = null;

    if (Array.isArray(body.doc_ids) && body.doc_ids.length > 0) {
      docIds = body.doc_ids.slice(0, MAX_DOCS);
    }

    // Query emails to reclassify
    let query = supabase
      .from("documents")
      .select("id, email_betreff, email_body_text, email_von_email, email_richtung, email_kategorie")
      .eq("source", "email");

    if (docIds) {
      query = query.in("id", docIds);
    } else {
      query = query.eq("email_kategorie", "Sonstiges").limit(limit);
    }

    const { data: emails, error: queryError } = await query;
    if (queryError) throw new Error(`Query failed: ${queryError.message}`);

    console.log(`[RECLASS] Processing ${(emails || []).length} emails, dry_run=${dryRun}`);

    let changed = 0;
    let unchanged = 0;
    let errors = 0;
    const results: any[] = [];

    for (const email of emails || []) {
      try {
        const result = await classifyEmail(
          email.email_betreff || "",
          email.email_body_text || "",
          email.email_von_email || "",
          email.email_richtung || "eingehend"
        );

        const wasChanged = result.kategorie !== email.email_kategorie;

        if (wasChanged && !dryRun) {
          const { error: updateError } = await supabase
            .from("documents")
            .update({
              email_kategorie: result.kategorie,
              inhalt_zusammenfassung: result.zusammenfassung,
            })
            .eq("id", email.id);

          if (updateError) {
            console.error(`[RECLASS] DB update failed for ${email.id}: ${updateError.message}`);
            errors++;
            results.push({ id: email.id, error: updateError.message });
            continue;
          }
        }

        if (wasChanged) {
          changed++;
        } else {
          unchanged++;
        }

        results.push({
          id: email.id,
          betreff: (email.email_betreff || "").substring(0, 60),
          old: email.email_kategorie,
          new: result.kategorie,
          changed: wasChanged,
          zusammenfassung: result.zusammenfassung?.substring(0, 80),
        });
      } catch (err: any) {
        console.error(`[RECLASS] Error for ${email.id}: ${err.message}`);
        errors++;
        results.push({ id: email.id, error: err.message });
      }

      // Small delay to not hammer OpenAI
      await new Promise((r) => setTimeout(r, 200));
    }

    const summary = {
      total: (emails || []).length,
      changed,
      unchanged,
      errors,
      dry_run: dryRun,
    };

    console.log(`[RECLASS] Done: ${JSON.stringify(summary)}`);

    return new Response(JSON.stringify({ results, summary }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err: any) {
    console.error("[RECLASS] Fatal:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
