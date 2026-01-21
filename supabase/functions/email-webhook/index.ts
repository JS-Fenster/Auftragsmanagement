// =============================================================================
// E-Mail Webhook - Microsoft Graph Change Notifications
// Version: 3.11 - 2026-01-21
// =============================================================================
// Empfaengt Notifications von Microsoft Graph wenn neue E-Mails ankommen
// oder E-Mails gesendet werden.
//
// Aenderungen v3.11:
// - NEU: Ingest-Filter - Noise-Emails (FRITZ!, Tracking) werden NICHT gespeichert
// - Filter-Regeln aus email_ingest_filters Tabelle (konfigurierbar)
// - Gefilterte Emails werden in ignored_emails geloggt
//
// Aenderungen v3.10:
// - NEU: source='email' bei DB-Insert (fuer Constraint + Analytics)
//
// Aenderungen v3.9.1:
// - HOTFIX: DB-Spalte heisst email_postfach, nicht postfach
//
// Aenderungen v3.9:
// - FIX: email_postfach via Subscription-Lookup (nicht Resource-Parsing)
// - Graph sendet GUID in resource -> unbrauchbar fuer Attachment-Fetch
// - Postfach jetzt IMMER aus email_subscriptions.email_postfach (E-Mail-Adresse)
// - Fehlerfall: processing_status=error statt silent "unknown"
//
// Aenderungen v3.8:
// - FIX: kategorie auf Email_Eingehend/Email_Ausgehend (statt Sonstiges_Eingehend)
// - Observability: DB-Fehler werden mit code/constraint geloggt
//
// Aenderungen v3.7:
// - FIX: Graph URL robust bauen (verhindert "v1.0users" statt "v1.0/users")
// - Safety Log: Bei Fetch-Fehler wird konstruierte URL (sanitized) geloggt
//
// Aenderungen v3.6:
// - process-email Aufruf mit x-api-key Header (INTERNAL_API_KEY)
// - Kompatibilitaet mit process-email v2.4 API-Key Pflicht
//
// Aenderungen v3.5:
// - Token Hardening: trim() vor Request, sichere Fehlerausgabe
// - AADSTS error code Parsing mit Diagnose
// - Nie Secrets loggen
//
// Aenderungen v3.4:
// - Fix: Resource-Vergleich nur wenn Formate kompatibel (GUID vs Email)
// - Graph sendet GUID-Format, DB hat Email-Format -> Skip Vergleich
//
// Aenderungen v3.3:
// - Health-Endpoint zeigt subscription_count_db, active_count_db, degraded status
// - Strengere Validierung: tenantId-Check, resource-Match gegen DB
// - Detailliertes Logging: Reject-Grund wird immer ausgegeben
//
// Aenderungen v3.2:
// - ImmutableId Header fuer stabile IDs bei Ordner-Verschiebungen
//
// Aenderungen v3.1:
// - Subscription-Validierung gegen email_subscriptions Tabelle
// - Unbekannte subscriptionIds werden abgelehnt
//
// Aenderungen v3.0:
// - Composite Unique Constraint (email_postfach, email_message_id)
// - Processing-Status Logic (pending->queued->processing->done/error)
// - Nur process-email triggern wenn status != done
//
// Aenderungen v2.0:
// - ValidationToken Handling verbessert (Change 1)
// - Security: clientState + x-webhook-secret Header (Change 2)
// - Background Processing fuer schnelle Antwort (Change 3)
// - Upsert statt Insert fuer Idempotenz (Change 4)
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Types for Microsoft Graph Notifications
interface ChangeNotification {
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  changeType: "created" | "updated" | "deleted";
  resource: string;
  resourceData: {
    "@odata.type": string;
    "@odata.id": string;
    "@odata.etag": string;
    id: string;
  };
  clientState?: string;
  tenantId: string;
}

interface NotificationPayload {
  value: ChangeNotification[];
}

// Environment variables
const AZURE_TENANT_ID = Deno.env.get("AZURE_TENANT_ID");
const AZURE_CLIENT_ID = Deno.env.get("AZURE_CLIENT_ID");
const AZURE_CLIENT_SECRET = Deno.env.get("AZURE_CLIENT_SECRET");
const EMAIL_WEBHOOK_CLIENT_STATE = Deno.env.get("EMAIL_WEBHOOK_CLIENT_STATE") || "js-fenster-email-webhook-secret";
const EMAIL_WEBHOOK_SECRET = Deno.env.get("EMAIL_WEBHOOK_SECRET"); // Optional additional header secret
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// v3.6: API Key for internal process-email calls
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");

// =============================================================================
// Microsoft Graph Authentication
// =============================================================================

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

// Extract AADSTS error code from Azure AD error response
function extractAadErrorCode(errorText: string): string | null {
  const match = errorText.match(/AADSTS\d+/);
  return match ? match[0] : null;
}

async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    throw new Error("Azure credentials not configured");
  }

  // Hardening: trim whitespace from secret
  const clientSecret = AZURE_CLIENT_SECRET.trim();

  const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
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
    // Safe logging: never log the secret, only identifiers and error codes
    console.error(`[TOKEN] Failed - Tenant: ${AZURE_TENANT_ID}, Client: ${AZURE_CLIENT_ID}, Error: ${errorCode || 'unknown'}`);
    if (errorCode === "AADSTS7000215") {
      console.error("[TOKEN] Diagnosis: Invalid client secret (wrong value or expired)");
    }
    throw new Error(`Failed to get access token: ${errorCode || error.substring(0, 100)}`);
  }

  const data: TokenResponse = await response.json();

  // Cache the token
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// =============================================================================
// Email Processing
// =============================================================================

interface EmailMessage {
  id: string;
  internetMessageId: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body: {
    contentType: string;
    content: string;
  };
  from: {
    emailAddress: {
      address: string;
      name: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      address: string;
      name: string;
    };
  }>;
  ccRecipients: Array<{
    emailAddress: {
      address: string;
      name: string;
    };
  }>;
  receivedDateTime: string;
  sentDateTime: string;
  hasAttachments: boolean;
  importance: string;
  isRead: boolean;
  flag: {
    flagStatus: string;
  };
  categories: string[];
}

async function fetchEmailDetails(
  resource: string,
  accessToken: string
): Promise<EmailMessage> {
  // v3.7: Robust URL building - ensure resource starts with /
  const normalizedResource = resource.startsWith("/") ? resource : `/${resource}`;
  const selectFields = "id,internetMessageId,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,hasAttachments,importance,isRead,flag,categories";

  // Build URL safely using URL constructor
  const graphUrl = new URL(`/v1.0${normalizedResource}`, "https://graph.microsoft.com");
  graphUrl.searchParams.set("$select", selectFields);
  const url = graphUrl.toString();

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      // v3.2: Request ImmutableId for stable IDs across folder moves
      Prefer: 'IdType="ImmutableId"',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    // v3.7: Safety log - show sanitized URL for debugging (messageId is ok, no tokens)
    const sanitizedUrl = url.replace(/Bearer [^"]+/, "Bearer [REDACTED]");
    console.error(`[GRAPH] Fetch failed - URL: ${sanitizedUrl}`);
    console.error(`[GRAPH] Error: ${error.substring(0, 500)}`);
    throw new Error(`Failed to fetch email: ${error}`);
  }

  return await response.json();
}

function extractUserFromResource(resource: string): string {
  // Extract user email from resource like "/users/info@js-fenster.de/messages/..."
  const match = resource.match(/\/users\/([^\/]+)/);
  return match ? match[1] : "unknown";
}

function extractFolderFromResource(resource: string): "eingehend" | "ausgehend" {
  // Check if it's from sent items folder
  if (resource.toLowerCase().includes("sentitems")) {
    return "ausgehend";
  }
  return "eingehend";
}

// =============================================================================
// v3.11: Email Ingest Filter - Check against configurable rules
// =============================================================================

interface FilterResult {
  shouldDrop: boolean;
  filterId: string | null;
  filterReason: string | null;
}

async function checkEmailAgainstFilters(
  email: EmailMessage,
  postfach: string
): Promise<FilterResult> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // No DB connection - skip filtering (backwards compatible)
    return { shouldDrop: false, filterId: null, filterReason: null };
  }

  const subject = email.subject || "";
  const fromEmail = email.from?.emailAddress?.address || "";
  const bodyPreview = email.bodyPreview || "";

  try {
    // Call the PostgreSQL function to check filters
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/check_email_against_filters`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          p_subject: subject,
          p_from_email: fromEmail,
          p_body_preview: bodyPreview.substring(0, 500),
        }),
      }
    );

    if (!response.ok) {
      console.warn(`[FILTER] DB function call failed: ${response.status}`);
      return { shouldDrop: false, filterId: null, filterReason: null };
    }

    const results = await response.json();
    // Function returns array with single row
    const result = Array.isArray(results) ? results[0] : results;

    if (result?.should_drop) {
      console.log(`[FILTER] Email matched filter: ${result.filter_reason}`);
      console.log(`[FILTER] Subject: "${subject.substring(0, 50)}..." From: ${fromEmail}`);

      // Log to ignored_emails table
      await logIgnoredEmail(
        postfach,
        email.id,
        result.filter_id,
        result.filter_reason,
        subject,
        fromEmail,
        bodyPreview
      );

      return {
        shouldDrop: true,
        filterId: result.filter_id,
        filterReason: result.filter_reason,
      };
    }

    return { shouldDrop: false, filterId: null, filterReason: null };
  } catch (error) {
    console.warn(`[FILTER] Error checking filters: ${error}`);
    // On error, don't drop - backwards compatible
    return { shouldDrop: false, filterId: null, filterReason: null };
  }
}

async function logIgnoredEmail(
  postfach: string,
  messageId: string,
  filterId: string | null,
  reason: string,
  subject: string,
  fromEmail: string,
  bodyPreview: string
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;

  const fromDomain = fromEmail.split("@")[1] || null;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/ignored_emails`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Prefer": "resolution=ignore-duplicates", // Idempotenz
        },
        body: JSON.stringify({
          email_postfach: postfach,
          email_message_id: messageId,
          matched_filter_id: filterId,
          matched_reason: reason,
          subject: subject.substring(0, 500),
          from_email: fromEmail,
          from_domain: fromDomain,
          body_preview: bodyPreview.substring(0, 500),
        }),
      }
    );

    if (!response.ok) {
      console.warn(`[FILTER] Failed to log ignored email: ${response.status}`);
    } else {
      console.log(`[FILTER] Logged ignored email to ignored_emails table`);
    }
  } catch (error) {
    console.warn(`[FILTER] Error logging ignored email: ${error}`);
  }
}

// =============================================================================
// Supabase Storage
// =============================================================================

async function saveEmailToDatabase(
  email: EmailMessage,
  postfach: string,
  richtung: "eingehend" | "ausgehend"
): Promise<{ id: string; wasInserted: boolean; shouldProcess: boolean } | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase credentials not configured");
  }

  // Convert recipients to JSONB format
  const anListe = email.toRecipients.map((r) => ({
    email: r.emailAddress.address,
    name: r.emailAddress.name,
  }));

  const ccListe = email.ccRecipients.map((r) => ({
    email: r.emailAddress.address,
    name: r.emailAddress.name,
  }));

  // Extract plain text from HTML body if needed
  let bodyText = "";
  if (email.body.contentType === "text") {
    bodyText = email.body.content;
  } else {
    // Simple HTML to text conversion (basic)
    bodyText = email.body.content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  // v3.8: Use proper Email categories based on direction
  const emailKategorie = richtung === "eingehend" ? "Email_Eingehend" : "Email_Ausgehend";

  const documentData = {
    dokument_typ: "email",
    kategorie: emailKategorie,
    source: "email",

    // E-Mail Identifikation
    email_message_id: email.id,
    email_conversation_id: email.conversationId,
    email_internet_message_id: email.internetMessageId,

    // E-Mail Metadaten
    email_richtung: richtung,
    email_postfach: postfach,

    // Absender
    email_von_email: email.from?.emailAddress?.address,
    email_von_name: email.from?.emailAddress?.name,

    // Empfaenger
    email_an_liste: anListe,
    email_cc_liste: ccListe,

    // Inhalt
    email_betreff: email.subject,
    email_body_text: bodyText.substring(0, 50000), // Limit to 50k chars
    email_body_html: email.body.contentType === "html" ? email.body.content : null,

    // Zeitstempel
    email_empfangen_am: email.receivedDateTime,
    email_gesendet_am: email.sentDateTime,

    // Anhaenge
    email_hat_anhaenge: email.hasAttachments,

    // Status
    email_ist_gelesen: email.isRead,
    email_wichtigkeit: email.importance?.toLowerCase(),
    email_ms_kategorien: email.categories,
    email_ms_flag: email.flag,

    // Placeholder for document URL (required field)
    dokument_url: `email://${postfach}/${email.id}`,

    // Will be filled by GPT categorization later
    inhalt_zusammenfassung: email.bodyPreview?.substring(0, 500),

    // Processing status (v3.0)
    processing_status: "queued",
    processing_attempts: 0,
  };

  // Use UPSERT with composite unique constraint (v3.0)
  // ON CONFLICT on (email_postfach, email_message_id)
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/documents?on_conflict=email_postfach,email_message_id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      body: JSON.stringify(documentData),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    // v3.8: Observability - parse and log DB error details
    let errorCode = "unknown";
    let constraintName = "unknown";
    try {
      const errorJson = JSON.parse(errorText);
      errorCode = errorJson.code || errorJson.error?.code || "unknown";
      // Extract constraint name from message if present
      const constraintMatch = errorText.match(/constraint "([^"]+)"/);
      if (constraintMatch) constraintName = constraintMatch[1];
    } catch {
      // Not JSON, try regex on raw text
      const codeMatch = errorText.match(/\b(\d{5})\b/);
      if (codeMatch) errorCode = codeMatch[1];
      const constraintMatch = errorText.match(/constraint "([^"]+)"/);
      if (constraintMatch) constraintName = constraintMatch[1];
    }
    console.error(`[DB] Insert failed - code=${errorCode} constraint=${constraintName} status=${response.status}`);
    console.error(`[DB] Error detail: ${errorText.substring(0, 300)}`);
    throw new Error(`Failed to save email: code=${errorCode} constraint=${constraintName}`);
  }

  const result = await response.json();
  const doc = result[0];
  const wasInserted = doc?.created_at === doc?.updated_at;
  const shouldProcess = doc?.processing_status !== "done";

  console.log(`Email ${wasInserted ? "inserted" : "updated"}: ${email.id} (process: ${shouldProcess})`);
  return { id: doc?.id, wasInserted, shouldProcess };
}

// =============================================================================
// Background Processing Helper (Change 3)
// v3.9: postfach MUSS aus Subscription kommen (nicht aus Resource parsen)
// =============================================================================

async function processNotificationInBackground(
  notification: ChangeNotification,
  postfach: string | undefined // v3.9: E-Mail-Adresse aus Subscription
): Promise<void> {
  // v3.9: CRITICAL - Kein Insert ohne gültiges Postfach!
  // Ohne echte E-Mail-Adresse kann process-email keine Attachments laden
  if (!postfach || postfach === "unknown") {
    const resourceUser = extractUserFromResource(notification.resource);
    console.error(`[BG] ABORT: No valid postfach from subscription lookup`);
    console.error(`[BG] resource contained: ${resourceUser} (unusable GUID or missing)`);
    console.error(`[DB] subscription lookup failed - not inserting email to prevent orphaned documents`);
    return;
  }

  // v3.9: Log that mailbox was resolved from subscription (masked for privacy)
  const maskedPostfach = postfach.replace(/(.{3}).*(@.*)/, "$1***$2");
  console.log(`[BG] mailbox resolved from subscription: ${maskedPostfach}`);

  // Check if resource uses GUID format (would have failed with old approach)
  if (resourceUsesGuidFormat(notification.resource)) {
    console.log(`[BG] resource user token was GUID -> using subscription mailbox`);
  }

  try {
    // Get access token
    const accessToken = await getAccessToken();

    // v3.9: postfach kommt jetzt aus Parameter (Subscription), nicht aus Resource
    const richtung = extractFolderFromResource(notification.resource);

    console.log(`[BG] Processing email for ${maskedPostfach} (${richtung})`);

    // Fetch full email details
    const email = await fetchEmailDetails(notification.resource, accessToken);

    // v3.11: Check against ingest filters BEFORE saving to database
    const filterResult = await checkEmailAgainstFilters(email, postfach);
    if (filterResult.shouldDrop) {
      console.log(`[BG] Email DROPPED by filter: ${filterResult.filterReason}`);
      console.log(`[BG] Subject: "${(email.subject || '').substring(0, 60)}"`);
      console.log(`[BG] From: ${email.from?.emailAddress?.address || 'unknown'}`);
      // Do NOT insert into documents, do NOT trigger process-email
      return;
    }

    // Save to database (upsert) - v3.9: mit echtem Postfach aus Subscription
    const result = await saveEmailToDatabase(email, postfach, richtung);

    if (result) {
      console.log(`[BG] Email saved with ID: ${result.id}`);

      // Only trigger process-email if not already done (v3.0 idempotency)
      if (result.shouldProcess && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const processUrl = `${SUPABASE_URL}/functions/v1/process-email`;

          // v3.6: Build headers with x-api-key for process-email authentication
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (INTERNAL_API_KEY) {
            headers["x-api-key"] = INTERNAL_API_KEY;
            console.log("[BG] Using x-api-key for process-email call");
          } else {
            console.warn("[BG] INTERNAL_API_KEY not set - process-email call may fail with 401");
          }

          const processResponse = await fetch(processUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
              document_id: result.id,
              email_message_id: email.id,
              postfach: postfach,
            }),
          });

          if (processResponse.ok) {
            console.log(`[BG] Triggered process-email for ${result.id}`);
          } else {
            console.warn(`[BG] process-email returned ${processResponse.status}`);
          }
        } catch (processError) {
          // Non-fatal: process-email might not be deployed yet
          console.log(`[BG] process-email not available: ${processError}`);
        }
      } else if (!result.shouldProcess) {
        console.log(`[BG] Email already processed - skipping process-email`);
      }
    }
  } catch (error) {
    console.error(`[BG] Error processing notification: ${error}`);
  }
}

// =============================================================================
// Security Validation (Change 2 + v3.1 DB validation + v3.3 strict validation)
// v3.4: Fix resource mismatch - Graph sends GUID format, DB has email format
// =============================================================================

// Cache for validated subscriptions: subscriptionId -> { resource, postfach }
const validatedSubscriptions = new Map<string, { resource: string; postfach: string }>();

// Check if notification resource uses GUID format (not comparable to email format)
// Graph sends: Users/<guid>/Messages/<id> but subscription uses /users/<email>/mailFolders/...
function resourceUsesGuidFormat(resource: string): boolean {
  // GUID pattern: 8-4-4-4-12 hex chars
  const guidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
  return guidPattern.test(resource);
}

// Check if two resources are comparable (same format)
function resourcesAreComparable(notificationResource: string, dbResource: string): boolean {
  const notificationUsesGuid = resourceUsesGuidFormat(notificationResource);
  const dbUsesGuid = resourceUsesGuidFormat(dbResource);
  // Only compare if both use same format (both GUID or both email)
  return notificationUsesGuid === dbUsesGuid;
}

interface SubscriptionValidationResult {
  valid: boolean;
  reason?: string;
  dbResource?: string;
  postfach?: string; // v3.9: E-Mail-Adresse aus email_subscriptions
}

async function validateSubscriptionInDb(
  subscriptionId: string,
  notificationResource?: string
): Promise<SubscriptionValidationResult> {
  // Check cache first
  const cached = validatedSubscriptions.get(subscriptionId);
  if (cached) {
    // v3.4: Only validate resource match if formats are comparable
    // Graph notifications use GUID format, subscriptions use email format - skip comparison
    if (notificationResource && cached.resource && resourcesAreComparable(notificationResource, cached.resource)) {
      const normalizedNotification = normalizeResource(notificationResource);
      const normalizedDb = normalizeResource(cached.resource);
      if (normalizedNotification !== normalizedDb) {
        return {
          valid: false,
          reason: `resource mismatch (notification: ${notificationResource}, db: ${cached.resource})`,
          dbResource: cached.resource,
        };
      }
    }
    // v3.9: Return cached postfach
    return { valid: true, dbResource: cached.resource, postfach: cached.postfach };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // If DB not configured, skip this check (backwards compatibility)
    console.warn("[SEC] DB not configured - skipping subscription validation");
    return { valid: true };
  }

  try {
    // v3.9: Also fetch postfach (E-Mail-Adresse) for attachment processing
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/email_subscriptions?subscription_id=eq.${subscriptionId}&is_active=eq.true&select=subscription_id,resource,email_postfach`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
      }
    );

    if (!response.ok) {
      console.error(`[SEC] Failed to query subscriptions: ${response.status}`);
      // On error, allow (fail open for availability)
      return { valid: true };
    }

    const results = await response.json();

    if (results.length === 0) {
      return { valid: false, reason: "unknown subscriptionId" };
    }

    const dbSubscription = results[0];
    const dbResource = dbSubscription.resource;
    const dbPostfach = dbSubscription.email_postfach; // v3.9: E-Mail-Adresse

    // v3.9: Cache the valid subscription with resource AND postfach
    if (dbPostfach) {
      validatedSubscriptions.set(subscriptionId, { resource: dbResource, postfach: dbPostfach });
    }

    // v3.4: Only validate resource match if formats are comparable
    // Graph notifications use GUID format, subscriptions use email format - skip comparison
    if (notificationResource && dbResource && resourcesAreComparable(notificationResource, dbResource)) {
      const normalizedNotification = normalizeResource(notificationResource);
      const normalizedDb = normalizeResource(dbResource);
      if (normalizedNotification !== normalizedDb) {
        return {
          valid: false,
          reason: `resource mismatch (notification: ${notificationResource}, db: ${dbResource})`,
          dbResource,
        };
      }
    }

    // v3.9: Return postfach for use in email processing
    return { valid: true, dbResource, postfach: dbPostfach };
  } catch (error) {
    console.error(`[SEC] Subscription validation error: ${error}`);
    // On error, allow (fail open for availability)
    return { valid: true };
  }
}

// Normalize resource path for comparison (lowercase, trim trailing slashes)
function normalizeResource(resource: string): string {
  return resource.toLowerCase().replace(/\/+$/, "");
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
  postfach?: string; // v3.9: E-Mail-Adresse aus Subscription
}

async function validateRequest(
  req: Request,
  notification?: ChangeNotification
): Promise<ValidationResult> {
  // Check x-webhook-secret header if configured
  if (EMAIL_WEBHOOK_SECRET) {
    const headerSecret = req.headers.get("x-webhook-secret");
    if (headerSecret !== EMAIL_WEBHOOK_SECRET) {
      return { valid: false, reason: "invalid x-webhook-secret header" };
    }
  }

  // Check clientState in notification payload (Microsoft Graph sends this)
  if (notification && notification.clientState) {
    if (notification.clientState !== EMAIL_WEBHOOK_CLIENT_STATE) {
      return {
        valid: false,
        reason: `clientState mismatch (got: ${notification.clientState})`,
      };
    }
  }

  // v3.3: Check tenantId against expected Azure tenant
  if (notification && notification.tenantId && AZURE_TENANT_ID) {
    if (notification.tenantId !== AZURE_TENANT_ID) {
      return {
        valid: false,
        reason: `tenantId mismatch (got: ${notification.tenantId}, expected: ${AZURE_TENANT_ID})`,
      };
    }
  }

  // v3.1 + v3.3 + v3.9: Check subscriptionId and get postfach from email_subscriptions table
  if (notification && notification.subscriptionId) {
    const result = await validateSubscriptionInDb(
      notification.subscriptionId,
      notification.resource
    );
    if (!result.valid) {
      return { valid: false, reason: result.reason };
    }
    // v3.9: Return postfach for use in email processing
    return { valid: true, postfach: result.postfach };
  }

  return { valid: true };
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // ==========================================================================
  // Microsoft Graph Subscription Validation (Change 1)
  // ==========================================================================
  // When creating a subscription, Microsoft sends a GET request with
  // validationToken query parameter. We MUST echo it back as plain text.

  const validationToken = url.searchParams.get("validationToken");
  if (validationToken) {
    // This can come via GET or POST - handle both
    console.log("Subscription validation request received");
    return new Response(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // ==========================================================================
  // Handle POST - Change Notifications
  // ==========================================================================

  if (req.method === "POST") {
    try {
      const payload: NotificationPayload = await req.json();
      const notificationCount = payload.value?.length || 0;

      console.log(`Received ${notificationCount} notifications`);

      // Return 202 IMMEDIATELY, process in background (Change 3)
      // This prevents Microsoft Graph from timing out and retrying
      // v3.9: Store notification WITH postfach from subscription lookup
      const validNotifications: Array<{ notification: ChangeNotification; postfach: string | undefined }> = [];

      for (const notification of payload.value || []) {
        // Security check (Change 2 + v3.1 + v3.3 + v3.9 strict validation + postfach lookup)
        const validation = await validateRequest(req, notification);
        if (!validation.valid) {
          console.warn(`[SEC] Rejected notification: ${validation.reason} (subscriptionId: ${notification.subscriptionId})`);
          continue;
        }

        // Only process "created" events (new emails)
        if (notification.changeType !== "created") {
          console.log(`Skipping ${notification.changeType} event`);
          continue;
        }

        // v3.9: Store notification with postfach from validation (subscription lookup)
        validNotifications.push({ notification, postfach: validation.postfach });
      }

      // Schedule background processing for all valid notifications
      // Using EdgeRuntime.waitUntil to keep function alive after response
      if (validNotifications.length > 0) {
        const backgroundPromise = Promise.all(
          // v3.9: Pass postfach to background processing
          validNotifications.map((item) => processNotificationInBackground(item.notification, item.postfach))
        );

        // @ts-ignore - EdgeRuntime.waitUntil is available in Supabase Edge Functions
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
          EdgeRuntime.waitUntil(backgroundPromise);
        } else {
          // Fallback: await directly (will delay response but works)
          await backgroundPromise;
        }
      }

      // Always return 202 Accepted to Microsoft
      return new Response(
        JSON.stringify({
          status: "accepted",
          received: notificationCount,
          processing: validNotifications.length,
        }),
        {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error(`Webhook error: ${error}`);
      // Still return 202 to prevent Microsoft from retrying
      return new Response(
        JSON.stringify({ status: "accepted", error: String(error) }),
        {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // ==========================================================================
  // Health Check / Info (GET without validationToken)
  // ==========================================================================

  // Fetch subscription counts from DB for health check
  let subscriptionCountDb = 0;
  let subscriptionActiveCountDb = 0;
  let dbHealthy = false;
  let dbError: string | null = null;

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const countResp = await fetch(
        `${SUPABASE_URL}/rest/v1/email_subscriptions?select=subscription_id,is_active`,
        {
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
          },
        }
      );

      if (countResp.ok) {
        const rows = await countResp.json();
        subscriptionCountDb = rows.length;
        subscriptionActiveCountDb = rows.filter((r: { is_active: boolean }) => r.is_active).length;
        dbHealthy = true;
      } else {
        dbError = `DB query failed: ${countResp.status}`;
      }
    } catch (e) {
      dbError = `DB error: ${e}`;
    }
  }

  // Determine overall status
  let overallStatus = "ready";
  let statusMessage: string | null = null;

  if (!dbHealthy && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    overallStatus = "error";
    statusMessage = dbError || "Database unreachable";
  } else if (subscriptionActiveCountDb === 0 && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    overallStatus = "degraded";
    statusMessage = "email_subscriptions empty - run manage-subscriptions.mjs sync";
  }

  return new Response(
    JSON.stringify({
      service: "email-webhook",
      version: "3.10.0",
      status: overallStatus,
      message: statusMessage,
      configured: {
        azure: !!(AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET),
        supabase: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
        webhookSecret: !!EMAIL_WEBHOOK_SECRET,
        subscriptionValidation: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
        internalApiKey: !!INTERNAL_API_KEY,
      },
      subscriptions: {
        count_db: subscriptionCountDb,
        active_count_db: subscriptionActiveCountDb,
        db_healthy: dbHealthy,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
});
