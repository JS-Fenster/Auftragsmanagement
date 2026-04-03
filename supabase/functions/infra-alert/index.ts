// =============================================================================
// Infra Alert - Webhook endpoint for infrastructure alerts
// Version: 1.0 - 2026-04-03
// =============================================================================
// Receives alerts from external sources (PowerShell backup scripts, Synology NAS,
// Veeam, GitHub Actions) and routes them to the AM NotificationBell via notify().
//
// Auth: INTERNAL_API_KEY (x-api-key header or Bearer token)
// No CORS needed (server-to-server only, no browser calls)
//
// Sources:
//   sql_backup    - FullDBBackup.ps1 (Full/Diff failures, Watchdog repairs)
//   wot_backup    - wotBackupScript.ps1 (WOT Sybase backup failures)
//   veeam         - Veeam Backup job failures
//   nas           - Synology DSM (disk, SMART, updates, Hyper Backup)
//   github_action - GitHub Actions (deploy/sync failures)
//   cloudflare    - Tunnel offline, SSL issues
//   infra_health  - Uptime/health pings
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { notify } from "../_shared/notify.ts";

const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");

// Valid sources for infra alerts
const VALID_SOURCES = [
  "sql_backup",
  "wot_backup",
  "veeam",
  "nas",
  "github_action",
  "cloudflare",
  "infra_health",
  "w4a_sync",
] as const;

const VALID_TYPES = ["info", "warning", "error", "success"] as const;
const VALID_SEVERITIES = ["low", "medium", "high", "critical"] as const;

interface InfraAlertPayload {
  source: string;
  title: string;
  body?: string;
  type?: string;
  severity?: string;
  metadata?: Record<string, unknown>;
}

function isAuthorized(req: Request): boolean {
  if (!INTERNAL_API_KEY) return false;
  const authHeader = req.headers.get("authorization") || "";
  const apiKey = req.headers.get("x-api-key") || "";
  return (
    authHeader === `Bearer ${INTERNAL_API_KEY}` ||
    apiKey === INTERNAL_API_KEY
  );
}

function validatePayload(
  payload: unknown
): { valid: true; data: InfraAlertPayload } | { valid: false; error: string } {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Request body must be JSON object" };
  }

  const p = payload as Record<string, unknown>;

  if (!p.source || typeof p.source !== "string") {
    return { valid: false, error: "Missing required field: source" };
  }

  if (!VALID_SOURCES.includes(p.source as typeof VALID_SOURCES[number])) {
    return {
      valid: false,
      error: `Invalid source: ${p.source}. Valid: ${VALID_SOURCES.join(", ")}`,
    };
  }

  if (!p.title || typeof p.title !== "string") {
    return { valid: false, error: "Missing required field: title" };
  }

  if (p.title.length > 200) {
    return { valid: false, error: "title too long (max 200 chars)" };
  }

  if (p.body && typeof p.body === "string" && p.body.length > 2000) {
    return { valid: false, error: "body too long (max 2000 chars)" };
  }

  if (p.type && !VALID_TYPES.includes(p.type as typeof VALID_TYPES[number])) {
    return {
      valid: false,
      error: `Invalid type: ${p.type}. Valid: ${VALID_TYPES.join(", ")}`,
    };
  }

  if (
    p.severity &&
    !VALID_SEVERITIES.includes(p.severity as typeof VALID_SEVERITIES[number])
  ) {
    return {
      valid: false,
      error: `Invalid severity: ${p.severity}. Valid: ${VALID_SEVERITIES.join(", ")}`,
    };
  }

  return {
    valid: true,
    data: {
      source: p.source as string,
      title: p.title as string,
      body: typeof p.body === "string" ? p.body : undefined,
      type: typeof p.type === "string" ? p.type : "error",
      severity: typeof p.severity === "string" ? p.severity : "high",
      metadata:
        p.metadata && typeof p.metadata === "object"
          ? (p.metadata as Record<string, unknown>)
          : undefined,
    },
  };
}

Deno.serve(async (req: Request) => {
  // No CORS needed - server-to-server only
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auth check
  if (!isAuthorized(req)) {
    console.warn("[infra-alert] Unauthorized request");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const validation = validatePayload(payload);

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { data } = validation;

    console.log(
      `[infra-alert] ${data.source}: ${data.title} (${data.severity})`
    );

    const notificationId = await notify({
      type: data.type as "info" | "warning" | "error" | "success",
      severity: data.severity as "low" | "medium" | "high" | "critical",
      source: data.source,
      title: data.title,
      body: data.body,
      metadata: {
        ...data.metadata,
        alert_source: "infra-alert",
      },
    });

    if (!notificationId) {
      console.error("[infra-alert] notify() returned null");
      return new Response(
        JSON.stringify({ error: "Failed to create notification" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        notification_id: notificationId,
        source: data.source,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error(`[infra-alert] Exception: ${err}`);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
