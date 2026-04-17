// =============================================================================
// TLS Certificate Watchdog - INFRA-027b
// Version: 1.0 - 2026-04-17
// =============================================================================
// For every row in public.expiring_items with category = 'tls_cert',
// opens a TLS connection to metadata.host:metadata.port (default 443),
// reads the peer certificate's valid_to and updates expires_at.
//
// The existing check_expiring_items() pg_cron job does the actual notification
// (30d warning, error when past).
//
// Adding a host to track:
//   INSERT INTO public.expiring_items
//     (name, category, warn_days_before, severity, description, metadata)
//   VALUES
//     ('dashboard.js-fenster.de', 'tls_cert', 14, 'high',
//      'Dashboard public endpoint', '{"host":"dashboard.js-fenster.de","port":443}'::jsonb);
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { connect as tlsConnect } from "node:tls";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getCertExpiry(host: string, port: number): Promise<Date> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

    const socket = tlsConnect(
      { host, port, servername: host, rejectUnauthorized: false, timeout: 10000 },
      () => {
        try {
          // deno-lint-ignore no-explicit-any
          const cert = (socket as any).getPeerCertificate();
          socket.end();
          if (!cert || !cert.valid_to) {
            settle(() => reject(new Error("no peer certificate")));
            return;
          }
          settle(() => resolve(new Date(cert.valid_to)));
        } catch (err) {
          settle(() => reject(err));
        }
      }
    );
    socket.on("error", (err: Error) => settle(() => reject(err)));
    socket.setTimeout(10000, () => {
      socket.destroy();
      settle(() => reject(new Error("tls handshake timeout")));
    });
  });
}

interface TlsRow {
  id: number;
  name: string;
  metadata: { host?: string; port?: number } | null;
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
  let ok = 0, fail = 0;

  for (const row of (rows ?? []) as TlsRow[]) {
    const host = row.metadata?.host ?? row.name;
    const port = row.metadata?.port ?? 443;
    try {
      const expiry = await getCertExpiry(host, port);
      const isoDate = expiry.toISOString().slice(0, 10); // YYYY-MM-DD for date column
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

  // Self-heartbeat
  await supabase.rpc("heartbeat", {
    p_name: "ef_tls_cert_check",
    p_status: fail === 0 ? "ok" : (ok > 0 ? "warning" : "error"),
    p_detail: { checked: results.length, ok, failed: fail },
  });

  return new Response(
    JSON.stringify({ status: "ok", checked: results.length, ok, failed: fail, results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
