// =============================================================================
// Process Email - GPT Categorization + Attachment Handling
// Version: 4.0.0 - 2026-01-22
// =============================================================================
// Wird von email-webhook aufgerufen nachdem E-Mail in DB gespeichert wurde.
//
// v4.0.0 Changes:
// - FIX: GPT reasoning.effort auf "medium" (war "none" - fuehrte zu schlechten Ergebnissen)
// - FIX: Robustere Kategorie-Erkennung (case-insensitive, trim)
// - FIX: Detailliertes Logging der GPT-Antwort fuer Debugging
// - FIX: Attachment-Workflow - process-document updated jetzt existierendes Document
// - NEW: Anhaenge erhalten processing_status="pending_ocr" bis process-document fertig
// - NEW: process-document erhaelt document_id zum Updaten statt neu erstellen
//
// v3.1.1 Changes:
// - NEW: Jeder Anhang erhaelt eigene Zeile in documents Tabelle
// - NEW: bezug_email_id verknuepft Anhang mit E-Mail
// - NEW: email_anhaenge_count und email_anhaenge_meta werden befuellt
// - NEW: Kategorie "Email_Anhang" fuer Anhaenge
//
// v3.0.0 Changes:
// - UPGRADE: GPT-5.2 fuer Kategorisierung (Chat Completions API)
// - UPGRADE: Supabase Client Library fuer Storage (Best Practice)
// - FIX: Kompatibel mit neuen Supabase API Keys (sb_secret_...)
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Environment variables
const AZURE_TENANT_ID = Deno.env.get("AZURE_TENANT_ID");
const AZURE_CLIENT_ID = Deno.env.get("AZURE_CLIENT_ID");
const AZURE_CLIENT_SECRET = Deno.env.get("AZURE_CLIENT_SECRET");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// v3.0: Supabase Client handles both legacy JWT and new sb_secret_... keys
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SVC_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// v3.0: Supabase Client fuer Storage und DB Operations
// Der Client transformiert neue API Keys (sb_secret_...) automatisch zu kurzlebigen JWTs
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// v2.5: API Key Protection - NUR INTERNAL_API_KEY fuer alle Calls
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");

// =============================================================================
// v2.5: API Key Validation (PFLICHT - nur INTERNAL_API_KEY)
// =============================================================================

function validateApiKey(req: Request): { valid: boolean; reason?: string } {
  // v2.5: Nur INTERNAL_API_KEY, PFLICHT
  if (!INTERNAL_API_KEY) {
    console.error("[AUTH] CRITICAL: INTERNAL_API_KEY not configured - rejecting request");
    return { valid: false, reason: "No API key configured on server" };
  }

  const apiKeyHeader = req.headers.get("x-api-key");
  if (apiKeyHeader && apiKeyHeader === INTERNAL_API_KEY) {
    console.log("[AUTH] Valid x-api-key header");
    return { valid: true };
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1] === INTERNAL_API_KEY) {
      console.log("[AUTH] Valid Bearer token");
      return { valid: true };
    }
  }

  console.warn("[AUTH] Rejected - invalid or missing API key");
  return { valid: false, reason: "Invalid or missing API key" };
}

// Attachment whitelist
const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".xls",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".tiff",
  ".tif",
];

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/tiff",
];

// Attachment Hardening Constants (v2.0)
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const INLINE_ATTACHMENT_SIGNATURES = [
  "image001", "image002", "image003", "image004", "image005",
  "signature", "logo", "banner", "cid:", "outlook"
];

// Categories
const VALID_CATEGORIES = [
  "Bewerbung",
  "Lead_Anfrage",
  "BAFA_Foerderung",
  "Versicherung_Schaden",
  "Lieferstatus_Update",
  "Rechnung_Eingang",
  "Rechnung_Gesendet",
  "Auftragserteilung",
  "Bestellbestaetigung",
  "Angebot_Anforderung",
  "Reklamation",
  "Serviceanfrage",
  "Anforderung_Unterlagen",
  "Terminanfrage",
  "Kundenanfrage",
  "Newsletter_Werbung",
  "Antwort_oder_Weiterleitung",
  "Sonstiges",
];

// =============================================================================
// Request/Response Types
// =============================================================================

interface ProcessEmailRequest {
  document_id: string;
  email_message_id: string;
  postfach: string;
}

interface EmailDocument {
  id: string;
  email_message_id: string;
  email_betreff: string;
  email_body_text: string;
  email_von_email: string;
  email_von_name: string;
  email_richtung: string;
}

interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: string;
  isInline: boolean;
}

// v3.1: Attachment processing result with document reference
interface AttachmentResult {
  hash: string;
  attachmentDocId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  storagePath: string;
}

// v3.1: Metadata for email_anhaenge_meta field
interface AttachmentMeta {
  id: string;           // Document ID of the attachment
  name: string;         // Original filename
  size: number;         // File size in bytes
  contentType: string;  // MIME type
  storagePath: string;  // Path in Storage bucket
  hash: string;         // SHA256 hash
}

// =============================================================================
// v2.2: Token Hardening (portiert von email-webhook v3.5)
// =============================================================================

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

// Extract AADSTS error code from Azure AD error response
function extractAadErrorCode(errorText: string): string | null {
  const match = errorText.match(/AADSTS\d+/);
  return match ? match[0] : null;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    throw new Error("Azure credentials not configured");
  }

  // v2.2 Hardening: trim whitespace from secret
  const clientSecret = AZURE_CLIENT_SECRET.trim();

  const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    const errorCode = extractAadErrorCode(error);
    // v2.2: Safe logging - never log the secret, only identifiers and error codes
    console.error(`[TOKEN] Failed - Tenant: ${AZURE_TENANT_ID}, Client: ${AZURE_CLIENT_ID}, Error: ${errorCode || 'unknown'}`);
    if (errorCode === "AADSTS7000215") {
      console.error("[TOKEN] Diagnosis: Invalid client secret (wrong value or expired)");
    } else if (errorCode === "AADSTS700016") {
      console.error("[TOKEN] Diagnosis: Application not found in tenant");
    } else if (errorCode === "AADSTS50126") {
      console.error("[TOKEN] Diagnosis: Invalid credentials");
    }
    throw new Error(`Failed to get access token: ${errorCode || error.substring(0, 100)}`);
  }

  const data: TokenResponse = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// =============================================================================
// GPT Categorization
// =============================================================================

async function categorizeWithGPT(
  betreff: string,
  bodyText: string,
  vonEmail: string,
  richtung: string
): Promise<{ kategorie: string; zusammenfassung: string }> {
  if (!OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY not set - using fallback category");
    return {
      kategorie: richtung === "ausgehend" ? "Sonstiges_Ausgehend" : "Sonstiges",
      zusammenfassung: betreff || "(keine Zusammenfassung)",
    };
  }

  const truncatedBody = bodyText?.substring(0, 2000) || "";

  const prompt = `Du bist ein E-Mail-Kategorisierer fuer ein Fenster- und Tuerenunternehmen.

Kategorisiere die folgende E-Mail in GENAU eine dieser Kategorien:
${VALID_CATEGORIES.join(", ")}

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

  try {
    // v4.0: GPT-5.2 mit reasoning.effort: "medium" fuer bessere Ergebnisse
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.2",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 400,  // Erhoeht fuer medium reasoning
        // v4.0: reasoning.effort: "medium" statt "none" - bessere Kategorisierung
        reasoning: { effort: "medium" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GPT] API error: ${response.status} - ${errorText.substring(0, 200)}`);
      throw new Error(`GPT API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // v4.0: Detailliertes Logging fuer Debugging
    console.log(`[GPT] Model: gpt-5.2, Response length: ${content.length}`);
    console.log(`[GPT] Raw response (first 500 chars): ${content.substring(0, 500)}`);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`[GPT] Parsed kategorie: "${parsed.kategorie}"`);

        // v4.0: Robustere Kategorie-Erkennung (case-insensitive, trim)
        const matchedCategory = VALID_CATEGORIES.find(
          cat => cat.toLowerCase() === parsed.kategorie?.toLowerCase()?.trim()
        );

        if (matchedCategory) {
          console.log(`[GPT] Matched category: "${matchedCategory}"`);
          return {
            kategorie: matchedCategory,  // Normalisierte Version aus VALID_CATEGORIES
            zusammenfassung: parsed.zusammenfassung || betreff,
          };
        } else {
          console.warn(`[GPT] Category "${parsed.kategorie}" NOT in VALID_CATEGORIES, falling back to Sonstiges`);
        }
      } catch (parseError) {
        console.error(`[GPT] JSON parse error: ${parseError}`);
      }
    } else {
      console.warn(`[GPT] No JSON found in response`);
    }

    return {
      kategorie: "Sonstiges",
      zusammenfassung: betreff || "(GPT Parse-Fehler)",
    };
  } catch (error) {
    console.error(`[GPT] Categorization error: ${error}`);
    return {
      kategorie: "Sonstiges",
      zusammenfassung: betreff || "(GPT-Fehler)",
    };
  }
}

// =============================================================================
// Attachment Processing
// =============================================================================

function isAllowedAttachment(name: string, contentType: string): boolean {
  const ext = name.toLowerCase().substring(name.lastIndexOf("."));
  return (
    ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_MIME_TYPES.includes(contentType)
  );
}

// v2.9: Diagnose-Interface fuer Attachment-Analyse
interface AttachmentDiagnostics {
  message_exists: boolean;
  message_subject?: string;
  message_hasAttachments?: boolean;
  message_receivedDateTime?: string;
  attachments_endpoint_count: number;
  attachments_expand_count: number;
  attachment_types: string[];
  raw_attachments: Array<{
    name: string;
    odataType: string;
    size: number;
    contentType: string;
    isInline: boolean;
    hasContentBytes: boolean;
  }>;
  diagnosis: string;
}

// v2.9: Umfassende Graph-Diagnose
async function diagnoseAttachments(
  postfach: string,
  messageId: string,
  accessToken: string
): Promise<AttachmentDiagnostics> {
  const result: AttachmentDiagnostics = {
    message_exists: false,
    attachments_endpoint_count: 0,
    attachments_expand_count: 0,
    attachment_types: [],
    raw_attachments: [],
    diagnosis: "unknown",
  };

  const maskedPostfach = postfach.replace(/(.{3}).*(@.*)/, "$1***$2");

  // Step 1: Fetch message details with hasAttachments
  console.log(`[DIAG] Step 1: Fetching message details...`);
  const messageUrl = `https://graph.microsoft.com/v1.0/users/${postfach}/messages/${messageId}?$select=id,subject,hasAttachments,receivedDateTime,from`;

  const msgResponse = await fetch(messageUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'IdType="ImmutableId"',
    },
  });

  if (!msgResponse.ok) {
    const errText = await msgResponse.text();
    console.error(`[DIAG] Message fetch FAILED: ${msgResponse.status} - ${errText.substring(0, 100)}`);
    result.diagnosis = `message_not_found: ${msgResponse.status}`;
    return result;
  }

  const msgData = await msgResponse.json();
  result.message_exists = true;
  result.message_subject = msgData.subject;
  result.message_hasAttachments = msgData.hasAttachments;
  result.message_receivedDateTime = msgData.receivedDateTime;
  console.log(`[DIAG] Message: subject="${msgData.subject}", hasAttachments=${msgData.hasAttachments}`);

  // Step 2: Try /attachments endpoint
  console.log(`[DIAG] Step 2: Fetching via /attachments endpoint...`);
  const attachUrl = `https://graph.microsoft.com/v1.0/users/${postfach}/messages/${messageId}/attachments`;

  const attachResponse = await fetch(attachUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'IdType="ImmutableId"',
    },
  });

  if (attachResponse.ok) {
    const attachData = await attachResponse.json();
    const attachments = attachData.value || [];
    result.attachments_endpoint_count = attachments.length;
    console.log(`[DIAG] /attachments returned ${attachments.length} item(s)`);

    for (const att of attachments) {
      const odataType = att["@odata.type"] || "unknown";
      result.attachment_types.push(odataType);
      result.raw_attachments.push({
        name: att.name || "(no name)",
        odataType,
        size: att.size || 0,
        contentType: att.contentType || "unknown",
        isInline: att.isInline || false,
        hasContentBytes: !!att.contentBytes,
      });
      console.log(`[DIAG]   - ${att.name}: type=${odataType}, size=${att.size}, isInline=${att.isInline}, hasBytes=${!!att.contentBytes}`);
    }
  } else {
    console.error(`[DIAG] /attachments FAILED: ${attachResponse.status}`);
  }

  // Step 3: Try $expand=attachments
  console.log(`[DIAG] Step 3: Fetching via $expand=attachments...`);
  const expandUrl = `https://graph.microsoft.com/v1.0/users/${postfach}/messages/${messageId}?$expand=attachments`;

  const expandResponse = await fetch(expandUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'IdType="ImmutableId"',
    },
  });

  if (expandResponse.ok) {
    const expandData = await expandResponse.json();
    const expandAttachments = expandData.attachments || [];
    result.attachments_expand_count = expandAttachments.length;
    console.log(`[DIAG] $expand=attachments returned ${expandAttachments.length} item(s)`);

    // If we got more attachments here, add them
    if (expandAttachments.length > result.raw_attachments.length) {
      result.raw_attachments = [];
      result.attachment_types = [];
      for (const att of expandAttachments) {
        const odataType = att["@odata.type"] || "unknown";
        result.attachment_types.push(odataType);
        result.raw_attachments.push({
          name: att.name || "(no name)",
          odataType,
          size: att.size || 0,
          contentType: att.contentType || "unknown",
          isInline: att.isInline || false,
          hasContentBytes: !!att.contentBytes,
        });
      }
    }
  } else {
    console.error(`[DIAG] $expand FAILED: ${expandResponse.status}`);
  }

  // Step 4: Generate diagnosis
  if (result.message_hasAttachments && result.attachments_endpoint_count === 0 && result.attachments_expand_count === 0) {
    result.diagnosis = "hasAttachments=true but no attachments returned - possible cloud/reference attachment or Graph sync issue";
  } else if (result.attachments_endpoint_count > 0) {
    const allInline = result.raw_attachments.every(a => a.isInline);
    const noContentBytes = result.raw_attachments.every(a => !a.hasContentBytes);

    if (allInline) {
      result.diagnosis = "all attachments are inline (signatures/images)";
    } else if (noContentBytes) {
      result.diagnosis = "attachments exist but no contentBytes - may be referenceAttachment or cloud links";
    } else {
      result.diagnosis = "attachments available with contentBytes";
    }
  } else if (!result.message_hasAttachments) {
    result.diagnosis = "message has no attachments (hasAttachments=false)";
  } else {
    result.diagnosis = "unknown state";
  }

  console.log(`[DIAG] Diagnosis: ${result.diagnosis}`);
  return result;
}

async function fetchAttachments(
  postfach: string,
  messageId: string,
  accessToken: string
): Promise<GraphAttachment[]> {
  const url = `https://graph.microsoft.com/v1.0/users/${postfach}/messages/${messageId}/attachments`;

  // v2.7: Detailed logging
  const maskedPostfach = postfach.replace(/(.{3}).*(@.*)/, "$1***$2");
  console.log(`[ATTACH] Graph fetch: users/${maskedPostfach}/messages/${messageId.substring(0, 20)}...`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'IdType="ImmutableId"',
    },
  });

  // v2.7: Log response status
  console.log(`[ATTACH] Graph response: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ATTACH] Graph fetch FAILED: ${errorText.substring(0, 200)}`);
    return [];
  }

  const data = await response.json();
  const attachments = data.value || [];
  console.log(`[ATTACH] Graph returned ${attachments.length} attachment(s)`);
  return attachments;
}

// =============================================================================
// v3.1: Create document row for attachment
// =============================================================================

// v4.0: Create attachment document with pending_ocr status
// process-document will update this document with the actual category after OCR
async function createAttachmentDocument(
  emailDocumentId: string,
  fileName: string,
  originalFileName: string,
  fileSize: number,
  contentType: string,
  storagePath: string,
  hash: string,
  emailBetreff: string
): Promise<string | null> {
  const docData = {
    // v4.0: Kategorie bleibt Email_Anhang bis process-document sie ueberschreibt
    kategorie: "Email_Anhang",
    bezug_email_id: emailDocumentId,
    dokument_url: storagePath,
    // NOTE: dokument_full_url is a generated column - do NOT set it
    file_hash: hash,
    source: "email_attachment",
    // Additional metadata
    email_betreff: `Anhang: ${originalFileName} (von: ${emailBetreff})`,
    // v4.0: Status pending_ocr - wird von process-document auf done gesetzt
    processing_status: "pending_ocr",
    // processed_at wird von process-document gesetzt
  };

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/documents`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY!,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(docData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ATTACH-DOC] Failed to create document: ${errorText.substring(0, 200)}`);
      return null;
    }

    const created = await response.json();
    const docId = created[0]?.id;
    console.log(`[ATTACH-DOC] Created document ${docId} for attachment ${originalFileName}`);
    return docId;
  } catch (error) {
    console.error(`[ATTACH-DOC] Error creating document: ${error}`);
    return null;
  }
}

async function processAttachment(
  attachment: GraphAttachment,
  documentId: string,
  emailBetreff: string
): Promise<AttachmentResult | { error: string } | null> {
  // v2.7: Detailed attachment info logging
  console.log(`[ATTACH] === Evaluating: ${attachment.name} ===`);
  console.log(`[ATTACH]   size: ${attachment.size} bytes`);
  console.log(`[ATTACH]   contentType: ${attachment.contentType}`);
  console.log(`[ATTACH]   isInline: ${attachment.isInline}`);
  console.log(`[ATTACH]   hasContentBytes: ${!!attachment.contentBytes}`);

  if (!attachment.contentBytes) {
    console.log(`[ATTACH]   chosen=NO | reason: no contentBytes`);
    return null;
  }

  if (!isAllowedAttachment(attachment.name, attachment.contentType)) {
    console.log(`[ATTACH]   chosen=NO | reason: not in whitelist (ext/mime)`);
    return null;
  }

  if (isLikelyInlineAttachment(attachment.name, attachment.isInline)) {
    console.log(`[ATTACH]   chosen=NO | reason: inline/signature image`);
    return null;
  }

  if (attachment.size > MAX_ATTACHMENT_SIZE_BYTES) {
    console.log(`[ATTACH]   chosen=NO | reason: exceeds size limit (${attachment.size} > ${MAX_ATTACHMENT_SIZE_BYTES})`);
    return null;
  }

  console.log(`[ATTACH]   chosen=YES | processing...`);
  console.log(`Processing attachment: ${attachment.name} (${attachment.size} bytes)`);

  const binaryContent = Uint8Array.from(atob(attachment.contentBytes), (c) =>
    c.charCodeAt(0)
  );

  const safeFileName = sanitizeFileName(attachment.name);
  const storagePath = `email-attachments/${documentId}/${safeFileName}`;

  // v2.7: Log upload attempt
  console.log(`[ATTACH]   upload target: ${storagePath}`);

  // v3.0: Supabase Client fuer Storage Upload (Best Practice)
  // Der Client transformiert neue API Keys (sb_secret_...) automatisch
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, binaryContent, {
      contentType: attachment.contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error(`[ATTACH]   upload FAILED: ${uploadError.message}`);
    return { error: `storage_upload_failed: ${uploadError.message}` };
  }

  console.log(`[ATTACH]   upload OK: ${uploadData?.path || storagePath}`);

  // v3.1: Calculate hash first (needed for document creation)
  const hash = await calculateSHA256(binaryContent);
  console.log(`[ATTACH]   hash: ${hash.substring(0, 16)}...`);

  // v3.1: Create document row for this attachment
  const attachmentDocId = await createAttachmentDocument(
    documentId,
    safeFileName,
    attachment.name,
    attachment.size,
    attachment.contentType,
    storagePath,
    hash,
    emailBetreff
  );

  if (!attachmentDocId) {
    console.error(`[ATTACH]   WARNING: Document creation failed, but file was uploaded`);
  }

  const processableTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/tiff",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  // v4.0: Call process-document with document_id for UPDATE mode
  // process-document will update the existing document instead of creating a new one
  if (processableTypes.includes(attachment.contentType) && attachmentDocId) {
    try {
      const processUrl = `${SUPABASE_URL}/functions/v1/process-document`;

      // v4.0: FormData mit document_id fuer Update-Mode
      const formData = new FormData();
      const blob = new Blob([binaryContent], { type: attachment.contentType });
      formData.append("file", blob, safeFileName);
      // v4.0: NEU - document_id signalisiert Update-Mode
      formData.append("document_id", attachmentDocId);
      // v4.0: NEU - storage_path damit process-document nicht nochmal hochlaedt
      formData.append("storage_path", storagePath);

      const headers: Record<string, string> = {};
      if (INTERNAL_API_KEY) {
        headers["x-api-key"] = INTERNAL_API_KEY;
        console.log(`[INTERNAL] Calling process-document in UPDATE mode for doc ${attachmentDocId}`);
      } else {
        console.warn("[INTERNAL] INTERNAL_API_KEY not set - process-document call will fail");
      }

      const processResponse = await fetch(processUrl, {
        method: "POST",
        headers,
        body: formData,
      });

      if (processResponse.ok) {
        const result = await processResponse.json();
        console.log(`[ATTACH] process-document completed for: ${attachment.name}`);
        console.log(`[ATTACH]   Updated doc ${attachmentDocId} with category: ${result.kategorie || 'unknown'}`);
      } else {
        const errorText = await processResponse.text();
        console.warn(`[ATTACH] process-document returned ${processResponse.status}: ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      console.error(`[ATTACH] process-document call failed: ${error}`);
    }
  } else if (!attachmentDocId) {
    console.warn(`[ATTACH] Skipping process-document - no document_id available`);
  }

  console.log(`[ATTACH]   SUCCESS: ${attachment.name} processed with doc_id=${attachmentDocId}`);

  // v3.1: Return full attachment result
  return {
    hash,
    attachmentDocId: attachmentDocId || "",
    fileName: attachment.name,
    fileSize: attachment.size,
    contentType: attachment.contentType,
    storagePath,
  };
}

// =============================================================================
// Helpers
// =============================================================================

async function calculateSHA256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isLikelyInlineAttachment(name: string, isInline: boolean): boolean {
  if (isInline) return true;
  const lowerName = name.toLowerCase();
  return INLINE_ATTACHMENT_SIGNATURES.some((sig) => lowerName.includes(sig));
}

// v2.3: Sanitize filename for Supabase Storage (no umlauts/special chars)
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

// =============================================================================
// Database Operations
// =============================================================================

async function updateProcessingStatus(
  documentId: string,
  status: "processing" | "done" | "error",
  error?: string,
  attachmentHashes?: string[]
): Promise<void> {
  const patchData: Record<string, unknown> = { processing_status: status };
  if (status === "done") patchData.processed_at = new Date().toISOString();
  if (status === "error" && error) patchData.processing_last_error = error;
  if (attachmentHashes) patchData.email_attachment_hashes = attachmentHashes;

  await fetch(`${SUPABASE_URL}/rest/v1/documents?id=eq.${documentId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patchData),
  });
}

async function getEmailDocument(documentId: string): Promise<EmailDocument | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/documents?id=eq.${documentId}&select=id,email_message_id,email_betreff,email_body_text,email_von_email,email_von_name,email_richtung`,
    {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY!,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${await response.text()}`);
  }

  const data = await response.json();
  return data[0] || null;
}

// v3.1: Update email attachment metadata
async function updateEmailAttachmentMeta(
  documentId: string,
  attachmentMetas: AttachmentMeta[]
): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/documents?id=eq.${documentId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_anhaenge_count: attachmentMetas.length,
        email_anhaenge_meta: attachmentMetas,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[EMAIL-META] Failed to update attachment metadata: ${errorText.substring(0, 100)}`);
  } else {
    console.log(`[EMAIL-META] Updated email with ${attachmentMetas.length} attachment(s) metadata`);
  }
}

// v2.6: Update email_kategorie (NOT documents.kategorie - avoids CHECK constraint violation)
async function updateEmailCategory(
  documentId: string,
  emailKategorie: string,
  zusammenfassung: string
): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/documents?id=eq.${documentId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // v2.6: Write to email_kategorie, NOT kategorie (which stays Email_Eingehend/Ausgehend)
        email_kategorie: emailKategorie,
        inhalt_zusammenfassung: zusammenfassung,
        kategorisiert_am: new Date().toISOString(),
        kategorisiert_von: "process-email-gpt",
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update email category: ${await response.text()}`);
  }
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  // Health check (no auth required for GET)
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        service: "process-email",
        version: "4.0.0",
        status: "ready",
        configured: {
          azure: !!(AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET),
          openai: !!OPENAI_API_KEY,
          supabase: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
          internalApiKey: !!INTERNAL_API_KEY,
        },
        features: {
          gptReasoningEffort: "medium",  // v4.0
          attachmentUpdateMode: true,     // v4.0
        },
        allowedExtensions: ALLOWED_EXTENSIONS,
        maxAttachmentSize: MAX_ATTACHMENT_SIZE_BYTES,
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

  // v2.4: API Key Validation (PFLICHT fuer POST)
  const authResult = validateApiKey(req);
  if (!authResult.valid) {
    return new Response(
      JSON.stringify({ error: authResult.reason }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body: ProcessEmailRequest = await req.json();

    if (!body.document_id || !body.email_message_id || !body.postfach) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: document_id, email_message_id, postfach" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing email document: ${body.document_id}`);

    await updateProcessingStatus(body.document_id, "processing");

    const doc = await getEmailDocument(body.document_id);
    if (!doc) {
      await updateProcessingStatus(body.document_id, "error", "Document not found");
      return new Response(
        JSON.stringify({ error: `Document not found: ${body.document_id}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 1: GPT Categorization
    console.log("Starting GPT categorization...");
    const { kategorie, zusammenfassung } = await categorizeWithGPT(
      doc.email_betreff || "",
      doc.email_body_text || "",
      doc.email_von_email || "",
      doc.email_richtung || "eingehend"
    );

    console.log(`Email category: ${kategorie}`);
    await updateEmailCategory(body.document_id, kategorie, zusammenfassung);

    // Step 2: Process Attachments
    let attachmentsProcessed = 0;
    const attachmentHashes: string[] = [];
    // v3.1: Collect attachment metadata for email_anhaenge_meta
    const attachmentMetas: AttachmentMeta[] = [];

    // v2.8: Debug info collection
    const _debug: Record<string, unknown> = {
      graph_fetch_url: null,
      graph_response_status: null,
      graph_attachment_count: null,
      attachments_raw: [] as Array<{
        name: string;
        size: number;
        contentType: string;
        isInline: boolean;
        hasContentBytes: boolean;
        decision: string;
        reason?: string;
        attachmentDocId?: string;
      }>,
    };

    try {
      const accessToken = await getAccessToken();

      // v2.9: Run comprehensive diagnostics FIRST
      const diagnostics = await diagnoseAttachments(
        body.postfach,
        body.email_message_id,
        accessToken
      );
      _debug.diagnostics = diagnostics;

      // v2.8: Build debug URL
      const graphUrl = `https://graph.microsoft.com/v1.0/users/${body.postfach}/messages/${body.email_message_id}/attachments`;
      _debug.graph_fetch_url = graphUrl.replace(body.postfach, body.postfach.replace(/(.{3}).*(@.*)/, "$1***$2"));

      const attachments = await fetchAttachments(
        body.postfach,
        body.email_message_id,
        accessToken
      );

      _debug.graph_response_status = 200; // If we got here, it was 200
      _debug.graph_attachment_count = attachments.length;

      console.log(`[ATTACH] Found ${attachments.length} total attachment(s) from Graph`);

      for (const attachment of attachments) {
        // v2.8: Collect raw attachment info
        const attachDebug: typeof _debug.attachments_raw extends Array<infer T> ? T : never = {
          name: attachment.name,
          size: attachment.size,
          contentType: attachment.contentType,
          isInline: attachment.isInline,
          hasContentBytes: !!attachment.contentBytes,
          decision: "pending",
        };

        // v3.1: Pass email subject for attachment document naming
        const result = await processAttachment(attachment, body.document_id, doc.email_betreff || "");

        // v3.1: Check for AttachmentResult (has attachmentDocId) vs error/null
        if (result && "attachmentDocId" in result) {
          attachmentHashes.push(result.hash);
          attachmentsProcessed++;
          attachDebug.decision = "YES";
          attachDebug.attachmentDocId = result.attachmentDocId;

          // v3.1: Collect metadata for email_anhaenge_meta
          attachmentMetas.push({
            id: result.attachmentDocId,
            name: result.fileName,
            size: result.fileSize,
            contentType: result.contentType,
            storagePath: result.storagePath,
            hash: result.hash,
          });
        } else {
          attachDebug.decision = "NO";
          // Determine reason - check ALL conditions
          if (!attachment.contentBytes) attachDebug.reason = "no contentBytes";
          else if (!isAllowedAttachment(attachment.name, attachment.contentType)) attachDebug.reason = "not in whitelist";
          else if (isLikelyInlineAttachment(attachment.name, attachment.isInline)) attachDebug.reason = "inline/signature";
          else if (attachment.size > MAX_ATTACHMENT_SIZE_BYTES) attachDebug.reason = "too large";
          else if (result && "error" in result) attachDebug.reason = result.error;
          else attachDebug.reason = "upload_or_processing_failed";
        }
        (_debug.attachments_raw as Array<unknown>).push(attachDebug);
      }

      // v3.1: Update email with attachment metadata
      if (attachmentMetas.length > 0) {
        await updateEmailAttachmentMeta(body.document_id, attachmentMetas);
      }
    } catch (attachmentError) {
      console.error(`[ATTACH] Attachment processing error: ${attachmentError}`);
      _debug.graph_error = String(attachmentError);
    }

    // v2.7: Final summary
    console.log(`[FINAL] ========================================`);
    console.log(`[FINAL] document_id: ${body.document_id}`);
    console.log(`[FINAL] attachments_processed: ${attachmentsProcessed}`);
    console.log(`[FINAL] email_attachment_hashes count: ${attachmentHashes.length}`);
    console.log(`[FINAL] processing_status: done`);
    console.log(`[FINAL] ========================================`);

    await updateProcessingStatus(body.document_id, "done", undefined, attachmentHashes);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: body.document_id,
        kategorie,
        zusammenfassung,
        attachments_processed: attachmentsProcessed,
        attachment_hashes: attachmentHashes,
        _debug, // v2.8: Debug info
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`Process-email error: ${error}`);
    try {
      const body = await req.clone().json();
      if (body?.document_id) {
        await updateProcessingStatus(body.document_id, "error", String(error));
      }
    } catch { /* ignore */ }
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
