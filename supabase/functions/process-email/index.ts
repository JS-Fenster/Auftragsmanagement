// =============================================================================
// Process Email - GPT Categorization + Attachment Handling
// Version: 2.3 - 2026-01-14
// =============================================================================
// Wird von email-webhook aufgerufen nachdem E-Mail in DB gespeichert wurde.
//
// v2.3 Changes:
// - Fix: sanitizeFileName fuer Attachment-Pfade (Umlaute -> ASCII)
// - Fix: process-document Aufruf mit FormData statt JSON
//
// v2.2 Changes:
// - Token Hardening: trim(), extractAadErrorCode(), safe logging
// - (portiert von email-webhook v3.5)
//
// v2.1 Changes:
// - ImmutableId Header fuer stabile IDs bei Ordner-Verschiebungen
//
// v2.0 Changes:
// - Processing-Status Management (queued->processing->done/error)
// - Attachment Size Limit (25MB)
// - SHA-256 Hash fuer Attachment-Deduplizierung
// - Inline-Attachment Skip
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Environment variables
const AZURE_TENANT_ID = Deno.env.get("AZURE_TENANT_ID");
const AZURE_CLIENT_ID = Deno.env.get("AZURE_CLIENT_ID");
const AZURE_CLIENT_SECRET = Deno.env.get("AZURE_CLIENT_SECRET");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`GPT API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (VALID_CATEGORIES.includes(parsed.kategorie)) {
        return {
          kategorie: parsed.kategorie,
          zusammenfassung: parsed.zusammenfassung || betreff,
        };
      }
    }

    return {
      kategorie: "Sonstiges",
      zusammenfassung: betreff || "(GPT Parse-Fehler)",
    };
  } catch (error) {
    console.error(`GPT categorization error: ${error}`);
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

async function fetchAttachments(
  postfach: string,
  messageId: string,
  accessToken: string
): Promise<GraphAttachment[]> {
  const url = `https://graph.microsoft.com/v1.0/users/${postfach}/messages/${messageId}/attachments`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'IdType="ImmutableId"',
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch attachments: ${await response.text()}`);
    return [];
  }

  const data = await response.json();
  return data.value || [];
}

async function processAttachment(
  attachment: GraphAttachment,
  documentId: string,
  _postfach: string
): Promise<{ hash: string } | null> {
  if (!attachment.contentBytes) {
    console.log(`Attachment ${attachment.name} has no content - skipping`);
    return null;
  }

  if (!isAllowedAttachment(attachment.name, attachment.contentType)) {
    console.log(`Attachment ${attachment.name} not in whitelist - skipping`);
    return null;
  }

  if (isLikelyInlineAttachment(attachment.name, attachment.isInline)) {
    console.log(`Attachment ${attachment.name} is inline/signature - skipping`);
    return null;
  }

  if (attachment.size > MAX_ATTACHMENT_SIZE_BYTES) {
    console.log(`Attachment ${attachment.name} exceeds size limit (${attachment.size} > ${MAX_ATTACHMENT_SIZE_BYTES}) - skipping`);
    return null;
  }

  console.log(`Processing attachment: ${attachment.name} (${attachment.size} bytes)`);

  const binaryContent = Uint8Array.from(atob(attachment.contentBytes), (c) =>
    c.charCodeAt(0)
  );

  const safeFileName = sanitizeFileName(attachment.name);
  const storagePath = `email-attachments/${documentId}/${safeFileName}`;
  const storageUrl = `${SUPABASE_URL}/storage/v1/object/documents/${storagePath}`;

  const uploadResponse = await fetch(storageUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": attachment.contentType,
      "x-upsert": "true",
    },
    body: binaryContent,
  });

  if (!uploadResponse.ok) {
    console.error(`Failed to upload attachment: ${await uploadResponse.text()}`);
    return null;
  }

  console.log(`Uploaded attachment to: ${storagePath}`);

  const processableTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/tiff",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  // v2.3: Call process-document with FormData (correct format)
  if (processableTypes.includes(attachment.contentType)) {
    try {
      const processUrl = `${SUPABASE_URL}/functions/v1/process-document`;

      // Build FormData with the file blob
      const formData = new FormData();
      const blob = new Blob([binaryContent], { type: attachment.contentType });
      formData.append("file", blob, safeFileName);

      const processResponse = await fetch(processUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: formData,
      });

      if (processResponse.ok) {
        const result = await processResponse.json();
        console.log(`Triggered process-document for: ${attachment.name} -> ID: ${result.id || 'unknown'}`);
      } else {
        const errorText = await processResponse.text();
        console.warn(`process-document returned ${processResponse.status}: ${errorText.substring(0, 100)}`);
      }
    } catch (error) {
      console.log(`process-document not available: ${error}`);
    }
  }

  const hash = await calculateSHA256(binaryContent);
  console.log(`Attachment hash: ${hash.substring(0, 16)}...`);
  return { hash };
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

async function updateDocumentCategory(
  documentId: string,
  kategorie: string,
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
        kategorie,
        inhalt_zusammenfassung: zusammenfassung,
        kategorisiert_am: new Date().toISOString(),
        kategorisiert_von: "process-email-gpt",
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update document: ${await response.text()}`);
  }
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  // Health check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        service: "process-email",
        version: "2.3.0",
        status: "ready",
        configured: {
          azure: !!(AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET),
          openai: !!OPENAI_API_KEY,
          supabase: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
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

    console.log(`Category: ${kategorie}`);
    await updateDocumentCategory(body.document_id, kategorie, zusammenfassung);

    // Step 2: Process Attachments
    let attachmentsProcessed = 0;
    const attachmentHashes: string[] = [];

    try {
      const accessToken = await getAccessToken();
      const attachments = await fetchAttachments(
        body.postfach,
        body.email_message_id,
        accessToken
      );

      console.log(`Found ${attachments.length} attachments`);

      for (const attachment of attachments) {
        const result = await processAttachment(attachment, body.document_id, body.postfach);
        if (result) {
          attachmentHashes.push(result.hash);
          attachmentsProcessed++;
        }
      }
    } catch (attachmentError) {
      console.error(`Attachment processing error: ${attachmentError}`);
    }

    await updateProcessingStatus(body.document_id, "done", undefined, attachmentHashes);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: body.document_id,
        kategorie,
        zusammenfassung,
        attachments_processed: attachmentsProcessed,
        attachment_hashes: attachmentHashes,
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
