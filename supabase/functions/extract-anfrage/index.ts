// =============================================================================
// Extract Anfrage - Auftragsdaten aus E-Mail extrahieren
// Version: 1.0.1 - 2026-02-09
// =============================================================================
// v1.0.1: temperature + max_tokens entfernt (GPT-5 Nano API-Kompatibilitaet)
// v1.0.0: Initial - GPT-5 Nano Extraktion, Bestandskunden-Match, Auftragsanlage
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SVC_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =============================================================================
// Auth
// =============================================================================

function validateApiKey(req: Request): boolean {
  if (!INTERNAL_API_KEY) return false;
  const key = req.headers.get("x-api-key");
  if (key === INTERNAL_API_KEY) return true;
  const auth = req.headers.get("authorization");
  if (auth) {
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match && match[1] === INTERNAL_API_KEY) return true;
  }
  return false;
}

// =============================================================================
// Types
// =============================================================================

interface EmailDoc {
  id: string;
  email_betreff: string;
  email_body_text: string;
  email_von_email: string;
  email_von_name: string;
  email_richtung: string;
  email_kategorie: string;
}

interface ExtractedData {
  kunde_name: string;
  kunde_telefon: string | null;
  kunde_email: string | null;
  kunde_strasse: string | null;
  kunde_plz: string | null;
  kunde_ort: string | null;
  beschreibung: string;
  auftragstyp: string;
}

// =============================================================================
// GPT-5 Nano Extraction (v1.0.1: no temperature/max_tokens)
// =============================================================================

async function extractWithGPT(doc: EmailDoc): Promise<ExtractedData> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

  const systemPrompt = `Du extrahierst Kundendaten aus E-Mail-Anfragen fuer JS Fenster & Tueren (Fensterbau, Amberg/Bayern).

Extrahiere als JSON:
- kunde_name: Vor- und Nachname des KUNDEN (nicht JS-Fenster-Mitarbeiter)
- kunde_telefon: Telefonnummer oder null
- kunde_email: E-Mail des Kunden (nicht @js-fenster.de)
- kunde_strasse: Strasse oder null
- kunde_plz: PLZ oder null
- kunde_ort: Ort oder null
- beschreibung: Was will der Kunde? Kurz zusammengefasst.
- auftragstyp: "Reparaturauftrag" wenn etwas kaputt/defekt, sonst "Auftrag"

WICHTIG:
- Website-Kontaktformulare (von website@js-fenster.de): Kundendaten stehen IM Text.
- Weiterleitungen (WG:/FW:): Der urspruengliche Absender ist der Kunde.
- Wenn Daten fehlen: null setzen, NICHT erfinden.
- beschreibung: In eigenen Worten, was der Kunde braucht.`;

  const userMessage = `Von: ${doc.email_von_name} <${doc.email_von_email}>\nBetreff: ${doc.email_betreff}\nText: ${(doc.email_body_text || "").substring(0, 4000)}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[GPT] Error ${response.status}: ${errText.substring(0, 200)}`);
    throw new Error(`GPT error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  console.log(`[EXTRACT-GPT] Response: ${content.substring(0, 500)}`);

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("GPT returned no JSON");

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    kunde_name: parsed.kunde_name || doc.email_von_name || "Unbekannt",
    kunde_telefon: parsed.kunde_telefon || null,
    kunde_email: parsed.kunde_email || (doc.email_von_email?.endsWith("@js-fenster.de") ? null : doc.email_von_email),
    kunde_strasse: parsed.kunde_strasse || null,
    kunde_plz: parsed.kunde_plz || null,
    kunde_ort: parsed.kunde_ort || null,
    beschreibung: parsed.beschreibung || doc.email_betreff || "",
    auftragstyp: parsed.auftragstyp || "Reparaturauftrag",
  };
}

// =============================================================================
// Bestandskunden-Suche
// =============================================================================

async function findBestandskunde(name: string, email: string | null): Promise<any | null> {
  // 1. Email-Match (praeziseste Methode)
  if (email && !email.endsWith("@js-fenster.de")) {
    const { data: emailMatch } = await supabase
      .from("erp_kunden")
      .select("code, firma1, firma2, name, ort, telefon, email")
      .ilike("email", `%${email}%`)
      .limit(1);
    if (emailMatch && emailMatch.length > 0) {
      console.log(`[MATCH] Email-Treffer: ${emailMatch[0].firma1}`);
      return emailMatch[0];
    }
  }

  // 2. Name-Match via Score-Funktion
  const nameWords = name.split(/\s+/).filter((w: string) => w.length >= 2);
  if (nameWords.length > 0) {
    const { data: nameMatch, error } = await supabase.rpc("search_kunden_scored", { search_words: nameWords });
    if (!error && nameMatch && nameMatch.length > 0 && nameMatch[0].match_count >= 2) {
      console.log(`[MATCH] Name-Treffer: ${nameMatch[0].firma1} (${nameMatch[0].match_count} Matches)`);
      return nameMatch[0];
    }
  }

  console.log(`[MATCH] Kein Bestandskunde gefunden fuer: ${name}`);
  return null;
}

// =============================================================================
// Telegram
// =============================================================================

async function sendTelegram(chatId: number, text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    return r.ok;
  } catch { return false; }
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  // Health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({
      service: "extract-anfrage",
      version: "1.0.1",
      status: "ready",
      configured: {
        openai: !!OPENAI_API_KEY,
        telegram: !!TELEGRAM_BOT_TOKEN,
        supabase: !!SUPABASE_SERVICE_ROLE_KEY,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  if (!validateApiKey(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const documentId = body.document_id;
    if (!documentId) {
      return new Response(JSON.stringify({ error: "document_id required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    console.log(`[EXTRACT] Start: ${documentId}`);

    // 1. Email lesen
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, email_betreff, email_body_text, email_von_email, email_von_name, email_richtung, email_kategorie")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      console.error(`[EXTRACT] Document not found: ${documentId}`);
      return new Response(JSON.stringify({ error: "Document not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    // 2. GPT Extraktion
    const extracted = await extractWithGPT(doc as EmailDoc);
    console.log(`[EXTRACT] Name=${extracted.kunde_name}, Typ=${extracted.auftragstyp}`);

    // 3. Bestandskunde suchen
    const bestandskunde = await findBestandskunde(extracted.kunde_name, extracted.kunde_email);

    // 4. Auftrag anlegen
    const auftragData: Record<string, unknown> = {
      status: "OFFEN",
      prioritaet: "NORMAL",
      beschreibung: extracted.beschreibung,
      auftragstyp: extracted.auftragstyp,
      erstellt_via: "email",
      document_id: documentId,
      kundentyp_option: "Privat",
      metadata: {
        email_betreff: doc.email_betreff,
        email_von: doc.email_von_email,
        email_kategorie: doc.email_kategorie,
        extrahiert_am: new Date().toISOString(),
      },
    };

    if (bestandskunde) {
      auftragData.kunde_kategorie = "BESTANDSKUNDE";
      auftragData.erp_kunde_id = bestandskunde.code;
    } else {
      auftragData.kunde_kategorie = "NEUKUNDE";
      auftragData.neukunde_name = extracted.kunde_name;
      auftragData.neukunde_telefon = extracted.kunde_telefon;
      auftragData.neukunde_email = extracted.kunde_email;
      if (extracted.kunde_strasse) auftragData.adresse_strasse = extracted.kunde_strasse;
      if (extracted.kunde_plz) auftragData.adresse_plz = extracted.kunde_plz;
      if (extracted.kunde_ort) auftragData.adresse_ort = extracted.kunde_ort;
    }

    const { data: newAuftrag, error: insertError } = await supabase
      .from("auftraege")
      .insert(auftragData)
      .select("id, auftragsnummer")
      .single();

    if (insertError) {
      console.error(`[EXTRACT] Auftrag-Insert fehlgeschlagen: ${insertError.message}`);
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    console.log(`[EXTRACT] Auftrag erstellt: ${newAuftrag.auftragsnummer}`);

    // 5. Telegram-Benachrichtigung
    const { data: sessions } = await supabase
      .from("telegram_sessions")
      .select("telegram_chat_id")
      .order("last_activity_at", { ascending: false })
      .limit(3);

    const kundeDisplay = bestandskunde
      ? `${bestandskunde.firma1 || bestandskunde.name} (Bestandskunde, ${bestandskunde.ort || ""})`
      : `${extracted.kunde_name} (Neukunde)`;

    const msg =
      `<b>Neuer Auftrag aus E-Mail</b>\n\n` +
      `<b>Nr:</b> ${newAuftrag.auftragsnummer}\n` +
      `<b>Typ:</b> ${extracted.auftragstyp}\n` +
      `<b>Kunde:</b> ${kundeDisplay}\n` +
      `<b>Tel:</b> ${extracted.kunde_telefon || "-"}\n` +
      `<b>Email:</b> ${extracted.kunde_email || "-"}\n` +
      `<b>Betreff:</b> ${(doc.email_betreff || "-").substring(0, 80)}\n\n` +
      `<b>Beschreibung:</b>\n${(extracted.beschreibung || "-").substring(0, 300)}\n\n` +
      `<i>Automatisch aus E-Mail (${doc.email_kategorie})</i>`;

    let telegramSent = false;
    for (const session of (sessions || [])) {
      const ok = await sendTelegram(session.telegram_chat_id, msg);
      if (ok) telegramSent = true;
    }
    console.log(`[EXTRACT] Telegram gesendet: ${telegramSent}`);

    return new Response(JSON.stringify({
      success: true,
      auftrag_id: newAuftrag.id,
      auftragsnummer: newAuftrag.auftragsnummer,
      kunde: kundeDisplay,
      telegram_sent: telegramSent,
      extracted,
    }), { status: 201, headers: { "Content-Type": "application/json" } });

  } catch (error) {
    console.error(`[EXTRACT] Error: ${error}`);
    return new Response(JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
