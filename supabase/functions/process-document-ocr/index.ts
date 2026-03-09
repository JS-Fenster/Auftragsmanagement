// =============================================================================
// Process Document OCR - Stage 1: OCR-Extraktion + Duplikat-Erkennung
// Version: 1.0.0 - 2026-03-09 (G-052 Stage 1)
// =============================================================================
// Erste Stufe der 2-Stufen-Pipeline:
// 1. Upload-Filter (Extension + Mindestgroesse)
// 2. File Hash + Duplikat-Check
// 3. Text-Extraktion (OCR via Mistral / Office nativ)
// 4. Text Hash + Content-Duplikat-Check
// 5. Storage Upload nach inbox/
// 6. DB Update mit processing_status = 'pending_categorize'
//
// Stage 2 (process-document-categorize) uebernimmt dann:
// - GPT-Kategorisierung
// - Storage-Verschiebung in Kategorie-Ordner
// - DB-Finalisierung
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  calculateHash,
  calculateTextHash,
  extractTextWithMistral,
  extractTextFromDocx,
  extractTextFromExcel,
  isImage,
} from "../process-document/extraction.ts";
import {
  getMimeType,
  isOcrSupported,
  isOfficeDocument,
  detectFileType,
  getMediaCategory,
  sanitizeFileName,
  createApiKeyValidator,
  validateUpload,
  OCR_SUPPORTED_EXTENSIONS,
  OFFICE_EXTENSIONS,
} from "../process-document/utils.ts";

// =============================================================================
// Environment + Clients
// =============================================================================

const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")!;
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");
const SCANNER_API_KEY = Deno.env.get("SCANNER_API_KEY");

const validateApiKey = createApiKeyValidator(INTERNAL_API_KEY, SCANNER_API_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// =============================================================================
// Helper: JSON Response
// =============================================================================

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// =============================================================================
// Helper: Set error status on document
// =============================================================================

async function setErrorStatus(documentId: string, error: string): Promise<void> {
  try {
    await supabase
      .from("documents")
      .update({
        processing_status: "error_ocr",
        processing_last_error: error.substring(0, 500),
      })
      .eq("id", documentId);
    console.log(`[ERROR] Set error_ocr on document ${documentId}: ${error.substring(0, 200)}`);
  } catch (e) {
    console.error(`[ERROR] Failed to set error status on ${documentId}:`, e);
  }
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  // ==========================================================================
  // Health Check (GET)
  // ==========================================================================
  if (req.method === "GET") {
    return jsonResponse({
      service: "process-document-ocr",
      version: "1.0.0",
      status: "ready",
      configured: {
        mistral: !!MISTRAL_API_KEY,
        supabase: !!(Deno.env.get("SUPABASE_URL") && Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
        internalApiKey: !!INTERNAL_API_KEY,
        scannerApiKey: !!SCANNER_API_KEY,
      },
      supportedFormats: {
        ocr: OCR_SUPPORTED_EXTENSIONS,
        office: OFFICE_EXTENSIONS,
      },
      pipeline: "stage-1-ocr",
      nextStage: "process-document-categorize",
    });
  }

  try {
    // ========================================================================
    // Method Check
    // ========================================================================
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    // ========================================================================
    // API Key Validation
    // ========================================================================
    const authResult = validateApiKey(req);
    if (!authResult.valid) {
      return jsonResponse({ error: authResult.reason }, 401);
    }

    // ========================================================================
    // Parse FormData
    // ========================================================================
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const existingDocumentId = formData.get("document_id") as string | null;
    const existingStoragePath = formData.get("storage_path") as string | null;
    const isUpdateMode = !!existingDocumentId;

    if (isUpdateMode) {
      console.log(`[UPDATE-MODE] document_id: ${existingDocumentId}, storage_path: ${existingStoragePath}`);
    }

    if (!file) {
      return jsonResponse({ error: "No file provided" }, 400);
    }

    // ========================================================================
    // G-045: Upload-Filter (Extension + Mindestgroesse)
    // ========================================================================
    if (!isUpdateMode) {
      const uploadValidation = validateUpload(file.name, file.size);

      if (!uploadValidation.valid) {
        console.log(`[UPLOAD-FILTER] Abgelehnt: ${file.name} - ${uploadValidation.reason}`);
        return jsonResponse({
          error: uploadValidation.reason,
          rejected: true,
          fileName: file.name,
          fileSize: file.size,
        }, 400);
      }

      // G-045: Mini-Bilder automatisch als "Bild" kategorisieren (kein OCR noetig)
      if (uploadValidation.skipProcessing && uploadValidation.autoKategorie) {
        console.log(`[UPLOAD-FILTER] Auto-Kategorie: ${file.name} -> ${uploadValidation.autoKategorie} (${uploadValidation.reason})`);

        const autoFileBuffer = await file.arrayBuffer();
        const autoFileHash = await calculateHash(autoFileBuffer);
        const autoMimeType = getMimeType(file.name);

        // Upload to inbox/ (Stage 2 will NOT move mini-images, they stay done)
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const safeFileName = sanitizeFileName(file.name);
        const storagePath = `${uploadValidation.autoKategorie}/${timestamp}_${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(storagePath, autoFileBuffer, {
            contentType: autoMimeType,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        const now = new Date().toISOString();
        const { data: insertData, error: insertError } = await supabase
          .from("documents")
          .insert({
            kategorie: uploadValidation.autoKategorie,
            dokument_url: storagePath,
            ocr_text: null,
            extraktions_zeitstempel: now,
            extraktions_qualitaet: "keine",
            extraktions_hinweise: [
              uploadValidation.reason || "Auto-kategorisiert",
              `Original: ${file.name}`,
              `Groesse: ${(file.size / 1024).toFixed(1)} KB`,
            ],
            file_hash: autoFileHash,
            text_hash: null,
            bemerkungen: `Mini-Bild: ${file.name}`,
            source: "scanner",
            processing_status: "done",
            processed_at: now,
            kategorisiert_von: "upload-filter",
          })
          .select("id")
          .single();

        if (insertError) {
          throw new Error(`Database insert failed: ${insertError.message}`);
        }

        return jsonResponse({
          success: true,
          id: insertData.id,
          processing_status: "done",
          kategorie: uploadValidation.autoKategorie,
          file_hash: autoFileHash,
          message: uploadValidation.reason,
        });
      }
    }

    // ========================================================================
    // Step 1: Read file + calculate file hash
    // ========================================================================
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
    const mimeType = getMimeType(file.name);
    const ocrSupportedByExt = isOcrSupported(file.name);
    const isOffice = isOfficeDocument(file.name);

    console.log(`[OCR] Processing: ${file.name}, size: ${file.size}B, mime: ${mimeType}, ocr: ${ocrSupportedByExt}, office: ${isOffice}${isUpdateMode ? " [UPDATE-MODE]" : ""}`);

    const fileBuffer = await file.arrayBuffer();
    const fileHash = await calculateHash(fileBuffer);
    console.log(`[OCR] File hash: ${fileHash}`);

    // Detect actual file type from magic bytes
    const detectedType = detectFileType(fileBuffer);
    console.log(`[OCR] Detected type: ${detectedType.type}, isOfficeDoc: ${detectedType.isOfficeDoc}`);

    // ========================================================================
    // Step 2: File Hash Duplikat-Check
    // ========================================================================
    if (!isUpdateMode) {
      // G-033: Standard Duplikat-Check fuer neue Uploads
      const { data: existingByFileHash } = await supabase
        .from("documents")
        .select("id, dokument_url, kategorie")
        .eq("file_hash", fileHash)
        .is("duplicate_of", null)
        .limit(1)
        .single();

      if (existingByFileHash) {
        console.log(`[OCR] DUPLIKAT (file_hash): ${existingByFileHash.id}`);
        return jsonResponse({
          success: false,
          duplicate: true,
          duplicate_type: "exact",
          duplicate_of: existingByFileHash.id,
          duplicate_of_url: existingByFileHash.dokument_url,
          duplicate_of_kategorie: existingByFileHash.kategorie,
          message: "Exaktes Duplikat - Datei bereits verarbeitet",
          file_hash: fileHash,
        });
      }
    } else {
      // G-033: UPDATE-Mode - trotzdem Duplikat-Check gegen ANDERE Dokumente
      const { data: existingByFileHash } = await supabase
        .from("documents")
        .select("id, dokument_url, kategorie")
        .eq("file_hash", fileHash)
        .is("duplicate_of", null)
        .neq("id", existingDocumentId)
        .limit(1)
        .single();

      if (existingByFileHash) {
        console.log(`[OCR] UPDATE-MODE DUPLIKAT (file_hash): ${existingByFileHash.id} (document_id: ${existingDocumentId})`);

        // Markiere das Update-Dokument als Duplikat
        await supabase
          .from("documents")
          .update({
            duplicate_of: existingByFileHash.id,
            file_hash: fileHash,
            processing_status: "done",
            processed_at: new Date().toISOString(),
          })
          .eq("id", existingDocumentId);

        return jsonResponse({
          success: false,
          duplicate: true,
          duplicate_type: "exact",
          duplicate_of: existingByFileHash.id,
          duplicate_of_url: existingByFileHash.dokument_url,
          duplicate_of_kategorie: existingByFileHash.kategorie,
          message: "Email-Anhang ist Duplikat eines bestehenden Dokuments",
          file_hash: fileHash,
          document_id: existingDocumentId,
        });
      }
    }

    // ========================================================================
    // Step 3: Text-Extraktion
    // ========================================================================
    let extractedText: string | null = null;
    let extractionMethod = "none";
    let extractionError: string | null = null;

    // BRANCH 1: Office documents (native extraction)
    if (isOffice || (detectedType.isOfficeDoc && !ocrSupportedByExt)) {
      console.log(`[OCR] Office extraction for ${file.name}`);
      extractionMethod = "office";

      try {
        if (fileExt === "docx" || (detectedType.isOfficeDoc && detectedType.type === "zip" && !fileExt.includes("xls"))) {
          extractedText = await extractTextFromDocx(fileBuffer);
          console.log(`[OCR] DOCX: ${extractedText.length} chars`);
        } else if (fileExt === "xlsx" || fileExt === "xls" || detectedType.type === "ole") {
          extractedText = extractTextFromExcel(fileBuffer);
          console.log(`[OCR] Excel: ${extractedText.length} chars`);
        } else if (detectedType.isOfficeDoc) {
          // Unknown Office - try docx first, then xlsx
          try {
            extractedText = await extractTextFromDocx(fileBuffer);
            console.log(`[OCR] DOCX (guessed): ${extractedText.length} chars`);
          } catch {
            extractedText = extractTextFromExcel(fileBuffer);
            console.log(`[OCR] Excel (fallback): ${extractedText.length} chars`);
          }
        }
      } catch (officeError) {
        extractionError = officeError instanceof Error ? officeError.message : String(officeError);
        console.error(`[OCR] Office extraction failed: ${extractionError}`);
        extractedText = null;
      }
    }
    // BRANCH 2: OCR-supported files (PDF, images)
    else if (ocrSupportedByExt && !detectedType.isOfficeDoc) {
      console.log(`[OCR] Mistral OCR for ${file.name}`);
      extractionMethod = "ocr";

      try {
        extractedText = await extractTextWithMistral(fileBuffer, file.name, mimeType, MISTRAL_API_KEY);
        console.log(`[OCR] Mistral: ${extractedText.length} chars`);
      } catch (ocrError) {
        extractionError = ocrError instanceof Error ? ocrError.message : String(ocrError);
        console.error(`[OCR] Mistral OCR failed: ${extractionError}`);
        extractedText = null;
      }
    }
    // BRANCH 3: Mismatch - extension says OCR but content is Office
    else if (ocrSupportedByExt && detectedType.isOfficeDoc) {
      console.log(`[OCR] WARNING: Extension suggests OCR but content is Office - trying Office extraction`);
      extractionMethod = "office-fallback";

      try {
        try {
          extractedText = await extractTextFromDocx(fileBuffer);
          console.log(`[OCR] DOCX (mismatch recovery): ${extractedText.length} chars`);
        } catch {
          extractedText = extractTextFromExcel(fileBuffer);
          console.log(`[OCR] Excel (mismatch recovery): ${extractedText.length} chars`);
        }
      } catch (officeError) {
        extractionError = officeError instanceof Error ? officeError.message : String(officeError);
        console.error(`[OCR] Office mismatch extraction failed: ${extractionError}`);
        extractedText = null;
      }
    }

    // ========================================================================
    // Step 4: Kein Text? -> Media-Datei direkt fertig
    // ========================================================================
    if (!extractedText || extractedText.trim().length === 0) {
      console.log(`[OCR] No text extracted - handling as media file`);

      let kategorie: string;
      if (detectedType.isOfficeDoc || isOffice) {
        kategorie = "Office_Dokument";
      } else {
        kategorie = getMediaCategory(file.name);
      }

      const hinweise = [
        "Keine Textextraktion moeglich",
        `Original: ${file.name}`,
        `Groesse: ${(file.size / 1024).toFixed(1)} KB`,
        `Methode versucht: ${extractionMethod}`,
      ];
      if (extractionError) {
        hinweise.push(`Fehler: ${extractionError.substring(0, 200)}`);
      }

      let mediaResultId: string;

      if (isUpdateMode && existingDocumentId) {
        // UPDATE-MODE: Update existing document
        const { error: updateError } = await supabase
          .from("documents")
          .update({
            kategorie,
            ocr_text: null,
            extraktions_zeitstempel: new Date().toISOString(),
            extraktions_qualitaet: "keine",
            extraktions_hinweise: hinweise,
            file_hash: fileHash,
            text_hash: null,
            bemerkungen: `Mediendatei: ${file.name}`,
            processing_status: "done",
            processed_at: new Date().toISOString(),
            kategorisiert_von: "media-type",
          })
          .eq("id", existingDocumentId);

        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        mediaResultId = existingDocumentId;
      } else {
        // INSERT-MODE: Upload to storage + insert
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const safeFileName = sanitizeFileName(file.name);
        const storagePath = `${kategorie}/${timestamp}_${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(storagePath, fileBuffer, {
            contentType: mimeType,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        const now = new Date().toISOString();
        const { data: insertData, error: insertError } = await supabase
          .from("documents")
          .insert({
            kategorie,
            dokument_url: storagePath,
            ocr_text: null,
            extraktions_zeitstempel: now,
            extraktions_qualitaet: "keine",
            extraktions_hinweise: hinweise,
            file_hash: fileHash,
            text_hash: null,
            bemerkungen: `Mediendatei: ${file.name}`,
            source: "scanner",
            processing_status: "done",
            processed_at: now,
            kategorisiert_von: "media-type",
          })
          .select("id")
          .single();

        if (insertError) {
          throw new Error(`Database insert failed: ${insertError.message}`);
        }

        mediaResultId = insertData.id;
      }

      console.log(`[OCR] Media file stored: ${mediaResultId}, kategorie: ${kategorie}`);

      return jsonResponse({
        success: true,
        id: mediaResultId,
        processing_status: "done",
        kategorie,
        file_hash: fileHash,
        ocr_text_length: 0,
        message: "Mediendatei gespeichert (keine Textextraktion moeglich)",
        extraction_error: extractionError,
        update_mode: isUpdateMode,
      });
    }

    // ========================================================================
    // Step 5: Text Hash + Content-Duplikat-Check
    // ========================================================================
    console.log(`[OCR] Text extracted: ${extractedText.length} chars via ${extractionMethod}`);
    const textHash = await calculateTextHash(extractedText);
    console.log(`[OCR] Text hash: ${textHash}`);

    if (!isUpdateMode) {
      const { data: existingByTextHash } = await supabase
        .from("documents")
        .select("id, dokument_url, kategorie")
        .eq("text_hash", textHash)
        .is("duplicate_of", null)
        .limit(1)
        .single();

      if (existingByTextHash) {
        console.log(`[OCR] INHALTSDUPLIKAT (text_hash): ${existingByTextHash.id}`);
        return jsonResponse({
          success: false,
          duplicate: true,
          duplicate_type: "content",
          duplicate_of: existingByTextHash.id,
          duplicate_of_url: existingByTextHash.dokument_url,
          duplicate_of_kategorie: existingByTextHash.kategorie,
          message: "Inhaltsduplikat - Dokument mit gleichem Text bereits vorhanden",
          file_hash: fileHash,
          text_hash: textHash,
        });
      }
    } else {
      // G-033: UPDATE-Mode - Content-Duplikat-Check gegen ANDERE Dokumente
      const { data: existingByTextHash } = await supabase
        .from("documents")
        .select("id, dokument_url, kategorie")
        .eq("text_hash", textHash)
        .is("duplicate_of", null)
        .neq("id", existingDocumentId)
        .limit(1)
        .single();

      if (existingByTextHash) {
        console.log(`[OCR] UPDATE-MODE INHALTSDUPLIKAT: ${existingByTextHash.id} (document_id: ${existingDocumentId})`);

        await supabase
          .from("documents")
          .update({
            duplicate_of: existingByTextHash.id,
            file_hash: fileHash,
            text_hash: textHash,
            processing_status: "done",
            processed_at: new Date().toISOString(),
          })
          .eq("id", existingDocumentId);

        return jsonResponse({
          success: false,
          duplicate: true,
          duplicate_type: "content",
          duplicate_of: existingByTextHash.id,
          duplicate_of_url: existingByTextHash.dokument_url,
          duplicate_of_kategorie: existingByTextHash.kategorie,
          message: "Email-Anhang ist Inhaltsduplikat eines bestehenden Dokuments",
          file_hash: fileHash,
          text_hash: textHash,
          document_id: existingDocumentId,
        });
      }
    }

    // ========================================================================
    // Step 6: Storage Upload nach inbox/
    // ========================================================================
    let dokumentUrl: string;

    if (isUpdateMode && existingStoragePath) {
      // UPDATE-MODE: Datei liegt bereits im Storage
      dokumentUrl = existingStoragePath;
      console.log(`[OCR] UPDATE-MODE: Using existing storage path: ${dokumentUrl}`);
    } else {
      // NORMAL-MODE: Upload nach inbox/
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeFileName = sanitizeFileName(file.name);
      const storagePath = `inbox/${timestamp}_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      dokumentUrl = storagePath;
      console.log(`[OCR] Uploaded to: ${dokumentUrl}`);
    }

    // ========================================================================
    // Step 7: DB Update/Insert mit pending_categorize
    // ========================================================================
    const now = new Date().toISOString();
    const hinweise = [
      `Extraktionsmethode: ${extractionMethod}`,
      `Original: ${file.name}`,
      `Groesse: ${(file.size / 1024).toFixed(1)} KB`,
      `OCR-Text: ${extractedText.length} Zeichen`,
    ];

    let resultId: string;

    if (isUpdateMode && existingDocumentId) {
      // UPDATE existing document
      const { error: updateError } = await supabase
        .from("documents")
        .update({
          ocr_text: extractedText,
          extraktions_zeitstempel: now,
          extraktions_qualitaet: extractedText.length > 100 ? "hoch" : "niedrig",
          extraktions_hinweise: hinweise,
          file_hash: fileHash,
          text_hash: textHash,
          processing_status: "pending_categorize",
          dokument_url: dokumentUrl,
        })
        .eq("id", existingDocumentId);

      if (updateError) {
        await setErrorStatus(existingDocumentId, `DB update failed: ${updateError.message}`);
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      resultId = existingDocumentId;
      console.log(`[OCR] Updated document ${resultId} -> pending_categorize`);
    } else {
      // INSERT new document
      const { data: insertData, error: insertError } = await supabase
        .from("documents")
        .insert({
          dokument_url: dokumentUrl,
          ocr_text: extractedText,
          extraktions_zeitstempel: now,
          extraktions_qualitaet: extractedText.length > 100 ? "hoch" : "niedrig",
          extraktions_hinweise: hinweise,
          file_hash: fileHash,
          text_hash: textHash,
          source: "scanner",
          processing_status: "pending_categorize",
        })
        .select("id")
        .single();

      if (insertError) {
        throw new Error(`Database insert failed: ${insertError.message}`);
      }

      resultId = insertData.id;
      console.log(`[OCR] Inserted document ${resultId} -> pending_categorize`);
    }

    // ========================================================================
    // Success Response
    // ========================================================================
    return jsonResponse({
      success: true,
      id: resultId,
      ocr_text_length: extractedText.length,
      file_hash: fileHash,
      text_hash: textHash,
      processing_status: "pending_categorize",
      extraction_method: extractionMethod,
      dokument_url: dokumentUrl,
      update_mode: isUpdateMode,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[OCR] CRITICAL ERROR: ${errorMessage}`);

    return jsonResponse({
      error: errorMessage,
      service: "process-document-ocr",
    }, 500);
  }
});
