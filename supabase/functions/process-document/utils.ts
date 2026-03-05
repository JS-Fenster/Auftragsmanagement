// =============================================================================
// Process Document - Utility Functions
// Extrahiert aus index.ts fuer bessere Modularitaet
// =============================================================================

// Supported file types for OCR (Mistral)
export const OCR_SUPPORTED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "tif", "tiff", "bmp", "heic", "heif"];

// Office file types with native text extraction
export const OFFICE_EXTENSIONS = ["docx", "xlsx", "xls"];

/**
 * Get MIME type from file extension
 */
export function getMimeType(fileName: string): string {
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
    heic: "image/heic",
    heif: "image/heif",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

// NOTE: isImage() is defined in extraction.ts and exported from there
// to avoid duplication, it is not exported here

/**
 * Check if file type supports OCR (Mistral)
 */
export function isOcrSupported(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return OCR_SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Check if file is Office document with native text extraction
 */
export function isOfficeDocument(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return OFFICE_EXTENSIONS.includes(ext);
}

/**
 * Detect actual file type from magic bytes
 */
export function detectFileType(buffer: ArrayBuffer): { type: string; isOfficeDoc: boolean } {
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

  // HEIC/HEIF: ISO Base Media File Format - "ftyp" at offset 4
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return { type: "heic", isOfficeDoc: false };
  }

  return { type: "unknown", isOfficeDoc: false };
}

/**
 * Get category for non-OCR files based on extension
 */
export function getMediaCategory(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "Video";
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "Audio";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "Office_Dokument";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "Archiv";
  if (["heic", "heif"].includes(ext)) return "Bild";  // G-044: HEIC als Bild wenn OCR fehlschlaegt
  return "Sonstiges_Dokument";
}

/**
 * v17.1: Sanitize filename for Supabase Storage (no umlauts/special chars)
 */
export function sanitizeFileName(fileName: string): string {
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

/**
 * API Key validation result type
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * v18/v28: API Key Validation
 * Validates requests against INTERNAL_API_KEY or SCANNER_API_KEY
 *
 * @param req - The incoming request
 * @param internalApiKey - The INTERNAL_API_KEY from environment (or null/undefined)
 * @param scannerApiKey - The SCANNER_API_KEY from environment (or null/undefined)
 * @returns Validation result with valid flag and optional reason
 */
export function validateApiKey(
  req: Request,
  internalApiKey: string | undefined | null,
  scannerApiKey: string | undefined | null
): ApiKeyValidationResult {
  // v28: INTERNAL_API_KEY oder SCANNER_API_KEY (mindestens einer PFLICHT)
  if (!internalApiKey && !scannerApiKey) {
    console.error("[AUTH] CRITICAL: Neither INTERNAL_API_KEY nor SCANNER_API_KEY configured");
    return { valid: false, reason: "No API key configured on server" };
  }

  // Check x-api-key header first
  const apiKeyHeader = req.headers.get("x-api-key");
  if (apiKeyHeader) {
    if (internalApiKey && apiKeyHeader === internalApiKey) {
      console.log("[AUTH] Valid x-api-key header (INTERNAL)");
      return { valid: true };
    }
    if (scannerApiKey && apiKeyHeader === scannerApiKey) {
      console.log("[AUTH] Valid x-api-key header (SCANNER)");
      return { valid: true };
    }
  }

  // Check Authorization: Bearer header
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      if (internalApiKey && match[1] === internalApiKey) {
        console.log("[AUTH] Valid Bearer token (INTERNAL)");
        return { valid: true };
      }
      if (scannerApiKey && match[1] === scannerApiKey) {
        console.log("[AUTH] Valid Bearer token (SCANNER)");
        return { valid: true };
      }
    }
  }

  // No valid key provided
  console.warn("[AUTH] Rejected - invalid or missing API key");
  return { valid: false, reason: "Invalid or missing API key" };
}

/**
 * Factory function to create a validateApiKey function with pre-bound keys
 * Useful when you want to avoid passing keys on every call
 */
export function createApiKeyValidator(
  internalApiKey: string | undefined | null,
  scannerApiKey: string | undefined | null
): (req: Request) => ApiKeyValidationResult {
  return (req: Request) => validateApiKey(req, internalApiKey, scannerApiKey);
}

// =============================================================================
// G-045: Upload-Filter - Extension + Mindestgroesse Validierung
// =============================================================================

/**
 * Erlaubte Datei-Extensions fuer den Upload
 * Umfasst OCR-faehige, Office- und Medien-Formate
 */
const ALLOWED_EXTENSIONS = [
  // OCR-faehig (Mistral)
  "pdf", "png", "jpg", "jpeg", "gif", "webp", "tif", "tiff", "bmp",
  // HEIC/HEIF (G-044: Mistral-OCR-Versuch + Fallback)
  "heic", "heif",
  // Office (native Text-Extraktion)
  "docx", "xlsx", "xls",
  // Medien (werden als Media-Kategorie gespeichert)
  "mp4", "mov", "avi", "mkv", "webm",
  "mp3", "wav", "ogg", "m4a",
  "doc", "ppt", "pptx",
  "zip", "rar", "7z", "tar", "gz",
];

/**
 * Mindestgroesse in Bytes - darunter wahrscheinlich Icon/Thumbnail/QR-Code
 */
const MIN_FILE_SIZE_BYTES = 5 * 1024; // 5 KB

/**
 * Bild-Extensions fuer Mindestgroessen-Check
 * (nur Bilder werden auf Mindestgroesse geprueft, nicht PDFs/Office)
 */
const IMAGE_EXTENSIONS_FOR_SIZE_CHECK = [
  "png", "jpg", "jpeg", "gif", "bmp", "webp", "heic", "heif",
];

export interface UploadValidationResult {
  valid: boolean;
  reason?: string;
  autoKategorie?: string;
  skipProcessing?: boolean;
}

/**
 * G-045: Validiert einen Upload VOR der Verarbeitung.
 *
 * Prueft:
 * 1. Extension erlaubt?
 * 2. Bild zu klein? (< 5KB -> auto-"Bild", kein GPT)
 */
export function validateUpload(fileName: string, fileSize: number): UploadValidationResult {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // Check 1: Extension erlaubt?
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      reason: `Extension .${ext} nicht unterstuetzt. Erlaubt: ${ALLOWED_EXTENSIONS.join(", ")}`
    };
  }

  // Check 2: Bild zu klein? (Icons, QR-Codes, Thumbnails)
  if (IMAGE_EXTENSIONS_FOR_SIZE_CHECK.includes(ext) && fileSize < MIN_FILE_SIZE_BYTES) {
    return {
      valid: true,
      autoKategorie: "Bild",
      skipProcessing: true,
      reason: `Bild unter ${MIN_FILE_SIZE_BYTES / 1024} KB - automatisch als Bild kategorisiert`
    };
  }

  return { valid: true };
}
