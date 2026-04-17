// =============================================================================
// External Services Check - INFRA-026 Phase 5
// Version: 1.0 - 2026-04-17
// =============================================================================
// Polls public status pages (statuspage.io format) of critical external services
// and fires notifications when any service reports degradation.
//
// Triggered by pg_cron hourly. Self-heartbeats via public.heartbeat() RPC.
//
// Status indicators (statuspage.io standard):
//   "none"     = all systems operational → no alert
//   "minor"    = minor service outage → warning
//   "major"    = major service outage → error
//   "critical" = critical service outage → error + critical severity
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ServiceCheck {
  name: string;
  display: string;
  url: string;
}

const SERVICES: ServiceCheck[] = [
  { name: "supabase",   display: "Supabase",          url: "https://status.supabase.com/api/v2/status.json" },
  { name: "cloudflare", display: "Cloudflare",        url: "https://www.cloudflarestatus.com/api/v2/status.json" },
  { name: "openai",     display: "OpenAI",            url: "https://status.openai.com/api/v2/status.json" },
  { name: "github",     display: "GitHub",            url: "https://www.githubstatus.com/api/v2/status.json" },
  { name: "anthropic",  display: "Anthropic (Claude)", url: "https://status.anthropic.com/api/v2/status.json" },
];

interface StatusPageResponse {
  status: { indicator: string; description: string };
}

function severityFor(indicator: string): string {
  switch (indicator) {
    case "critical": return "critical";
    case "major":    return "high";
    case "minor":    return "medium";
    case "maintenance": return "low";
    default:         return "low";
  }
}

function typeFor(indicator: string): string {
  return indicator === "minor" || indicator === "maintenance" ? "warning" : "error";
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: { service: string; indicator: string; description: string }[] = [];
  const alerts: string[] = [];

  for (const svc of SERVICES) {
    try {
      const resp = await fetch(svc.url, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) {
        console.warn(`[external-services-check] ${svc.name}: HTTP ${resp.status}`);
        continue;
      }
      const json = (await resp.json()) as StatusPageResponse;
      const indicator = json.status?.indicator || "unknown";
      const description = json.status?.description || "no description";
      results.push({ service: svc.name, indicator, description });

      if (indicator !== "none") {
        // Only notify once per service per 2h (dedupe)
        const { data: recent } = await supabase
          .from("notifications")
          .select("id")
          .eq("source", "infra_health")
          .contains("metadata", { external_service: svc.name })
          .gte("created_at", new Date(Date.now() - 2 * 3600 * 1000).toISOString())
          .limit(1);

        if (!recent || recent.length === 0) {
          await supabase.rpc("notify", {
            p_type:     typeFor(indicator),
            p_severity: severityFor(indicator),
            p_source:   "infra_health",
            p_title:    `${svc.display}: ${description}`,
            p_body:     `External service status indicator: ${indicator}. Check ${svc.url.replace("/api/v2/status.json", "")}`,
            p_metadata: { external_service: svc.name, indicator, description, status_url: svc.url.replace("/api/v2/status.json", "") },
          });
          alerts.push(`${svc.name}:${indicator}`);
        }
      } else {
        // Auto-resolve: Service back to OK → archive open warnings for this service
        const { data: openAlerts } = await supabase
          .from("notifications")
          .select("id")
          .eq("source", "infra_health")
          .eq("archived", false)
          .contains("metadata", { external_service: svc.name });

        if (openAlerts && openAlerts.length > 0) {
          const ids = openAlerts.map(n => n.id);
          await supabase.from("notifications").update({ read: true, archived: true }).in("id", ids);
          console.log(`[external-services-check] ${svc.name}: auto-resolved ${ids.length} open alerts`);
        }
      }
    } catch (err) {
      console.error(`[external-services-check] ${svc.name} error: ${err}`);
    }
  }

  // Self-heartbeat
  await supabase.rpc("heartbeat", {
    p_name: "ef_external_services_check",
    p_status: "ok",
    p_detail: { services_checked: results.length, alerts_fired: alerts.length },
  });

  return new Response(
    JSON.stringify({ status: "ok", results, alerts_fired: alerts }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
