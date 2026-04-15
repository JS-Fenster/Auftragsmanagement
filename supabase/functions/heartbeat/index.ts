// =============================================================================
// Heartbeat - Endpoint for automation "ich lebe" pings
// Version: 1.0 - 2026-04-15
// =============================================================================
// Receives heartbeat pings from automations (PowerShell scripts, GitHub Actions,
// Edge Functions) and updates public.automation_heartbeats via the heartbeat()
// RPC. Basis: INFRA-021 Heartbeat-Kern.
//
// Auth: INTERNAL_API_KEY (x-api-key header or Bearer token) - same pattern as
// infra-alert. No CORS needed (server-to-server only).
//
// Usage:
//   POST /functions/v1/heartbeat
//   Headers: x-api-key: <INTERNAL_API_KEY>, Content-Type: application/json
//   Body:    { "name": "fulldbbackup", "status": "ok", "detail": { ... } }
//
// The target row must exist in automation_heartbeats (name must be registered).
// Unknown names are silently ignored by the RPC (to avoid crashing scripts).
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VALID_STATUSES = ["ok", "warning", "error"] as const;

interface HeartbeatPayload {
  name: string;
  status?: string;
  detail?: Record<string, unknown>;
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
): { valid: true; data: HeartbeatPayload } | { valid: false; error: string } {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Request body must be JSON object" };
  }

  const p = payload as Record<string, unknown>;

  if (!p.name || typeof p.name !== "string") {
    return { valid: false, error: "Missing required field: name" };
  }

  if (p.name.length > 100) {
    return { valid: false, error: "name too long (max 100 chars)" };
  }

  if (
    p.status &&
    !VALID_STATUSES.includes(p.status as typeof VALID_STATUSES[number])
  ) {
    return {
      valid: false,
      error: `Invalid status: ${p.status}. Valid: ${VALID_STATUSES.join(", ")}`,
    };
  }

  return {
    valid: true,
    data: {
      name: p.name as string,
      status: typeof p.status === "string" ? p.status : "ok",
      detail:
        p.detail && typeof p.detail === "object"
          ? (p.detail as Record<string, unknown>)
          : undefined,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isAuthorized(req)) {
    console.warn("[heartbeat] Unauthorized request");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const validation = validatePayload(payload);

    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data } = validation;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await supabase.rpc("heartbeat", {
      p_name: data.name,
      p_status: data.status,
      p_detail: data.detail ?? null,
    });

    if (error) {
      console.error(`[heartbeat] RPC error for ${data.name}: ${error.message}`);
      return new Response(
        JSON.stringify({ error: "Failed to record heartbeat" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[heartbeat] ${data.name} status=${data.status}`);

    return new Response(
      JSON.stringify({ status: "ok", name: data.name }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error(`[heartbeat] Exception: ${err}`);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
