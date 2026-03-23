// =============================================================================
// System Health Check - Dashboard Notification Generator
// Version: 1.0 - 2026-03-13
// =============================================================================
// Periodic health checks that generate notifications for the AM dashboard.
// Intended to run via pg_cron or external scheduler (e.g., GitHub Action cron).
//
// Checks:
// 1. Email subscription expiry (< 24h remaining)
// 2. Stale email pipeline (no emails processed in 4+ hours during business hours)
// 3. Unprocessed email queue depth
// 4. Classification quality (Sonstiges rate)
// 5. Inactive email subscriptions
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { notify } from "../_shared/notify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Auth check
function isAuthorized(req: Request): boolean {
  if (!INTERNAL_API_KEY) return false;
  const authHeader = req.headers.get("authorization") || "";
  const apiKey = req.headers.get("x-api-key") || "";
  return (
    authHeader === `Bearer ${INTERNAL_API_KEY}` ||
    apiKey === INTERNAL_API_KEY
  );
}

// Check 1: Email subscriptions expiring soon
async function checkSubscriptionExpiry(): Promise<number> {
  const { data, error } = await supabase
    .from("email_subscriptions")
    .select("id, postfach, expiration_date_time")
    .gt("expiration_date_time", new Date().toISOString())
    .lt(
      "expiration_date_time",
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    )
    .eq("active", true);

  if (error || !data) return 0;

  for (const sub of data) {
    const hoursLeft = Math.round(
      (new Date(sub.expiration_date_time).getTime() - Date.now()) / 3600000
    );
    await notify({
      type: "warning",
      severity: "high",
      source: "system_health",
      title: `E-Mail Subscription laeuft in ${hoursLeft}h ab`,
      body: `Postfach: ${sub.postfach}. Automatische Erneuerung pruefen.`,
      metadata: { check: "subscription_expiry", subscription_id: sub.id },
    });
  }

  return data.length;
}

// Check 2: Stale email pipeline (no new emails in 4+ hours during business hours)
async function checkStalePipeline(): Promise<boolean> {
  const now = new Date();
  const hour = now.getUTCHours() + 1; // CET = UTC+1 (simplified)
  // Only check during business hours (8-18 CET)
  if (hour < 8 || hour > 18) return false;
  // Skip weekends
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;

  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("emails")
    .select("id", { count: "exact", head: true })
    .gt("created_at", fourHoursAgo);

  if (error) return false;

  if (count === 0) {
    await notify({
      type: "warning",
      severity: "medium",
      source: "system_health",
      title: "Keine neuen E-Mails seit 4+ Stunden",
      body: "Waehrend der Geschaeftszeiten wurden keine E-Mails verarbeitet. Email-Pipeline pruefen.",
      metadata: { check: "stale_pipeline", last_check: now.toISOString() },
    });
    return true;
  }

  return false;
}

// Check 3: Unprocessed email queue
async function checkEmailQueue(): Promise<number> {
  const { count, error } = await supabase
    .from("emails")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error || count === null) return 0;

  if (count > 20) {
    await notify({
      type: "warning",
      severity: count > 50 ? "high" : "medium",
      source: "system_health",
      title: `${count} E-Mails in Warteschlange`,
      body: "Unverarbeitete E-Mails haeufen sich. Moegliche Ursache: Edge Function Fehler oder Rate Limit.",
      metadata: { check: "email_queue", queue_depth: count },
    });
  }

  return count;
}

// Check 4: Failed email classifications (Sonstiges rate)
async function checkClassificationQuality(): Promise<void> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("emails")
    .select("kategorie")
    .gt("created_at", oneDayAgo)
    .not("kategorie", "is", null);

  if (error || !data || data.length < 10) return;

  const sonstigesCount = data.filter(
    (e) => e.kategorie === "Sonstiges"
  ).length;
  const rate = sonstigesCount / data.length;

  if (rate > 0.3) {
    await notify({
      type: "warning",
      severity: "medium",
      source: "system_health",
      title: `Hohe Sonstiges-Quote: ${Math.round(rate * 100)}%`,
      body: `${sonstigesCount} von ${data.length} E-Mails der letzten 24h als "Sonstiges" klassifiziert. KI-Klassifikation pruefen.`,
      metadata: {
        check: "classification_quality",
        rate: Math.round(rate * 100),
        total: data.length,
        sonstiges: sonstigesCount,
      },
    });
  }
}

// Check 5: Inactive email subscriptions (should never happen unnoticed)
async function checkInactiveSubscriptions(): Promise<number> {
  const { data, error } = await supabase
    .from("email_subscriptions")
    .select("id, postfach")
    .eq("active", false);

  if (error || !data || data.length === 0) return 0;

  const postfaecher = data.map((s) => s.postfach).join(", ");
  await notify({
    type: "error",
    severity: "critical",
    source: "system_health",
    title: `${data.length} E-Mail Subscription(s) inaktiv`,
    body: `Postfaecher: ${postfaecher}. Es kommen keine E-Mails mehr rein fuer diese Postfaecher.`,
    metadata: {
      check: "inactive_subscriptions",
      count: data.length,
      postfaecher: data.map((s) => s.postfach),
    },
  });

  return data.length;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const results: Record<string, unknown> = {};

  try {
    results.expiring_subscriptions = await checkSubscriptionExpiry();
    results.stale_pipeline = await checkStalePipeline();
    results.email_queue = await checkEmailQueue();
    await checkClassificationQuality();
    results.inactive_subscriptions = await checkInactiveSubscriptions();
    results.status = "ok";
  } catch (err) {
    results.status = "error";
    results.error = String(err);

    await notify({
      type: "error",
      severity: "high",
      source: "system_health",
      title: "System Health Check fehlgeschlagen",
      body: String(err).substring(0, 500),
    });
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
