// =============================================================================
// Process Document - OCR + GPT Kategorisierung
// Version: 17.1 - 2026-01-14
// =============================================================================
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
import * as XLSX from "npm:xlsx@0.18.5";
import JSZip from "npm:jszip@3.10.1";

const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// v17: API Key Protection
const PROCESS_DOCUMENT_API_KEY = Deno.env.get("PROCESS_DOCUMENT_API_KEY");
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// =============================================================================
// v17: API Key Validation
// =============================================================================

function validateApiKey(req: Request): { valid: boolean; reason?: string } {
  // Check if any API key is configured
  const expectedKey = PROCESS_DOCUMENT_API_KEY || INTERNAL_API_KEY;
  if (!expectedKey) {
    // No key configured = allow (backwards compatibility during transition)
    console.log("[AUTH] No API key configured - allowing request");
    return { valid: true };
  }

  // Check x-api-key header first
  const apiKeyHeader = req.headers.get("x-api-key");
  if (apiKeyHeader && apiKeyHeader === expectedKey) {
    console.log("[AUTH] Valid x-api-key header");
    return { valid: true };
  }

  // Check Authorization: Bearer header
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1] === expectedKey) {
      console.log("[AUTH] Valid Bearer token");
      return { valid: true };
    }
  }

  // No valid key provided
  console.warn("[AUTH] Rejected - invalid or missing API key");
  return { valid: false, reason: "Invalid or missing API key" };
}

// Supported file types for OCR (Mistral)
const OCR_SUPPORTED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "tif", "tiff", "bmp"];

// Office file types with native text extraction
const OFFICE_EXTENSIONS = ["docx", "xlsx", "xls"];

// Get MIME type from file extension
function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    tif: "image/tiff",
    tiff: "image/tiff",
    bmp: "image/bmp",
    mp4: "video/mp4",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

// Check if file is an image (for OCR type selection)
function isImage(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "gif", "webp", "tif", "tiff", "bmp"].includes(ext);
}

// Check if file type supports OCR (Mistral)
function isOcrSupported(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return OCR_SUPPORTED_EXTENSIONS.includes(ext);
}

// Check if file is Office document with native text extraction
function isOfficeDocument(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return OFFICE_EXTENSIONS.includes(ext);
}

// Detect actual file type from magic bytes
function detectFileType(buffer: ArrayBuffer): { type: string; isOfficeDoc: boolean } {
  const bytes = new Uint8Array(buffer.slice(0, 8));

  // PDF: starts with %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { type: "pdf", isOfficeDoc: false };
  }

  // ZIP/Office: starts with PK (0x50 0x4B)
  if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
    return { type: "zip", isOfficeDoc: true };
  }

  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return { type: "png", isOfficeDoc: false };
  }

  // JPEG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { type: "jpg", isOfficeDoc: false };
  }

  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { type: "gif", isOfficeDoc: false };
  }

  // TIFF
  if ((bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4D && bytes[1] === 0x4D)) {
    return { type: "tiff", isOfficeDoc: false };
  }

  // Old Excel format (xls) - starts with D0 CF 11 E0 (OLE compound file)
  if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) {
    return { type: "ole", isOfficeDoc: true };
  }

  return { type: "unknown", isOfficeDoc: false };
}

// Get category for non-OCR files based on extension
function getMediaCategory(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "Video";
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "Audio";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "Office_Dokument";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "Archiv";
  return "Sonstiges_Dokument";
}

// v17.1: Sanitize filename for Supabase Storage (no umlauts/special chars)
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9._-]/g, "_"); // Replace other special chars with underscore
}

// Extract text from Word document by parsing DOCX as ZIP and reading XML
async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const zip = new JSZip();
  const contents = await zip.loadAsync(buffer);

  // DOCX stores content in word/document.xml
  const documentXml = contents.file("word/document.xml");
  if (!documentXml) {
    throw new Error("No document.xml found in DOCX");
  }

  const xmlContent = await documentXml.async("string");

  // Extract text from XML - simple regex to get text between <w:t> tags
  const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const textParts: string[] = [];

  for (const match of textMatches) {
    const text = match.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, "");
    textParts.push(text);
  }

  // Join with spaces, but preserve paragraph breaks
  // Paragraphs in DOCX are marked with <w:p> tags
  let result = textParts.join("");

  // Add newlines for paragraph breaks (simplified)
  const paragraphCount = (xmlContent.match(/<w:p[\s>]/g) || []).length;
  if (paragraphCount > 1) {
    // Re-parse to get proper paragraph structure
    const paragraphs: string[] = [];
    const pMatches = xmlContent.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];

    for (const pMatch of pMatches) {
      const pTextMatches = pMatch.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const pText = pTextMatches
        .map(m => m.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, ""))
        .join("");
      if (pText.trim()) {
        paragraphs.push(pText);
      }
    }

    result = paragraphs.join("\n");
  }

  return result;
}

// Extract text from Excel using SheetJS
function extractTextFromExcel(buffer: ArrayBuffer): string {
  const workbook = XLSX.read(buffer, { type: "array" });
  const textParts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    textParts.push(`=== Sheet: ${sheetName} ===`);

    // Convert to CSV for text representation
    const csv = XLSX.utils.sheet_to_csv(sheet);
    textParts.push(csv);
    textParts.push("");
  }

  return textParts.join("\n");
}

Deno.serve(async (req: Request) => {
  // ==========================================================================
  // v17: Health Check (GET)
  // ==========================================================================
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        service: "process-document",
        version: "17.1.0",
        status: "ready",
        configured: {
          mistral: !!MISTRAL_API_KEY,
          openai: !!OPENAI_API_KEY,
          supabase: !!(Deno.env.get("SUPABASE_URL") && Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
          apiKeyProtection: !!(PROCESS_DOCUMENT_API_KEY || INTERNAL_API_KEY),
        },
        supportedFormats: {
          ocr: OCR_SUPPORTED_EXTENSIONS,
          office: OFFICE_EXTENSIONS,
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
    console.log(`Processing file: ${file.name}, size: ${file.size} bytes, type: ${mimeType}, OCR: ${ocrSupportedByExt}, Office: ${isOffice}`);

    // Step 1: Calculate file hash for exact duplicate detection
    const fileBuffer = await file.arrayBuffer();
    const fileHash = await calculateHash(fileBuffer);
    console.log(`File hash: ${fileHash}`);

    // Step 1b: Detect actual file type from content (magic bytes)
    const detectedType = detectFileType(fileBuffer);
    console.log(`Detected file type: ${detectedType.type}, isOfficeDoc: ${detectedType.isOfficeDoc}`);

    // Step 2: Check for exact duplicate - SOFORT ABBRECHEN wenn gefunden
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
        extractedText = await extractTextWithMistral(fileBuffer, file.name, mimeType);
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

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeFileName = sanitizeFileName(file.name);
      const storagePath = `${kategorie}/${timestamp}_${safeFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
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

      const { data: insertData, error: insertError } = await supabase
        .from("documents")
        .insert({
          kategorie: kategorie,
          dokument_url: uploadData.path,
          ocr_text: null,
          extraktions_zeitstempel: new Date().toISOString(),
          extraktions_qualitaet: "keine",
          extraktions_hinweise: hinweise,
          file_hash: fileHash,
          text_hash: null,
          bemerkungen: `Mediendatei: ${file.name}`,
        })
        .select("id")
        .single();

      if (insertError) {
        throw new Error(`Database insert failed: ${insertError.message}`);
      }

      console.log(`Inserted media file with ID: ${insertData.id}`);

      return new Response(JSON.stringify({
        success: true,
        id: insertData.id,
        kategorie: kategorie,
        dokument_url: uploadData.path,
        extraktions_qualitaet: "keine",
        file_hash: fileHash,
        message: "Mediendatei gespeichert (keine Textextraktion moeglich)",
        extraction_error: extractionError,
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

    // Categorize + Extract with GPT-5.2
    const extractedData = await categorizeAndExtract(extractedText);
    console.log(`Categorized as: ${extractedData.kategorie}`);

    // Upload file to Storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeFileName = sanitizeFileName(file.name);
    const storagePath = `${extractedData.kategorie}/${timestamp}_${safeFileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const dokumentUrl = uploadData.path;
    console.log(`Uploaded to: ${dokumentUrl}`);

    // Add extraction method to hints
    const hinweiseMitMethode = [
      ...(extractedData.extraktions_hinweise || []),
      `Extraktionsmethode: ${extractionMethod}`,
    ];

    // Insert into database
    const dbRecord = buildDatabaseRecord(
      { ...extractedData, extraktions_hinweise: hinweiseMitMethode },
      extractedText,
      dokumentUrl,
      fileHash,
      textHash
    );

    const { data: insertData, error: insertError } = await supabase
      .from("documents")
      .insert(dbRecord)
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    console.log(`Inserted with ID: ${insertData.id}`);

    return new Response(JSON.stringify({
      success: true,
      id: insertData.id,
      kategorie: extractedData.kategorie,
      dokument_url: dokumentUrl,
      extraktions_qualitaet: extractedData.extraktions_qualitaet,
      extraction_method: extractionMethod,
      file_hash: fileHash,
      text_hash: textHash,
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

// Calculate SHA256 hash of ArrayBuffer
async function calculateHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Calculate hash of normalized text
async function calculateTextHash(text: string): Promise<string> {
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\u00e4\u00f6\u00fc\u00df ]/g, "")
    .trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  return calculateHash(data.buffer);
}

async function extractTextWithMistral(fileBuffer: ArrayBuffer, fileName: string, mimeType: string): Promise<string> {
  const bytes = new Uint8Array(fileBuffer);

  let binary = "";
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  const base64 = btoa(binary);

  const isImageFile = isImage(fileName);

  const requestBody = isImageFile
    ? {
        model: "mistral-ocr-latest",
        document: {
          type: "image_url",
          image_url: `data:${mimeType};base64,${base64}`,
        },
      }
    : {
        model: "mistral-ocr-latest",
        document: {
          type: "document_url",
          document_url: `data:${mimeType};base64,${base64}`,
        },
      };

  const response = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral OCR failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  if (result.pages && Array.isArray(result.pages)) {
    return result.pages.map((page: { markdown: string }) => page.markdown).join("\n\n---\n\n");
  }

  return JSON.stringify(result);
}

async function categorizeAndExtract(ocrText: string): Promise<ExtractedDocument> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Analysiere das folgende Dokument und extrahiere alle relevanten Informationen:\n\n${ocrText}`,
        },
      ],
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

  return JSON.parse(content) as ExtractedDocument;
}

function buildDatabaseRecord(
  extracted: ExtractedDocument,
  ocrText: string,
  dokumentUrl: string,
  fileHash: string,
  textHash: string
): Record<string, unknown> {
  return {
    kategorie: extracted.kategorie,
    dokument_url: dokumentUrl,
    ocr_text: ocrText,
    extraktions_zeitstempel: new Date().toISOString(),
    extraktions_qualitaet: extracted.extraktions_qualitaet,
    extraktions_hinweise: extracted.extraktions_hinweise,
    file_hash: fileHash,
    text_hash: textHash,
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

interface ExtractedDocument {
  kategorie: string;
  extraktions_qualitaet: "hoch" | "mittel" | "niedrig";
  extraktions_hinweise: string[];
  dokument_datum: string | null;
  dokument_nummer: string | null;
  dokument_richtung: string | null;
  aussteller: {
    firma: string | null;
    name: string | null;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
    telefon: string | null;
    email: string | null;
    ust_id: string | null;
  } | null;
  empfaenger: {
    firma: string | null;
    vorname: string | null;
    nachname: string | null;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
    telefon: string | null;
    email: string | null;
    kundennummer: string | null;
  } | null;
  positionen: Array<{
    pos_nr: number | null;
    beschreibung: string | null;
    menge: number | null;
    einheit: string | null;
    einzelpreis_netto: number | null;
    gesamtpreis_netto: number | null;
  }> | null;
  summe_netto: number | null;
  mwst_betrag: number | null;
  summe_brutto: number | null;
  offener_betrag: number | null;
  zahlungsziel_tage: number | null;
  faellig_am: string | null;
  skonto_prozent: number | null;
  skonto_tage: number | null;
  bank: {
    name: string | null;
    iban: string | null;
    bic: string | null;
  } | null;
  liefertermin_datum: string | null;
  lieferzeit_wochen: number | null;
  bezug: {
    angebot_nr: string | null;
    bestellung_nr: string | null;
    lieferschein_nr: string | null;
    rechnung_nr: string | null;
    auftrag_nr: string | null;
    projekt: string | null;
  } | null;
  mahnung_stufe: number | null;
  mahngebuehren: number | null;
  verzugszinsen_betrag: number | null;
  gesamtforderung: number | null;
  betreff: string | null;
  inhalt_zusammenfassung: string | null;
  bemerkungen: string | null;
  dringlichkeit: string | null;
}

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    kategorie: {
      type: "string",
      enum: [
        "Preisanfrage",
        "Angebot",
        "Auftragsbestaetigung",
        "Bestellung",
        "Eingangslieferschein",
        "Eingangsrechnung",
        "Kundenlieferschein",
        "Montageauftrag",
        "Ausgangsrechnung",
        "Zahlungserinnerung",
        "Mahnung",
        "Notiz",
        "Skizze",
        "Brief_an_Kunde",
        "Brief_von_Kunde",
        "Brief_von_Finanzamt",
        "Brief_von_Amt",
        "Sonstiges_Dokument",
      ],
    },
    extraktions_qualitaet: {
      type: "string",
      enum: ["hoch", "mittel", "niedrig"],
    },
    extraktions_hinweise: {
      type: "array",
      items: { type: "string" },
    },
    dokument_datum: { type: ["string", "null"] },
    dokument_nummer: { type: ["string", "null"] },
    dokument_richtung: { type: ["string", "null"] },
    aussteller: {
      type: ["object", "null"],
      properties: {
        firma: { type: ["string", "null"] },
        name: { type: ["string", "null"] },
        strasse: { type: ["string", "null"] },
        plz: { type: ["string", "null"] },
        ort: { type: ["string", "null"] },
        telefon: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        ust_id: { type: ["string", "null"] },
      },
      required: ["firma", "name", "strasse", "plz", "ort", "telefon", "email", "ust_id"],
      additionalProperties: false,
    },
    empfaenger: {
      type: ["object", "null"],
      properties: {
        firma: { type: ["string", "null"] },
        vorname: { type: ["string", "null"] },
        nachname: { type: ["string", "null"] },
        strasse: { type: ["string", "null"] },
        plz: { type: ["string", "null"] },
        ort: { type: ["string", "null"] },
        telefon: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        kundennummer: { type: ["string", "null"] },
      },
      required: ["firma", "vorname", "nachname", "strasse", "plz", "ort", "telefon", "email", "kundennummer"],
      additionalProperties: false,
    },
    positionen: {
      type: ["array", "null"],
      items: {
        type: "object",
        properties: {
          pos_nr: { type: ["number", "null"] },
          beschreibung: { type: ["string", "null"] },
          menge: { type: ["number", "null"] },
          einheit: { type: ["string", "null"] },
          einzelpreis_netto: { type: ["number", "null"] },
          gesamtpreis_netto: { type: ["number", "null"] },
        },
        required: ["pos_nr", "beschreibung", "menge", "einheit", "einzelpreis_netto", "gesamtpreis_netto"],
        additionalProperties: false,
      },
    },
    summe_netto: { type: ["number", "null"] },
    mwst_betrag: { type: ["number", "null"] },
    summe_brutto: { type: ["number", "null"] },
    offener_betrag: { type: ["number", "null"] },
    zahlungsziel_tage: { type: ["number", "null"] },
    faellig_am: { type: ["string", "null"] },
    skonto_prozent: { type: ["number", "null"] },
    skonto_tage: { type: ["number", "null"] },
    bank: {
      type: ["object", "null"],
      properties: {
        name: { type: ["string", "null"] },
        iban: { type: ["string", "null"] },
        bic: { type: ["string", "null"] },
      },
      required: ["name", "iban", "bic"],
      additionalProperties: false,
    },
    liefertermin_datum: { type: ["string", "null"] },
    lieferzeit_wochen: { type: ["number", "null"] },
    bezug: {
      type: ["object", "null"],
      properties: {
        angebot_nr: { type: ["string", "null"] },
        bestellung_nr: { type: ["string", "null"] },
        lieferschein_nr: { type: ["string", "null"] },
        rechnung_nr: { type: ["string", "null"] },
        auftrag_nr: { type: ["string", "null"] },
        projekt: { type: ["string", "null"] },
      },
      required: ["angebot_nr", "bestellung_nr", "lieferschein_nr", "rechnung_nr", "auftrag_nr", "projekt"],
      additionalProperties: false,
    },
    mahnung_stufe: { type: ["number", "null"] },
    mahngebuehren: { type: ["number", "null"] },
    verzugszinsen_betrag: { type: ["number", "null"] },
    gesamtforderung: { type: ["number", "null"] },
    betreff: { type: ["string", "null"] },
    inhalt_zusammenfassung: { type: ["string", "null"] },
    bemerkungen: { type: ["string", "null"] },
    dringlichkeit: { type: ["string", "null"] },
  },
  required: [
    "kategorie",
    "extraktions_qualitaet",
    "extraktions_hinweise",
    "dokument_datum",
    "dokument_nummer",
    "dokument_richtung",
    "aussteller",
    "empfaenger",
    "positionen",
    "summe_netto",
    "mwst_betrag",
    "summe_brutto",
    "offener_betrag",
    "zahlungsziel_tage",
    "faellig_am",
    "skonto_prozent",
    "skonto_tage",
    "bank",
    "liefertermin_datum",
    "lieferzeit_wochen",
    "bezug",
    "mahnung_stufe",
    "mahngebuehren",
    "verzugszinsen_betrag",
    "gesamtforderung",
    "betreff",
    "inhalt_zusammenfassung",
    "bemerkungen",
    "dringlichkeit",
  ],
  additionalProperties: false,
};
