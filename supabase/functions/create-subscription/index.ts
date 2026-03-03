// =============================================================================
// Create Subscription - Create new Microsoft Graph Email Subscriptions
// Version: 1.0.0 - 2026-01-16
// =============================================================================
// Erstellt Microsoft Graph Subscriptions fuer E-Mail Benachrichtigungen.
// Unterstuetzt inbox und sentitems Folder.
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const AZURE_TENANT_ID = Deno.env.get("AZURE_TENANT_ID");
const AZURE_CLIENT_ID = Deno.env.get("AZURE_CLIENT_ID");
const AZURE_CLIENT_SECRET = Deno.env.get("AZURE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SVC_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");

// Webhook URL for Microsoft Graph notifications
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/email-webhook`;
const CLIENT_STATE = "js-fenster-email-webhook-secret";

interface CreateSubscriptionRequest {
  email_postfach: string;
  folders?: string[];  // Default: ["inbox", "sentitems"]
}

interface GraphSubscription {
  id: string;
  resource: string;
  changeType: string;
  notificationUrl: string;
  clientState: string;
  expirationDateTime: string;
}

// =============================================================================
// Token Management
// =============================================================================

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    throw new Error("Azure credentials not configured");
  }

  const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      client_secret: AZURE_CLIENT_SECRET.trim(),
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error.substring(0, 200)}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// =============================================================================
// Graph Subscription Creation
// =============================================================================

async function createGraphSubscription(
  accessToken: string,
  emailPostfach: string,
  folder: string
): Promise<GraphSubscription> {
  const resource = `/users/${emailPostfach}/mailFolders/${folder}/messages`;

  // Microsoft Graph subscriptions expire after max 3 days for mail
  const expirationDateTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  console.log(`[CREATE] Creating subscription for ${emailPostfach}/${folder}`);
  console.log(`[CREATE] Webhook URL: ${WEBHOOK_URL}`);
  console.log(`[CREATE] Expiration: ${expirationDateTime}`);

  const response = await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      changeType: "created,updated",
      notificationUrl: WEBHOOK_URL,
      resource: resource,
      expirationDateTime: expirationDateTime,
      clientState: CLIENT_STATE,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[CREATE] Graph API error: ${response.status} - ${errorText}`);
    throw new Error(`Failed to create Graph subscription: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const subscription: GraphSubscription = await response.json();
  console.log(`[CREATE] Success! Subscription ID: ${subscription.id}`);
  return subscription;
}

// =============================================================================
// Database Operations
// =============================================================================

async function checkExistingSubscription(emailPostfach: string, folder: string): Promise<boolean> {
  const resource = `/users/${emailPostfach}/mailFolders/${folder}/messages`;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/email_subscriptions?email_postfach=eq.${encodeURIComponent(emailPostfach)}&resource=eq.${encodeURIComponent(resource)}&select=id`,
    {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
    }
  );

  if (!response.ok) return false;
  const data = await response.json();
  return data.length > 0;
}

async function saveSubscription(
  emailPostfach: string,
  subscription: GraphSubscription
): Promise<void> {
  const data = {
    email_postfach: emailPostfach,
    subscription_id: subscription.id,
    resource: subscription.resource,
    client_state: subscription.clientState,
    expires_at: subscription.expirationDateTime,
    last_renewal_at: new Date().toISOString(),
    is_active: true,
  };

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/email_subscriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to save subscription: ${errorText}`);
  }

  console.log(`[DB] Saved subscription for ${emailPostfach}/${subscription.resource}`);
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  // Health check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        service: "create-subscription",
        version: "1.0.0",
        status: "ready",
        configured: {
          azure: !!(AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET),
          supabase: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
        },
        webhook_url: WEBHOOK_URL,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  // Simple auth check - require INTERNAL_API_KEY for POST
  const apiKey = req.headers.get("x-api-key");
  if (!INTERNAL_API_KEY || apiKey !== INTERNAL_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body: CreateSubscriptionRequest = await req.json();

    if (!body.email_postfach) {
      return new Response(
        JSON.stringify({ error: "Missing required field: email_postfach" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const folders = body.folders || ["inbox", "sentitems"];
    console.log(`[CREATE] Processing request for ${body.email_postfach}, folders: ${folders.join(", ")}`);

    const accessToken = await getAccessToken();
    const results: Array<{ folder: string; status: string; subscription_id?: string; error?: string }> = [];

    for (const folder of folders) {
      try {
        // Check if subscription already exists
        const exists = await checkExistingSubscription(body.email_postfach, folder);
        if (exists) {
          console.log(`[CREATE] Subscription for ${folder} already exists, skipping`);
          results.push({ folder, status: "skipped", error: "Already exists" });
          continue;
        }

        // Create new subscription
        const subscription = await createGraphSubscription(accessToken, body.email_postfach, folder);
        await saveSubscription(body.email_postfach, subscription);
        results.push({ folder, status: "created", subscription_id: subscription.id });
      } catch (error) {
        console.error(`[CREATE] Error for ${folder}: ${error}`);
        results.push({ folder, status: "error", error: String(error) });
      }
    }

    const successCount = results.filter(r => r.status === "created").length;
    const errorCount = results.filter(r => r.status === "error").length;

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        email_postfach: body.email_postfach,
        created: successCount,
        errors: errorCount,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[CREATE] Fatal error: ${error}`);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});