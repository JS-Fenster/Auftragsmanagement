// =============================================================================
// TLS Certificate Watchdog - INFRA-027b
// Version: 1.1 - 2026-04-17 (crt.sh API, node:tls not available in EF runtime)
// =============================================================================
// Queries https://crt.sh for each row in expiring_items with category='tls_cert'
// and picks the most recently issued certificate matching the hostname.
// Updates expires_at so check_expiring_items() can notify 30d/14d/0d before.
//
// Why crt.sh: Supabase Edge Runtime doesn't support raw TCP (node:tls).
// crt.sh mirrors all Certificate Transparency logs — every public cert is
// visible within minutes of issuance. Reliable + free + pure HTTP.
//
// Adding a host to track:
//   INSERT INTO public.expiring_items
//     (name, category, warn_days_before, severity, description, metadata)
//   VALUES ('dashboard.js-fenster.de', 'tls_cert', 14, 'high',
//           'Dashboard public endpoint',
//           '{"host":"dashboard.js-fenster.de"}'::jsonb);
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CrtShEntry {
  common_name?: string;
  name_value?: string;
  not_before?: string;
  not_after?: string;
  id?: number;
}

// Hostname matches if it equals common_name/name_value exactly, OR if a
// wildcard cert (*.domain.tld) covers it.
function hostMatches(host: string, certName: string): boolean {
  const h = host.toLowerCase();
  const c = certName.toLowerCase().trim();
  if (c === h) return true;
  if (c.startsWith("*.")) {
    const suffix = c.slice(1); // ".domain.tld"
    return h.endsWith(suffix) && h.slice(0, -suffix.length).indexOf(".") === -1;
  }
  return false;
}

type CrtResult = { kind: "ok"; expiry: Date } | { kind: "empty" } | { kind: "no_match" };

async function crtShFetch(url: string): Promise<CrtShEntry[] | null> {
  // 1x retry bei transient errors (crt.sh ist bekannt instabil).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (resp.ok) return (await resp.json()) as CrtShEntry[];
      // 5xx/timeout → als transient behandeln, NICHT throw.
      if (resp.status >= 500 && attempt < 1) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      // Non-2xx/non-5xx oder 5xx nach Retry → transient, skip (kein Cert-Fehler).
      return null;
    } catch (_err) {
      // Timeout/Abort/Network → transient, retry once
      if (attempt < 1) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function fetchCrtShExpiry(host: string): Promise<CrtResult> {
  const url = `https://crt.sh/?q=${encodeURIComponent(host)}&output=json`;
  const entries = await crtShFetch(url);
  // null = transient error (HTTP 5xx, timeout, network) → skip, keep existing expires_at
  if (entries === null) return { kind: "empty" };
  // Empty array = crt.sh rate-limited or no results → skip silently
  if (!Array.isArray(entries) || entries.length === 0) return { kind: "empty" };

  const now = Date.now();
  const candidates = entries
    .filter(e => e.not_after && e.not_before)
    .filter(e => {
      const names = [e.common_name, ...(e.name_value ?? "").split("\n")].filter(Boolean) as string[];
      return names.some(n => hostMatches(host, n));
    })
    .map(e => ({
      not_before: new Date(e.not_before!).getTime(),
      not_after: new Date(e.not_after!).getTime(),
    }))
    .filter(e => e.not_after > now);

  if (candidates.length === 0) return { kind: "no_match" };

  candidates.sort((a, b) => b.not_before - a.not_before);
  return { kind: "ok", expiry: new Date(candidates[0].not_after) };
}

interface TlsRow {
  id: number;
  name: string;
  metadata: { host?: string } | null;
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: rows, error } = await supabase
    .from("expiring_items")
    .select("id,name,metadata")
    .eq("category", "tls_cert")
    .eq("muted", false);

  if (error) {
    console.error(`[tls-cert-check] fetch rows failed: ${error.message}`);
    return new Response(JSON.stringify({ status: "error", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const results: Array<{ name: string; status: string; expires_at?: string; error?: string }> = [];
  let ok = 0, fail = 0, skipped = 0;

  for (const row of (rows ?? []) as TlsRow[]) {
    const host = row.metadata?.host ?? row.name;
    try {
      const res = await fetchCrtShExpiry(host);

      if (res.kind === "empty") {
        // crt.sh hat nichts geliefert (Rate-Limit / temp. Ausfall). Alten expires_at behalten.
        skipped++;
        results.push({ name: row.name, status: "skipped", error: "crt.sh returned empty (rate-limit?)" });
        continue;
      }
      if (res.kind === "no_match") {
        // keine gueltigen CT-Eintraege fuer diesen Host → echter Fehler
        throw new Error("no valid certificate in CT logs for this host");
      }

      const isoDate = res.expiry.toISOString().slice(0, 10);
      const { error: upErr } = await supabase
        .from("expiring_items")
        .update({ expires_at: isoDate, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (upErr) throw new Error(`update: ${upErr.message}`);
      ok++;
      results.push({ name: row.name, status: "ok", expires_at: isoDate });
    } catch (err) {
      fail++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[tls-cert-check] ${row.name}: ${msg}`);
      results.push({ name: row.name, status: "error", error: msg });
    }
  }

  // Status: nur echte Fehler zaehlen. Empty/skipped haben keine neuen Daten,
  // aber alte Daten sind noch ok → nicht als Fehler werten.
  const hbStatus = fail === 0 ? "ok" : (ok + skipped > 0 ? "warning" : "error");
  await supabase.rpc("heartbeat", {
    p_name: "ef_tls_cert_check",
    p_status: hbStatus,
    p_detail: { checked: results.length, ok, failed: fail, skipped },
  });

  return new Response(
    JSON.stringify({ status: "ok", checked: results.length, ok, failed: fail, results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
