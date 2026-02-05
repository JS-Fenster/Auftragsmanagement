// =============================================================================
// Extraction Functions - Text extraction utilities for process-document
// =============================================================================
// Extracted from index.ts for better modularity
// Functions: calculateHash, calculateTextHash, extractTextWithMistral,
//            extractTextFromDocx, extractTextFromExcel, isImage
// =============================================================================

import * as XLSX from "npm:xlsx@0.18.5";
import JSZip from "npm:jszip@3.10.1";

// =============================================================================
// Hashing Functions
// =============================================================================

/**
 * Calculate SHA256 hash of ArrayBuffer
 */
export async function calculateHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Calculate hash of normalized text
 * Normalizes: lowercase, collapse whitespace, remove special chars except umlauts
 */
export async function calculateTextHash(text: string): Promise<string> {
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\u00e4\u00f6\u00fc\u00df ]/g, "")
    .trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  return calculateHash(data.buffer);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if file is an image (for OCR type selection)
 */
export function isImage(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "gif", "webp", "tif", "tiff", "bmp"].includes(ext);
}

// =============================================================================
// Text Extraction Functions
// =============================================================================

/**
 * Extract text from Word document by parsing DOCX as ZIP and reading XML
 */
export async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
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

/**
 * Extract text from Excel using SheetJS
 */
export function extractTextFromExcel(buffer: ArrayBuffer): string {
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

/**
 * Extract text from document using Mistral OCR API
 * Supports PDF and image files
 *
 * @param fileBuffer - The file content as ArrayBuffer
 * @param fileName - Original filename (used to determine if it's an image)
 * @param mimeType - MIME type of the file
 * @param mistralApiKey - Mistral API key for authentication
 */
export async function extractTextWithMistral(
  fileBuffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  mistralApiKey: string
): Promise<string> {
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
      Authorization: `Bearer ${mistralApiKey}`,
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
