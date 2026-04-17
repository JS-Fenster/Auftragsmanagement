// =============================================================================
// External Services Check - INFRA-026 Phase 5 + 5b
// Version: 2.0 - 2026-04-17 (Incident Tracking + Flapping Detection)
// =============================================================================
// Polls public status pages (statuspage.io format) of critical external services
// and fires notifications when any service reports degradation.
//
// Triggered by pg_cron hourly. Self-heartbeats via public.heartbeat() RPC.
//
// Phase 5b additions:
//   - Opens/closes entries in infra_incidents table (permanent history)
//   - Interval-dependent flapping detection (hourly services: >3 incidents/24h → alert)
//   - "Nächster Schritt" guidance in notification body
//
// Status indicators (statuspage.io standard):
//   "none"     = all systems operational → close incident, archive notifications
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
  check_interval_seconds: number;  // how often we poll this service
}

// Anthropic entfernt: AM ruft Claude API nicht zur Laufzeit auf → kein Business-Impact → irreführend in Bell
const SERVICES: ServiceCheck[] = [
  { name: "supabase",   display: "Supabase",      url: "https://status.supabase.com/api/v2/status.json",      check_interval_seconds: 3600 },
  { name: "cloudflare", display: "Cloudflare",    url: "https://www.cloudflarestatus.com/api/v2/status.json", check_interval_seconds: 3600 },
  { name: "openai",     display: "OpenAI",        url: "https://status.openai.com/api/v2/status.json",        check_interval_seconds: 3600 },
  { name: "github",     display: "GitHub",        url: "https://www.githubstatus.com/api/v2/status.json",     check_interval_seconds: 3600 },
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

// Interval-abhängige Flapping-Schwelle
// Hourly check (3600s): >3 Incidents in 24h → Flapping
// Daily check   (86400s): >3 Incidents in 7d  → Flapping
// Weekly check  (604800s): >2 Incidents in 30d → Flapping
function flappingThreshold(intervalSeconds: number): { count: number; windowHours: number } {
  if (intervalSeconds <= 3600)   return { count: 3, windowHours: 24 };
  if (intervalSeconds <= 86400)  return { count: 3, windowHours: 24 * 7 };
  return { count: 2, windowHours: 24 * 30 };
}

// "Nächster Schritt"-Hinweis pro Service-Kategorie
function nextStepHint(category: string): string {
  switch (category) {
    case "external_service":
      return "Externer Dienst — nur beobachten. Auto-Resolve wenn wieder OK. Bei Flapping-Alert: Dienst-Status-Seite prüfen + Root Cause bewerten.";
    default:
      return "";
  }
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: { service: string; indicator: string; description: string }[] = [];
  const alerts: string[] = [];
  const flappingAlerts: string[] = [];

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
        // === Service is DOWN ===

        // 1. Incident öffnen (falls nicht schon offen)
        const { data: openIncident } = await supabase
          .from("infra_incidents")
          .select("id")
          .eq("service_name", svc.name)
          .is("ended_at", null)
          .limit(1);

        if (!openIncident || openIncident.length === 0) {
          const { error: insertErr } = await supabase.from("infra_incidents").insert({
            service_name: svc.name,
            category: "external_service",
            severity: severityFor(indicator),
            description: `${svc.display}: ${description}`,
            metadata: { indicator, status_url: svc.url.replace("/api/v2/status.json", ""), check_interval_seconds: svc.check_interval_seconds },
          });
          if (insertErr) console.error(`[external-services-check] insert incident failed: ${insertErr.message}`);
        }

        // 2. Flapping-Check: Wie viele Incidents gab es im konfigurierten Zeitfenster?
        const thr = flappingThreshold(svc.check_interval_seconds);
        const windowStart = new Date(Date.now() - thr.windowHours * 3600 * 1000).toISOString();

        const { count: recentCount } = await supabase
          .from("infra_incidents")
          .select("id", { count: "exact", head: true })
          .eq("service_name", svc.name)
          .gte("started_at", windowStart);

        const isFlapping = (recentCount ?? 0) > thr.count;

        // 3. Notification: Normal oder Flapping-Sonderfall
        // Dedupe: 1 Notification pro Service pro 2h
        const { data: recent } = await supabase
          .from("notifications")
          .select("id")
          .eq("source", "infra_health")
          .contains("metadata", { external_service: svc.name })
          .gte("created_at", new Date(Date.now() - 2 * 3600 * 1000).toISOString())
          .limit(1);

        if (!recent || recent.length === 0) {
          const hint = nextStepHint("external_service");
          const flapSuffix = isFlapping
            ? `\n\n⚠️ FLAPPING: ${recentCount} Incidents in den letzten ${thr.windowHours}h → Wiederkehrender Bug! Root Cause prüfen.`
            : "";
          const body = `Externer Status-Indicator: ${indicator}\nStatus-Seite: ${svc.url.replace("/api/v2/status.json", "")}\n\n${hint}${flapSuffix}`;

          await supabase.rpc("notify", {
            p_type:     isFlapping ? "error" : typeFor(indicator),
            p_severity: isFlapping ? "high" : severityFor(indicator),
            p_source:   "infra_health",
            p_title:    isFlapping
              ? `${svc.display} flappt (${recentCount}× in ${thr.windowHours}h)`
              : `${svc.display}: ${description}`,
            p_body:     body,
            p_metadata: {
              external_service: svc.name,
              indicator,
              description,
              status_url: svc.url.replace("/api/v2/status.json", ""),
              flapping: isFlapping,
              recent_incident_count: recentCount,
              flap_window_hours: thr.windowHours,
            },
          });
          alerts.push(`${svc.name}:${indicator}`);
          if (isFlapping) flappingAlerts.push(`${svc.name}:${recentCount}/${thr.windowHours}h`);
        }
      } else {
        // === Service is UP ===

        // 1. Offenes Incident schließen
        const { data: openIncidents } = await supabase
          .from("infra_incidents")
          .select("id")
          .eq("service_name", svc.name)
          .is("ended_at", null);

        if (openIncidents && openIncidents.length > 0) {
          const incidentIds = openIncidents.map(i => i.id);
          await supabase.from("infra_incidents").update({ ended_at: new Date().toISOString() }).in("id", incidentIds);
          console.log(`[external-services-check] ${svc.name}: closed ${incidentIds.length} incident(s)`);
        }

        // 2. Offene Notifications archivieren (Bell bereinigen)
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
    p_detail: { services_checked: results.length, alerts_fired: alerts.length, flapping: flappingAlerts.length },
  });

  return new Response(
    JSON.stringify({ status: "ok", results, alerts_fired: alerts, flapping: flappingAlerts }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
