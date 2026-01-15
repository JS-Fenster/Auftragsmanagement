// =============================================================================
// Scan Mailbox - Analyse bestehender E-Mails
// Version: 6 - 2026-01-14
// =============================================================================
// Ruft bestehende E-Mails aus einem Postfach ab zur Analyse.
// Speichert NICHTS - nur zur Uebersicht.
//
// v6 Changes:
// - Token Hardening: trim(), extractAadErrorCode(), safe logging
// - Token Caching aktiviert (wie andere Functions)
// - API-Key Protection (optional: SCAN_MAILBOX_API_KEY or INTERNAL_API_KEY)
// - (portiert von email-webhook v3.5)
//
// v5 Changes:
// - Folder-ID wird zu displayName aufgeloest
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Environment variables
const AZURE_TENANT_ID = Deno.env.get("AZURE_TENANT_ID");
const AZURE_CLIENT_ID = Deno.env.get("AZURE_CLIENT_ID");
const AZURE_CLIENT_SECRET = Deno.env.get("AZURE_CLIENT_SECRET");

// v6: API Key Protection (optional)
const SCAN_MAILBOX_API_KEY = Deno.env.get("SCAN_MAILBOX_API_KEY");
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");

// =============================================================================
// v6: API Key Validation (optional)
// =============================================================================

function validateApiKey(req: Request): { valid: boolean; reason?: string } {
  const expectedKey = SCAN_MAILBOX_API_KEY || INTERNAL_API_KEY;
  if (!expectedKey) {
    // No key configured = allow (backwards compatibility)
    return { valid: true };
  }

  const apiKeyHeader = req.headers.get("x-api-key");
  if (apiKeyHeader && apiKeyHeader === expectedKey) {
    console.log("[AUTH] Valid x-api-key header");
    return { valid: true };
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1] === expectedKey) {
      console.log("[AUTH] Valid Bearer token");
      return { valid: true };
    }
  }

  console.warn("[AUTH] Rejected - invalid or missing API key");
  return { valid: false, reason: "Invalid or missing API key" };
}

// =============================================================================
// v6: Token Hardening + Caching (portiert von email-webhook v3.5)
// =============================================================================

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// v6: Token Caching aktiviert
let cachedToken: { token: string; expiresAt: number } | null = null;

// Extract AADSTS error code from Azure AD error response
function extractAadErrorCode(errorText: string): string | null {
  const match = errorText.match(/AADSTS\d+/);
  return match ? match[0] : null;
}

async function getAccessToken(): Promise<string> {
  // v6: Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    throw new Error("Azure credentials not configured");
  }

  // v6 Hardening: trim whitespace from secret
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
    // v6: Safe logging - never log the secret
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

  // v6: Cache the token
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// =============================================================================
// Folder Listing
// =============================================================================

interface GraphFolder {
  id: string;
  displayName: string;
  parentFolderId: string;
  childFolderCount: number;
  totalItemCount: number;
  unreadItemCount: number;
}

interface FolderResponse {
  value: GraphFolder[];
}

interface FolderInfo {
  id: string;
  name: string;
  total: number;
  unread: number;
  subfolders: number;
}

async function listFolders(
  accessToken: string,
  mailbox: string,
  parentFolderId?: string
): Promise<FolderInfo[]> {
  let url: string;
  if (parentFolderId) {
    url = `https://graph.microsoft.com/v1.0/users/${mailbox}/mailFolders/${parentFolderId}/childFolders?$top=50`;
  } else {
    url = `https://graph.microsoft.com/v1.0/users/${mailbox}/mailFolders?$top=50`;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list folders: ${error}`);
  }

  const data: FolderResponse = await response.json();

  return data.value.map((folder) => ({
    id: folder.id,
    name: folder.displayName,
    total: folder.totalItemCount,
    unread: folder.unreadItemCount,
    subfolders: folder.childFolderCount,
  }));
}

async function listAllFoldersRecursive(
  accessToken: string,
  mailbox: string,
  parentId?: string,
  prefix: string = ""
): Promise<Array<FolderInfo & { path: string }>> {
  const folders = await listFolders(accessToken, mailbox, parentId);
  const result: Array<FolderInfo & { path: string }> = [];

  for (const folder of folders) {
    const path = prefix ? `${prefix}/${folder.name}` : folder.name;
    result.push({ ...folder, path });

    if (folder.subfolders > 0) {
      const subfolders = await listAllFoldersRecursive(
        accessToken,
        mailbox,
        folder.id,
        path
      );
      result.push(...subfolders);
    }
  }

  return result;
}

// =============================================================================
// Folder ID Resolution
// =============================================================================

const WELLKNOWN_FOLDERS: Record<string, string> = {
  inbox: "Inbox",
  sentitems: "Sent Items",
  drafts: "Drafts",
  deleteditems: "Deleted Items",
  junkemail: "Junk Email",
  outbox: "Outbox",
  archive: "Archive",
};

async function resolveFolderName(
  accessToken: string,
  mailbox: string,
  folderIdOrName: string
): Promise<string> {
  const lowerFolder = folderIdOrName.toLowerCase();
  if (WELLKNOWN_FOLDERS[lowerFolder]) {
    return WELLKNOWN_FOLDERS[lowerFolder];
  }

  if (folderIdOrName.startsWith("AAMk") || folderIdOrName.length > 50) {
    try {
      const url = `https://graph.microsoft.com/v1.0/users/${mailbox}/mailFolders/${folderIdOrName}?$select=displayName`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.displayName || folderIdOrName;
      }
    } catch (error) {
      console.warn(`Could not resolve folder name: ${error}`);
    }
  }

  return folderIdOrName;
}

// =============================================================================
// Email Fetching
// =============================================================================

interface GraphEmail {
  id: string;
  subject: string;
  bodyPreview: string;
  from?: {
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
  receivedDateTime: string;
  sentDateTime: string;
  hasAttachments: boolean;
  importance: string;
  isRead: boolean;
}

interface GraphResponse {
  value: GraphEmail[];
  "@odata.nextLink"?: string;
}

interface EmailSummary {
  id: string;
  datum: string;
  von_email: string;
  von_name: string;
  an: string;
  betreff: string;
  preview: string;
  hat_anhaenge: boolean;
  wichtigkeit: string;
  gelesen: boolean;
}

async function fetchEmails(
  accessToken: string,
  mailbox: string,
  folder: string,
  count: number
): Promise<EmailSummary[]> {
  const url = `https://graph.microsoft.com/v1.0/users/${mailbox}/mailFolders/${folder}/messages?$top=${count}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,from,toRecipients,receivedDateTime,sentDateTime,hasAttachments,importance,isRead`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch emails: ${error}`);
  }

  const data: GraphResponse = await response.json();

  return data.value.map((email) => ({
    id: email.id,
    datum: email.receivedDateTime || email.sentDateTime,
    von_email: email.from?.emailAddress?.address || "-",
    von_name: email.from?.emailAddress?.name || "-",
    an: email.toRecipients?.map((r) => r.emailAddress.address).join(", ") || "-",
    betreff: email.subject || "(kein Betreff)",
    preview: email.bodyPreview?.substring(0, 150) || "",
    hat_anhaenge: email.hasAttachments,
    wichtigkeit: email.importance,
    gelesen: email.isRead,
  }));
}

// =============================================================================
// Simple categorization guess based on subject/sender
// =============================================================================

function guessCategory(email: EmailSummary, folderName: string = ""): string {
  const betreff = email.betreff.toLowerCase();
  const von = email.von_email.toLowerCase();
  const preview = email.preview.toLowerCase();
  const folder = folderName.toLowerCase();

  // Bewerbungen
  if (betreff.includes("bewerbung") || betreff.includes("bewerbe") ||
      betreff.includes("lebenslauf") || betreff.includes("stellenanzeige") ||
      preview.includes("bewerbung") || preview.includes("bewerbe mich") ||
      folder.includes("bewerbung")) {
    return "Bewerbung";
  }

  // Lead-Anfragen
  if (von.includes("hubspot") || von.includes("notifications.hubspot") ||
      von.includes("@weru.de") || von.includes("noreply@weru") ||
      betreff.includes("produktfinder") || betreff.includes("lead") ||
      betreff.includes("angebotstool") || betreff.includes("weru-leadservice")) {
    return "Lead_Anfrage";
  }

  // BAFA / Foerderung
  if (von.includes("fe-bis.de") || von.includes("bafa") ||
      betreff.includes("zuwendungsbescheid") || betreff.includes("bafa") ||
      betreff.includes("foerderantrag")) {
    return "BAFA_Foerderung";
  }

  // Versicherung / Schaden
  if (von.includes("generali") || von.includes("allianz") || von.includes("versicherung") ||
      betreff.includes("versicherungsschaden") || betreff.includes("schadenmeldung")) {
    return "Versicherung_Schaden";
  }

  // Paketdienste
  if (von.includes("dhl") || von.includes("dpd") || von.includes("ups") ||
      von.includes("gls") || von.includes("hermes") || von.includes("fedex")) {
    return "Lieferstatus_Update";
  }

  // Online-Haendler
  if (von.includes("amazon") || von.includes("ebay")) {
    if (betreff.includes("bestellung") || betreff.includes("order")) {
      return "Bestellbestaetigung";
    }
    return "Bestellbestaetigung";
  }

  // Rechnungen
  if (betreff.includes("rechnung") || betreff.includes("invoice")) {
    if (folder.includes("ausgang") || folder.includes("sent")) {
      return "Rechnung_Gesendet";
    }
    return "Rechnung_Eingang";
  }

  // Auftragserteilung
  if (betreff.includes("auftragserteilung") || betreff.includes("auftrag erteilt") ||
      betreff.includes("beauftragung")) {
    return "Auftragserteilung";
  }

  // Bestellbestaetigung
  if (betreff.includes("bestellbestaetigung") || betreff.includes("auftragsbestaetigung") ||
      betreff.includes("order confirmation")) {
    return "Bestellbestaetigung";
  }

  // Angebote
  if (betreff.includes("angebot") || betreff.includes("offerte") || betreff.includes("quote")) {
    return "Angebot_Anforderung";
  }

  // Reklamation
  if (betreff.includes("reklamation") || betreff.includes("beschwerde") ||
      betreff.includes("mangel") || betreff.includes("maengelanzeige") ||
      preview.includes("reklamation") || preview.includes("reklamieren")) {
    return "Reklamation";
  }

  // Service/Reparatur
  if (betreff.includes("reparatur") || betreff.includes("defekt") ||
      betreff.includes("kaputt") || betreff.includes("funktioniert nicht") ||
      betreff.includes("sturmschaden") || betreff.includes("undicht") ||
      preview.includes("defekt") || preview.includes("reparatur")) {
    return "Serviceanfrage";
  }

  // Anforderung Unterlagen
  if (betreff.includes("bescheinigung") || betreff.includes("nachweis") ||
      betreff.includes("freistellung") || betreff.includes("unbedenklichkeit")) {
    return "Anforderung_Unterlagen";
  }

  // Termine
  if (betreff.includes("termin") || betreff.includes("montage") || betreff.includes("aufmass")) {
    return "Terminanfrage";
  }

  // Kontaktformular
  if (von.includes("website@") || betreff.includes("kontaktanfrage")) {
    return "Kundenanfrage";
  }

  // Anfragen allgemein
  if (betreff.includes("anfrage") || betreff.includes("bitte um angebot") ||
      betreff.includes("preisanfrage")) {
    return "Kundenanfrage";
  }

  // Newsletter/Werbung
  if (betreff.includes("newsletter") || von.includes("newsletter") ||
      von.includes("marketing") || von.includes("noreply") ||
      preview.includes("abmelden") || preview.includes("unsubscribe")) {
    return "Newsletter_Werbung";
  }

  // Antworten
  if (betreff.startsWith("re:") || betreff.startsWith("aw:") ||
      betreff.startsWith("antw:") || betreff.startsWith("fwd:") ||
      betreff.startsWith("wg:")) {
    return "Antwort_oder_Weiterleitung";
  }

  return "Sonstiges";
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Only allow GET
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // v6: API Key Validation (optional)
  const authResult = validateApiKey(req);
  if (!authResult.valid) {
    return new Response(
      JSON.stringify({ error: authResult.reason }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Parse parameters
  const mailbox = url.searchParams.get("mailbox") || "info@js-fenster.de";
  const action = url.searchParams.get("action") || "emails";
  const folder = url.searchParams.get("folder") || "inbox";
  const count = Math.min(parseInt(url.searchParams.get("count") || "50"), 200);

  // Health check (action=health)
  if (action === "health") {
    return new Response(
      JSON.stringify({
        service: "scan-mailbox",
        version: "6.0.0",
        status: "ready",
        configured: {
          azure: !!(AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET),
          apiKeyProtection: !!(SCAN_MAILBOX_API_KEY || INTERNAL_API_KEY),
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const accessToken = await getAccessToken();

    // Action: List Folders
    if (action === "folders") {
      console.log(`Listing folders for ${mailbox}...`);
      const folders = await listAllFoldersRecursive(accessToken, mailbox);
      folders.sort((a, b) => a.path.localeCompare(b.path));

      return new Response(
        JSON.stringify({
          mailbox,
          anzahl_ordner: folders.length,
          ordner: folders,
        }, null, 2),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Action: Scan Emails (default)
    console.log(`Scanning ${count} emails from ${mailbox}/${folder}...`);

    const folderDisplayName = await resolveFolderName(accessToken, mailbox, folder);
    console.log(`Folder resolved: ${folder} -> ${folderDisplayName}`);

    const emails = await fetchEmails(accessToken, mailbox, folder, count);

    const emailsWithGuess = emails.map((email) => ({
      ...email,
      kategorie_vermutung: guessCategory(email, folderDisplayName),
    }));

    const kategorieStats: Record<string, number> = {};
    for (const email of emailsWithGuess) {
      const kat = email.kategorie_vermutung;
      kategorieStats[kat] = (kategorieStats[kat] || 0) + 1;
    }

    const sortedStats = Object.entries(kategorieStats)
      .sort((a, b) => b[1] - a[1])
      .map(([kategorie, anzahl]) => ({ kategorie, anzahl }));

    return new Response(
      JSON.stringify({
        mailbox,
        folder,
        folder_name: folderDisplayName,
        anzahl: emails.length,
        statistik: sortedStats,
        emails: emailsWithGuess,
      }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`Scan error: ${error}`);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
