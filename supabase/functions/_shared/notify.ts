// Shared notification helper for Edge Functions
// Inserts into public.notifications via Supabase client
// Usage: await notify({ title: "...", source: "scan_mailbox", type: "error" })

import { createClient } from "jsr:@supabase/supabase-js@2";

interface NotifyParams {
  type?: "info" | "warning" | "error" | "success";
  severity?: "low" | "medium" | "high" | "critical";
  source: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
}

let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!_client) {
    _client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
  }
  return _client;
}

export async function notify(params: NotifyParams): Promise<string | null> {
  try {
    const { data, error } = await getClient().rpc("notify", {
      p_type: params.type || "info",
      p_severity: params.severity || "low",
      p_source: params.source,
      p_title: params.title,
      p_body: params.body || "",
      p_metadata: params.metadata || {},
    });

    if (error) {
      console.error(`[notify] Failed: ${error.message}`);
      return null;
    }

    return data as string;
  } catch (err) {
    console.error(`[notify] Exception: ${err}`);
    return null;
  }
}
