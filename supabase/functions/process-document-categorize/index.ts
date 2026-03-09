// =============================================================================
// Process Document - Stage 2: GPT-Kategorisierung + Feld-Extraktion
// Version: 1.0.0 - 2026-03-09
// =============================================================================
// Zweite Stufe der 2-Stufen-Pipeline (G-052):
// Stage 1 (process-document-ocr): OCR-Extraktion → speichert ocr_text, setzt status=pending_categorize
// Stage 2 (DIESE FUNCTION): GPT-Kategorisierung + Feld-Extraktion + Storage-Verschiebung
//
// Input: POST { "document_id": "uuid" }
// - Kein File-Upload noetig, OCR-Text steht bereits in der DB
// - Dokument muss processing_status='pending_categorize' haben
//
// Ablauf:
// 1. API Key Validation (x-api-key Header)
// 2. Dokument aus DB laden (mit Status-Check)
// 3. Status auf 'processing' setzen (Lock)
// 4. GPT-Kategorisierung (json_schema strict)
// 5. Validierung + Canonicalization
// 6. Storage-Verschiebung (inbox → Kategorie-Ordner)
// 7. DB Update (alle extrahierten Felder)
// 8. Budget-Extraktion (bei Aufmassblatt)
// 9. Response
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SYSTEM_PROMPT } from "../process-document/prompts.ts";
import { canonicalizeKategorie, isValidDokumentKategorie } from "../_shared/categories.ts";
import {
  ExtractedDocument,
  EXTRACTION_SCHEMA,
  UNTERSCHRIFT_ERFORDERLICH_KATEGORIEN,
} from "../process-document/schema.ts";
import {
  getMimeType,
  sanitizeFileName,
  createApiKeyValidator,
} from "../process-document/utils.ts";
import {
  BUDGET_EXTRACTION_PROMPT,
  shouldExtractBudget,
  validateExtractionResult,
  type BudgetExtractionResult,
} from "../process-document/budget-prompts.ts";

// =============================================================================
// Environment & Clients
// =============================================================================

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");
const SCANNER_API_KEY = Deno.env.get("SCANNER_API_KEY");

const validateApiKey = createApiKeyValidator(INTERNAL_API_KEY, SCANNER_API_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// =============================================================================
// GPT Categorization (identisch zu process-document categorizeAndExtract)
// =============================================================================

async function categorizeAndExtract(ocrText: string, fileName: string): Promise<ExtractedDocument> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Dateiname: ${fileName}\n\nAnalysiere das folgende Dokument und extrahiere alle relevanten Informationen als JSON:\n\n${ocrText}`,
        },
      ],
      // json_schema mit strict:true (Enum-Constraint fuer Kategorie)
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "document_extraction",
          strict: true,
          schema: EXTRACTION_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI extraction failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;

  const parsed = JSON.parse(content);

  // Defensive Validierung (json_schema strict erzwingt Felder, aber sicher ist sicher)
  if (!parsed.kategorie) {
    console.warn(`[GPT-VALIDATION] Missing 'kategorie' in GPT response - falling back to Sonstiges_Dokument`);
    parsed.kategorie = "Sonstiges_Dokument";
  }
  if (!parsed.extraktions_qualitaet) {
    console.warn(`[GPT-VALIDATION] Missing 'extraktions_qualitaet' - falling back to niedrig`);
    parsed.extraktions_qualitaet = "niedrig";
  }
  if (!Array.isArray(parsed.extraktions_hinweise)) {
    parsed.extraktions_hinweise = [];
  }

  return parsed as ExtractedDocument;
}

// =============================================================================
// Build Database Record (identisch zu process-document buildDatabaseRecord)
// =============================================================================

function buildDatabaseRecord(
  extracted: ExtractedDocument,
  dokumentUrl: string,
  kategorisiertVon: string = "process-document-gpt"
): Record<string, unknown> {
  // Canonicalize kategorie (alias mapping)
  let kategorie = canonicalizeKategorie(extracted.kategorie) || extracted.kategorie;

  // Validate category against known enum
  if (!isValidDokumentKategorie(kategorie)) {
    console.warn(`[GPT-VALIDATION] Invalid kategorie '${kategorie}' after canonicalization - falling back to Sonstiges_Dokument`);
    kategorie = "Sonstiges_Dokument";
  }

  // Business-Logik fuer unterschrift_erforderlich
  const unterschriftErforderlich = UNTERSCHRIFT_ERFORDERLICH_KATEGORIEN.includes(kategorie);

  const now = new Date().toISOString();

  return {
    kategorie: kategorie,
    dokument_url: dokumentUrl,
    extraktions_zeitstempel: now,
    extraktions_qualitaet: extracted.extraktions_qualitaet,
    extraktions_hinweise: extracted.extraktions_hinweise,
    // Processing-Status Felder
    processing_status: "done",
    processed_at: now,
    kategorisiert_am: now,
    kategorisiert_von: kategorisiertVon,
    // Unterschrift-Felder
    empfang_unterschrift: extracted.empfang_unterschrift,
    unterschrift: extracted.unterschrift,
    unterschrift_erforderlich: unterschriftErforderlich,
    dokument_datum: extracted.dokument_datum,
    dokument_nummer: extracted.dokument_nummer,
    dokument_richtung: extracted.dokument_richtung,
    aussteller_firma: extracted.aussteller?.firma,
    aussteller_name: extracted.aussteller?.name,
    aussteller_strasse: extracted.aussteller?.strasse,
    aussteller_plz: extracted.aussteller?.plz,
    aussteller_ort: extracted.aussteller?.ort,
    aussteller_telefon: extracted.aussteller?.telefon,
    aussteller_email: extracted.aussteller?.email,
    aussteller_ust_id: extracted.aussteller?.ust_id,
    empfaenger_firma: extracted.empfaenger?.firma,
    empfaenger_vorname: extracted.empfaenger?.vorname,
    empfaenger_nachname: extracted.empfaenger?.nachname,
    empfaenger_strasse: extracted.empfaenger?.strasse,
    empfaenger_plz: extracted.empfaenger?.plz,
    empfaenger_ort: extracted.empfaenger?.ort,
    empfaenger_telefon: extracted.empfaenger?.telefon,
    empfaenger_email: extracted.empfaenger?.email,
    empfaenger_kundennummer: extracted.empfaenger?.kundennummer,
    summe_netto: extracted.summe_netto,
    mwst_betrag: extracted.mwst_betrag,
    summe_brutto: extracted.summe_brutto,
    offener_betrag: extracted.offener_betrag,
    positionen: extracted.positionen,
    zahlungsziel_tage: extracted.zahlungsziel_tage,
    faellig_am: extracted.faellig_am,
    skonto_prozent: extracted.skonto_prozent,
    skonto_tage: extracted.skonto_tage,
    bank_name: extracted.bank?.name,
    bank_iban: extracted.bank?.iban,
    bank_bic: extracted.bank?.bic,
    liefertermin_datum: extracted.liefertermin_datum,
    lieferzeit_wochen: extracted.lieferzeit_wochen,
    bezug_angebot_nr: extracted.bezug?.angebot_nr,
    bezug_bestellung_nr: extracted.bezug?.bestellung_nr,
    bezug_lieferschein_nr: extracted.bezug?.lieferschein_nr,
    bezug_rechnung_nr: extracted.bezug?.rechnung_nr,
    bezug_auftrag_nr: extracted.bezug?.auftrag_nr,
    bezug_projekt: extracted.bezug?.projekt,
    mahnung_stufe: extracted.mahnung_stufe,
    mahngebuehren: extracted.mahngebuehren,
    verzugszinsen_betrag: extracted.verzugszinsen_betrag,
    gesamtforderung: extracted.gesamtforderung,
    betreff: extracted.betreff,
    inhalt_zusammenfassung: extracted.inhalt_zusammenfassung,
    bemerkungen: extracted.bemerkungen,
    dringlichkeit: extracted.dringlichkeit,
  };
}

// =============================================================================
// Storage Move (Download → Upload → Delete)
// =============================================================================

async function moveStorageFile(
  oldPath: string,
  newPath: string
): Promise<{ success: boolean; error?: string }> {
  // Supabase Storage hat kein move() - wir machen Download → Upload → Delete

  // 1. Download von alter URL
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("documents")
    .download(oldPath);

  if (downloadError) {
    return { success: false, error: `Download failed: ${downloadError.message}` };
  }

  if (!fileData) {
    return { success: false, error: "Download returned no data" };
  }

  // Content-Type aus Dateiname ableiten
  const fileName = oldPath.split("/").pop() || "file";
  const contentType = getMimeType(fileName);

  // 2. Upload an neue URL
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(newPath, fileData, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` };
  }

  // 3. Loesche alte URL
  const { error: deleteError } = await supabase.storage
    .from("documents")
    .remove([oldPath]);

  if (deleteError) {
    // Upload war erfolgreich, aber Delete fehlgeschlagen - nicht kritisch
    console.warn(`[STORAGE] Delete of old file failed (non-critical): ${deleteError.message}`);
  }

  return { success: true };
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req) => {
  // =====================================================================
  // Health Check (GET)
  // =====================================================================
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        service: "process-document-categorize",
        version: "1.0.0",
        status: "ready",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // =====================================================================
  // POST: GPT-Kategorisierung + Extraktion
  // =====================================================================
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  // 1. API Key Validation
  const authResult = validateApiKey(req);
  if (!authResult.valid) {
    return new Response(
      JSON.stringify({ error: authResult.reason || "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  let documentId: string | undefined;

  try {
    // Parse request body
    const body = await req.json();
    documentId = body.document_id;

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: document_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[CATEGORIZE] Starting categorization for document ${documentId}`);

    // 2. Dokument aus DB laden
    const { data: doc, error: fetchError } = await supabase
      .from("documents")
      .select("id, ocr_text, dokument_url, file_hash, text_hash, extraktions_hinweise")
      .eq("id", documentId)
      .eq("processing_status", "pending_categorize")
      .single();

    if (fetchError || !doc) {
      console.warn(`[CATEGORIZE] Document ${documentId} not found or wrong status: ${fetchError?.message}`);
      return new Response(
        JSON.stringify({
          error: "Document not found or not in pending_categorize status",
          document_id: documentId,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!doc.ocr_text) {
      return new Response(
        JSON.stringify({
          error: "Document has no OCR text - Stage 1 (OCR) must run first",
          document_id: documentId,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Status auf 'processing' setzen (Lock gegen Doppelverarbeitung)
    const { error: lockError } = await supabase
      .from("documents")
      .update({ processing_status: "processing" })
      .eq("id", documentId)
      .eq("processing_status", "pending_categorize"); // Optimistic lock

    if (lockError) {
      console.error(`[CATEGORIZE] Failed to lock document ${documentId}: ${lockError.message}`);
      return new Response(
        JSON.stringify({ error: "Failed to lock document for processing" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Dateiname aus dokument_url extrahieren
    const fileName = doc.dokument_url?.split("/").pop() || "unknown";
    const ocrText = doc.ocr_text as string;

    console.log(`[CATEGORIZE] Document loaded: ${fileName}, OCR text length: ${ocrText.length}`);

    // 4. GPT-Kategorisierung
    const startTime = Date.now();
    let extractedData: ExtractedDocument;

    try {
      extractedData = await categorizeAndExtract(ocrText, fileName);
    } catch (gptError) {
      // GPT fehlgeschlagen: Status auf error_gpt setzen, ocr_text bleibt erhalten
      const errorMessage = gptError instanceof Error ? gptError.message : "Unknown GPT error";
      console.error(`[CATEGORIZE] GPT failed for ${documentId}: ${errorMessage}`);

      await supabase
        .from("documents")
        .update({
          processing_status: "error_gpt",
          processing_last_error: errorMessage,
        })
        .eq("id", documentId);

      return new Response(
        JSON.stringify({
          error: "GPT categorization failed",
          detail: errorMessage,
          document_id: documentId,
          processing_status: "error_gpt",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const gptDuration = (Date.now() - startTime) / 1000;
    console.log(`[CATEGORIZE] GPT completed in ${gptDuration.toFixed(2)}s: kategorie=${extractedData.kategorie}`);

    // 5. Build database record (Validierung + Canonicalization)
    const dbRecord = buildDatabaseRecord(extractedData, doc.dokument_url);
    const kategorie = dbRecord.kategorie as string;

    // Merge extraktions_hinweise from Stage 1 (OCR) with Stage 2 (GPT)
    const existingHinweise = Array.isArray(doc.extraktions_hinweise) ? doc.extraktions_hinweise : [];
    const newHinweise = Array.isArray(dbRecord.extraktions_hinweise) ? dbRecord.extraktions_hinweise as string[] : [];
    dbRecord.extraktions_hinweise = [...existingHinweise, ...newHinweise];

    // 6. Storage-Verschiebung (inbox → Kategorie-Ordner)
    let newDokumentUrl = doc.dokument_url;

    if (doc.dokument_url && kategorie) {
      const oldPath = doc.dokument_url as string;
      const fileBaseName = oldPath.split("/").pop() || fileName;
      const sanitizedFileName = sanitizeFileName(fileBaseName);
      const newPath = `${kategorie}/${sanitizedFileName}`;

      // Nur verschieben wenn sich der Pfad aendert
      if (oldPath !== newPath) {
        console.log(`[STORAGE] Moving: ${oldPath} → ${newPath}`);
        const moveResult = await moveStorageFile(oldPath, newPath);

        if (moveResult.success) {
          newDokumentUrl = newPath;
          dbRecord.dokument_url = newPath;
          console.log(`[STORAGE] Move successful`);
        } else {
          console.warn(`[STORAGE] Move failed (non-critical): ${moveResult.error}`);
          // Nicht-kritisch: Kategorisierung ist wichtiger als Storage-Ordnung
          // dokument_url bleibt beim alten Pfad
          const hinweise = dbRecord.extraktions_hinweise as string[];
          hinweise.push(`Storage-Verschiebung fehlgeschlagen: ${moveResult.error}`);
        }
      }
    }

    // 7. DB Update (alle extrahierten Felder)
    const { error: updateError } = await supabase
      .from("documents")
      .update(dbRecord)
      .eq("id", documentId);

    if (updateError) {
      console.error(`[CATEGORIZE] DB update failed for ${documentId}: ${updateError.message}`);
      // Status zuruecksetzen damit ein Retry moeglich ist
      await supabase
        .from("documents")
        .update({
          processing_status: "error_gpt",
          processing_last_error: `DB update failed: ${updateError.message}`,
        })
        .eq("id", documentId);

      return new Response(
        JSON.stringify({
          error: "Database update failed",
          detail: updateError.message,
          document_id: documentId,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[CATEGORIZE] DB updated: kategorie=${kategorie}, status=done`);

    // 8. Budget-Extraktion (wenn Kategorie = "Aufmassblatt")
    let budgetExtraction: BudgetExtractionResult | null = null;
    let budgetCaseId: string | null = null;

    if (kategorie === "Aufmassblatt" && shouldExtractBudget(ocrText)) {
      console.log(`[BUDGET] Aufmassblatt erkannt - starte GPT Budget-Extraktion`);

      try {
        const budgetStartTime = Date.now();

        // GPT-Call fuer Budget-Extraktion (json_object, nicht json_schema)
        const budgetResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-5.2",
            messages: [
              { role: "system", content: BUDGET_EXTRACTION_PROMPT },
              { role: "user", content: ocrText },
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
          }),
        });

        if (!budgetResponse.ok) {
          const errorText = await budgetResponse.text();
          throw new Error(`OpenAI budget extraction failed: ${budgetResponse.status} - ${errorText}`);
        }

        const budgetResult = await budgetResponse.json();
        const budgetContent = JSON.parse(budgetResult.choices[0].message.content);

        const budgetDuration = (Date.now() - budgetStartTime) / 1000;
        console.log(`[BUDGET] GPT-Call dauerte ${budgetDuration.toFixed(2)}s`);

        // Validieren und normalisieren
        budgetExtraction = validateExtractionResult(budgetContent);

        if (budgetExtraction && budgetExtraction.elemente.length > 0) {
          console.log(`[BUDGET] ${budgetExtraction.elemente.length} Elemente extrahiert, Confidence: ${budgetExtraction.gesamt_confidence}`);

          // In budget_* Tabellen speichern
          try {
            // 1. budget_cases erstellen
            const { data: caseData, error: caseError } = await supabase
              .from("budget_cases")
              .insert({
                lead_name: budgetExtraction.kunde.name || null,
                lead_telefon: budgetExtraction.kunde.telefon || null,
                lead_email: budgetExtraction.kunde.email || null,
                kanal: "scan",
                status: "draft",
                notes: budgetExtraction.kunde.adresse || null,
              })
              .select("id")
              .single();

            if (caseError) {
              console.error(`[BUDGET] Fehler beim Erstellen des Cases:`, caseError);
            } else {
              budgetCaseId = caseData.id;
              console.log(`[BUDGET] Case erstellt: ${budgetCaseId}`);

              // 2. budget_profile erstellen
              const { error: profileError } = await supabase
                .from("budget_profile")
                .insert({
                  budget_case_id: budgetCaseId,
                  manufacturer: budgetExtraction.kontext.hersteller || "WERU",
                  system: budgetExtraction.kontext.system || null,
                  glazing: budgetExtraction.kontext.verglasung || null,
                  color_inside: budgetExtraction.kontext.farbe_innen || "weiss",
                  color_outside: budgetExtraction.kontext.farbe_aussen || "weiss",
                  material_class: budgetExtraction.kontext.material || "Kunststoff",
                  inferred: !budgetExtraction.kontext.hersteller,
                  manual_override: false,
                });

              if (profileError) {
                console.error(`[BUDGET] Fehler beim Erstellen des Profils:`, profileError);
              }

              // 3. budget_items erstellen
              for (const elem of budgetExtraction.elemente) {
                const { data: itemData, error: itemError } = await supabase
                  .from("budget_items")
                  .insert({
                    budget_case_id: budgetCaseId,
                    room: elem.raum || null,
                    element_type: elem.typ,
                    width_mm: elem.breite_mm,
                    height_mm: elem.hoehe_mm,
                    qty: elem.menge,
                    position_in_source: elem.position,
                    notes: elem.bemerkungen || null,
                    confidence: elem.confidence,
                  })
                  .select("id")
                  .single();

                if (itemError) {
                  console.error(`[BUDGET] Fehler beim Erstellen von Item ${elem.position}:`, itemError);
                  continue;
                }

                // 4. budget_accessories erstellen (falls Zubehoer vorhanden)
                const hasAccessories = Object.values(elem.zubehoer).some(v => v === true);
                if (hasAccessories && itemData) {
                  const { error: accError } = await supabase
                    .from("budget_accessories")
                    .insert({
                      budget_item_id: itemData.id,
                      shutter: elem.zubehoer.rollladen || elem.zubehoer.raffstore,
                      shutter_type: elem.zubehoer.raffstore ? "raffstore" : (elem.zubehoer.rollladen ? "rollladen" : null),
                      shutter_electric: elem.zubehoer.rollladen_elektrisch || elem.zubehoer.raffstore_elektrisch,
                      motor_qty: (elem.zubehoer.rollladen_elektrisch || elem.zubehoer.raffstore_elektrisch) ? 1 : null,
                      afb: elem.zubehoer.afb,
                      ifb: elem.zubehoer.ifb,
                      insect: elem.zubehoer.insektenschutz,
                      plissee: elem.zubehoer.plissee,
                    });

                  if (accError) {
                    console.error(`[BUDGET] Fehler beim Erstellen von Accessories fuer Item ${elem.position}:`, accError);
                  }
                }
              }

              // 5. budget_inputs erstellen (Referenz zum Dokument)
              const { error: inputError } = await supabase
                .from("budget_inputs")
                .insert({
                  budget_case_id: budgetCaseId,
                  source_type: "scan",
                  document_id: documentId,
                  raw_ocr: ocrText,
                  parsing_confidence: budgetExtraction.gesamt_confidence,
                  parsed_at: new Date().toISOString(),
                });

              if (inputError) {
                console.error(`[BUDGET] Fehler beim Erstellen von Input:`, inputError);
              }

              console.log(`[BUDGET] Alle Daten gespeichert fuer Case ${budgetCaseId}`);
            }
          } catch (dbError) {
            console.error(`[BUDGET] Datenbank-Fehler:`, dbError);
          }
        } else {
          console.log(`[BUDGET] Keine Elemente extrahiert oder Validierung fehlgeschlagen`);
        }
      } catch (budgetError) {
        console.error(`[BUDGET] Extraktion fehlgeschlagen:`, budgetError);
        // Budget-Fehler sind nicht kritisch - Kategorisierung war erfolgreich
      }
    }

    // 9. Response
    return new Response(
      JSON.stringify({
        success: true,
        id: documentId,
        kategorie: kategorie,
        kategorisiert_von: "process-document-gpt",
        dokument_url: newDokumentUrl,
        processing_status: "done",
        gpt_duration_seconds: gptDuration,
        // Budget-Info (nur bei Aufmassblaettern)
        ...(budgetExtraction && {
          budget_case_id: budgetCaseId,
          budget_elemente_count: budgetExtraction.elemente.length,
          budget_confidence: budgetExtraction.gesamt_confidence,
        }),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[CATEGORIZE] Unexpected error for ${documentId || "unknown"}:`, errorMessage);

    // Wenn wir eine document_id haben, Status auf error setzen
    if (documentId) {
      try {
        await supabase
          .from("documents")
          .update({
            processing_status: "error_gpt",
            processing_last_error: errorMessage,
          })
          .eq("id", documentId);
      } catch (updateErr) {
        console.error(`[CATEGORIZE] Failed to update error status:`, updateErr);
      }
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        document_id: documentId,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
