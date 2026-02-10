// =============================================================================
// Process Document - OCR + GPT Kategorisierung
// Version: 33 - 2026-02-10 (Typo-Fix Brief_eingend/Brief_eingang)
// =============================================================================
// Aenderungen v33:
// - FIX: Typo-Aliases fuer GPT-5 mini (Brief_eingend, Brief_eingang -> Brief_eingehend)
//
// Aenderungen v32:
// - Modell: gpt-5.2 → gpt-5-mini (15x guenstiger, gleiche Qualitaet)
// - Response-Format: json_schema → json_object (GPT-5 mini Kompatibilitaet)
// - Heuristik-Override komplett deaktiviert (GPT-5 mini ist praeziser)
// - Dateiname wird als zusaetzlicher Kontext an GPT uebergeben
// - kategorisiert_von immer "process-document-gpt" (keine Rules mehr)
//
// Aenderungen v31:
// - NEU: GPT-basierte Budget-Extraktion statt Regex-Parser
// - NEU: budget-prompts.ts mit spezialisiertem Prompt
// - NEU: Speicherung in budget_cases, budget_items, budget_profile, budget_accessories
// - ENTFERNT: budget-extraction.ts (Regex-Parser nicht mehr benoetigt)
// - NEU: Flag budget_extracted in documents Tabelle gegen Doppelt-Extraktion
//
// Aenderungen v30:
// - Budget-Item-Extraktion fuer Aufmassblaetter (Regex-basiert, jetzt ersetzt durch GPT)
//
// Aenderungen v29:
// - REFACTORING: Schema und Interfaces nach schema.ts extrahiert
// - REFACTORING: Extraction-Funktionen nach extraction.ts extrahiert
// - REFACTORING: Utility-Funktionen nach utils.ts extrahiert
// - Imports aktualisiert fuer neue Module
//
// Aenderungen v28:
// - NEU: Separater SCANNER_API_KEY fuer Scanner-Webhook
// - validateApiKey akzeptiert jetzt INTERNAL_API_KEY ODER SCANNER_API_KEY
// - Verhindert Konflikte mit anderen Tools die INTERNAL_API_KEY nutzen
//
// Aenderungen v27:
// - FIX: imagescript Import entfernt (Deno-Kompatibilitaetsproblem)
// - Bildkomprimierung temporaer deaktiviert
//
// Aenderungen v26:
// - FIX: processing_status wird jetzt auf "done" gesetzt bei Scanner-Dokumenten
// - FIX: processed_at, kategorisiert_am, kategorisiert_von werden gesetzt
// - buildDatabaseRecord erhält jetzt kategorisiertVon als Parameter
//
// Aenderungen v25:
// - NEU: UPDATE-Mode fuer Email-Anhaenge (document_id + storage_path Parameter)
// - NEU: Wenn document_id uebergeben wird, UPDATE statt INSERT
// - NEU: Wenn storage_path uebergeben wird, kein erneuter Upload
// - NEU: Aktualisiert processing_status auf "done" nach Kategorisierung
// - FIX: Email-Anhaenge erhalten jetzt korrekte Kategorie statt "Email_Anhang"
//
// Aenderungen v24:
// - NEU: Kategorie Kassenbeleg (Tankquittungen, Baumarkt-Bons, Barbelege)
// - NEU: Automatische Bildkomprimierung vor Upload
// - NEU: Bilder > 500KB werden auf max 1920px + JPEG Q80 komprimiert
// - NEU: Logging der Komprimierungsersparnis
// - NEU: compressImage() Funktion mit imagescript Library
//
// Aenderungen v23:
// - NEU: Kategorien Reiseunterlagen, Kundenbestellung, Zahlungsavis
// - NEU: Heuristik fuer Kundenbestellung (PO vom Kunden, Prio 95)
// - NEU: Heuristik fuer Reiseunterlagen (Hotel/Flug/Bahn, Prio 70)
// - NEU: Heuristik fuer Zahlungsavis (Belastungsanzeige/Lastschrift, Prio 78)
// - VERBESSERT: Bestellung-Heuristik auf ausgehende Dokumente eingeschraenkt
//
// Aenderungen v22:
// - NEU: Heuristik-Regeln VOR GPT (Keyword-basierte Klassifizierung)
// - NEU: Kategorien Produktdatenblatt, Finanzierung, Leasing
// - NEU: kategorisiert_von Feld (rule/gpt)
// - NEU: Prioritaets-System fuer Bestellung vs Auftragsbestaetigung
//
// Aenderungen v21:
// - NEU: Taxonomie-Update - Kategorien alphabetisch, Aliase, neue Kategorien
// - NEU: Kategorien Gutschrift, Abnahmeprotokoll, Reklamation, Vertrag
// - NEU: Brief_eingehend / Brief_ausgehend (ersetzt Brief_von_*/Brief_an_*)
// - NEU: canonicalizeKategorie() fuer Alias-Mapping
// - ENTFERNT: Angebotsanfrage (-> Kundenanfrage), Archiv (-> Sonstiges_Dokument)
//
// Aenderungen v20:
// - NEU: Unterschriftserkennung (empfang_unterschrift, unterschrift)
// - NEU: Business-Logik unterschrift_erforderlich (Auftragsbestaetigung, Serviceauftrag, Montageauftrag)
// - NEU: Kategorien Lieferantenangebot, Bild
//
// Aenderungen v19:
// - NEU: source='scanner' bei DB-Insert (fuer Constraint + Analytics)
//
// Aenderungen v18:
// - API-Key Vereinheitlichung: NUR noch INTERNAL_API_KEY
// - PROCESS_DOCUMENT_API_KEY entfernt (nicht mehr benoetigt)
// - API-Key jetzt PFLICHT (kein backwards compatibility mehr)
//
// Aenderungen v17.1:
// - Fix: sanitizeFileName fuer Storage-Pfade (Umlaute -> ASCII)
//
// Aenderungen v17:
// - API-Key Schutz (PROCESS_DOCUMENT_API_KEY oder INTERNAL_API_KEY)
// - Health-Endpoint GET /health (keine externen APIs)
// - Safe Logging (keine Keys in Logs)
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SYSTEM_PROMPT } from "./prompts.ts";
// v32: applyHeuristicRules entfernt (Heuristik deaktiviert)
import { canonicalizeKategorie } from "./categories.ts";
import {
  calculateHash,
  calculateTextHash,
  extractTextWithMistral,
  extractTextFromDocx,
  extractTextFromExcel,
  isImage,
} from "./extraction.ts";
import {
  ExtractedDocument,
  UNTERSCHRIFT_ERFORDERLICH_KATEGORIEN,
} from "./schema.ts";
import {
  OCR_SUPPORTED_EXTENSIONS,
  OFFICE_EXTENSIONS,
  getMimeType,
  isOcrSupported,
  isOfficeDocument,
  detectFileType,
  getMediaCategory,
  sanitizeFileName,
  createApiKeyValidator,
} from "./utils.ts";
import {
  BUDGET_EXTRACTION_PROMPT,
  shouldExtractBudget,
  validateExtractionResult,
  type BudgetExtractionResult,
} from "./budget-prompts.ts";
// v24: Image compression - DISABLED due to Deno compatibility issues
// import { Image } from "npm:imagescript@1.3.0";
const Image: null = null; // Stub for disabled feature

const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// v18: API Key Protection - INTERNAL_API_KEY oder SCANNER_API_KEY
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");
const SCANNER_API_KEY = Deno.env.get("SCANNER_API_KEY");

// Create API key validator with environment keys
const validateApiKey = createApiKeyValidator(INTERNAL_API_KEY, SCANNER_API_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// =============================================================================
// v24: Image Compression Configuration
// =============================================================================

const COMPRESSION_CONFIG = {
  maxSizeBytes: 500 * 1024,      // Komprimiere wenn > 500KB
  maxWidthOrHeight: 1920,        // Max Full-HD Aufloesung
  jpegQuality: 80,               // JPEG Qualitaet (0-100)
  enabled: false,                // DISABLED - imagescript incompatible with Edge Functions
};

// Bildformate die komprimiert werden koennen
const COMPRESSIBLE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif"];

/**
 * v24: Komprimiert ein Bild wenn es groesser als der Schwellwert ist.
 * - Reduziert auf max 1920px (laengste Seite)
 * - Konvertiert zu JPEG mit Quality 80
 * - Behaelt Original wenn bereits klein genug
 */
async function compressImage(
  buffer: ArrayBuffer,
  fileName: string
): Promise<{
  buffer: ArrayBuffer;
  compressed: boolean;
  originalSize: number;
  newSize: number;
  newMimeType: string;
  newFileName: string;
}> {
  const originalSize = buffer.byteLength;
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // Nicht komprimierbar oder deaktiviert
  if (!COMPRESSION_CONFIG.enabled || !COMPRESSIBLE_EXTENSIONS.includes(ext)) {
    return {
      buffer,
      compressed: false,
      originalSize,
      newSize: originalSize,
      newMimeType: getMimeType(fileName),
      newFileName: fileName,
    };
  }

  // Bereits klein genug
  if (originalSize <= COMPRESSION_CONFIG.maxSizeBytes) {
    console.log(`[COMPRESS] ${fileName}: ${(originalSize / 1024).toFixed(0)}KB - bereits unter Schwellwert, uebersprungen`);
    return {
      buffer,
      compressed: false,
      originalSize,
      newSize: originalSize,
      newMimeType: getMimeType(fileName),
      newFileName: fileName,
    };
  }

  try {
    console.log(`[COMPRESS] ${fileName}: ${(originalSize / 1024).toFixed(0)}KB - starte Komprimierung...`);

    const bytes = new Uint8Array(buffer);
    const image = await Image.decode(bytes);

    const { width, height } = image;
    const maxDim = COMPRESSION_CONFIG.maxWidthOrHeight;

    // Resize wenn zu gross
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        image.resize(maxDim, Image.RESIZE_AUTO);
      } else {
        image.resize(Image.RESIZE_AUTO, maxDim);
      }
      console.log(`[COMPRESS] Resized: ${width}x${height} -> ${image.width}x${image.height}`);
    }

    // Encode als JPEG
    const compressed = await image.encodeJPEG(COMPRESSION_CONFIG.jpegQuality);
    const newSize = compressed.byteLength;
    const savings = ((originalSize - newSize) / originalSize * 100).toFixed(1);

    console.log(`[COMPRESS] ${fileName}: ${(originalSize / 1024).toFixed(0)}KB -> ${(newSize / 1024).toFixed(0)}KB (${savings}% gespart)`);

    // Neuer Dateiname mit .jpg Extension
    const baseName = fileName.replace(/\.[^/.]+$/, "");
    const newFileName = `${baseName}.jpg`;

    return {
      buffer: compressed.buffer as ArrayBuffer,
      compressed: true,
      originalSize,
      newSize,
      newMimeType: "image/jpeg",
      newFileName,
    };
  } catch (compressError) {
    console.error(`[COMPRESS] Fehler bei ${fileName}:`, compressError);
    // Bei Fehler: Original behalten
    return {
      buffer,
      compressed: false,
      originalSize,
      newSize: originalSize,
      newMimeType: getMimeType(fileName),
      newFileName: fileName,
    };
  }
}

Deno.serve(async (req: Request) => {
  // ==========================================================================
  // v17: Health Check (GET)
  // ==========================================================================
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        service: "process-document",
        version: "33.0.0",
        status: "ready",
        configured: {
          mistral: !!MISTRAL_API_KEY,
          openai: !!OPENAI_API_KEY,
          supabase: !!(Deno.env.get("SUPABASE_URL") && Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
          internalApiKey: !!INTERNAL_API_KEY,
        },
        supportedFormats: {
          ocr: OCR_SUPPORTED_EXTENSIONS,
          office: OFFICE_EXTENSIONS,
        },
        compression: {
          enabled: COMPRESSION_CONFIG.enabled,
          maxSizeKB: COMPRESSION_CONFIG.maxSizeBytes / 1024,
          maxDimension: COMPRESSION_CONFIG.maxWidthOrHeight,
          jpegQuality: COMPRESSION_CONFIG.jpegQuality,
        },
        features: {
          updateMode: true,  // v25: Email attachment update mode
          budgetExtraction: true,  // v31: GPT-basierte Budget-Extraktion fuer Aufmassblaetter
          budgetExtractionModel: "gpt-5.2",  // v31: GPT-5.2 fuer Budget-Extraktion
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

    // ==========================================================================
    // v17: API Key Validation
    // ==========================================================================
    const authResult = validateApiKey(req);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: authResult.reason }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    // v25: UPDATE-Mode Parameter (von process-email)
    const existingDocumentId = formData.get("document_id") as string | null;
    const existingStoragePath = formData.get("storage_path") as string | null;
    const isUpdateMode = !!existingDocumentId;

    if (isUpdateMode) {
      console.log(`[UPDATE-MODE] document_id: ${existingDocumentId}, storage_path: ${existingStoragePath}`);
    }

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
    const mimeType = getMimeType(file.name);
    const ocrSupportedByExt = isOcrSupported(file.name);
    const isOffice = isOfficeDocument(file.name);
    console.log(`Processing file: ${file.name}, size: ${file.size} bytes, type: ${mimeType}, OCR: ${ocrSupportedByExt}, Office: ${isOffice}${isUpdateMode ? " [UPDATE-MODE]" : ""}`);

    // Step 1: Calculate file hash for exact duplicate detection
    const fileBuffer = await file.arrayBuffer();
    const fileHash = await calculateHash(fileBuffer);
    console.log(`File hash: ${fileHash}`);

    // Step 1b: Detect actual file type from content (magic bytes)
    const detectedType = detectFileType(fileBuffer);
    console.log(`Detected file type: ${detectedType.type}, isOfficeDoc: ${detectedType.isOfficeDoc}`);

    // Step 2: Check for exact duplicate - SOFORT ABBRECHEN wenn gefunden
    // v25: Skip in UPDATE-MODE (das Dokument existiert bereits)
    if (!isUpdateMode) {
      const { data: existingByFileHash } = await supabase
        .from("documents")
        .select("id, dokument_url, kategorie")
        .eq("file_hash", fileHash)
        .is("duplicate_of", null)
        .limit(1)
        .single();

      if (existingByFileHash) {
        console.log(`DUPLIKAT: ${existingByFileHash.id} - Abbruch (spart OCR+GPT Kosten)`);

        return new Response(JSON.stringify({
          success: false,
          duplicate: true,
          duplicate_type: "exact",
          duplicate_of: existingByFileHash.id,
          duplicate_of_url: existingByFileHash.dokument_url,
          duplicate_of_kategorie: existingByFileHash.kategorie,
          message: "Exaktes Duplikat - Datei bereits verarbeitet",
          file_hash: fileHash,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      console.log(`[UPDATE-MODE] Duplikat-Check uebersprungen`);
    }

    // Determine extraction method
    let extractedText: string | null = null;
    let extractionMethod: string = "none";
    let extractionError: string | null = null;

    // BRANCH 1: Office documents with native text extraction
    if (isOffice || (detectedType.isOfficeDoc && !ocrSupportedByExt)) {
      console.log(`Using native Office text extraction for ${file.name}`);
      extractionMethod = "office";

      try {
        if (fileExt === "docx" || (detectedType.isOfficeDoc && detectedType.type === "zip" && !fileExt.includes("xls"))) {
          // Try as Word document
          console.log(`Attempting DOCX extraction...`);
          extractedText = await extractTextFromDocx(fileBuffer);
          console.log(`Extracted ${extractedText.length} chars from DOCX`);
        } else if (fileExt === "xlsx" || fileExt === "xls" || detectedType.type === "ole") {
          // Try as Excel
          console.log(`Attempting Excel extraction...`);
          extractedText = extractTextFromExcel(fileBuffer);
          console.log(`Extracted ${extractedText.length} chars from Excel`);
        } else if (detectedType.isOfficeDoc) {
          // Unknown Office format - try docx first, then xlsx
          console.log(`Unknown Office format, trying DOCX first...`);
          try {
            extractedText = await extractTextFromDocx(fileBuffer);
            console.log(`Extracted ${extractedText.length} chars as DOCX (guessed)`);
          } catch (docxError) {
            console.log(`DOCX failed: ${docxError}, trying Excel...`);
            extractedText = extractTextFromExcel(fileBuffer);
            console.log(`Extracted ${extractedText.length} chars as Excel (fallback)`);
          }
        }
      } catch (officeError) {
        extractionError = officeError instanceof Error ? officeError.message : String(officeError);
        console.error(`Office extraction failed: ${extractionError}`);
        extractedText = null;
      }
    }
    // BRANCH 2: OCR-supported files (PDF, images)
    else if (ocrSupportedByExt && !detectedType.isOfficeDoc) {
      console.log(`Using Mistral OCR for ${file.name}`);
      extractionMethod = "ocr";

      try {
        extractedText = await extractTextWithMistral(fileBuffer, file.name, mimeType, MISTRAL_API_KEY);
        console.log(`OCR extracted ${extractedText.length} characters`);
      } catch (ocrError) {
        extractionError = ocrError instanceof Error ? ocrError.message : String(ocrError);
        console.error(`OCR failed: ${extractionError}`);
        extractedText = null;
      }
    }
    // BRANCH 3: Mismatch - extension says OCR but content is Office
    else if (ocrSupportedByExt && detectedType.isOfficeDoc) {
      console.log(`WARNING: Extension suggests OCR but content is Office - trying Office extraction`);
      extractionMethod = "office-fallback";

      try {
        // Try docx first
        try {
          extractedText = await extractTextFromDocx(fileBuffer);
          console.log(`Extracted ${extractedText.length} chars as DOCX (mismatch recovery)`);
        } catch {
          extractedText = extractTextFromExcel(fileBuffer);
          console.log(`Extracted ${extractedText.length} chars as Excel (mismatch recovery)`);
        }
      } catch (officeError) {
        extractionError = officeError instanceof Error ? officeError.message : String(officeError);
        console.error(`Office extraction failed for mismatched file: ${extractionError}`);
        extractedText = null;
      }
    }

    // If no text was extracted, store as media file
    if (!extractedText || extractedText.trim().length === 0) {
      console.log(`No text extracted - storing as media file`);

      let kategorie: string;
      if (detectedType.isOfficeDoc || isOffice) {
        kategorie = "Office_Dokument";
      } else {
        kategorie = getMediaCategory(file.name);
      }

      // v25: Skip upload in UPDATE-MODE for media files
      let mediaStoragePath: string;
      let mediaCompressionInfo: string | null = null;

      if (isUpdateMode && existingStoragePath) {
        // UPDATE-MODE: Use existing storage path
        mediaStoragePath = existingStoragePath;
        console.log(`[UPDATE-MODE] Using existing storage path for media: ${mediaStoragePath}`);
      } else {
        // NORMAL-MODE: Compress and upload
        let mediaUploadBuffer: ArrayBuffer = fileBuffer;
        let mediaUploadMimeType = mimeType;
        let mediaUploadFileName = file.name;

        if (isImage(file.name)) {
          const compressionResult = await compressImage(fileBuffer, file.name);
          mediaUploadBuffer = compressionResult.buffer;
          mediaUploadMimeType = compressionResult.newMimeType;
          mediaUploadFileName = compressionResult.newFileName;

          if (compressionResult.compressed) {
            const savedKB = ((compressionResult.originalSize - compressionResult.newSize) / 1024).toFixed(0);
            const savedPct = ((compressionResult.originalSize - compressionResult.newSize) / compressionResult.originalSize * 100).toFixed(1);
            mediaCompressionInfo = `Komprimiert: ${(compressionResult.originalSize / 1024).toFixed(0)}KB -> ${(compressionResult.newSize / 1024).toFixed(0)}KB (${savedPct}% / ${savedKB}KB gespart)`;
          }
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const safeFileName = sanitizeFileName(mediaUploadFileName);
        mediaStoragePath = `${kategorie}/${timestamp}_${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(mediaStoragePath, mediaUploadBuffer, {
            contentType: mediaUploadMimeType,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }
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
      if (mediaCompressionInfo) {
        hinweise.push(mediaCompressionInfo);
      }

      let mediaResultId: string;

      // v25: UPDATE-MODE vs INSERT-MODE for media files
      if (isUpdateMode && existingDocumentId) {
        console.log(`[UPDATE-MODE] Updating media document ${existingDocumentId} with category: ${kategorie}`);

        const { error: updateError } = await supabase
          .from("documents")
          .update({
            kategorie: kategorie,
            ocr_text: null,
            extraktions_zeitstempel: new Date().toISOString(),
            extraktions_qualitaet: "keine",
            extraktions_hinweise: hinweise,
            file_hash: fileHash,
            text_hash: null,
            bemerkungen: `Mediendatei: ${file.name}`,
            processing_status: "done",
            processed_at: new Date().toISOString(),
          })
          .eq("id", existingDocumentId);

        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        mediaResultId = existingDocumentId;
        console.log(`[UPDATE-MODE] Updated media document ${mediaResultId}`);
      } else {
        // v26: processing_status wird jetzt gesetzt
        const now = new Date().toISOString();
        const { data: insertData, error: insertError } = await supabase
          .from("documents")
          .insert({
            kategorie: kategorie,
            dokument_url: mediaStoragePath,
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
        console.log(`Inserted media file with ID: ${mediaResultId}`);
      }

      return new Response(JSON.stringify({
        success: true,
        id: mediaResultId,
        kategorie: kategorie,
        dokument_url: mediaStoragePath,
        extraktions_qualitaet: "keine",
        file_hash: fileHash,
        message: "Mediendatei gespeichert (keine Textextraktion moeglich)",
        extraction_error: extractionError,
        update_mode: isUpdateMode,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Text was extracted - continue with GPT categorization
    console.log(`Text extracted (${extractedText.length} chars) via ${extractionMethod}`);

    // Calculate text hash for content duplicate detection
    const textHash = await calculateTextHash(extractedText);
    console.log(`Text hash: ${textHash}`);

    // Check for content duplicate
    // v25: Skip in UPDATE-MODE
    if (!isUpdateMode) {
      const { data: existingByTextHash } = await supabase
        .from("documents")
        .select("id, dokument_url, kategorie")
        .eq("text_hash", textHash)
        .is("duplicate_of", null)
        .limit(1)
        .single();

      if (existingByTextHash) {
        console.log(`INHALTSDUPLIKAT: ${existingByTextHash.id} - Abbruch (spart GPT Kosten)`);

        return new Response(JSON.stringify({
          success: false,
          duplicate: true,
          duplicate_type: "content",
          duplicate_of: existingByTextHash.id,
          duplicate_of_url: existingByTextHash.dokument_url,
          duplicate_of_kategorie: existingByTextHash.kategorie,
          message: "Inhaltsduplikat - Dokument mit gleichem Text bereits vorhanden",
          file_hash: fileHash,
          text_hash: textHash,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // v32: Nur noch GPT-5 mini Klassifizierung (Heuristik deaktiviert)
    const kategorisiertVon = "gpt";

    // Categorize + Extract with GPT-5 mini
    const extractedData = await categorizeAndExtract(extractedText, file.name);

    console.log(`Categorized as: ${extractedData.kategorie} (by ${kategorisiertVon})`);

    // v25: Skip upload in UPDATE-MODE (file already in storage)
    let dokumentUrl: string;
    let compressionInfo: string | null = null;

    if (isUpdateMode && existingStoragePath) {
      // UPDATE-MODE: Use existing storage path, no upload needed
      dokumentUrl = existingStoragePath;
      console.log(`[UPDATE-MODE] Using existing storage path: ${dokumentUrl}`);
    } else {
      // NORMAL-MODE: Compress and upload
      let uploadBuffer: ArrayBuffer = fileBuffer;
      let uploadMimeType = mimeType;
      let uploadFileName = file.name;

      if (isImage(file.name)) {
        const compressionResult = await compressImage(fileBuffer, file.name);
        uploadBuffer = compressionResult.buffer;
        uploadMimeType = compressionResult.newMimeType;
        uploadFileName = compressionResult.newFileName;

        if (compressionResult.compressed) {
          const savedKB = ((compressionResult.originalSize - compressionResult.newSize) / 1024).toFixed(0);
          const savedPct = ((compressionResult.originalSize - compressionResult.newSize) / compressionResult.originalSize * 100).toFixed(1);
          compressionInfo = `Komprimiert: ${(compressionResult.originalSize / 1024).toFixed(0)}KB -> ${(compressionResult.newSize / 1024).toFixed(0)}KB (${savedPct}% / ${savedKB}KB gespart)`;
        }
      }

      // Upload file to Storage
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeFileName = sanitizeFileName(uploadFileName);
      const storagePath = `${extractedData.kategorie}/${timestamp}_${safeFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, uploadBuffer, {
          contentType: uploadMimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      dokumentUrl = uploadData.path;
      console.log(`Uploaded to: ${dokumentUrl}`);
    }

    // Add extraction method and categorization source to hints
    const hinweiseMitMethode = [
      ...(extractedData.extraktions_hinweise || []),
      `Extraktionsmethode: ${extractionMethod}`,
      `Kategorisiert von: ${kategorisiertVon}`,
      ...(compressionInfo ? [compressionInfo] : []),
    ];

    // Build database record
    // v26: kategorisiertVon wird jetzt übergeben
    const dbRecord = buildDatabaseRecord(
      { ...extractedData, extraktions_hinweise: hinweiseMitMethode },
      extractedText,
      dokumentUrl,
      fileHash,
      textHash,
      kategorisiertVon
    );

    let resultId: string;

    // v25: UPDATE-MODE vs INSERT-MODE
    if (isUpdateMode && existingDocumentId) {
      // UPDATE existing document (from process-email)
      console.log(`[UPDATE-MODE] Updating document ${existingDocumentId} with category: ${extractedData.kategorie}`);

      // Remove source field for update (don't overwrite email_attachment source)
      const { source: _source, ...updateRecord } = dbRecord;

      // Add processing completion fields
      const updateData = {
        ...updateRecord,
        processing_status: "done",
        processed_at: new Date().toISOString(),
        kategorisiert_am: new Date().toISOString(),
        kategorisiert_von: kategorisiertVon === "rule" ? "rule" : "process-document-gpt",
      };

      const { error: updateError } = await supabase
        .from("documents")
        .update(updateData)
        .eq("id", existingDocumentId);

      if (updateError) {
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      resultId = existingDocumentId;
      console.log(`[UPDATE-MODE] Updated document ${resultId} with category: ${extractedData.kategorie}`);
    } else {
      // INSERT new document (normal scanner mode)
      const { data: insertData, error: insertError } = await supabase
        .from("documents")
        .insert(dbRecord)
        .select("id")
        .single();

      if (insertError) {
        throw new Error(`Database insert failed: ${insertError.message}`);
      }

      resultId = insertData.id;
      console.log(`Inserted with ID: ${resultId}`);
    }

    // v31: GPT-basierte Budget-Extraktion fuer Aufmassblaetter
    let budgetExtraction: BudgetExtractionResult | null = null;
    let budgetCaseId: string | null = null;

    if (extractedData.kategorie === "Aufmassblatt" && shouldExtractBudget(extractedText)) {
      console.log(`[BUDGET] Aufmassblatt erkannt - starte GPT Budget-Extraktion`);

      try {
        const budgetStartTime = Date.now();

        // GPT-Call fuer Budget-Extraktion
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
              { role: "user", content: extractedText },
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
                kanal: "scan",  // Gescanntes Dokument
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
                  document_id: resultId,
                  raw_ocr: extractedText,
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
      }
    }

    return new Response(JSON.stringify({
      success: true,
      id: resultId,
      kategorie: extractedData.kategorie,
      kategorisiert_von: kategorisiertVon,
      dokument_url: dokumentUrl,
      extraktions_qualitaet: extractedData.extraktions_qualitaet,
      extraction_method: extractionMethod,
      file_hash: fileHash,
      text_hash: textHash,
      update_mode: isUpdateMode,
      // v31: GPT-basierte Budget-Extraktion (nur bei Aufmassblaettern)
      ...(budgetExtraction && {
        budget_case_id: budgetCaseId,
        budget_elemente_count: budgetExtraction.elemente.length,
        budget_kontext: budgetExtraction.kontext,
        budget_montage: budgetExtraction.montage,
        budget_fehlende_infos: budgetExtraction.fehlende_infos,
        budget_annahmen: budgetExtraction.annahmen,
        budget_confidence: budgetExtraction.gesamt_confidence,
      }),
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing document:", error);
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

async function categorizeAndExtract(ocrText: string, fileName: string): Promise<ExtractedDocument> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      // v32: GPT-5 mini statt GPT-5.2 (15x guenstiger)
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          // v32: Dateiname als Kontext mitgeben
          content: `Dateiname: ${fileName}\n\nAnalysiere das folgende Dokument und extrahiere alle relevanten Informationen als JSON:\n\n${ocrText}`,
        },
      ],
      // v32: json_object statt json_schema (GPT-5 mini Kompatibilitaet)
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI extraction failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;

  return JSON.parse(content) as ExtractedDocument;
}

function buildDatabaseRecord(
  extracted: ExtractedDocument,
  ocrText: string,
  dokumentUrl: string,
  fileHash: string,
  textHash: string,
  kategorisiertVon: string = "gpt"  // v26: Parameter hinzugefuegt
): Record<string, unknown> {
  // v21: Canonicalize kategorie (alias mapping)
  const kategorie = canonicalizeKategorie(extracted.kategorie) || extracted.kategorie;

  // v20: Business-Logik fuer unterschrift_erforderlich
  const unterschriftErforderlich = UNTERSCHRIFT_ERFORDERLICH_KATEGORIEN.includes(kategorie);

  const now = new Date().toISOString();

  return {
    kategorie: kategorie,
    dokument_url: dokumentUrl,
    ocr_text: ocrText,
    extraktions_zeitstempel: now,
    extraktions_qualitaet: extracted.extraktions_qualitaet,
    extraktions_hinweise: extracted.extraktions_hinweise,
    file_hash: fileHash,
    text_hash: textHash,
    source: "scanner",
    // v26: Processing-Status Felder
    processing_status: "done",
    processed_at: now,
    kategorisiert_am: now,
    kategorisiert_von: kategorisiertVon === "rule" ? "rule" : "process-document-gpt",
    // v20: Unterschrift-Felder
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
